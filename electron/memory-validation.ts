import { validId } from './agent-profiles';
import { redact } from './codex-protocol';
import { memoryTypes, type MemoryImportOrigin, type MemoryRecord, type MemoryScope, type MemorySource } from '../shared/memory';
const text=(value:unknown,name:string,max:number)=>{if(typeof value!=='string'||value.length>max||value.includes('\0'))throw new Error(`${name} must be text of at most ${max} characters.`);const safe=redact(value.trim());if(!safe)throw new Error(`${name} is required.`);return safe;};
// Persist only the exact UTC form emitted by our exporter/repository. Check length before parsing.
export function canonicalMemoryTimestamp(value:unknown):value is string {
  return typeof value==='string'&&value.length===24&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
}
export function storedImportOrigin(r:MemoryImportOrigin):MemoryImportOrigin {
  if(!r||!validId(r.ownerId)||!canonicalMemoryTimestamp(r.exportedAt))throw new Error('Invalid imported provenance.');
  return {ownerId:r.ownerId,ownerLabel:text(r.ownerLabel,'Imported owner',100),exportedAt:r.exportedAt};
}
export function storedScope(input:unknown):MemoryScope {
  if(!input||typeof input!=='object')throw new Error('Choose personal or project scope.');const r=input as MemoryScope;
  if(r.kind==='personal')return {kind:'personal'};
  if(r.kind!=='project'||typeof r.projectPath!=='string'||r.projectPath.length>4096||!r.projectPath.startsWith('/')&&!/^[a-z]:\\/i.test(r.projectPath)||r.projectPath.includes('\0'))throw new Error('Invalid project scope.');
  return {kind:'project',projectPath:r.projectPath};
}
export function storedSource(input:unknown):MemorySource {
  if(!input||typeof input!=='object')throw new Error('Invalid memory source.');const r=input as MemorySource;
  if(r.kind==='manual')return {kind:'manual',note:text(r.note,'Source note',500)};
  if(r.kind==='run-task'&&validId(r.runId))return {kind:'run-task',runId:r.runId,excerpt:text(r.excerpt,'Task excerpt',1000)};
  if(r.kind==='task-draft')return {kind:'task-draft',excerpt:text(r.excerpt,'Draft excerpt',1000)};
  if(r.kind==='extraction'&&r.method==='local-rules-v1'&&(r.runId===undefined||validId(r.runId)))return {kind:'extraction',method:r.method,title:text(r.title,'Source title',100),excerpt:text(r.excerpt,'Source excerpt',1000),...(r.runId?{runId:r.runId}:{})};
  throw new Error('Only manual entries, user task sources, and reviewed extraction are supported.');
}
export function storedMemory(input:unknown):MemoryRecord {
  if(!input||typeof input!=='object')throw new Error('Invalid memory record.');const r=input as MemoryRecord;
  if(!validId(r.id)||!validId(r.rootId)||!Number.isInteger(r.version)||r.version<1||!['current','superseded'].includes(r.status)||!canonicalMemoryTimestamp(r.createdAt)||!canonicalMemoryTimestamp(r.updatedAt)||r.supersedesId!==undefined&&!validId(r.supersedesId)||r.supersededById!==undefined&&!validId(r.supersededById))throw new Error('Invalid memory metadata.');
  const base={id:r.id,rootId:r.rootId,version:r.version,label:text(r.label,'Label',100),meaning:text(r.meaning,'Meaning',4000),scope:storedScope(r.scope),source:storedSource(r.source),createdAt:r.createdAt,updatedAt:r.updatedAt,status:r.status,...(r.importedFrom!==undefined?{importedFrom:storedImportOrigin(r.importedFrom)}:{}),...(r.supersedesId?{supersedesId:r.supersedesId}:{}),...(r.supersededById?{supersededById:r.supersededById}:{})};
  if(r.kind==='node'&&memoryTypes.includes(r.nodeType))return {...base,kind:'node',nodeType:r.nodeType};
  if(r.kind==='relationship'&&validId(r.from)&&validId(r.to)&&r.from!==r.to)return {...base,kind:'relationship',from:r.from,to:r.to};
  throw new Error('Choose a supported memory type or two different endpoints.');
}
