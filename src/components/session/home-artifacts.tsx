import { useEffect, useRef, useState } from 'react';
import { isActiveRun } from '../../../shared/bridge';
import { researchKinds, type ResearchArtifactList, type ResearchArtifactSummary, type ResearchKind, type ResearchDocument, type ResearchDestination } from '../../../shared/research';
import { useApp } from '@/state/app-context';
import { selectSession } from '@/state/model';
import { Icon, SectionHeading } from '../common';
import { Button } from '../ui/button';

const labels:Record<ResearchKind,string>={draft:'Draft',outline:'Outline',comparison:'Comparison'};
const message=(error:unknown)=>error instanceof Error?error.message:'Could not load artifacts. Try again.';
const key=(item:ResearchArtifactSummary)=>`${item.runId}:${item.kind}`;

export function HomeArtifacts(){
  const {m,update}=useApp();
  const [index,setIndex]=useState<ResearchArtifactList>({artifacts:[]});
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[limit,setLimit]=useState(20);
  const [selected,setSelected]=useState<ResearchArtifactSummary|null>(null),[document,setDocument]=useState<ResearchDocument|null>(null);
  const [destination,setDestination]=useState<ResearchDestination|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [creating,setCreating]=useState(false),[runId,setRunId]=useState(''),[kind,setKind]=useState<ResearchKind>('draft');
  const pending=useRef(false),alive=useRef(true),request=useRef(0);
  const refresh=async()=>{if(!window.theseus){setLoading(false);return;}setLoading(true);try{const value=await window.theseus.listResearchArtifacts();if(alive.current)setIndex(value);}catch(e){if(alive.current)setError(message(e));}finally{if(alive.current)setLoading(false);}};
  useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;request.current++;};},[]);
  const perform=async(action:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');try{await action();}catch(e){if(alive.current)setError(message(e));}finally{pending.current=false;if(alive.current)setBusy(false);}};
  const choose=async(item:ResearchArtifactSummary)=>{
    const token=++request.current;setSelected(item);setDocument(null);setDestination(null);setError('');setNotice('');
    try{const value=await window.theseus!.getResearch({runId:item.runId});if(!alive.current||request.current!==token)return;if(value.warning)throw new Error(value.warning);if(!value.document?.artifacts[item.kind])throw new Error('This artifact is no longer available. Refresh the list.');setDocument(value.document);}catch(e){if(alive.current&&request.current===token)setError(message(e));}
  };
  const visible=index.artifacts.filter(item=>(filter==='all'||item.kind===filter)&&`${item.task} ${item.projectName} ${item.preview}`.toLowerCase().includes(query.trim().toLowerCase()));
  const completed=Object.values(m.runs).filter(run=>run.status==='completed'&&run.output.some(entry=>entry.kind==='message'&&entry.text.trim())).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  const source=completed.find(run=>run.id===runId)??completed[0];
  const artifact=selected&&document?.artifacts[selected.kind];
  const active=!!selected&&!!m.runs[selected.runId]&&isActiveRun(m.runs[selected.runId].status);
  const target=selected&&document?{runId:selected.runId,revision:document.revision,kind:selected.kind}:null;
  const edit=()=>{if(!selected)return;update(d=>{d.runInspectorViews[selected.runId]={tab:'research',artifactKind:selected.kind};selectSession(d,selected.runId);d.layout='focus';d.showInspector=true;});};

  return <section className="sec panel-artifacts" aria-label="Saved artifacts">
    <SectionHeading icon="file" title="Saved artifacts" action={<button disabled={busy||loading} onClick={()=>{setError('');void refresh();if(selected)void choose(selected);}}>Refresh</button>}/>
    <p className="demo-note">Drafts, outlines, and comparisons saved from your live runs.</p>
    {error&&<p className="run-error" role="alert">{error}</p>}{index.warning&&<p className="run-error" role="alert">{index.warning}</p>}{notice&&<p role="status">{notice}</p>}
    {selected?<>
      <button className="overview-link" disabled={busy} onClick={()=>{request.current++;setSelected(null);setDocument(null);setDestination(null);setError('');}}>All artifacts</button>
      <h3>{labels[selected.kind]} · {selected.projectName}</h3><p>{selected.task}</p>
      {!artifact&&!error?<p role="status">Loading artifact…</p>:artifact&&<><small>Saved {new Date(artifact.updatedAt).toLocaleString()} · {artifact.content.length.toLocaleString()} characters</small><pre className="panel-artifact-preview">{artifact.content}</pre>
        <div className="panel-actions"><Button size="sm" disabled={busy||active} onClick={edit}>Edit in session</Button><Button size="sm" disabled={busy||active} onClick={()=>void perform(async()=>{if(target)setDestination(await window.theseus!.chooseResearchDestination(target));})}>Export Markdown…</Button></div>
        {active&&<p className="demo-note">Wait for this run to finish before editing or exporting.</p>}
        {destination&&target&&<div className="panel-export"><p className="panel-pre">Destination: {destination.path}</p><Button size="sm" variant="primary" disabled={busy||active} onClick={()=>void perform(async()=>{const result=await window.theseus!.publishResearch({...target,token:destination.token,intent:'export-markdown'});setDestination(null);setNotice(result.state==='exported'?`Exported to ${result.path}`:'Export cancelled.');})}>Export saved {labels[selected.kind].toLowerCase()}…</Button></div>}
      </>}
    </>:<>
      <div className="panel-toolbar"><label className="panel-search"><Icon name="search" size={13}/><input aria-label="Search artifacts" placeholder="Search task, project, or preview…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}}/></label></div>
      <label className="panel-field">Artifact type<select aria-label="Artifact type" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(20);}}><option value="all">All types</option>{researchKinds.map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <Button size="sm" disabled={!window.theseus||busy||!completed.length} onClick={()=>setCreating(!creating)}>{creating?'Close creation form':'Create from a run'}</Button>
      {creating&&<form className="panel-create-artifact" onSubmit={e=>{e.preventDefault();if(!source)return;void perform(async()=>{const state=await window.theseus!.getResearch({runId:source.id});if(state.warning)throw new Error(state.warning);if(!state.document)throw new Error('No saved results available.');if(state.document.artifacts[kind])throw new Error('This artifact already exists. Open it from the list to edit it.');const result=await window.theseus!.generateResearch({runId:source.id,kind,revision:state.document.revision});if(result.warning)throw new Error(result.warning);await refresh();setCreating(false);setNotice(`${labels[kind]} created from saved results.`);});}}>
        <label className="panel-field">Source run<select aria-label="Source run" value={source?.id??''} onChange={e=>setRunId(e.target.value)}>{completed.map(run=><option value={run.id} key={run.id}>{run.projectName} · {run.task.slice(0,70)}</option>)}</select></label>
        <label className="panel-field">Create type<select aria-label="Create type" value={kind} onChange={e=>setKind(e.target.value as ResearchKind)}>{researchKinds.map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>
        <Button type="submit" size="sm" variant="primary" disabled={busy||!source}>Create {labels[kind].toLowerCase()}</Button>
      </form>}
      {loading?<p role="status">Loading saved artifacts…</p>:!visible.length?<p className="empty-note">{index.artifacts.length?'No artifacts match your filters.':'No saved artifacts yet. Create one from a completed run’s results.'}</p>:<div className="panel-artifact-list">{visible.slice(0,limit).map(item=><button key={key(item)} onClick={()=>void choose(item)}><span className="panel-artifact-kind">{labels[item.kind]} · {item.projectName}</span><b>{item.task}</b><span>{item.preview.slice(0,110)}{item.preview.length>110?'…':''}</span><small>{new Date(item.updatedAt).toLocaleDateString()} · {item.citations} citations</small></button>)}{visible.length>limit&&<button className="overview-link" onClick={()=>setLimit(value=>value+20)}>Show more artifacts ({visible.length-limit} remaining)</button>}</div>}
    </>}
  </section>;
}
