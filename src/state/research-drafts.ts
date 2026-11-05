import { researchEdit, type ResearchDocument, type ResearchKind } from '../../shared/research';

export interface ResearchDraft {
  runId:string; kind:ResearchKind; revision:number; projectPath:string;
  baseContent:string; content:string; updatedAt:string;
}
interface DraftSnapshot { drafts:ResearchDraft[]; warning:string; blocked?:boolean }
export const researchDraftKey='theseus.research-drafts.v1';
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
const failure='Research drafts could not be stored on this device. Keep this window open and save your edits before leaving.';

// Research documents cross JSON/IPC boundaries. Object key order is not data;
// array order and every serialized field still participate in conflict checks.
function documentJSON(document:ResearchDocument){
  return JSON.stringify(document,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
}

/** Synchronous writes avoid losing the last keystroke during navigation or quit.
 * Recovery retains the original revision and base text. Only a confirmed local
 * mutation can advance unchanged sibling drafts; the save API still checks both.
 */
export class ResearchDraftStore {
  private snapshot:DraftSnapshot={drafts:[],warning:''};
  private listeners=new Set<()=>void>();
  private damaged=false;
  constructor(private storage:Storage){
    try{
      const raw=storage.getItem(researchDraftKey);if(!raw)return;
      const value=JSON.parse(raw);if(value.version!==1||!Array.isArray(value.drafts))throw new Error();
      const keys=new Set<string>();
      for(const draft of value.drafts){
        researchEdit(draft);
        const key=`${draft.runId}/${draft.kind}`;
        if(keys.has(key)||typeof draft.projectPath!=='string'||typeof draft.baseContent!=='string'||typeof draft.content!=='string'||draft.content.length>200000||!Number.isFinite(Date.parse(draft.updatedAt)))throw new Error();
        keys.add(key);
      }
      this.snapshot={drafts:value.drafts,warning:''};
    }catch{this.damaged=true;this.snapshot={drafts:[],blocked:true,warning:'Stored Research drafts could not be read. Existing local data was preserved. Recover it before editing more research.'};}
  }
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private write(drafts:ResearchDraft[]){
    if(this.damaged)throw new Error(this.snapshot.warning);
    let warning='';try{this.storage.setItem(researchDraftKey,JSON.stringify({version:1,drafts}));}catch{warning=failure;}
    this.snapshot={drafts,warning};this.listeners.forEach(listener=>listener());
    return !warning;
  }
  edit(document:ResearchDocument,kind:ResearchKind,content:string){
    if(this.damaged)throw new Error(this.snapshot.warning);
    const artifact=document.artifacts[kind];if(!artifact)throw new Error('Create this artifact before editing.');
    const prior=this.snapshot.drafts.find(d=>d.runId===document.runId&&d.kind===kind);
    const remaining=this.snapshot.drafts.filter(d=>d!==prior);
    if(content===artifact.content)return this.write(remaining);
    return this.write([...remaining,{...(prior??{runId:document.runId,kind,revision:document.revision,projectPath:document.projectPath,baseContent:artifact.content}),content,updatedAt:new Date().toISOString()}]);
  }
  /** Call only with the before/after documents of a successful local save/create,
   * never on a read or refresh. Any unexpected change prevents sibling rebasing.
   */
  acceptLocalChange(before:ResearchDocument,after:ResearchDocument,kind:ResearchKind){
    const expected={...after,revision:before.revision,artifacts:{...after.artifacts,[kind]:before.artifacts[kind]}};
    const knownLocal=after.revision===before.revision+1&&documentJSON(expected)===documentJSON(before);
    return this.write(this.snapshot.drafts.flatMap(draft=>{
      if(draft.runId!==before.runId||draft.projectPath!==before.projectPath||draft.revision!==before.revision||draft.baseContent!==before.artifacts[draft.kind]?.content)return [draft];
      if(draft.kind===kind){
        // A newer edit made while the request was pending must remain recoverable.
        return after.runId===draft.runId&&after.projectPath===draft.projectPath&&after.artifacts[kind]?.content===draft.content?[]:[draft];
      }
      return [knownLocal?{...draft,revision:after.revision}:draft];
    }));
  }
  discard(runId:string,kind?:ResearchKind){return this.write(this.snapshot.drafts.filter(d=>d.runId!==runId||(kind!==undefined&&d.kind!==kind)));}
}
let store:ResearchDraftStore|undefined;
export function researchDrafts(){return store??=new ResearchDraftStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});}

/** IPC transport details do not help someone recover their Research edits. */
export function researchError(error:unknown,fallback='Research operation failed. Your edits are kept.'){
  return (error instanceof Error?error.message:fallback).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
}
