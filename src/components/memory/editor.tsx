import { useEffect, useState } from 'react';
import { memoryTypes, type MemoryRecord, type MemoryScope, type MemorySourceInput, type SaveMemoryRequest } from '../../../shared/memory';
import { useMemory } from '@/state/memory-context';
import { useApp } from '@/state/app-context';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
export interface MemorySeed {text:string;source:MemorySourceInput;scope:MemoryScope}
export function RememberThis({seed,disabled=false}:{seed:MemorySeed;disabled?:boolean}){
  const [open,setOpen]=useState(false);
  return <><Button size="sm" variant="ghost" disabled={disabled||!seed.text.trim()} onClick={()=>setOpen(true)}>Remember this</Button>{open&&<MemoryEditor seed={seed} onClose={()=>setOpen(false)}/>}</>;
}
export function MemoryEditor({record,relationship=false,seed,onClose,onSaved}:{record?:MemoryRecord;relationship?:boolean;seed?:MemorySeed;onClose:()=>void;onSaved?:(record:MemoryRecord)=>void}){
  const {graph,save,refresh}=useMemory();const {workspace}=useApp();
  const initial:SaveMemoryRequest={id:record?.id,kind:record?.kind??(relationship?'relationship':'node'),nodeType:record?.kind==='node'?record.nodeType:seed?'goal':'preference',from:record?.kind==='relationship'?record.from:undefined,to:record?.kind==='relationship'?record.to:undefined,label:record?.label??seed?.text.trim().slice(0,80)??'',meaning:record?.meaning??seed?.text.slice(0,4000)??'',scope:record?.scope??seed?.scope??{kind:'personal'},source:record?{kind:'manual',note:'Manual revision'}:seed?.source??{kind:'manual',note:'Manual entry'}};
  const [draft,setDraft]=useState(initial),[baseline]=useState(JSON.stringify(initial)),[saving,setSaving]=useState(false),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
  const dirty=JSON.stringify(draft)!==baseline||!!seed;
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const leave=()=>{if(saving)return;if(dirty)setDiscard(true);else onClose();};
  const change=<K extends keyof SaveMemoryRequest>(key:K,value:SaveMemoryRequest[K])=>setDraft(prev=>({...prev,[key]:value}));
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(!draft.label.trim()||!draft.meaning.trim()){setError('Label and meaning are required.');return;}setSaving(true);try{const state=await save(draft);onSaved?.(state.records.at(-1)!);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save memory.');}finally{setSaving(false);}};
  const projects=[...graph.projects];if(workspace&&!projects.some(p=>p.path===workspace.path))projects.push({path:workspace.path,name:workspace.name});
  const nodes=graph.records.filter(r=>r.kind==='node'&&r.status==='current');
  const scopeLocked=!!record||!!seed;
  return <Dialog open onOpenChange={open=>{if(!open)leave();}}><DialogContent className="memory-editor" onEscapeKeyDown={e=>{if(discard){e.preventDefault();setDiscard(false);}}}><DialogTitle>{record?'Edit memory':seed?'Remember this':relationship?'Add relationship':'Add memory'}</DialogTitle><DialogDescription>{record?'Saving creates a new version and supersedes this version.':'Only what you explicitly save is remembered. Review the meaning and scope.'}</DialogDescription>
    {discard?<div className="space-y-4 mt-5"><p>Discard unsaved memory changes?</p><div className="flex gap-2"><Button onClick={()=>setDiscard(false)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard changes</Button></div></div>:<form noValidate onSubmit={e=>void submit(e)} className="memory-fields space-y-4 mt-5"><fieldset disabled={saving} className="space-y-4">
      {draft.kind==='node'&&<div><label htmlFor="memory-type">Type</label><select id="memory-type" value={draft.nodeType} onChange={e=>change('nodeType',e.target.value as SaveMemoryRequest['nodeType'])}>{memoryTypes.map(type=><option key={type}>{type}</option>)}</select></div>}
      <div><label htmlFor="memory-label">{draft.kind==='relationship'?'Relationship label':'Label'}</label><input id="memory-label" autoFocus maxLength={100} value={draft.label} onChange={e=>change('label',e.target.value)} placeholder={draft.kind==='relationship'?'uses, prefers, works toward…':'A short, descriptive name'}/></div>
      {draft.kind==='relationship'&&<div className="grid grid-cols-2 gap-3">{(['from','to'] as const).map(key=><div key={key}><label htmlFor={`memory-${key}`}>{key==='from'?'From node':'To node'}</label><select id={`memory-${key}`} disabled={!!record} value={draft[key]??''} onChange={e=>change(key,e.target.value)}><option value="">Choose node…</option>{nodes.map(node=><option key={node.rootId} value={node.rootId}>{node.label} · {node.scope.kind==='personal'?'Personal':node.scope.projectPath.split('/').at(-1)}</option>)}</select></div>)}</div>}
      <div><label htmlFor="memory-meaning">Meaning</label><textarea id="memory-meaning" rows={5} maxLength={4000} value={draft.meaning} onChange={e=>change('meaning',e.target.value)} placeholder="State a fact you want the app to remember. Avoid passwords and tokens."/></div>
      <div><label htmlFor="memory-scope">Scope</label><select id="memory-scope" disabled={scopeLocked} value={draft.scope.kind==='personal'?'personal':draft.scope.projectPath} onChange={e=>change('scope',e.target.value==='personal'?{kind:'personal'}:{kind:'project',projectPath:e.target.value})}><option value="personal">Personal · available across projects when allowed</option>{projects.map(project=><option key={project.path} value={project.path}>{project.name} · {project.path}</option>)}</select><p className="demo-note mt-2">{scopeLocked?'Scope stays fixed for this fact. Create a separate manual entry to describe a different scope.':'For a new project, first choose its folder on Home. Project facts never become global preferences automatically.'}</p></div>
      <div className="runtime-check"><b>Source</b><p>{draft.source.kind==='manual'?'Manual entry / manual revision':draft.source.kind==='run-task'?'User task from a saved run':'User-authored task draft · not a completed conversation'}</p>{seed&&<p className="whitespace-pre-wrap">{seed.text.slice(0,1000)}</p>}</div>
    </fieldset>{error&&<p className="run-error" role="alert">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" disabled={saving} onClick={leave}>Cancel</Button><Button type="submit" variant="primary" disabled={saving||!!graph.warning||!window.theseus}>{saving?'Saving…':record?'Save new version':'Save memory'}</Button></div></form>}
  </DialogContent></Dialog>;
}
