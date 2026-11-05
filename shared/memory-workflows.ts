import { sameScope, type MemoryGraph, type MemoryNodeType, type MemoryRecord, type MemoryScope } from './memory';

export interface PortableMemory {
  format:'theseus-memory';version:1;demo:false;exportedAt:string;
  owner:{id:string;label:string};graph:MemoryGraph;
}
export type ConflictChoice='local'|'incoming';
export interface MemoryImportGroup {
  rootId:string;status:'new'|'identical'|'conflict';local:MemoryRecord[];incoming:MemoryRecord[];
  layout?:{local?:{x:number;y:number};incoming?:{x:number;y:number}};
}
export interface MemoryTransferPreview {
  id:string;mode:'import'|'sync-pull'|'sync-publish';revision:number;fileName:string;
  owner:PortableMemory['owner'];exportedAt:string;groups:MemoryImportGroup[];
  incomingVersions:number;localVersions:number;outgoing?:MemoryRecord[];warning:string;
}
export interface MemoryDeleteImpact {
  revision:number;selectedIds:string[];roots:string[];records:MemoryRecord[];
  facts:number;relationships:number;versions:number;positions:number;
}
export interface ExtractionCandidate {
  id:string;label:string;meaning:string;nodeType:MemoryNodeType;scope:MemoryScope;
  source:Extract<MemoryRecord['source'],{kind:'extraction'}>;
}
export interface ExtractionReview {id:string;revision:number;candidates:ExtractionCandidate[];omitted:number;method:'local-rules-v1'}
export type MemoryWorkflowRequest=
  | {action:'export';ownerLabel:string}
  | {action:'import'|'sync-connect'|'sync-pull'|'sync-publish'|'sync-disconnect'|'status'}
  | {action:'apply-transfer';id:string;choices:Record<string,ConflictChoice>}
  | {action:'extract';scope:MemoryScope;source:{kind:'user-text';title:string;text:string}|{kind:'run-task';runId:string}}
  | {action:'save-extraction';id:string;candidates:{id:string;label:string;meaning:string;nodeType:MemoryNodeType}[]}
  | {action:'delete-preview';ids:string[]}
  | {action:'delete-confirm';ids:string[];revision:number};
export interface MemoryWorkflowResult {
  saved?:boolean;cancelled?:boolean;graph?:MemoryGraph;transfer?:MemoryTransferPreview;
  extraction?:ExtractionReview;impact?:MemoryDeleteImpact;sync?:{fileName:string;owner:PortableMemory['owner']};
}

// Bounded, on-device concept matching. No embedding provider, network request, or hidden context selection.
const concepts=[
  ['concise','brief','short','succinct','terse'],['verbose','detailed','thorough','comprehensive'],
  ['test','tests','testing','verify','verification','validate','validation'],['error','errors','failure','failures','bug','bugs'],
  ['docs','documentation','document','documents'],['typescript','ts'],['javascript','js'],['python','py'],
  ['prefer','prefers','preference','favorite','favourite'],['avoid','dislike','never'],['use','uses','using'],
  ['build','compile','compilation'],['delete','remove','erase'],['save','persist','store','storage'],
  ['auth','authentication','login','signin'],['secure','security','safe','safety'],['async','asynchronous'],
  ['fast','quick','performance','speed'],['accessible','accessibility','a11y'],['response','reply','responses','replies'],
  ['project','repository','repo'],['goal','objective','aim'],['format','formatting','style'],['code','coding','implementation'],
];
const aliases=new Map(concepts.flatMap(words=>words.map(word=>[word,words[0]] as const)));
const stops=new Set('a an and are as at be by for from i in is it me my of on or our that the their them this to we with you your'.split(' '));
function terms(text:string){return (text.toLowerCase().match(/[\p{L}\p{N}+#]+/gu)??[]).filter(w=>!stops.has(w)).map(w=>aliases.get(w)??w);}
function vector(text:string){const v=new Map<string,number>();for(const term of terms(text))v.set(term,(v.get(term)??0)+1);return v;}
function cosine(a:Map<string,number>,b:Map<string,number>){let dot=0;for(const [term,n]of a)dot+=n*(b.get(term)??0);const norm=(v:Map<string,number>)=>Math.sqrt([...v.values()].reduce((n,x)=>n+x*x,0));return dot/(norm(a)*norm(b)||1);}
export function semanticMemories(records:MemoryRecord[],search:string):{record:MemoryRecord;score:number}[]{
  const current=records.filter(r=>r.status==='current'),q=search.trim();if(!q)return current.map(record=>({record,score:1}));
  const v=vector(q);return current.map(record=>({record,score:Math.max(cosine(v,vector(`${record.label} ${record.meaning}`)),`${record.label} ${record.meaning}`.toLowerCase().includes(q.toLowerCase())?1:0)})).filter(r=>r.score>=0.18).sort((a,b)=>b.score-a.score||a.record.label.localeCompare(b.record.label));
}
export interface DuplicateMemory {a:MemoryRecord;b:MemoryRecord;score:number;reason:string}
export interface DuplicateReview {pairs:DuplicateMemory[];limited:boolean;comparisons:number}
export function duplicateMemories(records:MemoryRecord[]):DuplicateReview {
  const current=records.filter(r=>r.status==='current'),vectors=current.map(r=>vector(`${r.label} ${r.meaning}`));
  const postings=new Map<string,number[]>(),result:DuplicateMemory[]=[];let comparisons=0,limited=false;
  for(let i=0;i<current.length;i++){
    const candidates=new Set<number>();for(const term of vectors[i].keys())for(const j of postings.get(term)??[])candidates.add(j);
    for(const j of candidates){if(comparisons>=20000||result.length>=100){limited=true;break;}comparisons++;const a=current[j],b=current[i];if(!sameScope(a.scope,b.scope)||a.kind!==b.kind||a.kind==='relationship'&&b.kind==='relationship'&&(a.from!==b.from||a.to!==b.to))continue;
      const exact=a.meaning.trim().toLowerCase()===b.meaning.trim().toLowerCase(),score=exact?1:cosine(vectors[j],vectors[i]);
      if(score>=0.72)result.push({a,b,score,reason:exact?'Same meaning text':'Similar local concepts; review wording and negation'});
    }
    if(limited)break;
    for(const term of vectors[i].keys()){const list=postings.get(term)??[];list.push(i);postings.set(term,list);}
  }
  return {pairs:result.sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id)),limited,comparisons};
}
export function deletionImpact(graph:MemoryGraph,ids:string[]):MemoryDeleteImpact {
  const selected=ids.map(id=>{const record=graph.records.find(r=>r.id===id);if(!record)throw new Error('A selected memory changed or was deleted. Review selection again.');return record;});
  const roots=new Set(selected.map(r=>r.rootId)),nodes=new Set(selected.filter(r=>r.kind==='node').map(r=>r.rootId));
  for(const r of graph.records)if(r.kind==='relationship'&&(nodes.has(r.from)||nodes.has(r.to)))roots.add(r.rootId);
  const records=graph.records.filter(r=>roots.has(r.rootId)),current=records.filter(r=>r.status==='current');
  return {revision:graph.revision,selectedIds:ids,roots:[...roots],records,facts:current.filter(r=>r.kind==='node').length,relationships:current.filter(r=>r.kind==='relationship').length,versions:records.length,positions:[...roots].filter(root=>graph.positions[root]!==undefined).length};
}
