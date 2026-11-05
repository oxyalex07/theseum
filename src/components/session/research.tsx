import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isActiveRun } from '../../../shared/bridge';
import { citationIds, researchKinds, type ResearchDestination, type ResearchDocument, type ResearchKind, type ResearchState } from '../../../shared/research';
import { researchDrafts, researchError } from '@/state/research-drafts';
import { useApp } from '@/state/app-context';
import { Button } from '../ui/button';
import './research.css';

const labels:Record<ResearchKind,string>={outline:'Outline',draft:'Draft',comparison:'Comparison'};
export function ResearchPanel({id,initialKind='draft'}:{id:string;initialKind?:ResearchKind}){
  const {m}=useApp(),run=m.runs[id];
  const [document,setDocument]=useState<ResearchDocument|null>(null),[kind,setKind]=useState<ResearchKind>(initialKind);
  const store=researchDrafts(),draftState=useSyncExternalStore(store.subscribe,store.getSnapshot);
  const edits=Object.fromEntries(draftState.drafts.filter(d=>d.runId===id).map(d=>[d.kind,d]));
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState(''),[notice,setNotice]=useState('');
  const [destination,setDestination]=useState<ResearchDestination|null>(null);
  const pending=useRef(false);
  const apply=(state:ResearchState)=>{setDocument(state.document);setWarning(state.warning??'');setDestination(null);};
  const applyLocal=(before:ResearchDocument,state:ResearchState,changedKind:ResearchKind)=>{if(state.document)store.acceptLocalChange(before,state.document,changedKind);apply(state);};
  const refresh=async()=>{
    if(!window.theseus)return;
    setLoading(true);setError('');
    try{const state=await window.theseus.getResearch({runId:id});if(!state.document||state.warning)throw new Error(state.warning??'Research could not be loaded. Your drafts are kept.');apply(state);store.discard(id);}catch(e){setError(researchError(e,'Research could not be loaded.'));}finally{setLoading(false);}
  };
  useEffect(()=>{let current=true;setLoading(true);setDocument(null);setError('');setNotice('');setWarning('');setDestination(null);window.theseus?.getResearch({runId:id}).then(state=>{if(current)apply(state);}).catch(e=>{if(current)setError(researchError(e,'Research could not be loaded.'));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[id,run?.status]);
  useEffect(()=>{const saved=(event:Event)=>{const state=(event as CustomEvent<ResearchState>).detail;if(state.document?.runId===id)apply(state);};window.addEventListener('theseus:research-saved',saved);return()=>window.removeEventListener('theseus:research-saved',saved);},[id]);
  const perform=async(action:()=>Promise<void>)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');
    try{await action();}catch(e){setError(researchError(e));}finally{pending.current=false;setBusy(false);}
  };
  const artifact=document?.runId===id?document.artifacts[kind]:undefined,edit=edits[kind],content=edit?.content??artifact?.content??'';
  const dirty=!!edit,anyDirty=Object.keys(edits).length>0;
  const conflicted=!!edit&&(edit.revision!==document?.revision||edit.baseContent!==artifact?.content||edit.projectPath!==document?.projectPath);
  const active=!!run&&isActiveRun(run.status),disabled=busy||loading||active||!!warning;
  const target={runId:id,revision:document?.revision??0,kind};
  const sourceIds=citationIds(content);
  return <section className="research-panel" aria-label="Saved research workspace" aria-busy={busy||loading}>
    <div className="research-heading"><h2>Research</h2><Button size="sm" disabled={busy||loading} onClick={()=>void refresh()}>{anyDirty?'Discard edits and refresh':'Refresh research'}</Button></div>
    <p className="demo-note">Collected from this run’s saved output and selected page references. URL mentions do not mean a page was fetched or verified.</p>
    {active&&<p className="empty-note">Sources are collected when the run ends. Wait for completion before creating or editing artifacts.</p>}
    {loading&&<p role="status">Loading saved research…</p>}
    {draftState.warning&&<p className="run-error" role="alert">{draftState.warning}</p>}
    {warning&&<p className="run-error" role="alert">{warning}</p>}
    {error&&<p className="run-error" role="alert">{error}</p>}
    {notice&&<p role="status" className="research-notice">{notice}</p>}
    {document?.runId===id&&<>
      {document.truncated&&<p className="demo-note">Earlier output was trimmed. Sources and artifacts use retained results; previously collected citations are kept.</p>}
      <details className="research-sources" open={!document.sources.length}>
        <summary>Collected sources · {document.sources.length}</summary>
        {!document.sources.length?<p className="empty-note">No supported HTTP(S) links in this run’s results or selected pages. Ask Codex to include source links in its response.</p>:<ol>{document.sources.map(source=><li key={source.id}>
          <div><b>[{source.id}] {source.title}</b><Button size="sm" variant="ghost" aria-label={`Open source ${source.id}`} onClick={()=>void perform(async()=>{await window.theseus!.openBrowserUrl(source.url);})}>Open source</Button></div>
          <p className="research-url">{source.url}</p>
          {source.evidence.map((evidence,i)=><details key={i}><summary>{evidence.origin==='selected-page'?'Selected page reference':evidence.origin==='browser-activity'?'Browser activity':'Link in assistant output'}{evidence.sequence?` · output ${evidence.sequence}`:''} · {new Date(evidence.capturedAt).toLocaleString()}</summary><pre>{evidence.excerpt}</pre><small>Run {document.runId}{evidence.pageId?` · page ${evidence.pageId}`:''}<br/>SHA-256 {evidence.sha256}{evidence.origin==='selected-page'?' (reference metadata)':' (output entry)'}</small></details>)}
        </li>)}</ol>}
      </details>
      <label className="research-field">Artifact<select aria-label="Research artifact" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as ResearchKind);setDestination(null);setError('');setNotice('');}}>{researchKinds.map(key=><option key={key} value={key}>{labels[key]}{document.artifacts[key]?' · saved':''}</option>)}</select></label>
      {!artifact?<div className="research-empty"><p>{kind==='outline'?'Extract an outline from the assistant’s paragraphs and headings.':kind==='draft'?'Create an editable draft using the actual assistant results.':'Extract result tables, or compare collected sources using their actual result excerpts.'}</p><Button size="sm" variant="primary" disabled={disabled||run?.status!=='completed'} onClick={()=>void perform(async()=>{applyLocal(document,await window.theseus!.generateResearch(target),kind);setNotice(`${labels[kind]} created from saved assistant results.`);})}>Create {labels[kind].toLowerCase()} from results</Button></div>:<>
        <p className="demo-note">Extracted from saved assistant results. Review claims before publishing. Keep [S#] markers to preserve citations.</p>
        <label className="research-field">{labels[kind]} Markdown<textarea aria-label={`${labels[kind]} Markdown`} maxLength={200000} rows={18} disabled={busy||loading||active||!!draftState.blocked} value={content} onChange={e=>{const value=e.target.value;try{store.edit(document,kind,value);}catch(e){setError(researchError(e,'Your edit could not be stored.'));}setDestination(null);setNotice('');}}/></label>
        {edit&&<p role="status" className="demo-note">Recovered local {kind} edits · based on revision {edit.revision}. {conflicted?'Saved research changed. Your original draft is kept; review the current saved text before discarding or resolving it.':'Save or discard when ready.'}</p>}
        {conflicted&&<details><summary>Current saved {kind} · your local edits are kept above</summary><pre>{artifact.content}</pre></details>}
        <div className="research-actions"><Button size="sm" variant="primary" disabled={disabled||!dirty} onClick={()=>void perform(async()=>{if(edit!.projectPath!==document.projectPath)throw new Error('The Research project changed. Your draft is kept.');applyLocal(document,await window.theseus!.saveResearch({...target,revision:edit!.revision,content,baseContent:edit!.baseContent,projectPath:edit!.projectPath}),kind);setNotice(`${labels[kind]} saved with citations.`);})}>Save {labels[kind].toLowerCase()}</Button><small>{dirty?draftState.warning?'Unsaved changes · save before leaving':'Unsaved changes · recoverable on this device after navigation or restart':`Saved ${new Date(artifact.updatedAt).toLocaleString()}`}</small></div>
        <div className="research-citations"><b>Citations in this artifact</b>{sourceIds.length?sourceIds.map(sourceId=>{const source=document.sources.find(source=>source.id===sourceId);return <p key={sourceId}>{source?<button onClick={()=>void perform(async()=>{await window.theseus!.openBrowserUrl(source.url);})}>[{sourceId}] {source.title}</button>:<span className="run-error">Unknown citation [{sourceId}]</span>}</p>;}):<p className="demo-note">No source citations in this text. Claims without links were not assigned sources automatically.</p>}</div>
        <details className="research-publishing"><summary>Publish / export</summary><p className="demo-note">Supported destination: a new local Markdown file. Remote publishing is unavailable. Saving edits does not publish.</p><Button size="sm" disabled={disabled||dirty} onClick={()=>void perform(async()=>{setDestination(await window.theseus!.chooseResearchDestination(target));})}>Choose Markdown destination…</Button>{destination&&<><p className="research-url">Destination: {destination.path}</p><p className="demo-note">Export includes the saved text, cited source URLs, and provenance. A final confirmation names this destination.</p><Button size="sm" variant="primary" disabled={disabled||dirty} onClick={()=>void perform(async()=>{const result=await window.theseus!.publishResearch({...target,token:destination.token,intent:'export-markdown'});setDestination(null);setNotice(result.state==='exported'?`Exported Markdown to ${result.path}`:'Export cancelled. No file was written.');})}>Export saved {labels[kind].toLowerCase()}…</Button></>}</details>
      </>}
    </>}
    {!loading&&!document&&!active&&!warning&&<p className="empty-note">No saved research is available for this run.</p>}
  </section>;
}
