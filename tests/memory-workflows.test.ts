import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalMemoryRepository, type MemoryWrite } from '../electron/memory-repository';
import { importGroups, mergeMemoryGraph, validateMemoryGraph, validatePortableMemory } from '../electron/memory-format';
import { extractCandidates, MemoryWorkflows } from '../electron/memory-workflows';
import { deletionImpact, duplicateMemories, semanticMemories, type PortableMemory } from '../shared/memory-workflows';
const dirs:string[]=[];
function setup(){const dir=mkdtempSync(join(tmpdir(),'theseus-memory-workflows-'));dirs.push(dir);const repo=new LocalMemoryRepository(dir);let chosen:string|undefined=join(dir,'portable.json');const service=new MemoryWorkflows(repo,dir,{openFile:async()=>chosen,saveFile:async()=>chosen,knownProject:path=>path==='/project',runTask:id=>id===runId?{task:'We prefer concise replies. We must test every change.',projectPath:'/project'}:undefined});return {dir,repo,service,path:chosen,setFile:(path?:string)=>{chosen=path;}};}
const runId=randomUUID();
const fact=(overrides:Partial<MemoryWrite>={}):MemoryWrite=>({kind:'node',nodeType:'preference',label:'Response style',meaning:'Prefer concise responses.',scope:{kind:'personal'},source:{kind:'manual',note:'Review'},...overrides});
function envelope(repo:LocalMemoryRepository):PortableMemory{return {format:'theseus-memory',version:1,demo:false,owner:{id:randomUUID(),label:'My device'},exportedAt:new Date().toISOString(),graph:repo.read()};}
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});

describe('real memory portability',()=>{
  it('round-trips all versions, project scopes, relationships, provenance, positions and owner metadata',async()=>{
    const a=setup(),b=setup(),node=a.repo.save(fact({scope:{kind:'project',projectPath:'/project'},source:{kind:'run-task',runId,excerpt:'Original task'}})),personal=a.repo.save(fact({label:'Personal'}));
    a.repo.save(fact({id:node.id,scope:node.scope,meaning:'Prefer thorough responses.'}));a.repo.save(fact({kind:'relationship',from:node.rootId,to:personal.rootId,scope:node.scope,label:'related'}));a.repo.move(node.rootId,{x:4,y:8});
    expect(await a.service.perform({action:'export',ownerLabel:'Laptop'})).toMatchObject({saved:true});
    const portable=validatePortableMemory(JSON.parse(readFileSync(a.path,'utf8')));expect(portable.graph).toEqual(a.repo.read());expect(portable.owner.label).toBe('Laptop');
    b.setFile(a.path);const preview=(await b.service.perform({action:'import'})).transfer!;expect(b.repo.read().records).toEqual([]);
    await b.service.perform({action:'apply-transfer',id:preview.id,choices:{}});expect(b.repo.read().records.map(({importedFrom,...record})=>record)).toEqual(a.repo.read().records);expect(b.repo.read().records[0].importedFrom?.ownerId).toBe(portable.owner.id);expect(b.repo.read().positions).toEqual(a.repo.read().positions);
    expect(new LocalMemoryRepository(b.dir).read()).toEqual(b.repo.read());
  });
  it('enforces FIFO watchdogs and growth byte budgets in killable production-source subprocesses',()=>{
    const probe=spawnSync(process.execPath,['tests/memory-workflows-security.mjs'],{encoding:'utf8',timeout:15000});
    expect(probe.error).toBeUndefined();expect(probe.status,probe.stderr).toBe(0);expect(probe.stdout).toContain('read 32000001 bytes');
    if(process.platform!=='win32')for(const mode of ['fifo-import','fifo-sync','race-import','race-sync'])expect(probe.stdout).toContain(`PASS ${mode}`);
  });
  it('rejects unbounded/noncanonical export, receipt and record dates atomically',async()=>{
    const {repo,service,path}=setup();repo.save(fact());const before=repo.read(),disk=readFileSync(repo.file,'utf8');
    for(const date of [' '.repeat(1_000_000)+'2026-10-29','2026-10-29','2026-02-30T00:00:00.000Z','2026-10-29T00:00:00+00:00']){
      const payload=envelope(repo);payload.exportedAt=date;writeFileSync(path,JSON.stringify(payload));await expect(service.perform({action:'import'})).rejects.toThrow(/export date/);
      const record=structuredClone(before);record.records[0].createdAt=date;expect(()=>validateMemoryGraph(record)).toThrow(/metadata/);record.records[0].createdAt=before.records[0].createdAt;record.records[0].updatedAt=date;expect(()=>validateMemoryGraph(record)).toThrow(/metadata/);
      const receipt=structuredClone(before);receipt.records[0].importedFrom={ownerId:randomUUID(),ownerLabel:'Owner',exportedAt:date};expect(()=>validateMemoryGraph(receipt)).toThrow(/provenance/);
    }
    expect(repo.read()).toEqual(before);expect(readFileSync(repo.file,'utf8')).toBe(disk);
  });
  it('preflights a real 5,000-record UTF-8 receipt footprint before amplified serialization and leaves the store untouched',async()=>{
    const {repo,service,path}=setup(),template=repo.save(fact({meaning:'界'.repeat(1900)}));
    const payload=envelope(repo);payload.owner.label='界'.repeat(100);
    payload.graph.records=[template,...Array.from({length:4999},()=>{const id=randomUUID();return {...template,id,rootId:id};})];
    const raw=JSON.stringify(payload),origin={ownerId:payload.owner.id,ownerLabel:payload.owner.label,exportedAt:payload.exportedAt};
    expect(Buffer.byteLength(raw)).toBeLessThan(32_000_000);
    const projected=payload.graph.records.reduce((bytes,r)=>bytes+Buffer.byteLength(JSON.stringify(r.id===template.id?r:{...r,importedFrom:origin}))+1,0);
    expect(projected).toBeGreaterThan(32_000_000);writeFileSync(path,raw);
    const before=repo.read(),disk=readFileSync(repo.file,'utf8'),preview=(await service.perform({action:'import'})).transfer!;
    const stringify=JSON.stringify;let stampedSerializations=0;
    const spy=vi.spyOn(JSON,'stringify').mockImplementation(((value:unknown,...args:unknown[])=>{if((value as {importedFrom?:{ownerId:string}})?.importedFrom?.ownerId===origin.ownerId)stampedSerializations++;return Reflect.apply(stringify,JSON,[value,...args]);}) as typeof JSON.stringify);
    try{await expect(service.perform({action:'apply-transfer',id:preview.id,choices:{}})).rejects.toThrow(/exceeds 32 MB/);}finally{spy.mockRestore();}
    expect(stampedSerializations).toBe(0);expect(repo.read()).toEqual(before);expect(readFileSync(repo.file,'utf8')).toBe(disk);
  });
  it('reviews layout-only moves and removals, applies either choice, and keeps repeated pulls/exports stable',async()=>{
    const {repo,service,path}=setup(),node=repo.save(fact());repo.move(node.rootId,{x:1,y:2});
    const payload=envelope(repo);payload.graph.positions[node.rootId]={x:900,y:800};writeFileSync(path,JSON.stringify(payload));
    let preview=(await service.perform({action:'sync-connect'})).transfer!;
    expect(preview.groups[0]).toMatchObject({status:'conflict',layout:{local:{x:1,y:2},incoming:{x:900,y:800}}});
    await expect(service.perform({action:'apply-transfer',id:preview.id,choices:{}})).rejects.toThrow(/every conflict/);
    await service.perform({action:'apply-transfer',id:preview.id,choices:{[node.rootId]:'local'}});expect(repo.read().positions[node.rootId]).toEqual({x:1,y:2});
    preview=(await service.perform({action:'sync-pull'})).transfer!;await service.perform({action:'apply-transfer',id:preview.id,choices:{[node.rootId]:'incoming'}});
    expect(repo.read().positions[node.rootId]).toEqual({x:900,y:800});expect((await service.perform({action:'sync-pull'})).transfer!.groups[0].status).toBe('identical');
    delete payload.graph.positions[node.rootId];writeFileSync(path,JSON.stringify(payload));preview=(await service.perform({action:'sync-pull'})).transfer!;
    expect(preview.groups[0]).toMatchObject({status:'conflict',layout:{local:{x:900,y:800}}});
    await service.perform({action:'apply-transfer',id:preview.id,choices:{[node.rootId]:'local'}});expect(repo.read().positions[node.rootId]).toEqual({x:900,y:800});
    preview=(await service.perform({action:'sync-pull'})).transfer!;await service.perform({action:'apply-transfer',id:preview.id,choices:{[node.rootId]:'incoming'}});expect(repo.read().positions[node.rootId]).toBeUndefined();
    expect((await service.perform({action:'sync-pull'})).transfer!.groups[0].status).toBe('identical');
    await service.perform({action:'export',ownerLabel:'Device'});expect(JSON.parse(readFileSync(path,'utf8')).graph.positions).toEqual({});expect(new LocalMemoryRepository(repo.directory+'/..').read()).toEqual(repo.read());
  });
  it('rejects demo envelopes, duplicate IDs, missing endpoints, malformed chains, scope promotion and unknown layouts',()=>{
    const {repo}=setup(),a=repo.save(fact()),b=repo.save(fact({label:'Second'}));repo.save(fact({kind:'relationship',from:a.rootId,to:b.rootId}));const original=envelope(repo);
    for(const mutate of [(p:PortableMemory)=>{p.demo=true as false;},(p:PortableMemory)=>{p.graph.records.push(p.graph.records[0]);},(p:PortableMemory)=>{p.graph.records.shift();},(p:PortableMemory)=>{p.graph.records[0].version=9;},(p:PortableMemory)=>{p.graph.records[0].scope={kind:'project',projectPath:'/secret'};},(p:PortableMemory)=>{p.graph.positions[randomUUID()]={x:1,y:2};}]){const broken=structuredClone(original);mutate(broken);expect(()=>validatePortableMemory(broken)).toThrow();}
    expect(()=>validatePortableMemory({version:1,mock:true,memory:{}})).toThrow(/Demo|real-memory/);
  });
  it('requires one explicit whole-lineage conflict decision and retains chosen history',()=>{
    const a=setup(),b=setup(),n=a.repo.save(fact());b.repo.replaceGraph(a.repo.read(),0);a.repo.save(fact({id:n.id,meaning:'Prefer local replies.'}));b.repo.save(fact({id:n.id,meaning:'Prefer remote replies.'}));
    const incoming=b.repo.read();expect(importGroups(a.repo.read(),incoming)[0].status).toBe('conflict');expect(()=>mergeMemoryGraph(a.repo.read(),incoming,{})).toThrow(/every conflict/);
    expect(mergeMemoryGraph(a.repo.read(),incoming,{[n.rootId]:'local'}).records).toEqual(a.repo.read().records);
    expect(mergeMemoryGraph(a.repo.read(),incoming,{[n.rootId]:'incoming'}).records).toEqual(b.repo.read().records);
  });
  it('refuses changing an existing lineage’s scope or endpoints through an import conflict',()=>{
    const {repo}=setup();repo.save(fact());const incoming=repo.read();incoming.records[0].scope={kind:'project',projectPath:'/project'};
    expect(()=>importGroups(repo.read(),incoming)).toThrow(/fixed scope/);
  });
  it('rejects stale local/file review, unknown tokens, and cancelled file dialogs without mutation',async()=>{
    const {repo,service,path,setFile}=setup();repo.save(fact());await service.perform({action:'export',ownerLabel:'Owner'});
    const first=(await service.perform({action:'import'})).transfer!;repo.save(fact({label:'New'}));await expect(service.perform({action:'apply-transfer',id:first.id,choices:{}})).rejects.toThrow(/changed/);
    const next=(await service.perform({action:'import'})).transfer!;const remote=JSON.parse(readFileSync(path,'utf8'));remote.owner.label='Different';writeFileSync(path,JSON.stringify(remote));
    await expect(service.perform({action:'apply-transfer',id:next.id,choices:{}})).rejects.toThrow(/file changed/);await expect(service.perform({action:'apply-transfer',id:randomUUID(),choices:{}})).rejects.toThrow(/expired/);
    setFile();expect(await service.perform({action:'import'})).toEqual({cancelled:true});
  });
  it('syncs only the user-chosen file, pulls without deleting local facts and requires a fresh publish review',async()=>{
    const a=setup(),b=setup();a.repo.save(fact({label:'Shared'}));await a.service.perform({action:'export',ownerLabel:'My graph'});b.repo.save(fact({label:'Local only'}));b.setFile(a.path);
    const preview=(await b.service.perform({action:'sync-connect'})).transfer!;expect(preview.owner.label).toBe('My graph');expect(b.repo.read().records).toHaveLength(1);
    await b.service.perform({action:'apply-transfer',id:preview.id,choices:{}});expect(b.repo.read().records).toHaveLength(2);expect(JSON.parse(readFileSync(a.path,'utf8')).graph.records).toHaveLength(1);
    const publish=(await b.service.perform({action:'sync-publish'})).transfer!;expect(publish.mode).toBe('sync-publish');await b.service.perform({action:'apply-transfer',id:publish.id,choices:{}});expect(JSON.parse(readFileSync(a.path,'utf8')).graph.records).toHaveLength(2);
    await b.service.perform({action:'sync-disconnect'});await expect(b.service.perform({action:'sync-pull'})).rejects.toThrow(/Choose/);
  });
});

describe('reviewed local extraction and discovery',()=>{
  it('proposes classified exact source excerpts, skips unrelated/oversized text, and never writes until reviewed',async()=>{
    const {repo,service}=setup(),review=(await service.perform({action:'extract',scope:{kind:'personal'},source:{kind:'user-text',title:'My notes',text:'I prefer brief responses.\nWe must verify each change.\nWe use TypeScript.\nIt is sunny.'}})).extraction!;
    expect(repo.read().records).toEqual([]);expect(review.candidates.map(c=>c.nodeType)).toEqual(['preference','goal','technology']);expect(review.candidates[0].source.excerpt).toBe('I prefer brief responses.');
    const c=review.candidates[0];await service.perform({action:'save-extraction',id:review.id,candidates:[{id:c.id,label:'Reviewed preference',meaning:'I prefer succinct replies.',nodeType:'preference'}]});
    expect(repo.read().records).toHaveLength(1);expect(repo.read().records[0]).toMatchObject({label:'Reviewed preference',source:{kind:'extraction',title:'My notes',excerpt:'I prefer brief responses.'}});
    expect(extractCandidates('Always '+ 'x'.repeat(1000),'Notes',{kind:'personal'},0).omitted).toBe(1);
  });
  it('keeps run-derived proposals in their original project and refuses forged or stale reviewed saves',async()=>{
    const {repo,service}=setup();await expect(service.perform({action:'extract',scope:{kind:'personal'},source:{kind:'run-task',runId}})).rejects.toThrow(/original project/);
    const review=(await service.perform({action:'extract',scope:{kind:'project',projectPath:'/project'},source:{kind:'run-task',runId}})).extraction!;expect(review.candidates[0].source.runId).toBe(runId);
    await expect(service.perform({action:'save-extraction',id:review.id,candidates:[{id:randomUUID(),label:'x',meaning:'x',nodeType:'goal'}]})).rejects.toThrow(/Unknown/);
    repo.save(fact());await expect(service.perform({action:'save-extraction',id:review.id,candidates:[review.candidates[0]]})).rejects.toThrow(/changed/);
  });
  it('does not partially commit a reviewed batch when a candidate is invalid',()=>{
    const {repo}=setup();const before=repo.read();expect(()=>repo.saveMany([fact(),fact({meaning:''})],before.revision)).toThrow();expect(repo.read()).toEqual(before);
  });
  it('bounds duplicate review for a large identical store',()=>{
    const {repo}=setup(),template=repo.save(fact()),records=Array.from({length:5000},()=>{const id=randomUUID();return {...template,id,rootId:id};});
    const result=duplicateMemories(records);expect(result.limited).toBe(true);expect(result.pairs).toHaveLength(100);expect(result.comparisons).toBeLessThanOrEqual(20000);
  });
  it('finds useful synonyms without selecting context and suggests duplicates only within matching scope',()=>{
    const {repo}=setup(),a=repo.save(fact()),b=repo.save(fact({label:'Reply preference',meaning:'Prefer brief replies.'}));repo.save(fact({scope:{kind:'project',projectPath:'/different'}}));repo.save(fact({label:'Unrelated',meaning:'Build with Rust.'}));
    expect(semanticMemories(repo.read().records,'succinct replies').map(r=>r.record.id)).toEqual(expect.arrayContaining([a.id,b.id]));expect(semanticMemories(repo.read().records,'succinct replies').some(r=>r.record.label==='Unrelated')).toBe(false);
    const duplicates=duplicateMemories(repo.read().records).pairs;expect(duplicates).toHaveLength(1);expect(duplicates[0].a.id).toBe(a.id);expect(repo.context([],'/project','personal-project')).toEqual([]);
  });
});

describe('explicit bulk deletion',()=>{
  it('deduplicates cascade impacts across selected nodes and physically purges all versions/relationships/layout',async()=>{
    const {repo,service}=setup(),a=repo.save(fact()),b=repo.save(fact({label:'B'})),keep=repo.save(fact({label:'Keep'}));const edge=repo.save(fact({kind:'relationship',from:a.rootId,to:b.rootId}));repo.save(fact({id:a.id}));repo.move(a.rootId,{x:2,y:3});
    const impact=(await service.perform({action:'delete-preview',ids:[a.id,b.id]})).impact!;expect(impact).toMatchObject({facts:2,relationships:1,versions:4,positions:1});expect(impact.records.map(r=>r.id)).toContain(edge.id);expect(repo.read().records).toHaveLength(5);
    await service.perform({action:'delete-confirm',ids:[a.id,b.id],revision:impact.revision});expect(repo.read().records).toEqual([keep]);expect(JSON.parse(readFileSync(repo.file,'utf8')).records).toEqual([keep]);
  });
  it('rejects stale or malformed bulk confirmations and does not delete independent duplicates',async()=>{
    const {repo,service}=setup(),a=repo.save(fact()),b=repo.save(fact());const impact=deletionImpact(repo.read(),[a.id]);repo.move(a.rootId,{x:1,y:1});await expect(service.perform({action:'delete-confirm',ids:[a.id],revision:impact.revision})).rejects.toThrow(/changed/);expect(repo.read().records).toHaveLength(2);
    await expect(service.perform({action:'delete-preview',ids:[a.id,a.id]})).rejects.toThrow(/distinct/);repo.deleteMany([a.id],repo.read().revision);expect(repo.read().records).toEqual([b]);
  });
});
