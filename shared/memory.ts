export type MemoryNodeType='person'|'project'|'preference'|'technology'|'goal';
export type MemoryPolicy='none'|'project'|'personal-project';
export type MemoryScope={kind:'personal'}|{kind:'project';projectPath:string};
export type MemorySource={kind:'manual';note:string}|{kind:'run-task';runId:string;excerpt:string}|{kind:'task-draft';excerpt:string}|{kind:'extraction';method:'local-rules-v1';title:string;excerpt:string;runId?:string};
export type MemorySourceInput={kind:'manual';note?:string}|{kind:'run-task';runId:string}|{kind:'task-draft';text:string;workspaceId?:string};
export interface MemoryImportOrigin {ownerId:string;ownerLabel:string;exportedAt:string}
interface MemoryBase {
  id:string; rootId:string; version:number; label:string; meaning:string; scope:MemoryScope; source:MemorySource;
  importedFrom?:MemoryImportOrigin;
  createdAt:string;updatedAt:string;status:'current'|'superseded';supersedesId?:string;supersededById?:string;
}
export interface MemoryNode extends MemoryBase {kind:'node';nodeType:MemoryNodeType}
export interface MemoryRelationship extends MemoryBase {kind:'relationship';from:string;to:string}
export type MemoryRecord=MemoryNode|MemoryRelationship;
export interface MemoryGraph {version:1;revision:number;records:MemoryRecord[];positions:Record<string,{x:number;y:number}>;warning?:string}
export interface MemoryProject {path:string;name:string}
export interface MemoryState extends MemoryGraph {projects:MemoryProject[]}
export interface SaveMemoryRequest {
  id?:string;kind:'node'|'relationship';nodeType?:MemoryNodeType;from?:string;to?:string;
  label:string;meaning:string;scope:MemoryScope;source:MemorySourceInput;
}
export interface MemoryReference {id:string;rootId:string}
export interface MemoryContextItem extends MemoryReference {kind:MemoryRecord['kind'];label:string;meaning:string;scope:MemoryScope;relationship?:{from:string;to:string}}
export interface MemoryQuery {search?:string;scope?:'all'|'personal'|'project';projectPath?:string;includeSuperseded?:boolean}
export const memoryTypes:MemoryNodeType[]=['person','project','preference','technology','goal'];
export function sameScope(a:MemoryScope,b:MemoryScope){return a.kind===b.kind&&(a.kind==='personal'||b.kind==='project'&&a.projectPath===b.projectPath);}
export function memoryAllowed(record:Pick<MemoryRecord,'scope'>,projectPath:string,policy:MemoryPolicy){return policy!=='none'&&(record.scope.kind==='personal'?policy==='personal-project':record.scope.projectPath===projectPath);}
export function queryMemory(records:MemoryRecord[],query:MemoryQuery={}):MemoryRecord[]{
  const text=query.search?.trim().toLowerCase()??'';
  return records.filter(r=>(query.includeSuperseded||r.status==='current')&&(query.scope!=='personal'||r.scope.kind==='personal')&&(query.scope!=='project'||r.scope.kind==='project')&&(!query.projectPath||r.scope.kind==='project'&&r.scope.projectPath===query.projectPath)&&(!text||`${r.label} ${r.meaning} ${r.kind==='node'?r.nodeType:'relationship'} ${r.scope.kind==='project'?r.scope.projectPath:'personal'}`.toLowerCase().includes(text)));
}
