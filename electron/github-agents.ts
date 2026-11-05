import { randomUUID, createHash } from 'node:crypto';
import type { GitHubAgentCatalog, GitHubAgentPreview, GitHubAgentSource } from '../shared/github-agents';
import { redact } from './codex-protocol';

const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function githubRepository(value:unknown){
  if(typeof value!=='string'||value.length>500)throw new Error('Enter a public GitHub repository URL or owner/repository.');
  const input=value.trim();
  try{
    const url=new URL(input.startsWith('https://')?input:`https://github.com/${input}`);
    if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname))throw new Error();
    const path=url.pathname.replace(/\/$/,'').replace(/\.git$/,'');
    if(path.split('/').some(part=>part==='.'||part==='..'))throw new Error();
    return `https://github.com${path}`;
  }catch{throw new Error('Enter a repository such as https://github.com/owner/repo. Use the branch field for a branch or tag.');}
}
export function githubSource(value:unknown):GitHubAgentSource{
  if(!value||typeof value!=='object')throw new Error('Invalid GitHub agent source.');
  const source=value as GitHubAgentSource;
  if(typeof source.path!=='string'||!source.path||source.path.length>1000||/[\x00-\x1f\x7f]/.test(source.path)||source.path.startsWith('/')||source.path.split('/').some(p=>!p||p==='..'||p==='.')||!hash(source.commit))throw new Error('Invalid GitHub agent source.');
  return {repository:githubRepository(source.repository),path:source.path,commit:source.commit};
}
export function agentMarkdown(text:string,path:string):Pick<GitHubAgentPreview,'name'|'description'|'instructions'|'hadFrontmatter'>{
  const metadata=text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  // Only descriptive fields are read. Provider models, permissions and tools never become app settings.
  const field=(key:string)=>{
    const match=metadata?.[1].match(new RegExp(`^${key}:\\s*([^\\r\\n]*)`,'m'));
    if(!match)return '';
    let value=match[1].trim();
    if(/^[>|][-+]?$/.test(value)){
      const rest=metadata![1].slice(match.index!+match[0].length);
      value=(rest.match(/^(?:\r?\n[ \t]+[^\r\n]*)+/)?.[0]??'').trim().replace(/\s+/g,' ');
    }
    return value.replace(/^(['"])([\s\S]*)\1$/,'$2').trim();
  };
  const instructions=redact((metadata?text.slice(metadata[0].length):text).trim());
  if(!instructions||instructions.includes('\0'))throw new Error('This file has no usable agent instructions. Choose another Markdown file.');
  if(instructions.length>32000)throw new Error('This file exceeds the 32,000-character instruction limit. Choose a smaller agent file.');
  const fallback=path.split('/').at(-1)!.replace(/\.md$/i,'').replace(/[._-]+/g,' ');
  const heading=instructions.match(/^#\s+(.+)$/m)?.[1];
  return {name:redact(field('name')||heading||fallback).slice(0,80),description:redact(field('description')).slice(0,500),instructions,hadFrontmatter:!!metadata};
}

type CatalogRecord={catalog:GitHubAgentCatalog;blobs:Map<string,string>;expires:number};
export class GitHubAgents {
  private catalogs=new Map<string,CatalogRecord>();
  private active=0;
  constructor(private request:typeof fetch=(...args)=>fetch(...args)){}
  private async json(path:string,limit=9_000_000):Promise<any>{
    if(this.active>=3)throw new Error('A GitHub request is in progress. Wait a moment and try again.');
    this.active++;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await this.request(`https://api.github.com${path}`,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Theseus-Desktop'},redirect:'error',signal:controller.signal});
      if(!response.ok){
        await response.body?.cancel();
        if(response.status===404)throw new Error('Repository or branch not found. Check the URL and branch. Only public repositories are supported.');
        if(response.status===403||response.status===429)throw new Error('GitHub has limited this request. Wait for the rate limit to reset and try again.');
        if(response.status===409)throw new Error('This repository is empty. Choose a repository with agent instructions.');
        throw new Error(`GitHub could not load this repository (${response.status}). Try again.`);
      }
      const reader=response.body?.getReader();if(!reader)throw new Error('GitHub returned an empty response. Try again.');
      const chunks:Uint8Array[]=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('This GitHub response is too large. Choose a smaller repository or agent file.');chunks.push(value);}}
      catch(error){await reader.cancel().catch(()=>{});throw error;}
      try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('GitHub returned an invalid response. Try again.');}
    }catch(error){
      if(controller.signal.aborted)throw new Error('GitHub took too long to respond. Check your connection and try again.');
      if(error instanceof TypeError)throw new Error('Could not reach GitHub. Check your internet connection and try again.');
      throw error;
    }finally{clearTimeout(timeout);this.active--;}
  }
  async discover(input:unknown):Promise<GitHubAgentCatalog>{
    if(!input||typeof input!=='object')throw new Error('Invalid repository request.');
    const request=input as {repository:unknown;ref?:unknown},repository=githubRepository(request.repository);
    if(request.ref!==undefined&&(typeof request.ref!=='string'||request.ref.length>200||/[\x00-\x1f\x7f]/.test(request.ref)))throw new Error('Use a branch or tag of at most 200 characters.');
    const endpoint=`/repos/${repository.slice('https://github.com/'.length)}`;
    const repo=await this.json(endpoint);
    const ref=(request.ref as string|undefined)?.trim()||repo.default_branch;
    if(typeof ref!=='string'||!ref)throw new Error('This repository has no default branch.');
    const commit=await this.json(`${endpoint}/commits/${encodeURIComponent(ref)}`);
    if(!hash(commit.sha)||!hash(commit.commit?.tree?.sha))throw new Error('GitHub returned an invalid commit. Try again.');
    const tree=await this.json(`${endpoint}/git/trees/${commit.commit.tree.sha}?recursive=1`);
    if(tree.truncated)throw new Error('This repository is too large to list completely. Try a smaller repository containing the agent definitions.');
    if(!Array.isArray(tree.tree))throw new Error('GitHub returned an invalid file list. Try again.');
    const entries=tree.tree.filter((entry:any)=>entry.type==='blob'&&['100644','100755'].includes(entry.mode)&&typeof entry.path==='string'&&entry.path.length<=1000&&!/[\x00-\x1f\x7f]/.test(entry.path)&&/\.md$/i.test(entry.path)&&!entry.path.split('/').some((p:string)=>['node_modules','.git','vendor'].includes(p))&&hash(entry.sha)&&Number.isSafeInteger(entry.size)&&entry.size>=0);
    const rank=(path:string)=>/(^|\/)(agents?\.md|skill\.md)$|(^|\/)\.?(claude\/)?agents?\//i.test(path)?0:/(^|\/)(readme|changelog|license|contributing|code_of_conduct)\.md$/i.test(path)?2:1;
    entries.sort((a:any,b:any)=>rank(a.path)-rank(b.path)||a.path.localeCompare(b.path));
    const selected=entries.slice(0,1000);
    const catalog:GitHubAgentCatalog={id:randomUUID(),repository,ref,commit:commit.sha,files:selected.map((e:any)=>({path:e.path,size:e.size})),omitted:entries.length-selected.length};
    for(const [id,record] of this.catalogs)if(record.expires<Date.now())this.catalogs.delete(id);
    while(this.catalogs.size>=5)this.catalogs.delete(this.catalogs.keys().next().value!);
    this.catalogs.set(catalog.id,{catalog,blobs:new Map(selected.map((e:any)=>[e.path,e.sha])),expires:Date.now()+15*60*1000});
    return structuredClone(catalog);
  }
  async preview(input:unknown):Promise<GitHubAgentPreview>{
    if(!input||typeof input!=='object')throw new Error('Choose an agent file first.');
    const {catalogId,path}=input as {catalogId:string;path:string};
    const record=this.catalogs.get(catalogId),sha=record?.blobs.get(path);
    if(!record||record.expires<Date.now()||!sha)throw new Error('This repository preview expired. Find agents again and choose a file.');
    const file=record.catalog.files.find(f=>f.path===path)!;
    if(file.size>128000)throw new Error('This file is too large. Choose a smaller agent file.');
    const endpoint=record.catalog.repository.slice('https://github.com/'.length);
    const blob=await this.json(`/repos/${endpoint}/git/blobs/${sha}`,200000);
    if(blob.encoding!=='base64'||typeof blob.content!=='string')throw new Error('GitHub returned an unsupported file encoding.');
    const bytes=Buffer.from(blob.content,'base64');
    if(bytes.length>128000||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==sha)throw new Error('The downloaded file did not match its GitHub version. Find agents again and retry.');
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('This file is not UTF-8 text. Choose another agent file.');}
    return {...agentMarkdown(text,path),source:githubSource({repository:record.catalog.repository,path,commit:record.catalog.commit})};
  }
}
