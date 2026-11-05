import { canonicalMemoryTimestamp, storedImportOrigin, storedMemory } from './memory-validation';
import { sameScope, type MemoryGraph, type MemoryImportOrigin, type MemoryRecord } from '../shared/memory';
import type { ConflictChoice, MemoryImportGroup, PortableMemory } from '../shared/memory-workflows';
import { validId } from './agent-profiles';
import { redact } from './codex-protocol';

export const MEMORY_BYTES=32_000_000;
export function validateMemoryGraph(input:unknown):MemoryGraph {
  if(!input||typeof input!=='object')throw new Error('Invalid memory graph.');
  const raw=input as MemoryGraph;
  if(raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.records)||raw.records.length>5000)throw new Error('Unsupported graph or more than 5,000 versions.');
  const records:MemoryRecord[]=[];let recordBytes=0;
  for(const input of raw.records){const record=storedMemory(input);recordBytes+=Buffer.byteLength(JSON.stringify(record))+1;if(recordBytes>MEMORY_BYTES)throw new Error('Memory graph exceeds 32 MB.');records.push(record);}
  const ids=new Set(records.map(r=>r.id));
  if(ids.size!==records.length)throw new Error('Duplicate memory version IDs.');
  const roots=new Map<string,MemoryRecord[]>();
  for(const r of records){const chain=roots.get(r.rootId)??[];chain.push(r);roots.set(r.rootId,chain);}
  for(const chain of roots.values()){
    chain.sort((a,b)=>a.version-b.version);const first=chain[0];
    if(first.id!==first.rootId||chain.some((r,i)=>r.version!==i+1||!sameScope(r.scope,first.scope)||r.kind!==first.kind||r.kind==='relationship'&&first.kind==='relationship'&&(r.from!==first.from||r.to!==first.to)||r.status!==(i===chain.length-1?'current':'superseded')||r.supersedesId!==(i?chain[i-1].id:undefined)||r.supersededById!==(i<chain.length-1?chain[i+1].id:undefined)||Date.parse(r.updatedAt)<Date.parse(r.createdAt)))throw new Error('Invalid memory version chain, scope, or relationship lineage.');
  }
  for(const r of records)if(r.kind==='relationship')for(const endpoint of [r.from,r.to]){
    const n=roots.get(endpoint)?.at(-1);if(!n||n.kind!=='node')throw new Error('Relationship endpoint is missing.');
    if(n.scope.kind==='project'&&(r.scope.kind!=='project'||n.scope.projectPath!==r.scope.projectPath))throw new Error('Relationship crosses project scope.');
  }
  if(!raw.positions||typeof raw.positions!=='object'||Array.isArray(raw.positions))throw new Error('Invalid graph layout.');
  const positions:MemoryGraph['positions']={};
  for(const [id,p]of Object.entries(raw.positions)){
    if(!validId(id)||roots.get(id)?.[0].kind!=='node'||!p||typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw new Error('Invalid graph position or unknown node.');
    positions[id]={x:p.x,y:p.y};
  }
  const graph:MemoryGraph={version:1,revision:raw.revision,records,positions};
  assertGraphBudget(graph.records,graph.positions,graph.revision);return graph;
}
export function validatePortableMemory(input:unknown):PortableMemory {
  if(!input||typeof input!=='object')throw new Error('Choose a Theseus real-memory export.');
  const r=input as PortableMemory;
  if(r.format!=='theseus-memory'||r.version!==1||r.demo!==false)throw new Error('This is not a supported real-memory export. Demo preferences cannot be imported into saved memory.');
  if(!r.owner||!validId(r.owner.id)||typeof r.owner.label!=='string'||!r.owner.label.trim()||r.owner.label.length>100||r.owner.label.includes('\0')||!canonicalMemoryTimestamp(r.exportedAt))throw new Error('Invalid owner or export date.');
  return {format:'theseus-memory',version:1,demo:false,owner:{id:r.owner.id,label:redact(r.owner.label.trim())},exportedAt:r.exportedAt,graph:validateMemoryGraph(r.graph)};
}
function lineageContent(records:MemoryRecord[]){return JSON.stringify(records.map(({importedFrom,...record})=>record));}
function lineages(graph:MemoryGraph){const map=new Map<string,MemoryRecord[]>();for(const r of graph.records){const list=map.get(r.rootId)??[];list.push(r);map.set(r.rootId,list);}for(const list of map.values())list.sort((a,b)=>a.version-b.version);return map;}
// Count the exact compact UTF-8 representation incrementally. Receipts are counted once per
// accepted version before allocating stamped records or serializing the combined graph.
function assertGraphBudget(records:Iterable<MemoryRecord>,positions:MemoryGraph['positions'],revision:number,accepted?:Set<string>,origin?:MemoryImportOrigin){
  let bytes=Buffer.byteLength(JSON.stringify({version:1,revision,records:[],positions})),count=0;
  const receipt=origin?Buffer.byteLength(JSON.stringify(origin))+Buffer.byteLength(',"importedFrom":'):0;
  for(const record of records){
    if(++count>5000)throw new Error('Unsupported graph or more than 5,000 versions.');
    if(origin&&accepted?.has(record.rootId)){const {importedFrom,...content}=record;bytes+=Buffer.byteLength(JSON.stringify(content))+receipt;}
    else bytes+=Buffer.byteLength(JSON.stringify(record));
    if(count>1)bytes++;
    if(bytes>MEMORY_BYTES)throw new Error('Memory graph exceeds 32 MB.');
  }
}
export function importGroups(local:MemoryGraph,incoming:MemoryGraph):MemoryImportGroup[]{
  const a=lineages(local),b=lineages(incoming);
  return [...b].map(([rootId,records])=>{
    const own=a.get(rootId)??[];
    if(own.length&&(!sameScope(own[0].scope,records[0].scope)||own[0].kind!==records[0].kind||own[0].kind==='relationship'&&records[0].kind==='relationship'&&(own[0].from!==records[0].from||own[0].to!==records[0].to)))throw new Error('An imported lineage changes its fixed scope, type, or relationship endpoints.');
    const before=local.positions[rootId],after=incoming.positions[rootId];
    const layoutChanged=own.length>0&&(before?.x!==after?.x||before?.y!==after?.y);
    return {rootId,local:own,incoming:records,status:own.length?lineageContent(own)===lineageContent(records)&&!layoutChanged?'identical':'conflict':'new',...(layoutChanged?{layout:{local:before,incoming:after}}:{})};
  });
}
export function mergeMemoryGraph(local:MemoryGraph,incoming:MemoryGraph,choices:Record<string,ConflictChoice>,origin?:MemoryImportOrigin):MemoryGraph {
  const receipt=origin?storedImportOrigin(origin):undefined;
  const positions={...local.positions},accepted=new Set<string>();
  for(const group of importGroups(local,incoming)){
    if(group.status==='identical')continue;
    if(group.status==='conflict'&&!['local','incoming'].includes(choices[group.rootId]))throw new Error('Choose which complete lineage and layout to keep for every conflict.');
    if(group.status==='conflict'&&choices[group.rootId]==='local')continue;
    accepted.add(group.rootId);
    delete positions[group.rootId];if(incoming.positions[group.rootId])positions[group.rootId]=incoming.positions[group.rootId];
  }
  function* projected(){for(const r of local.records)if(!accepted.has(r.rootId))yield r;for(const r of incoming.records)if(accepted.has(r.rootId))yield r;}
  assertGraphBudget(projected(),positions,local.revision+1,accepted,receipt);
  const records=[...projected()].map(r=>receipt&&accepted.has(r.rootId)?{...r,importedFrom:receipt}:r);
  return validateMemoryGraph({version:1,revision:local.revision+1,records,positions});
}
