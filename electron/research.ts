import { createHash, randomUUID } from 'node:crypto';
import { constants, mkdirSync, lstatSync, realpathSync, openSync, fstatSync, readSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { exportResearchMarkdown } from './research-export';
import { isActiveRun, type AgentRun } from '../shared/bridge';
import { validateBrowserUrl } from '../shared/browser';
import { citationIds, researchEdit, researchKinds, researchTarget, validateResearchContent, type ResearchArtifact, type ResearchDestination, type ResearchDocument, type ResearchEvidence, type ResearchKind, type ResearchSource, type ResearchState } from '../shared/research';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const validHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const timestamp=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const noFollow=constants.O_NOFOLLOW??0;
const storageLimit=3_000_000;
const sourceLimit=200;
const unavailable='Research storage is unavailable or damaged. Existing data was preserved; check the app user-data research directory before retrying.';

/** Extract URL mentions, never treating them as a claim that a page was fetched. */
function resultLinks(text:string):{url:string;offset:number}[]{
  const links=new Map<string,{url:string;offset:number}>();
  for(const match of text.matchAll(/https?:\/\/[^\s<>"'`\u0000-\u001f]+/gi)){
    let candidate=match[0].replace(/[.,;:!?\]}]+$/,'');
    while(candidate.endsWith(')')&&(candidate.match(/\)/g)?.length??0)>(candidate.match(/\(/g)?.length??0))candidate=candidate.slice(0,-1);
    try{const url=validateBrowserUrl(candidate);if(!links.has(url))links.set(url,{url,offset:match.index});}catch{/* Unsupported or credential-bearing links never enter the collection. */}
  }
  return [...links.values()];
}
export function resultUrls(text:string):string[]{return resultLinks(text).map(link=>link.url);}
function sourceTitle(text:string,url:string):string {
  for(const match of text.matchAll(/\[([^\]\n]{1,500})\]\((https?:\/\/[^\s]+)\)/g))try{if(validateBrowserUrl(match[2])===url)return match[1];}catch{/* use hostname */}
  return new URL(url).hostname;
}
function results(run:AgentRun){return run.output.filter(entry=>entry.kind==='message'&&entry.text.trim());}
function cite(text:string,sources:ResearchSource[]):string {
  const urls=new Set(resultUrls(text));
  const refs=sources.filter(source=>urls.has(source.url)).map(source=>`[${source.id}]`).filter(ref=>!text.includes(ref));
  return `${text}${refs.length?` ${refs.join(' ')}`:''}`;
}
function tableCell(text:string){return text.replaceAll('|','\\|').replace(/\r?\n/g,'<br>');}
export function deriveArtifact(run:AgentRun,document:ResearchDocument,kind:ResearchKind):ResearchArtifact {
  if(run.status!=='completed')throw new Error('Wait for a successfully completed run before creating an artifact.');
  const entries=results(run);if(!entries.length)throw new Error('This run has no assistant result to turn into an artifact.');
  let content:string;
  if(kind==='draft')content=entries.map(entry=>entry.text.split(/\n\s*\n/).map(paragraph=>cite(paragraph,document.sources)).join('\n\n')).join('\n\n');
  else if(kind==='outline'){
    content=entries.flatMap(entry=>entry.text.split(/\n\s*\n/).filter(paragraph=>paragraph.trim()).map(paragraph=>{
      const first=paragraph.split('\n').find(line=>line.trim())!.replace(/^\s*(?:#{1,6}\s*|[-*+]\s*|\d+[.)]\s*)/,'');
      // Extract labels verbatim; citation association uses the entire originating paragraph.
      const label=first.length>500?`${first.slice(0,500)}…`:first;
      const citations=document.sources.filter(source=>resultUrls(paragraph).includes(source.url)).map(source=>`[${source.id}]`).filter(ref=>!label.includes(ref));
      return `- ${label}${citations.length?` ${citations.join(' ')}`:''}`;
    })).join('\n');
  }else{
    const tables=entries.flatMap(entry=>[...entry.text.matchAll(/(^\|?.+\|.+\n\s*\|?\s*:?-{3,}[^\n]*\n(?:[^\n]*\|[^\n]*(?:\n|$))+)/gm)].map(match=>cite(match[1].trim(),document.sources)));
    if(tables.length)content=tables.join('\n\n');
    else {
      const linked=document.sources.flatMap(source=>source.evidence.filter(evidence=>evidence.origin==='output-link'&&entries.some(entry=>entry.sequence===evidence.sequence&&hash(entry.text)===evidence.sha256)).map(evidence=>`| ${tableCell(source.title)} | ${tableCell(evidence.excerpt)} | [${source.id}] · output ${evidence.sequence} |`));
      if(!linked.length)throw new Error('No comparison table or source-linked result is present. Ask Codex for a sourced comparison, then retry.');
      content=`| Source | Result excerpt (not independently verified) | Citation / provenance |\n| --- | --- | --- |\n${linked.join('\n')}`;
    }
  }
  validateResearchContent(content,document.sources);
  return {kind,content,updatedAt:new Date().toISOString(),resultHashes:entries.map(entry=>hash(entry.text))};
}

function storedDocument(input:unknown,run:AgentRun):ResearchDocument {
  if(!input||typeof input!=='object')throw new Error(unavailable);
  const d=input as ResearchDocument;
  if(d.version!==1||d.runId!==run.id||d.projectPath!==run.projectPath||!Number.isSafeInteger(d.revision)||d.revision<1||!Number.isSafeInteger(d.runRevision)||d.runRevision<0||!timestamp(d.collectedAt)||!Array.isArray(d.sources)||d.sources.length>sourceLimit||!d.artifacts||typeof d.artifacts!=='object'||Array.isArray(d.artifacts))throw new Error(unavailable);
  const ids=new Set<string>(),urls=new Set<string>();
  const sources=d.sources.map((source,index)=>{
    if(!source||source.id!==`S${index+1}`||ids.has(source.id)||typeof source.title!=='string'||source.title.length>500||!Array.isArray(source.evidence)||!source.evidence.length||source.evidence.length>300)throw new Error(unavailable);
    const url=validateBrowserUrl(source.url);if(urls.has(url))throw new Error(unavailable);urls.add(url);ids.add(source.id);
    const evidence=source.evidence.map(e=>{
      if(!e||!['output-link','selected-page','browser-activity'].includes(e.origin)||!timestamp(e.capturedAt)||!validHash(e.sha256)||typeof e.excerpt!=='string'||e.excerpt.length>2000||e.origin==='selected-page'&&(typeof e.pageId!=='string'||!/^[a-f0-9-]{36}$/.test(e.pageId))||e.origin!=='selected-page'&&(!Number.isSafeInteger(e.sequence)||(e.sequence??0)<1))throw new Error(unavailable);
      return {origin:e.origin,capturedAt:e.capturedAt,sha256:e.sha256,excerpt:e.excerpt,...(e.origin==='selected-page'?{pageId:e.pageId}:{sequence:e.sequence})};
    });
    return {id:source.id,url,title:source.title,evidence};
  });
  const artifacts:ResearchDocument['artifacts']={};
  for(const kind of researchKinds){const artifact=d.artifacts[kind];if(!artifact)continue;
    if(artifact.kind!==kind||!timestamp(artifact.updatedAt)||!Array.isArray(artifact.resultHashes)||artifact.resultHashes.length>300||artifact.resultHashes.some(value=>!validHash(value)))throw new Error(unavailable);
    artifacts[kind]={kind,content:validateResearchContent(artifact.content,sources),updatedAt:artifact.updatedAt,resultHashes:[...artifact.resultHashes]};
  }
  return {version:1,runId:run.id,projectPath:run.projectPath,runRevision:d.runRevision,revision:d.revision,collectedAt:d.collectedAt,truncated:!!d.truncated,sources,artifacts};
}
function regularRead(path:string):string {
  const before=lstatSync(path);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>storageLimit)throw new Error(unavailable);
  const fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK|noFollow);
  try{
    const stat=fstatSync(fd);if(!stat.isFile()||stat.size>storageLimit||stat.nlink!==1||stat.ino!==before.ino||stat.dev!==before.dev)throw new Error(unavailable);
    const buffer=Buffer.alloc(storageLimit+1);let length=0,count=0;
    while(length<buffer.length&&(count=readSync(fd,buffer,length,buffer.length-length,null))>0)length+=count;
    const after=fstatSync(fd);if(!after.isFile()||after.nlink!==1||length>storageLimit||length!==stat.size||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs)throw new Error(unavailable);
    return new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,length));
  }finally{closeSync(fd);}
}
function ensureDirectory(path:string){
  mkdirSync(path,{recursive:true,mode:0o700});
  const stat=lstatSync(path);if(!stat.isDirectory()||stat.isSymbolicLink()||realpathSync(path)!==resolve(path))throw new Error('A research directory cannot be a symbolic link.');
  return stat;
}
interface Receipt extends ResearchDestination { runId:string; revision:number; kind:ResearchKind; projectPath:string; parent:{dev:number;ino:number} }

/** Main-owned source provenance and editable artifacts; no renderer-provided result data. */
export class Research {
  readonly directory:string;
  private warnings=new Map<string,string>();
  private receipts=new Map<string,Receipt>();
  private publishing=new Set<string>();
  constructor(userData:string,private getRun:(id:string)=>AgentRun|undefined){this.directory=join(userData,'research');}
  private run(input:unknown){const {runId}=researchTarget(input),run=this.getRun(runId);if(!run)throw new Error('Research run no longer exists. Refresh history.');return run;}
  private read(run:AgentRun):ResearchDocument|null {
    ensureDirectory(this.directory);
    try{return storedDocument(JSON.parse(regularRead(join(this.directory,`${run.id}.json`))),run);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw new Error(unavailable);}
  }
  private write(run:AgentRun,document:ResearchDocument){
    const safe=storedDocument(document,run),text=JSON.stringify(safe);if(Buffer.byteLength(text)>storageLimit)throw new Error('Research record exceeds 3 MB. Existing data was preserved.');
    ensureDirectory(this.directory);
    const target=join(this.directory,`${run.id}.json`),temporary=join(this.directory,`${randomUUID()}.tmp`);
    try{const existing=lstatSync(target);if(!existing.isFile()||existing.isSymbolicLink()||existing.nlink!==1)throw new Error(unavailable);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    try{
      const fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|noFollow,0o600);
      try{writeFileSync(fd,text,'utf8');fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(temporary,target);
      if(process.platform!=='win32'){const directory=openSync(this.directory,constants.O_RDONLY);try{fsyncSync(directory);}finally{closeSync(directory);}}
    }finally{try{unlinkSync(temporary);}catch{/* already renamed */}}
  }
  /** Called at terminal updates, and lazily for saved runs. Failure never changes run success. */
  capture(run:AgentRun):void {
    if(isActiveRun(run.status))return;
    try{
      const previous=this.read(run);if(previous&&previous.runRevision===run.revision){this.warnings.delete(run.id);return;}
      const now=new Date().toISOString(),document:ResearchDocument=previous??{version:1,runId:run.id,projectPath:run.projectPath,runRevision:run.revision,revision:0,collectedAt:now,truncated:run.truncated,sources:[],artifacts:{}};
      const add=(url:string,title:string,evidence:ResearchEvidence)=>{
        let source=document.sources.find(source=>source.url===url);
        if(!source){if(document.sources.length>=sourceLimit)throw new Error('Research collection exceeds 200 sources. Existing data was preserved.');source={id:`S${document.sources.length+1}`,url,title,evidence:[]};document.sources.push(source);}
        if(!source.evidence.some(e=>e.origin===evidence.origin&&e.sequence===evidence.sequence&&e.pageId===evidence.pageId&&e.sha256===evidence.sha256))source.evidence.push(evidence);
      };
      for(const page of run.pageSelection??[])add(validateBrowserUrl(page.url),page.title,{origin:'selected-page',pageId:page.id,capturedAt:page.capturedAt,sha256:hash(JSON.stringify(page)),excerpt:page.title});
      for(const entry of run.output){
        const origin=entry.kind==='message'?'output-link':entry.kind==='system'&&entry.text.startsWith('Browser · ')?'browser-activity':null;if(!origin)continue;
        for(const {url,offset} of resultLinks(entry.text)){
          const start=Math.max(0,offset-400);
          add(url,sourceTitle(entry.text,url),{origin,sequence:entry.sequence,capturedAt:run.endedAt??now,sha256:hash(entry.text),excerpt:entry.text.slice(start,start+2000)});
        }
      }
      document.runRevision=run.revision;document.revision++;document.collectedAt=now;document.truncated ||= run.truncated;
      this.write(run,document);this.warnings.delete(run.id);
    }catch(error){this.warnings.set(run.id,error instanceof Error?error.message:unavailable);}
  }
  state(input:unknown):ResearchState {
    const run=this.run(input);this.capture(run);
    try{return {document:this.read(run),...(this.warnings.has(run.id)?{warning:this.warnings.get(run.id)}:{})};}catch(error){return {document:null,warning:error instanceof Error?error.message:unavailable};}
  }
  list(runs:AgentRun[]):import('../shared/research').ResearchArtifactList {
    const artifacts:import('../shared/research').ResearchArtifactSummary[]=[];
    let failures=0;
    for(const candidate of runs){
      const run=this.getRun(candidate.id);if(!run)continue;
      try{
        const document=this.read(run);if(!document)continue;
        for(const kind of researchKinds){
          const artifact=document.artifacts[kind];if(!artifact)continue;
          artifacts.push({runId:run.id,kind,task:run.task.slice(0,160),projectName:run.projectName,updatedAt:artifact.updatedAt,characters:artifact.content.length,citations:citationIds(artifact.content).length,preview:artifact.content.slice(0,240)});
        }
      }catch{failures++;}
    }
    artifacts.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    return {artifacts,...(failures?{warning:`Could not read saved artifacts for ${failures} run(s). Existing files were preserved.`}:{})};
  }
  private editable(input:unknown){
    const request=researchEdit(input),run=this.run(request);if(isActiveRun(run.status))throw new Error('Wait for this run to finish before editing research.');
    this.capture(run);if(this.warnings.has(run.id))throw new Error(this.warnings.get(run.id));
    const document=this.read(run);if(!document||document.revision!==request.revision)throw new Error('Research changed. Refresh before editing or publishing.');
    return {request,run,document};
  }
  generate(input:unknown):ResearchState {
    const {request,run,document}=this.editable(input);
    if(document.artifacts[request.kind])throw new Error('This artifact already exists. Edit the saved text; it will not be overwritten.');
    document.artifacts[request.kind]=deriveArtifact(run,document,request.kind);document.revision++;this.write(run,document);return {document};
  }
  save(input:unknown):ResearchState {
    const {request,run,document}=this.editable(input),artifact=document.artifacts[request.kind];if(!artifact)throw new Error('Create this artifact before saving edits.');
    const draft=input as {content:unknown;baseContent?:unknown;projectPath?:unknown};
    if(draft.baseContent!==undefined&&(draft.baseContent!==artifact.content||draft.projectPath!==run.projectPath))throw new Error('Research changed. Your original draft is kept; review the current saved artifact before saving.');
    const content=validateResearchContent(draft.content,document.sources);
    // Removing a referenced source requires a deliberate citation-preserving rewrite.
    if(citationIds(artifact.content).some(id=>!citationIds(content).includes(id)))throw new Error('Keep existing citation IDs when editing so source attribution is preserved.');
    document.artifacts[request.kind]={...artifact,content,updatedAt:new Date().toISOString()};document.revision++;this.write(run,document);return {document};
  }
  async destination(input:unknown,choose:(name:string)=>Promise<string|null>):Promise<ResearchDestination|null>{
    const {request,run,document}=this.editable(input);if(!document.artifacts[request.kind])throw new Error('Create and save the artifact before choosing a destination.');
    const path=await choose(`research-${request.kind}.md`);if(!path)return null;
    this.editable(input);
    if(!isAbsolute(path)||extname(path).toLowerCase()!=='.md'||path.includes('\0'))throw new Error('Choose a new Markdown (.md) file.');
    const parent=dirname(path),stat=lstatSync(parent);if(!stat.isDirectory()||stat.isSymbolicLink()||realpathSync(parent)!==resolve(parent))throw new Error('Choose a destination without symbolic links.');
    this.assertAbsent(path);
    for(const [token,receipt] of this.receipts)if(Date.parse(receipt.expiresAt)<Date.now()||receipt.runId===run.id)this.receipts.delete(token);
    if(this.receipts.size>=100)throw new Error('Too many destinations. Finish an export or wait five minutes.');
    const receipt:Receipt={...request,token:randomUUID(),path,expiresAt:new Date(Date.now()+5*60_000).toISOString(),projectPath:run.projectPath,parent:{dev:stat.dev,ino:stat.ino}};this.receipts.set(receipt.token,receipt);
    return {token:receipt.token,path:receipt.path,expiresAt:receipt.expiresAt};
  }
  private assertAbsent(path:string){try{lstatSync(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}throw new Error('Destination already exists. Choose a new filename; research export never overwrites a file.');}
  async publish(input:unknown,confirm:(path:string,kind:ResearchKind)=>Promise<boolean>):Promise<{state:'cancelled'|'exported';path?:string}>{
    const {request,run,document}=this.editable(input),r=input as {token?:unknown;intent?:unknown};
    if(r.intent!=='export-markdown'||typeof r.token!=='string')throw new Error('Explicit Markdown export intent and a selected destination are required.');
    const receipt=this.receipts.get(r.token);
    if(!receipt||receipt.runId!==run.id||receipt.projectPath!==run.projectPath||receipt.revision!==request.revision||receipt.kind!==request.kind||Date.parse(receipt.expiresAt)<Date.now())throw new Error('Destination expired or artifact changed. Choose a destination again.');
    if(this.publishing.has(run.id))throw new Error('An export confirmation is already open for this run.');
    this.publishing.add(run.id);this.receipts.delete(receipt.token);
    try{
      if(!await confirm(receipt.path,request.kind))return {state:'cancelled'};
      this.editable(input);
      if(Date.parse(receipt.expiresAt)<Date.now())throw new Error('Destination expired. Choose a destination again.');
      const parent=lstatSync(dirname(receipt.path));if(!parent.isDirectory()||parent.isSymbolicLink()||parent.dev!==receipt.parent.dev||parent.ino!==receipt.parent.ino||realpathSync(dirname(receipt.path))!==resolve(dirname(receipt.path)))throw new Error('Destination folder changed. Choose a destination again.');
      this.assertAbsent(receipt.path);
      const artifact=document.artifacts[request.kind];if(!artifact)throw new Error('Artifact no longer exists.');
      const bibliography=document.sources.filter(source=>citationIds(artifact.content).includes(source.id)).map(source=>`[${source.id}]: <${source.url}>\n    ${source.title.replace(/[\r\n]/g,' ')} · ${source.evidence.map(e=>`${e.origin}${e.sequence?` output ${e.sequence}`:''} at ${e.capturedAt}; SHA-256 ${e.sha256}`).join('; ')}`).join('\n\n');
      const text=`${artifact.content}\n\n${bibliography?`## Sources\n\n${bibliography}\n\n`:''}---\nExported from saved run ${run.id}. Result hashes: ${artifact.resultHashes.join(', ')}.\nLinks and claims have not been independently verified.${document.truncated?' Earlier run output was trimmed; this artifact uses retained results.':''}\n`;
      await exportResearchMarkdown(receipt.path,receipt.parent,text);
      return {state:'exported',path:receipt.path};
    }finally{this.publishing.delete(run.id);}
  }
  delete(id:string){
    researchTarget({runId:id});for(const [token,receipt] of this.receipts)if(receipt.runId===id)this.receipts.delete(token);
    ensureDirectory(this.directory);try{unlinkSync(join(this.directory,`${id}.json`));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}this.warnings.delete(id);
  }
}
