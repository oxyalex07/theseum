import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/app-context';
import { Icon, SectionHeading } from '../common';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { routineTriggerLabel, type Routine, type RoutineState, type RoutineTrigger, type SaveRoutineRequest } from '../../../shared/routines';
import './routines.css';

const empty:RoutineState={routines:[],executions:[],paused:false};
const errorText=(e:unknown)=>e instanceof Error?e.message:'Could not update routines. Refresh and try again.';
const reference=(r:Routine)=>({id:r.id,expectedRevision:r.revision});
const when=(value:string)=>new Date(value).toLocaleString();
function useRoutines(){
  const [state,setState]=useState(empty),[loading,setLoading]=useState(!!window.theseus),[error,setError]=useState('');
  useEffect(()=>{
    if(!window.theseus)return;
    let live=true,received=false;
    const unsubscribe=window.theseus.onRoutines(state=>{received=true;if(live)setState(state);});
    void window.theseus.getRoutines().then(state=>{if(live&&!received)setState(state);}).catch(e=>{if(live)setError(errorText(e));}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;unsubscribe();};
  },[]);
  return {state,setState,loading,error,setError};
}
export function RoutineSummary(){
  const {m,update,select,notify}=useApp(),{state,setState,loading,error,setError}=useRoutines();
  const [query,setQuery]=useState(''),[busy,setBusy]=useState(false);
  const [editor,setEditor]=useState<{routine?:Routine}|null>(null),[enable,setEnable]=useState<Routine|null>(null);
  const pending=useRef(false);
  const act=async(action:()=>Promise<RoutineState>)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{setState(await action());setEnable(null);}catch(e){setError(errorText(e));}finally{pending.current=false;setBusy(false);}
  };
  const disabled=busy||loading||!!state.warning||!window.theseus;
  const visible=state.routines.filter(r=>`${r.name} ${r.profileName} ${r.task}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="sec panel-routines"><SectionHeading icon="cal" title="Saved routines" action={<button onClick={()=>update(d=>{d.page='routines';})}>Manage</button>}/>
    <div className="panel-toolbar"><label className="panel-search"><Icon name="search" size={13}/><input aria-label="Search routines" placeholder="Find a routine…" value={query} onChange={e=>setQuery(e.target.value)}/></label><Button size="sm" disabled={disabled} onClick={()=>setEditor({})}>New routine</Button></div>
    <p className="demo-note">Runs while Theseus is open and awake. Missed occurrences are skipped.</p>
    {state.paused&&<div className="routine-notice"><p>Scheduling is paused.</p><Button size="sm" disabled={disabled} onClick={()=>void act(()=>window.theseus!.resumeRoutines())}>Resume scheduling</Button></div>}
    {(error||state.warning)&&<p role="alert" className="run-error">{error||state.warning}</p>}
    {loading?<p role="status">Loading routines…</p>:!state.routines.length?<p className="empty-note">No saved routines. Choose New routine to schedule a task.</p>:!visible.length?<p className="empty-note">No routines match your search.</p>:visible.map(r=>{
      const attempts=state.executions.filter(e=>e.routineId===r.id),executions=attempts.slice(-3).reverse();
      const active=attempts.some(e=>['preparing','queued','starting','running','cancelling'].includes(e.status));
      return <article key={r.id} className="panel-routine" data-panel-routine-id={r.id}><div className="overview-heading"><h3>{r.name}</h3><Switch aria-label={`Enable ${r.name}`} checked={r.enabled} disabled={disabled} onCheckedChange={enabled=>{setError('');if(enabled)setEnable(r);else void act(()=>window.theseus!.enableRoutine(reference(r),false,false));}}/></div>
        <p>{routineTriggerLabel(r.trigger)}</p><small>{!r.enabled?'Disabled':state.paused?'Scheduling paused':r.nextRunAt?`Next ${when(r.nextRunAt)}`:'Waiting for a live execution event'}</small>
        <div className="panel-actions"><Button size="sm" aria-label={`Run now: ${r.name}`} disabled={disabled||!r.enabled||state.paused||active} onClick={()=>void act(()=>window.theseus!.runRoutineNow(reference(r)))}>Run now</Button><Button size="sm" aria-label={`Edit ${r.name}`} disabled={disabled} onClick={()=>setEditor({routine:r})}>Edit</Button></div>
        <details><summary>Task & recent results</summary><p className="panel-pre">{r.task}</p><p>{r.profileName} · {r.sandbox}</p><p className="panel-pre">{r.projectPath}</p>{!executions.length?<p>No executions yet.</p>:executions.map(e=><div className="panel-execution" key={e.id}><b>{e.status} · {when(e.triggeredAt)}</b>{e.detail&&<p>{e.detail}</p>}{e.runId&&m.runs[e.runId]&&<button className="overview-link" onClick={()=>{select(e.runId!);update(d=>{d.layout='focus';d.showInspector=true;});}}>Open result<Icon name="right" size={12}/></button>}</div>)}</details>
      </article>;
    })}
    {editor&&<RoutineEditor routine={editor.routine} onClose={()=>setEditor(null)} onSaved={value=>{setState(value);setEditor(null);notify('Routine saved.');}}/>}
    {enable&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setEnable(null);}}><DialogContent className="routine-confirm"><DialogTitle>Enable {enable.name}?</DialogTitle><DialogDescription>This allows automatic live Codex execution and may use your account. {enable.profileName} will run with {enable.sandbox} permissions in {enable.projectPath}. {routineTriggerLabel(enable.trigger)}.</DialogDescription><pre className="routine-task-review">{enable.task}</pre>{error&&<p className="run-error" role="alert">{error}</p>}<div className="routine-actions"><Button autoFocus disabled={busy} onClick={()=>setEnable(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={()=>void act(()=>window.theseus!.enableRoutine(reference(enable),true,true))}>{busy?'Saving…':'Allow and enable routine'}</Button></div></DialogContent></Dialog>}
  </div>;
}
export function RoutineSidebar(){
  const {update}=useApp(),{state,loading,error}=useRoutines();
  return <div className="routines"><div className="grp"><Icon name="cal" size={11}/>Saved routines<span className="c"><button onClick={()=>update(d=>{d.page='routines';})}>Manage</button></span></div>{state.warning||error?<p className="demo-note">Scheduling unavailable · open Manage</p>:loading?<p className="demo-note">Loading…</p>:!state.routines.length?<p className="demo-note">No saved routines</p>:state.routines.slice(0,3).map(r=><button key={r.id} className="rt-row" onClick={()=>update(d=>{d.page='routines';})}><Icon name="cal" size={13}/><span className="trunc">{r.name}</span><span className="when">{!r.enabled?'Disabled':state.paused?'Paused':r.nextRunAt?new Date(r.nextRunAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Event'}</span></button>)}</div>;
}
export function RoutinesPage(){
  const {m,select,notify}=useApp(),{state,setState,loading,error,setError}=useRoutines();
  const [editor,setEditor]=useState<{routine?:Routine}|null>(null),[confirmation,setConfirmation]=useState<{routine:Routine;action:'enable'|'delete'}|null>(null),[busy,setBusy]=useState(false);
  const act=async(action:()=>Promise<RoutineState>)=>{setBusy(true);setError('');try{setState(await action());setConfirmation(null);}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  return <div className="page"><div className="page-w routines-page"><div className="routine-heading"><h1><Icon name="cal" size={20}/>Routines</h1><Button variant="primary" disabled={!window.theseus||loading||!!state.warning} onClick={()=>setEditor({})}><Icon name="plus" size={13}/>New routine</Button></div>
    <p>Run a saved Codex agent on a schedule or after a live execution event.</p>
    <p className="demo-note routine-policy">Theseus must be open and awake. Closing with the menu bar enabled keeps scheduling active; quitting stops it. Missed schedules and offline events are skipped, with no catch-up or automatic retry. Each routine runs one occurrence at a time.</p>
    {!window.theseus&&<p role="status" className="empty-note">Open the Electron app to save routines and execute live work. Browser preview does not schedule jobs.</p>}
    {state.paused&&<div className="routine-notice"><p>Scheduling paused. Enabled routines will resume only when you choose to continue. Repair any storage problem before resuming.</p><Button disabled={busy} onClick={()=>void act(()=>window.theseus!.resumeRoutines())}>Resume scheduling</Button></div>}
    {(state.warning||error)&&<p role="alert" className="run-error">{state.warning||error}</p>}
    {loading?<p role="status">Loading saved routines…</p>:!state.routines.length?<div className="routine-empty"><Icon name="cal" size={24}/><h2>No saved routines</h2><p>Choose a project, agent and task. Review permissions before enabling automatic execution.</p></div>:<div className="routine-list" aria-label="Saved routines">{state.routines.map(r=>{
      const active=state.executions.find(e=>e.routineId===r.id&&['preparing','queued','starting','running','cancelling'].includes(e.status));
      const last=state.executions.filter(e=>e.routineId===r.id).at(-1);
      return <article className="routine-row" key={r.id} data-routine-id={r.id}><div className="routine-description"><h2>{r.name}</h2><p>{routineTriggerLabel(r.trigger)}</p><small>{r.profileName} · {r.sandbox} · {r.useWorktree?'Managed worktree':'Project checkout'}</small><small className="routine-path">{r.projectPath}</small></div><div className="routine-status"><b>{!r.enabled?'Disabled':state.paused?'Scheduling paused':r.nextRunAt?`Next ${when(r.nextRunAt)}`:'Waiting for event'}</b><small>{active?`Execution ${active.status}`:last?`Last: ${last.status} · ${when(last.endedAt??last.triggeredAt)}`:'No executions yet'}</small></div><div className="routine-actions"><Switch aria-label={`Enable ${r.name}`} checked={r.enabled} disabled={busy||!!state.warning} onCheckedChange={enabled=>{setError('');if(enabled)setConfirmation({routine:r,action:'enable'});else void act(()=>window.theseus!.enableRoutine(reference(r),false,false));}}/><Button size="sm" aria-label={`Edit ${r.name}`} disabled={busy||!!state.warning} onClick={()=>setEditor({routine:r})}>Edit</Button><Button size="sm" aria-label={`Run now: ${r.name}`} disabled={busy||!r.enabled||state.paused||!!active||!!state.warning} onClick={()=>void act(()=>window.theseus!.runRoutineNow(reference(r)))}>Run now</Button><Button size="sm" aria-label={`Delete ${r.name}…`} variant="ghost" disabled={busy||!!state.warning} onClick={()=>{setError('');setConfirmation({routine:r,action:'delete'});}}>Delete…</Button></div></article>;
    })}</div>}
    <section className="routine-history" aria-label="Routine execution history"><h2>Execution history</h2><p className="demo-note">Latest 500 attempts across all routines, including deleted routines. Results open the real run output while it remains in History. Completion and failure notifications follow Notifications & focus preferences.</p>{!state.executions.length?<p className="empty-note">No routine has fired yet.</p>:<ol>{[...state.executions].reverse().map(e=><li key={e.id} data-execution-status={e.status}><div><b>{e.routineName}</b><small>{when(e.triggeredAt)} · configuration {e.revision} · {e.triggerKey.startsWith('schedule:')?'Scheduled':e.triggerKey.startsWith('event:')?'Execution event':'Run now'}</small>{e.detail&&<p>{e.detail}</p>}</div><span>{e.status}</span>{e.runId&&m.runs[e.runId]?<Button size="sm" aria-label={`View result: ${e.routineName}`} onClick={()=>select(e.runId!)}>View result</Button>:e.runId?<span className="muted">Result unavailable in History</span>:null}</li>)}</ol>}</section>
    {editor&&<RoutineEditor routine={editor.routine} onClose={()=>setEditor(null)} onSaved={value=>{setState(value);setEditor(null);notify('Routine saved.');}}/>}
    {confirmation&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setConfirmation(null);}}><DialogContent className="routine-confirm"><DialogTitle>{confirmation.action==='enable'?`Enable ${confirmation.routine.name}?`:`Delete ${confirmation.routine.name}?`}</DialogTitle><DialogDescription>{confirmation.action==='enable'?`This allows automatic live Codex execution and may use your account. ${confirmation.routine.profileName} will run the saved task with ${confirmation.routine.sandbox} permissions in ${confirmation.routine.projectPath}. ${routineTriggerLabel(confirmation.routine.trigger)}. Routine-generated runs never trigger other routines.`:'The saved routine will be removed. Pending starts and queued runs are cancelled. Already running work continues with its saved configuration; execution history is kept.'}</DialogDescription>{confirmation.action==='enable'&&<pre className="routine-task-review">{confirmation.routine.task}</pre>}{error&&<p className="run-error" role="alert">{error}</p>}<div className="routine-actions"><Button autoFocus disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</Button><Button variant={confirmation.action==='enable'?'primary':'destructive'} disabled={busy} onClick={()=>void act(()=>confirmation.action==='enable'?window.theseus!.enableRoutine(reference(confirmation.routine),true,true):window.theseus!.deleteRoutine(reference(confirmation.routine)))}>{busy?'Saving…':confirmation.action==='enable'?'Allow and enable routine':'Delete routine'}</Button></div></DialogContent></Dialog>}
  </div></div>;
}
function RoutineEditor({routine,onClose,onSaved}:{routine?:Routine;onClose:()=>void;onSaved:(state:RoutineState)=>void}){
  const {profiles,update}=useApp();
  const available=profiles.filter(p=>!p.archivedAt),initialProfile=routine?available.find(p=>p.id===routine.profileId):available[0];
  const [draft,setDraft]=useState<SaveRoutineRequest>({id:routine?.id,expectedRevision:routine?.revision,name:routine?.name??'',task:routine?.task??'',trigger:routine?.trigger??{kind:'weekly',time:'08:00',days:[1,2,3,4,5]},enabled:routine?.enabled??false,profileId:initialProfile?.id??'',profileUpdatedAt:initialProfile?.updatedAt??'',useWorktree:routine?.useWorktree??false,folderChoice:null,executionConsent:false});
  const [folder,setFolder]=useState(routine?.projectPath??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false);
  const change=<K extends keyof SaveRoutineRequest>(key:K,value:SaveRoutineRequest[K])=>{setDirty(true);setDraft(d=>({...d,[key]:value}));};
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const close=()=>{if(busy)return;if(dirty)setDiscard(true);else onClose();};
  const choose=async()=>{setBusy(true);setError('');try{const folder=await window.theseus!.selectAgentFolder();if(folder){setFolder(folder.path);change('folderChoice',folder.id);}}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  const save=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{onSaved(await window.theseus!.saveRoutine(draft));}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  const selected=available.find(p=>p.id===draft.profileId);
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="routine-editor"><DialogTitle>{routine?'Edit routine':'New routine'}</DialogTitle><DialogDescription>Define the actual task, execution permissions and trigger.</DialogDescription>{discard?<div><h2>Discard routine changes?</h2><div className="routine-actions"><Button autoFocus onClick={()=>setDiscard(false)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard changes</Button></div></div>:<form onSubmit={event=>void save(event)}>
    <label htmlFor="routine-name">Routine name</label><input id="routine-name" autoFocus required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)}/>
    <label htmlFor="routine-task">Task to execute</label><textarea id="routine-task" required rows={4} maxLength={32000} value={draft.task} onChange={e=>change('task',e.target.value)}/>
    <label htmlFor="routine-agent">Saved agent</label><select id="routine-agent" required value={draft.profileId} onChange={e=>{const profile=available.find(p=>p.id===e.target.value);if(profile){change('profileId',profile.id);change('profileUpdatedAt',profile.updatedAt);}}}>{!selected&&<option value="">{available.length?'Choose an available saved agent':'Create an agent first'}</option>}{available.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sandbox}</option>)}</select>
    {routine&&selected&&routine.profileUpdatedAt!==selected.updatedAt&&<p role="status" className="demo-note">This agent changed since the routine was saved. Review its current permissions below before saving.</p>}
    {selected?<p className="demo-note">{selected.sandbox} · approvals never · timeout {selected.timeoutSeconds}s (app limits apply). Model: {selected.model??'runtime default'}. Agent changes require reviewing and saving this routine again. No memory, files or pages are attached automatically.</p>:<Button onClick={()=>{onClose();update(d=>{d.page='crew';});}}>Create a saved agent</Button>}
    <label>Project folder</label><p className="routine-path" data-testid="routine-folder">{folder||'Choose a project before saving'}</p><Button disabled={busy} onClick={()=>void choose()}>Choose routine project</Button>
    <label htmlFor="routine-location">Run location</label><select id="routine-location" value={draft.useWorktree?'worktree':'project'} onChange={e=>change('useWorktree',e.target.value==='worktree')}><option value="project">Selected project checkout</option><option value="worktree">New managed worktree from committed HEAD</option></select>
    <label htmlFor="routine-trigger">Trigger</label><select id="routine-trigger" value={draft.trigger.kind} onChange={e=>change('trigger',e.target.value==='interval'?{kind:'interval',minutes:60}:e.target.value==='weekly'?{kind:'weekly',time:'08:00',days:[1,2,3,4,5]}:{kind:e.target.value as 'run-completed'|'run-failed'})}><option value="weekly">Weekly / daily at UTC time</option><option value="interval">Every N minutes</option><option value="run-completed">Manual live run succeeds in this project</option><option value="run-failed">Manual live run fails in this project</option></select>
    {draft.trigger.kind==='interval'&&<><label htmlFor="routine-minutes">Interval in minutes</label><input id="routine-minutes" type="number" required min={1} max={10080} step={1} value={draft.trigger.minutes} onChange={e=>change('trigger',{kind:'interval',minutes:Number(e.target.value)})}/></>}
    {draft.trigger.kind==='weekly'&&<><label htmlFor="routine-time">Time (UTC)</label><input id="routine-time" type="time" required value={draft.trigger.time} onChange={e=>change('trigger',{...draft.trigger as Extract<RoutineTrigger,{kind:'weekly'}>,time:e.target.value})}/><fieldset className="routine-days"><legend>Days (UTC)</legend>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,index)=>{const trigger=draft.trigger as Extract<RoutineTrigger,{kind:'weekly'}>;return <label key={day}><input type="checkbox" checked={trigger.days.includes(index)} onChange={e=>change('trigger',{...trigger,days:e.target.checked?[...trigger.days,index]:trigger.days.filter(d=>d!==index)})}/>{day}</label>;})}</fieldset><p className="demo-note">UTC times do not change with daylight saving time. Next run is shown in your system’s local time.</p></>}
    <p className="demo-note">Events apply once per manual live run ID, excluding all routine runs and their follow-ups. Offline events are never replayed. Busy routines skip overlapping triggers. A busy live slot queues work unless your overflow preference requires approval, in which case the attempt fails visibly.</p>
    <label className="routine-check"><input type="checkbox" checked={draft.enabled} onChange={e=>{change('enabled',e.target.checked);change('executionConsent',false);}}/>Enable automatic execution</label>
    {draft.enabled&&<label className="routine-check"><input type="checkbox" checked={draft.executionConsent} onChange={e=>change('executionConsent',e.target.checked)}/>I allow this task to run automatically with the selected agent’s permissions and account usage.</label>}
    <p className="demo-note">Saving or enabling starts with the next future occurrence. Editing, disabling or deleting cancels pending starts and queued work. Already running tasks continue. No background daemon or automatic retry is installed.</p>
    {error&&<p className="run-error" role="alert">{error}</p>}<footer className="routine-actions"><Button disabled={busy} onClick={close}>Cancel</Button><Button type="submit" variant="primary" disabled={busy||!selected||!folder||draft.enabled&&!draft.executionConsent}>{busy?'Saving…':routine?'Save routine changes':'Save routine'}</Button></footer>
  </form>}</DialogContent></Dialog>;
}
