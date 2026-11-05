import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, existsSync, unlinkSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateMemoryGraph } from './memory-format';
import { deletionImpact } from '../shared/memory-workflows';
import { validId } from './agent-profiles';
import { storedMemory } from './memory-validation';
export { storedMemory, storedScope, storedSource } from './memory-validation';
import { memoryAllowed, queryMemory, sameScope, type MemoryContextItem, type MemoryGraph, type MemoryPolicy, type MemoryQuery, type MemoryRecord, type MemoryScope, type MemorySource } from '../shared/memory';
export interface MemoryWrite {id?:string;kind:'node'|'relationship';nodeType?:string;from?:string;to?:string;label:string;meaning:string;scope:MemoryScope;source:MemorySource}
// Storage/retrieval contract. A future Graphiti adapter can implement this projection without changing the view.
export interface MemoryRepository {
  read():MemoryGraph;
  query(query:MemoryQuery):MemoryRecord[];
  save(input:MemoryWrite):MemoryRecord;
  delete(id:unknown):string[];
  move(id:unknown,position:unknown):void;
  context(ids:unknown,projectPath:string,policy:MemoryPolicy):MemoryContextItem[];
}
export class LocalMemoryRepository implements MemoryRepository {
  readonly directory:string;readonly file:string;
  private graph:MemoryGraph={version:1,revision:0,records:[],positions:{}};
  private searchIndex=new Map<string,string>();
  private fatal=false;
  constructor(userData:string){
    this.directory=join(userData,'memory');this.file=join(this.directory,'graph.json');
    try{
      mkdirSync(this.directory,{recursive:true,mode:0o700});chmodSync(this.directory,0o700);
      if(existsSync(this.file)){
        if(statSync(this.file).size>32_000_000)throw new Error('Oversized store');
        const raw=JSON.parse(readFileSync(this.file,'utf8'));
        if(raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.records)||raw.records.length>5000)throw new Error('Unsupported memory store');
        this.graph=validateMemoryGraph(raw);this.reindex();
      }
    }catch{this.fatal=true;this.graph.warning='Memory storage is unavailable, damaged, or uses an unsupported format. It was left untouched. Check disk permissions or restore the memory store before restarting. Changes and memory inclusion are blocked.';}
  }
  read(){return structuredClone(this.graph);}
  query(query:MemoryQuery){
    const search=query.search?.trim().toLowerCase();
    // Derived index exists only in main memory, rebuilt from committed records; no stale disk index to purge.
    const records=search?this.graph.records.filter(r=>this.searchIndex.get(r.id)?.includes(search)):this.graph.records;
    return structuredClone(queryMemory(records,{...query,search:undefined}));
  }
  private reindex(){this.searchIndex=new Map(this.graph.records.map(r=>[r.id,`${r.label} ${r.meaning} ${r.kind==='node'?r.nodeType:'relationship'} ${r.scope.kind==='project'?r.scope.projectPath:'personal'}`.toLowerCase()]));}
  private commit(next:MemoryGraph){
    if(this.fatal)throw new Error(this.graph.warning);
    if(next.records.length>5000)throw new Error('The local memory limit is 5,000 versions. Delete unused memories before adding more.');
    const raw=JSON.stringify(next);if(Buffer.byteLength(raw)>32_000_000)throw new Error('Local memory storage limit exceeded.');
    const temporary=`${this.file}.tmp`;
    try{const fd=openSync(temporary,'w',0o600);try{writeFileSync(fd,raw,'utf8');fsyncSync(fd);}finally{closeSync(fd);}renameSync(temporary,this.file);
      if(process.platform!=='win32'){const fd=openSync(this.directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
    }catch{throw new Error('Could not save memory. Check disk space and user-data permissions. No change was acknowledged.');}
    finally{try{unlinkSync(temporary);}catch{/* absent or already committed */}}
    this.graph=next;this.reindex();
  }
  private checkEndpoints(r:Extract<MemoryRecord,{kind:'relationship'}>,records:MemoryRecord[]){
    for(const id of [r.from,r.to]){const node=records.find(n=>n.rootId===id&&n.kind==='node'&&n.status==='current');if(!node)throw new Error('Relationship endpoints must be current saved nodes.');if(node.scope.kind==='project'&&(r.scope.kind!=='project'||r.scope.projectPath!==node.scope.projectPath))throw new Error('A relationship cannot make project facts personal or connect different projects.');}
  }
  private append(next:MemoryGraph,input:MemoryWrite){
    if(this.fatal)throw new Error(this.graph.warning);
    const old=input.id?next.records.find(r=>r.id===input.id):undefined;
    if(input.id&&(!old||old.status!=='current'))throw new Error('This memory changed or was deleted. Reopen its current version before editing.');
    const now=new Date(Math.max(Date.now(),old?Date.parse(old.updatedAt)+1:0)).toISOString(),id=randomUUID();
    const record=storedMemory({kind:input.kind,nodeType:input.nodeType,from:input.from,to:input.to,label:input.label,meaning:input.meaning,scope:input.scope,source:input.source,id,rootId:old?.rootId??id,version:(old?.version??0)+1,createdAt:now,updatedAt:now,status:'current',...(old?.importedFrom?{importedFrom:old.importedFrom}:{}),...(old?{supersedesId:old.id}:{})});
    if(old&&(!sameScope(old.scope,record.scope)||old.kind!==record.kind||old.kind==='relationship'&&record.kind==='relationship'&&(old.from!==record.from||old.to!==record.to)))throw new Error('Scope and relationship endpoints are fixed. Create a new memory to change them.');
    if(record.kind==='relationship')this.checkEndpoints(record,next.records);
    if(old){old.status='superseded';old.supersededById=id;old.updatedAt=now;}
    next.records.push(record);return structuredClone(record);
  }
  save(input:MemoryWrite){return this.saveMany([input],this.graph.revision)[0];}
  saveMany(inputs:MemoryWrite[],revision:number){
    this.expectRevision(revision);const next=this.read();delete next.warning;
    const records=inputs.map(input=>this.append(next,input));next.revision++;this.commit(validateMemoryGraph(next));return records;
  }
  expectRevision(revision:unknown){if(this.fatal)throw new Error(this.graph.warning);if(revision!==this.graph.revision)throw new Error('Memory changed. Review the operation again before saving.');}
  replaceGraph(graph:MemoryGraph,revision:number){this.expectRevision(revision);this.commit({...validateMemoryGraph(graph),revision:this.graph.revision+1});}
  deleteMany(ids:unknown,revision:unknown){
    this.expectRevision(revision);
    if(!Array.isArray(ids)||!ids.length||ids.length>5000||ids.some(id=>!validId(id))||new Set(ids).size!==ids.length)throw new Error('Select distinct saved memories to delete.');
    const next=this.read(),impact=deletionImpact(next,ids),roots=new Set(impact.roots);
    next.records=next.records.filter(r=>!roots.has(r.rootId));for(const root of roots)delete next.positions[root];next.revision++;this.commit(next);return impact;
  }
  delete(id:unknown){
    return this.deleteMany([id],this.graph.revision).records.map(r=>r.id);
  }
  private position(input:unknown){const p=input as {x:number;y:number};if(!p||typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw new Error('Invalid graph position.');return {x:p.x,y:p.y};}
  move(id:unknown,position:unknown){if(!validId(id)||!this.graph.records.some(r=>r.kind==='node'&&r.rootId===id&&r.status==='current'))throw new Error('Node not found.');const next=this.read();next.positions[id]=this.position(position);next.revision++;this.commit(next);}
  context(ids:unknown,projectPath:string,policy:MemoryPolicy):MemoryContextItem[]{
    if(ids===undefined)return [];
    if(!Array.isArray(ids)||ids.length>20||ids.some(id=>!validId(id))||new Set(ids).size!==ids.length)throw new Error('Select at most 20 distinct memory versions.');
    if(ids.length&&this.fatal)throw new Error(this.graph.warning);
    const current=this.query({});const context:MemoryContextItem[]=ids.map(id=>{
      const r=current.find(r=>r.id===id);if(!r)throw new Error('A selected memory was deleted or superseded. Review memory selection before starting.');
      if(!memoryAllowed(r,projectPath,policy))throw new Error('Selected memory is outside this project or the agent’s memory policy. Review the selection.');
      let relationship:MemoryContextItem['relationship'];
      if(r.kind==='relationship'){
        const endpoints=[r.from,r.to].map(root=>current.find(r=>r.kind==='node'&&r.rootId===root));
        if(endpoints.some(n=>!n||!memoryAllowed(n,projectPath,policy)))throw new Error('Relationship endpoints are outside the selected memory policy.');
        relationship={from:endpoints[0]!.label,to:endpoints[1]!.label};
      }
      return {id:r.id,rootId:r.rootId,kind:r.kind,label:r.label,meaning:r.meaning,scope:structuredClone(r.scope),...(relationship?{relationship}:{})};
    });
    if(JSON.stringify(context).length>24000)throw new Error('Selected memory context is too large. Select fewer or shorter memories (24,000 character limit).');
    return context;
  }
}
