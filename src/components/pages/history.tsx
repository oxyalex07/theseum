import { useEffect, useState } from 'react';
import { useApp } from '@/state/app-context';
import { isActiveRun, type DeleteHistoryRequest } from '../../../shared/bridge';
import { Icon, StatusPill } from '../common';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { RunRetentionControl } from './run-retention';

export function HistoryPage(){
  const {m,select,update,historyWarning,deleteHistory,prepareRerun}=useApp();
  const [query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[pending,setPending]=useState<DeleteHistoryRequest|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const runs=Object.values(m.runs).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)||b.id.localeCompare(a.id));
  const visible=runs.filter(run=>`${run.task} ${run.projectPath} ${run.status}`.toLowerCase().includes(query.toLowerCase()));
  const eligible=visible.filter(run=>!isActiveRun(run.status));
  useEffect(()=>{setSelected(ids=>ids.filter(id=>m.runs[id]&&!isActiveRun(m.runs[id].status)));},[m.runs]);
  async function erase(){if(!pending)return;setBusy(true);setError('');try{const state=await deleteHistory(pending);setSelected(ids=>ids.filter(id=>!state.deletedIds.includes(id)));const remaining='ids' in pending?pending.ids.filter(id=>!state.deletedIds.includes(id)):state.runs.filter(r=>!isActiveRun(r.status)).map(r=>r.id);if(state.warning&&remaining.length){setPending('ids' in pending?{ids:remaining}:pending);setError(state.warning);}else{setPending(null);setError(state.warning??'');}}catch(e){setError(e instanceof Error?e.message:'Could not delete history. Try again.');}finally{setBusy(false);}}
  async function rerun(id:string){setBusy(true);setError('');try{await prepareRerun(id);}catch(e){setError(e instanceof Error?e.message:'Could not prepare rerun. Try again.');}finally{setBusy(false);}}
  return <div className="home"><div className="home-w"><div className="hello"><h1>Run history</h1><p>Saved Codex runs · {runs.length} records · demo sessions excluded</p></div>
    {historyWarning&&<div className="run-error sec" role="alert">{historyWarning}</div>}
    {!pending&&error&&<p className="run-error" role="alert">{error}</p>}
    <label className="search"><Icon name="search" size={13}/><input aria-label="Search run history" placeholder="Search task, project, or status…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="history-toolbar"><label>Keep run history <RunRetentionControl/></label><Button size="sm" disabled={busy||!eligible.length} onClick={()=>setSelected([...new Set([...selected,...eligible.map(r=>r.id)])])}>Select visible finished runs</Button><Button size="sm" disabled={busy||!selected.length} onClick={()=>setSelected([])}>Clear selection</Button><Button size="sm" variant="destructive" disabled={busy||!selected.length} onClick={()=>{setError('');setPending({ids:selected});}}>Delete selected ({selected.length})</Button><Button size="sm" variant="destructive" disabled={busy||!runs.some(r=>!isActiveRun(r.status))} onClick={()=>{setError('');setPending({all:true});}}>Delete all finished runs</Button></div>
    <p className="demo-note">Active runs are protected. Rerun opens a new task for review before execution. Open a saved run to send a follow-up when its Codex thread is available. Conversations never resume automatically.</p>
    <div className="history-list">{visible.map(run=><div className="history-row" key={run.id} data-history-id={run.id}><input type="checkbox" aria-label={`Select run ${run.task}`} disabled={busy||isActiveRun(run.status)} checked={selected.includes(run.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,run.id]:ids.filter(id=>id!==run.id))}/><button className="history-open" onClick={()=>{select(run.id);update(d=>{d.layout='focus';d.showInspector=true;});}}><b className="trunc">{run.task}</b><span className="mono trunc" title={run.projectPath}>{run.projectPath}</span><small>{new Date(run.startedAt).toLocaleString()}{run.endedAt&&` · ended ${new Date(run.endedAt).toLocaleString()}`}</small></button><StatusPill status={run.status}/><Button size="sm" disabled={busy||isActiveRun(run.status)} onClick={()=>void rerun(run.id)}>Review rerun</Button></div>)}</div>
    {!visible.length&&<p className="empty-note">{runs.length?'No runs match your search.':window.theseus?'No saved runs yet. Start a Codex task from Home.':'Persistent run history is available in the Electron app.'}</p>}
    <div><Button onClick={()=>update(d=>{d.page='home';})}>New task</Button></div>
    <Dialog open={pending!==null} onOpenChange={open=>{if(!busy&&!open)setPending(null);}}><DialogContent><DialogTitle>Delete run history permanently?</DialogTitle><DialogDescription>{pending&&'all' in pending?'Delete every finished run, including records hidden by search. Active runs are kept.':`Delete ${pending&&'ids' in pending?pending.ids.length:0} selected run(s) and their saved output.`} Project files and memories are kept. Memories retain their source run ID and saved excerpt after the original run is deleted. This cannot be undone.</DialogDescription>{error&&<p className="run-error" role="alert">{error}</p>}<div className="btns"><Button disabled={busy} onClick={()=>setPending(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={()=>void erase()}>{busy?'Deleting…':'Delete permanently'}</Button></div></DialogContent></Dialog>
  </div></div>;
}
