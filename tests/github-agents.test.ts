import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentMarkdown, githubRepository, githubSource, GitHubAgents } from '../electron/github-agents';
import { AgentProfiles } from '../electron/agent-profiles';
import { promptForProfile } from '../electron/agent-runner';

const markdown='---\nname: "Careful reviewer"\ndescription: >\n  Reviews changes\n  and explains findings.\nmodel: another-provider\ntools: Bash\n---\n# Review code\nLook for bugs.\n';
const bytes=Buffer.from(markdown),sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const commit='a'.repeat(40),tree='b'.repeat(40);
function fixture(options:{truncated?:boolean;status?:number;content?:string}={}){
  const request=vi.fn(async(url:Parameters<typeof fetch>[0],_init?:RequestInit)=>{
    const path=String(url);
    if(options.status)return new Response('',{status:options.status});
    const data=path.endsWith('/example/agents')?{default_branch:'main'}:path.includes('/commits/')?{sha:commit,commit:{tree:{sha:tree}}}:path.includes('/git/trees/')?{truncated:options.truncated??false,tree:[
      {type:'blob',mode:'100644',path:'README.md',sha,size:bytes.length},
      {type:'blob',mode:'100644',path:'.claude/agents/reviewer.md',sha,size:bytes.length},
      {type:'blob',mode:'120000',path:'symlink.md',sha,size:10},
      {type:'blob',mode:'100644',path:'node_modules/dependency/SKILL.md',sha,size:20},
      {type:'blob',mode:'100644',path:'script.sh',sha,size:20},
    ]}:{encoding:'base64',content:options.content??bytes.toString('base64')};
    return Response.json(data);
  });
  return {request,service:new GitHubAgents(request as typeof fetch)};
}

describe('GitHub agent import',()=>{
  it('accepts public repository URLs and shorthand; rejects other hosts, paths, credentials and query strings',()=>{
    expect(githubRepository('example/agents')).toBe('https://github.com/example/agents');
    expect(githubRepository(' https://github.com/example/agents.git/ ')).toBe('https://github.com/example/agents');
    for(const input of ['http://github.com/example/agents','https://evil.test/example/agents','https://github.com.evil.test/example/agents','https://token@github.com/example/agents','https://github.com/example/agents?token=x','https://github.com/example/agents/blob/main/a.md','https://github.com:8443/example/agents','file:///etc/passwd',null,{},'../agents'])expect(()=>githubRepository(input)).toThrow();
  });
  it('pins previews to the discovered blob and commit without evaluating provider metadata',async()=>{
    const {service,request}=fixture();const catalog=await service.discover({repository:'example/agents',ref:'feature/review'});
    expect(catalog.files.map(f=>f.path)).toEqual(['.claude/agents/reviewer.md','README.md']);
    expect(request.mock.calls.map(call=>String(call[0]))).toContain('https://api.github.com/repos/example/agents/commits/feature%2Freview');
    const preview=await service.preview({catalogId:catalog.id,path:catalog.files[0].path});
    expect(preview).toEqual({name:'Careful reviewer',description:'Reviews changes and explains findings.',instructions:'# Review code\nLook for bugs.',hadFrontmatter:true,source:{repository:catalog.repository,path:catalog.files[0].path,commit}});
    expect(String(request.mock.calls.at(-1)![0])).toContain(`/git/blobs/${sha}`);
    const init=(request.mock.calls[0] as unknown as [string,RequestInit])[1];expect(init.redirect).toBe('error');expect(init.headers).not.toHaveProperty('Authorization');
  });
  it('keeps imported instructions and provenance through storage, edits, restart and the actual run prompt',async()=>{
    const directory=mkdtempSync(join(tmpdir(),'theseus-github-unit-'));
    try{
      const {service}=fixture(),catalog=await service.discover({repository:'example/agents'}),preview=await service.preview({catalogId:catalog.id,path:catalog.files[0].path});
      const store=new AgentProfiles(directory),saved=store.save({...preview,githubSource:preview.source,icon:'book',color:'violet',runtime:'codex',model:null,reasoningEffort:null,memory:'none',sandbox:'read-only',timeoutSeconds:1800,folderChoice:null},null,null);
      const restored=new AgentProfiles(directory).get(saved.id);
      expect(restored.githubSource).toEqual(preview.source);expect(restored.sandbox).toBe('read-only');expect(restored.model).toBeNull();
      expect(promptForProfile('Review my changes',{profile:restored,approvalPolicy:'never',timeoutSeconds:1800})).toContain(preview.instructions);
      expect(store.save({...restored,id:saved.id,expectedUpdatedAt:saved.updatedAt,name:'My reviewer',folderChoice:null},null,null).githubSource).toEqual(preview.source);
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it.each([404,403,429,409,500])('reports recoverable GitHub errors (%i)',async status=>{
    await expect(fixture({status}).service.discover({repository:'example/agents'})).rejects.toThrow(status===404?/public repositories/:status===403||status===429?/rate limit/:status===409?/empty/:/Try again/);
  });
  it('rejects incomplete trees and preview requests for undiscovered files',async()=>{
    await expect(fixture({truncated:true}).service.discover({repository:'example/agents'})).rejects.toThrow(/too large/);
    const {service,request}=fixture(),catalog=await service.discover({repository:'example/agents'}),count=request.mock.calls.length;
    await expect(service.preview({catalogId:catalog.id,path:'../../secret.md'})).rejects.toThrow(/expired/);
    await expect(service.preview({catalogId:'forged',path:'README.md'})).rejects.toThrow(/expired/);
    expect(request.mock.calls.length).toBe(count);
  });
  it('rejects file contents that differ from the selected version',async()=>{
    const {service}=fixture({content:Buffer.from('changed').toString('base64')}),catalog=await service.discover({repository:'example/agents'});
    await expect(service.preview({catalogId:catalog.id,path:'README.md'})).rejects.toThrow(/did not match/);
  });
  it('bounds repository responses and rejects network failures',async()=>{
    await expect(new GitHubAgents((async()=>new Response('x'.repeat(9_000_001))) as typeof fetch).discover({repository:'example/agents'})).rejects.toThrow(/too large/);
    await expect(new GitHubAgents((async()=>{throw new TypeError('fetch failed');}) as typeof fetch).discover({repository:'example/agents'})).rejects.toThrow(/internet connection/);
  });
  it('handles Markdown without metadata and refuses empty, binary and oversized instructions',()=>{
    expect(agentMarkdown('# A reviewer\nReview code.','reviewer.md').name).toBe('A reviewer');
    expect(agentMarkdown('Review code.','careful-reviewer.md').name).toBe('careful reviewer');
    expect(agentMarkdown('---\nname: Reviewer\n---\nInstructions','agent.md').instructions).toBe('Instructions');
    expect(()=>agentMarkdown('---\nname: Empty\n---\n','agent.md')).toThrow(/no usable/);
    expect(()=>agentMarkdown('bad\0text','agent.md')).toThrow(/no usable/);
    expect(()=>agentMarkdown('x'.repeat(32001),'agent.md')).toThrow(/32,000/);
    expect(agentMarkdown('Never store sk-githubcredential123456789','agent.md').instructions).not.toContain('sk-githubcredential123456789');
  });
  it('validates saved provenance instead of preserving arbitrary payloads',()=>{
    expect(githubSource({repository:'example/agents',path:'agent.md',commit,token:'secret'})).toEqual({repository:'https://github.com/example/agents',path:'agent.md',commit});
    for(const source of [{repository:'example/agents',path:'../agent.md',commit},{repository:'example/agents',path:'agent.md',commit:'main'},null])expect(()=>githubSource(source)).toThrow();
  });
});
