import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, readFileSync, rmSync, symlinkSync, statSync, renameSync, linkSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as childProcess from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Research, resultUrls } from '../electron/research';
import { citationIds, validateResearchContent } from '../shared/research';
import type { AgentRun } from '../shared/bridge';
import { ResearchDraftStore } from '../src/state/research-drafts';

vi.mock('node:fs',async importOriginal=>{
  const actual=await importOriginal<typeof import('node:fs')>();
  return {...actual,renameSync:vi.fn(actual.renameSync),readSync:vi.fn(actual.readSync)};
});
vi.mock('node:child_process',async importOriginal=>{
  const actual=await importOriginal<typeof import('node:child_process')>();
  return {...actual,spawnSync:vi.fn(actual.spawnSync),spawn:vi.fn(actual.spawn)};
});

const runId='11111111-1111-4111-8111-111111111111',workspaceId='22222222-2222-4222-8222-222222222222';
const time='2026-10-29T09:00:00.000Z';
const result='# Actual findings\n\nAlpha has a 40 ms measured result [Alpha docs](https://alpha.example/docs).\n\nBeta has a 70 ms measured result https://beta.example/report.\n\n<script>hostile()</script>';
const roots:string[]=[];
// Windows reports synthetic POSIX mode bits; access follows the directory ACL.
// POSIX hosts must retain the private 0600 mode rather than merely write access.
const privateFileMode=process.platform==='win32'?0o666:0o600;
function fixture(text=result){
  const root=realpathSync(mkdtempSync(join(tmpdir(),'theseus-research-')));roots.push(root);
  const project=join(root,'project');mkdirSync(project);
  const run:AgentRun={id:runId,workspaceId,projectName:'Actual project',projectPath:project,task:'Research alpha versus beta',startedAt:time,endedAt:time,status:'completed',revision:8,output:[{sequence:1,kind:'user',text:'https://user-only.example'},{sequence:2,kind:'message',text},{sequence:3,kind:'command',text:'https://command-only.example'}],truncated:false};
  const runs=new Map([[runId,run]]),data=join(root,'data'),research=new Research(data,id=>runs.get(id));
  const get=()=>research.state({runId}).document!;
  const target=(kind:'draft'|'outline'|'comparison'='draft')=>({runId,kind,revision:get().revision});
  const generate=(kind:'draft'|'outline'|'comparison'='draft')=>research.generate(target(kind)).document!;
  return {root,project,run,runs,data,research,get,target,generate};
}
afterEach(()=>{vi.restoreAllMocks();for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});

describe('actual research provenance and artifacts',()=>{
  it.each([['draft','outline'],['outline','draft']] as const)('saves two uncanonicalized generated artifacts in %s then %s order without a refresh', (first,second)=>{
    const f=fixture();f.generate('draft');
    // Keep the actual generation response used by the panel, not a canonicalizing get().
    let current=f.generate('outline');expect(Object.keys(current.artifacts)).toEqual(['draft','outline']);
    const before=current,data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    const store=new ResearchDraftStore(storage);
    for(const kind of [first,second])store.edit(current,kind,current.artifacts[kind]!.content+`\nLocal ${kind}`);
    for(const kind of [first,second]){
      const draft=store.getSnapshot().drafts.find(d=>d.kind===kind)!;
      const saved=f.research.save(draft).document!;expect(Object.keys(saved.artifacts)).toEqual(['outline','draft']);
      store.acceptLocalChange(current,saved,kind);current=saved;
      for(const remaining of new ResearchDraftStore(storage).getSnapshot().drafts)expect(remaining).toMatchObject({revision:saved.revision,content:before.artifacts[remaining.kind]!.content+`\nLocal ${remaining.kind}`,baseContent:before.artifacts[remaining.kind]!.content});
    }
    expect(store.getSnapshot().drafts).toEqual([]);
    for(const kind of [first,second])expect(f.get().artifacts[kind]!.content).toBe(before.artifacts[kind]!.content+`\nLocal ${kind}`);
  });
  it('creates the third artifact with two local drafts from the uncanonicalized generation response',()=>{
    const f=fixture();f.generate('draft');const before=f.generate('outline');
    expect(Object.keys(before.artifacts)).toEqual(['draft','outline']);
    const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}},store=new ResearchDraftStore(storage);
    for(const kind of ['draft','outline'] as const)store.edit(before,kind,before.artifacts[kind]!.content+`\nLocal ${kind}`);
    let current=f.generate('comparison');store.acceptLocalChange(before,current,'comparison');
    expect(new ResearchDraftStore(storage).getSnapshot().drafts.map(d=>d.revision)).toEqual([current.revision,current.revision]);
    for(const kind of ['outline','draft'] as const){
      const draft=store.getSnapshot().drafts.find(d=>d.kind===kind)!;const saved=f.research.save(draft).document!;
      store.acceptLocalChange(current,saved,kind);current=saved;
      expect(f.get().artifacts[kind]!.content).toBe(before.artifacts[kind]!.content+`\nLocal ${kind}`);
    }
    expect(store.getSnapshot().drafts).toEqual([]);
  });
  it('saves all three edited artifact kinds in every order after persisted draft and Research reloads',()=>{
    const kinds=['draft','outline','comparison'] as const;
    for(const first of kinds)for(const second of kinds.filter(kind=>kind!==first)){
      const order=[first,second,kinds.find(kind=>kind!==first&&kind!==second)!],f=fixture();
      for(const kind of kinds)f.generate(kind);
      const before=f.get(),data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
      let store=new ResearchDraftStore(storage),current=before;
      for(const kind of kinds)store.edit(before,kind,before.artifacts[kind]!.content+`\nLocal ${kind}`);
      for(const [index,kind] of order.entries()){
        store=new ResearchDraftStore(storage);const draft=store.getSnapshot().drafts.find(d=>d.kind===kind)!;
        const research=new Research(f.data,id=>f.runs.get(id));
        const saved=research.save(draft).document!;store.acceptLocalChange(current,saved,kind);current=saved;
        expect(store.getSnapshot().drafts).toHaveLength(2-index);
        for(const remaining of store.getSnapshot().drafts)expect(remaining).toMatchObject({revision:saved.revision,content:before.artifacts[remaining.kind]!.content+`\nLocal ${remaining.kind}`,baseContent:before.artifacts[remaining.kind]!.content});
      }
      for(const kind of kinds)expect(f.get().artifacts[kind]!.content).toBe(before.artifacts[kind]!.content+`\nLocal ${kind}`);
    }
  });
  it('lists saved artifact metadata without generating artifacts or exposing full content',()=>{
    const f=fixture();expect(f.research.list([f.run]).artifacts).toEqual([]);
    expect(existsSync(join(f.data,'research',`${runId}.json`))).toBe(false);
    const d=f.generate('draft'),before=readFileSync(join(f.data,'research',`${runId}.json`),'utf8');
    const listed=f.research.list([f.run]);expect(listed.artifacts).toHaveLength(1);
    expect(listed.artifacts[0]).toMatchObject({runId,kind:'draft',projectName:f.run.projectName,characters:d.artifacts.draft!.content.length,citations:2});
    expect(listed.artifacts[0].preview.length).toBeLessThanOrEqual(240);
    expect(listed.artifacts[0]).not.toHaveProperty('content');
    expect(readFileSync(join(f.data,'research',`${runId}.json`),'utf8')).toBe(before);
    f.runs.delete(runId);expect(f.research.list([f.run]).artifacts).toEqual([]);
  });
  it('guards recovered draft base text and project even when a disk edit does not increment the revision',()=>{
    const f=fixture(),original=f.generate(),baseContent=original.artifacts.draft!.content;
    const request={...f.target(),baseContent,projectPath:f.project,content:baseContent+'\nLocal edits'};
    expect(()=>f.research.save({...request,projectPath:'/other-project'})).toThrow(/Research changed/);
    const path=join(f.data,'research',`${runId}.json`),external=structuredClone(original);
    external.artifacts.draft!.content=baseContent+'\nExternally changed';writeFileSync(path,JSON.stringify(external));
    expect(()=>f.research.save(request)).toThrow(/original draft is kept/);
    expect(f.get().artifacts.draft!.content).toBe(external.artifacts.draft!.content);
    expect(f.get().revision).toBe(original.revision);
    const saved=f.research.save({...request,baseContent:external.artifacts.draft!.content}).document!;
    expect(saved.artifacts.draft!.content).toBe(request.content);
  });
  it('reports damaged artifact records without overwriting them',()=>{
    const f=fixture();f.generate();const path=join(f.data,'research',`${runId}.json`);
    writeFileSync(path,'damaged');expect(f.research.list([f.run]).warning).toContain('Could not read');
    expect(readFileSync(path,'utf8')).toBe('damaged');
  });
  it('collects only actual result/page/browser links with stable deduplicated provenance and hashes',()=>{
    const f=fixture();f.run.pageSelection=[{id:workspaceId,url:'https://alpha.example/docs',title:'Selected alpha page',capturedAt:time}];
    f.run.output.push({sequence:4,kind:'system',text:'Browser · navigate https://browser.example/seen'});
    const d=f.get();expect(d.sources.map(s=>s.url)).toEqual(['https://alpha.example/docs','https://beta.example/report','https://browser.example/seen']);
    expect(d.sources[0].evidence.map(e=>e.origin)).toEqual(['selected-page','output-link']);
    expect(d.sources[0].evidence[1]).toMatchObject({sequence:2,capturedAt:time,sha256:createHash('sha256').update(result).digest('hex')});
    expect(d.sources[2].evidence[0].origin).toBe('browser-activity');expect(f.get().revision).toBe(d.revision);
    const reloaded=new Research(f.data,id=>f.runs.get(id)).state({runId}).document!;expect(reloaded).toEqual(d);expect(statSync(join(f.data,'research',`${runId}.json`)).mode&0o777).toBe(privateFileMode);
  });
  it('rejects unsupported and credential-bearing links while preserving supported URL punctuation',()=>{
    expect(resultUrls('javascript:alert(1) file:///etc/passwd https://u:password@a.example https://a.example/docs(foo). [B](https://b.example/x?q=1#z)')).toEqual(['https://a.example/docs(foo)','https://b.example/x?q=1#z']);
    expect(resultUrls('https://a.example/'+ 'a'.repeat(4096))).toEqual([]);
  });
  it('uses raw URL offsets for late linked claims while deduplicating canonical identities',()=>{
    for(const [raw,canonical] of [
      ['https://alpha.example','https://alpha.example/'],
      ['HTTPS://ALPHA.EXAMPLE:443/a/../docs','https://alpha.example/docs'],
      ['https://alpha.example/café?q=résumé','https://alpha.example/caf%C3%A9?q=r%C3%A9sum%C3%A9'],
      ['https://alpha.example/a%20b','https://alpha.example/a%20b'],
    ]){
      const text='Earlier introductory text. '.repeat(120)+`\n\nOnly alpha supports this claim: ${raw}\n\nRepeated reference: ${canonical}`;
      const f=fixture(text),d=f.get();expect(d.sources).toHaveLength(1);expect(d.sources[0].url).toBe(canonical);
      expect(d.sources[0].evidence).toHaveLength(1);expect(d.sources[0].evidence[0].excerpt).toContain(`Only alpha supports this claim: ${raw}`);
      expect(d.sources[0].evidence[0]).toMatchObject({sequence:2,sha256:createHash('sha256').update(text).digest('hex')});
      expect(f.generate('comparison').artifacts.comparison!.content).toContain('Only alpha supports this claim');
      f.run.revision++;f.run.output.push({sequence:4,kind:'message',text:`Follow-up ${canonical} and https://beta.example`});
      expect(f.get().sources.map(s=>[s.id,s.url])).toEqual([['S1',canonical],['S2','https://beta.example/']]);
      expect(f.get().sources[0].evidence[0]).toEqual(d.sources[0].evidence[0]);
    }
  });
  it('extracts editable draft, outline and evidence comparison from actual results with associated citations',()=>{
    const f=fixture();let d=f.generate();expect(d.artifacts.draft!.content).toContain('40 ms measured');expect(d.artifacts.draft!.content).toContain('[S1]');expect(d.artifacts.draft!.content).toContain('[S2]');
    d=f.generate('outline');expect(d.artifacts.outline!.content).toContain('- Actual findings');expect(d.artifacts.outline!.content).toContain('Alpha has a 40 ms');
    d=f.generate('comparison');expect(d.artifacts.comparison!.content).toContain('Result excerpt (not independently verified)');expect(d.artifacts.comparison!.content).toContain('[S2] · output 2');expect(d.artifacts.comparison!.content).not.toContain('LangGraph');
    const content=d.artifacts.draft!.content+'\n\nUser reviewed conclusion.';
    d=f.research.save({...f.target(),content}).document!;expect(d.artifacts.draft!.content).toBe(content);
    expect(new Research(f.data,id=>f.runs.get(id)).state({runId}).document!.artifacts.draft!.content).toBe(content);
    expect(()=>f.research.generate(f.target())).toThrow(/already exists/);
  });
  it('extracts the actual comparison matrix instead of inventing scores',()=>{
    const f=fixture('| Runtime | Measured latency | Source |\n| --- | --- | --- |\n| Alpha | 40 ms | https://alpha.example/docs |\n| Beta | 70 ms | https://beta.example/report |\n');
    const content=f.generate('comparison').artifacts.comparison!.content;expect(content).toContain('| Alpha | 40 ms |');expect(content).toContain('| Beta | 70 ms |');expect(citationIds(content)).toEqual(['S1','S2']);
  });
  it('does not assign selected-page citations to unrelated claims or invent missing comparison data',()=>{
    const f=fixture('An actual answer without a supporting link.');f.run.pageSelection=[{id:workspaceId,title:'Selected reference',url:'https://selected.example/',capturedAt:time}];
    expect(citationIds(f.generate().artifacts.draft!.content)).toEqual([]);expect(()=>f.generate('comparison')).toThrow(/No comparison table/);
  });
  it('preserves source IDs, prior attribution and user edits across follow-up results and trimming',()=>{
    const f=fixture();const first=f.generate();f.research.save({...f.target(),content:first.artifacts.draft!.content+'\nEdited by user.'});
    f.run.revision++;f.run.truncated=true;f.run.output=[{sequence:20,kind:'message',text:'Follow-up https://new.example/result'}];
    const d=f.get();expect(d.truncated).toBe(true);expect(d.sources.map(s=>s.id)).toEqual(['S1','S2','S3']);expect(d.sources[0].url).toBe('https://alpha.example/docs');expect(d.artifacts.draft!.content).toContain('Edited by user.');expect(d.artifacts.draft!.resultHashes).toEqual(first.artifacts.draft!.resultHashes);
  });
  it('rejects stale edits, unknown or removed citations, oversized content and cross-project storage',()=>{
    const f=fixture(),d=f.generate(),target=f.target();
    f.research.save({...target,content:d.artifacts.draft!.content+' updated'});
    expect(()=>f.research.save({...target,content:d.artifacts.draft!.content})).toThrow(/changed/);
    for(const content of ['Forged [S99]',d.artifacts.draft!.content.replace('[S1]',''),'x'.repeat(200001),'','null\0byte'])expect(()=>f.research.save({...f.target(),content})).toThrow();
    expect(()=>validateResearchContent('bad [S0]',f.get().sources)).toThrow(/Unknown citation/);
    f.run.projectPath=join(f.root,'another');expect(f.research.state({runId})).toMatchObject({document:null,warning:expect.stringMatching(/damaged/)});
  });
  it('requires actual completed results, never fixture artifacts or active snapshots',()=>{
    const f=fixture('');expect(()=>f.generate()).toThrow(/no assistant result/);
    f.run.status='running';f.run.revision++;expect(()=>f.research.generate(f.target())).toThrow(/finish/);
    const g=fixture();g.run.status='failed';expect(g.get().sources.length).toBe(2);expect(()=>g.generate()).toThrow(/successfully completed/);
    expect(()=>g.research.state({runId:workspaceId})).toThrow(/no longer exists/);expect(()=>g.research.state({runId:'../../outside'})).toThrow(/Invalid/);
  });
  it('preserves damaged, unsupported, oversized, symlink and hardlink records rather than replacing them',()=>{
    for(const variant of ['json','version','oversize','symlink','hardlink']){
      const f=fixture(),path=join(f.data,'research',`${runId}.json`);f.get();
      if(variant==='json')writeFileSync(path,'broken');
      else if(variant==='version'){const d=JSON.parse(readFileSync(path,'utf8'));d.version=9;writeFileSync(path,JSON.stringify(d));}
      else if(variant==='oversize')writeFileSync(path,'x'.repeat(3_000_001));
      else{rmSync(path);const outside=join(f.root,'outside.json');writeFileSync(outside,'OUTSIDE');if(variant==='symlink')symlinkSync(outside,path);else linkSync(outside,path);}
      const before=readFileSync(path,'utf8');expect(f.research.state({runId}).warning).toMatch(/damaged/);expect(readFileSync(path,'utf8')).toBe(before);expect(()=>f.research.generate({runId,kind:'draft',revision:1})).toThrow();
    }
  });
  it('rejects symlinked storage directories and excessive sources without persisting partial data',()=>{
    const f=fixture();mkdirSync(f.data);symlinkSync(f.project,join(f.data,'research'));expect(f.research.state({runId}).warning).toMatch(/symbolic link/);
    const g=fixture();const previous=g.get();g.run.revision++;g.run.output.push({sequence:4,kind:'message',text:Array.from({length:201},(_,i)=>`https://source-${i}.example/`).join('\n')});
    expect(g.research.state({runId}).warning).toMatch(/200 sources/);const disk=JSON.parse(readFileSync(join(g.data,'research',`${runId}.json`),'utf8'));expect(disk).toEqual(previous);
  });
  it('fails closed on malformed UTF-8 and preserves original bytes across capture, generate and save until repaired',()=>{
    for(const invalid of [Buffer.from([0xff]),Buffer.from([0xc0,0xaf]),Buffer.from([0xed,0xa0,0x80]),Buffer.from([0xe2,0x82])]){
      const f=fixture(),saved=f.generate(),target={runId,kind:'draft',revision:saved.revision},path=join(f.research.directory,`${runId}.json`);
      const valid=readFileSync(path),at=valid.indexOf(Buffer.from('Alpha has'));expect(at).toBeGreaterThan(0);
      const damaged=Buffer.concat([valid.subarray(0,at),invalid,valid.subarray(at+invalid.length)]);writeFileSync(path,damaged);
      f.run.revision++;f.research.capture(f.run);
      expect(f.research.state({runId})).toMatchObject({document:null,warning:expect.stringMatching(/damaged/)});
      expect(()=>f.research.generate({...target,kind:'outline'})).toThrow(/damaged/);
      expect(()=>f.research.save({...target,content:saved.artifacts.draft!.content+' reviewed'})).toThrow(/damaged/);
      expect(readFileSync(path)).toEqual(damaged);expect(readdirSync(f.research.directory)).toEqual([`${runId}.json`]);
      writeFileSync(path,valid);expect(f.research.state({runId}).warning).toBeUndefined();
      expect(f.research.save({...f.target(),content:saved.artifacts.draft!.content+' repaired'}).document!.artifacts.draft!.content).toContain('repaired');
    }
  });
  it('bounds reads in bytes and rejects a record that grows after its descriptor was checked',async()=>{
    const f=fixture(),saved=f.get(),path=join(f.data,'research',`${runId}.json`);
    const padded=JSON.stringify(saved).padEnd(3_000_000,' ');writeFileSync(path,padded);
    expect(f.get()).toEqual(saved);
    const actualRead=(await vi.importActual<typeof import('node:fs')>('node:fs')).readSync;let calls=0;
    vi.mocked(fs.readSync).mockImplementationOnce(((fd:number,buffer:Buffer,offset:number,length:number,position:number|null)=>{
      const size=actualRead(fd,buffer,offset,Math.min(length,64),position);calls++;
      writeFileSync(path,padded+' ');return size;
    }) as typeof fs.readSync);
    expect(f.research.state({runId}).warning).toMatch(/damaged/);expect(calls).toBe(1);
    expect(statSync(path).size).toBe(3_000_001);
  });
  it('preserves the committed record and removes the private temporary file after atomic replacement fails',()=>{
    const f=fixture(),saved=f.get(),path=join(f.data,'research',`${runId}.json`),before=readFileSync(path,'utf8');
    vi.mocked(fs.renameSync).mockImplementationOnce(()=>{throw new Error('fixture atomic replacement failed');});
    expect(()=>f.research.generate({runId,kind:'draft',revision:saved.revision})).toThrow(/atomic replacement failed/);
    expect(readFileSync(path,'utf8')).toBe(before);expect(readdirSync(f.research.directory)).toEqual([`${runId}.json`]);
    expect(f.get()).toEqual(saved);
  });
  it.skipIf(process.platform==='win32')('rejects a FIFO without a writer promptly and leaves nonregular records intact',()=>{
    const f=fixture();mkdirSync(f.research.directory,{recursive:true});const path=join(f.research.directory,`${runId}.json`);
    expect(spawnSync('mkfifo',[path]).status).toBe(0);const before=lstatSync(path);
    // Isolate the sync call: a regression to opening before checking file type
    // must fail with a timeout instead of hanging the test worker indefinitely.
    const child=spawnSync(process.execPath,['--input-type=commonjs','-e',`
      const {buildSync}=require('esbuild'),Module=require('node:module');
      const filename=${JSON.stringify(join(process.cwd(),'electron/research.ts'))};
      const source=buildSync({entryPoints:[filename],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
      const compiled=new Module(filename);compiled.filename=filename;compiled.paths=module.paths;compiled._compile(source,filename);
      const run=${JSON.stringify(f.run)},research=new compiled.exports.Research(${JSON.stringify(f.data)},()=>run);
      console.log(JSON.stringify(research.state({runId:run.id})));
    `],{timeout:2500,encoding:'utf8'});
    expect(child.error).toBeUndefined();expect(child.status,child.stderr).toBe(0);expect(JSON.parse(child.stdout)).toMatchObject({document:null,warning:expect.stringMatching(/damaged/)});
    expect(lstatSync(path).isFIFO()).toBe(true);expect(lstatSync(path).ino).toBe(before.ino);
    rmSync(path);mkdirSync(path);expect(f.research.state({runId}).warning).toMatch(/damaged/);expect(lstatSync(path).isDirectory()).toBe(true);
  });
  it.skipIf(process.platform==='win32')('bounds a deterministic regular-to-FIFO swap before descriptor open without hanging the main process',()=>{
    const f=fixture();f.get();const path=join(f.research.directory,`${runId}.json`);
    const child=spawnSync(process.execPath,['--input-type=commonjs','-e',`
      const fs=require('node:fs'),cp=require('node:child_process'),{buildSync}=require('esbuild'),Module=require('node:module');
      const filename=${JSON.stringify(join(process.cwd(),'electron/research.ts'))};
      const source=buildSync({entryPoints:[filename],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
      const compiled=new Module(filename);compiled.filename=filename;compiled.paths=module.paths;compiled._compile(source,filename);
      const record=${JSON.stringify(path)},actualOpen=fs.openSync;
      fs.openSync=function(path,...args){if(path===record){fs.openSync=actualOpen;fs.unlinkSync(record);if(cp.spawnSync('mkfifo',[record]).status!==0)throw Error('mkfifo failed');console.log('FIFO swapped before open');}return actualOpen(path,...args);};
      const run=${JSON.stringify(f.run)};console.log(JSON.stringify(new compiled.exports.Research(${JSON.stringify(f.data)},()=>run).state({runId:run.id})));
    `],{timeout:2500,encoding:'utf8'});
    expect(child.error).toBeUndefined();expect(child.status,child.stderr).toBe(0);expect(child.stdout).toContain('FIFO swapped before open');
    expect(JSON.parse(child.stdout.trim().split('\n').at(-1)!)).toMatchObject({document:null,warning:expect.stringMatching(/damaged/)});
    expect(lstatSync(path).isFIFO()).toBe(true);
  });
});

describe('explicit research publishing destination and intent',()=>{
  async function interceptExport(injection:string){
    const actual=await vi.importActual<typeof import('node:child_process')>('node:child_process');
    vi.mocked(childProcess.spawn).mockImplementationOnce(((file:string,args:string[],options:object)=>actual.spawn(file,[args[0],injection+'\n'+args[1]],options)) as typeof childProcess.spawn);
  }
  it('anchors the actual export child before creation when the selected directory is replaced before spawn',async()=>{
    const f=fixture();f.generate();const chosen=join(f.root,'chosen'),outside=join(f.root,'outside');mkdirSync(chosen);mkdirSync(outside);
    const path=join(chosen,'export.md'),target=f.target(),receipt=await f.research.destination(target,async()=>path);
    const actual=await vi.importActual<typeof import('node:child_process')>('node:child_process');
    vi.mocked(childProcess.spawn).mockImplementationOnce(((...args:Parameters<typeof childProcess.spawn>)=>{renameSync(chosen,chosen+'-old');symlinkSync(outside,chosen,process.platform==='win32'?'junction':'dir');return actual.spawn(...args);}) as typeof childProcess.spawn);
    await expect(f.research.publish({...target,token:receipt!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/folder changed/);
    expect(readdirSync(outside)).toEqual([]);expect(readdirSync(chosen+'-old')).toEqual([]);
  });
  it('keeps creation and cleanup in the pinned parent across final-open parent and ancestor swaps',async()=>{
    for(const ancestor of [false,true]){
      const f=fixture();f.generate();const tree=join(f.root,'tree'),chosen=join(tree,'chosen'),outside=join(f.root,'outside');mkdirSync(chosen,{recursive:true});mkdirSync(outside);if(ancestor)mkdirSync(join(outside,'chosen'));
      const swapped=ancestor?tree:chosen,path=join(chosen,'export.md'),target=f.target(),receipt=await f.research.destination(target,async()=>path);
      await interceptExport(`
        const fixtureFs=require('node:fs'),originalOpen=fixtureFs.openSync;
        fixtureFs.openSync=function(name,...args){
          if(name==='./export.md'){
            fixtureFs.openSync=originalOpen;
            try{fixtureFs.renameSync(${JSON.stringify(swapped)},${JSON.stringify(swapped+'-old')});fixtureFs.symlinkSync(${JSON.stringify(outside)},${JSON.stringify(swapped)},process.platform==='win32'?'junction':'dir');}
            catch(error){throw Error('fixture parent swap blocked by OS: '+error.code);}
          }
          return originalOpen(name,...args);
        };
      `);
      await expect(f.research.publish({...target,token:receipt!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/folder changed|fixture parent swap blocked by OS/);
      expect(readdirSync(ancestor?join(outside,'chosen'):outside)).toEqual([]);
      expect(readdirSync(existsSync(swapped+'-old')?(ancestor?join(swapped+'-old','chosen'):swapped+'-old'):chosen)).toEqual([]);
    }
  });
  it('cleans up failed actual-child writes and preserves a concurrent destination without overwriting it',async()=>{
    for(const failure of ['write','timeout','collision']){
      const f=fixture();f.generate();const chosen=join(f.root,'chosen');mkdirSync(chosen);const path=join(chosen,'export.md'),target=f.target(),receipt=await f.research.destination(target,async()=>path);
      await interceptExport(failure!=='collision'?`
        const fixtureCp=require('node:child_process'),originalSpawn=fixtureCp.spawnSync;
        fixtureCp.spawnSync=function(file,args,options){return originalSpawn(file,[args[0],${JSON.stringify(failure==='write'?"require('node:fs').writeFileSync(3,'partial output');throw Error('fixture write failed');":"setInterval(()=>{},1000);")}],{...options,timeout:${failure==='timeout'?100:5000}});};
      `:`
        const fixtureFs=require('node:fs'),originalOpen=fixtureFs.openSync;
        fixtureFs.openSync=function(name,...args){if(name==='./export.md'){fixtureFs.openSync=originalOpen;fixtureFs.writeFileSync(name,'DO NOT OVERWRITE');}return originalOpen(name,...args);};
      `);
      let ticks=0;const pulse=setInterval(()=>ticks++,10);
      try{await expect(f.research.publish({...target,token:receipt!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(failure==='write'?/fixture write failed/:failure==='timeout'?/ETIMEDOUT/:/already exists/);}finally{clearInterval(pulse);}
      if(failure==='timeout')expect(ticks).toBeGreaterThan(0);
      if(failure!=='collision')expect(readdirSync(chosen)).toEqual([]);else expect(readFileSync(path,'utf8')).toBe('DO NOT OVERWRITE');
    }
  });
  it('requires explicit destination plus intent, supports cancellation, and exports saved text/citations/provenance',async()=>{
    const f=fixture();f.generate();const path=join(f.root,'publication.md'),target=f.target();
    expect(await f.research.destination(target,async()=>null)).toBeNull();
    const selected=await f.research.destination(target,async()=>path);expect(existsSync(path)).toBe(false);
    await expect(f.research.publish({...target,token:selected!.token},async()=>true)).rejects.toThrow(/intent/);
    expect(await f.research.publish({...target,token:selected!.token,intent:'export-markdown'},async()=>false)).toEqual({state:'cancelled'});expect(existsSync(path)).toBe(false);
    await expect(f.research.publish({...target,token:selected!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/expired/);
    const next=await f.research.destination(target,async()=>path);
    expect(await f.research.publish({...target,token:next!.token,intent:'export-markdown'},async(p,kind)=>p===path&&kind==='draft')).toEqual({state:'exported',path});
    const text=readFileSync(path,'utf8');expect(text).toContain('40 ms measured');expect(text).toContain('[S1]: <https://alpha.example/docs>');expect(text).toContain('SHA-256');expect(text).toContain(runId);expect(text).toContain('not been independently verified');
    expect(statSync(path).mode&0o777).toBe(privateFileMode);
  });
  it('rejects renderer paths, forged/expired/wrong-kind receipts, deleted runs and changed artifacts',async()=>{
    const f=fixture();f.generate();const path=join(f.root,'publication.md'),target=f.target();
    await expect(f.research.publish({...target,token:workspaceId,path,intent:'export-markdown'},async()=>true)).rejects.toThrow(/expired/);
    const selected=await f.research.destination(target,async()=>path);
    await expect(f.research.publish({...target,kind:'outline',token:selected!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/expired/);
    vi.spyOn(Date,'now').mockReturnValue(Date.now()+6*60_000);await expect(f.research.publish({...target,token:selected!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/expired/);vi.restoreAllMocks();
    const next=await f.research.destination(target,async()=>path);
    await expect(f.research.publish({...target,token:next!.token,intent:'export-markdown'},async()=>{f.research.save({...target,content:f.get().artifacts.draft!.content+' changed'});return true;})).rejects.toThrow(/changed/);expect(existsSync(path)).toBe(false);
    const last=await f.research.destination(f.target(),async()=>path);
    await expect(f.research.publish({...f.target(),token:last!.token,intent:'export-markdown'},async()=>{f.runs.delete(runId);return true;})).rejects.toThrow(/no longer exists/);expect(existsSync(path)).toBe(false);
  });
  it('does not overwrite replaced/existing/symlink/nonregular destinations, and rejects parent swaps',async()=>{
    const f=fixture();f.generate();const target=f.target(),path=join(f.root,'publication.md');
    for(const type of ['file','symlink','directory']){
      if(existsSync(path))rmSync(path,{recursive:true});const selected=await f.research.destination(target,async()=>path);
      await expect(f.research.publish({...target,token:selected!.token,intent:'export-markdown'},async()=>{
        if(type==='file')writeFileSync(path,'DO NOT OVERWRITE');else if(type==='directory')mkdirSync(path);else symlinkSync(join(f.root,'uncreated.md'),path);return true;
      })).rejects.toThrow(/already exists/);
      if(type==='file')expect(readFileSync(path,'utf8')).toBe('DO NOT OVERWRITE');
      rmSync(path,{recursive:true});
    }
    const folder=join(f.root,'export');mkdirSync(folder);const selected=await f.research.destination(target,async()=>join(folder,'new.md'));
    await expect(f.research.publish({...target,token:selected!.token,intent:'export-markdown'},async()=>{renameSync(folder,folder+'-old');symlinkSync(f.project,folder);return true;})).rejects.toThrow(/folder changed/);expect(existsSync(join(f.project,'new.md'))).toBe(false);
    for(const invalid of [join(f.root,'out.html'),'relative.md',join(folder,'new.md')])await expect(f.research.destination(target,async()=>invalid)).rejects.toThrow();
  });
  it('serializes confirmations and revalidates run progress and project identity after dialogs',async()=>{
    const f=fixture();f.generate();const target=f.target(),path=join(f.root,'publication.md');const selected=await f.research.destination(target,async()=>path);
    let accept!:(value:boolean)=>void;const confirmation=new Promise<boolean>(resolve=>{accept=resolve;});
    const first=f.research.publish({...target,token:selected!.token,intent:'export-markdown'},()=>confirmation);
    const next=await f.research.destination(target,async()=>join(f.root,'second.md'));
    await expect(f.research.publish({...target,token:next!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/already open/);
    f.run.status='running';accept(true);await expect(first).rejects.toThrow(/finish/);expect(existsSync(path)).toBe(false);
  });
  it('removes research and destination receipts when run history is deleted',async()=>{
    const f=fixture();f.generate();const target=f.target(),selected=await f.research.destination(target,async()=>join(f.root,'out.md'));f.research.delete(runId);
    expect(existsSync(join(f.data,'research',`${runId}.json`))).toBe(false);f.runs.delete(runId);
    await expect(f.research.publish({...target,token:selected!.token,intent:'export-markdown'},async()=>true)).rejects.toThrow(/no longer exists/);
  });
});
