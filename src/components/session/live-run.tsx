import { taskInvocations } from '../../../shared/task-context';
import { ResearchPanel } from './research';
import { executionSandbox } from '../../../shared/crew';
import { gitWorkTitle } from '../../../shared/git';
import { GitChanges } from './git-changes';
import { RememberThis } from '../memory/editor';
import { useMemory } from '@/state/memory-context';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/app-context';
import { isActiveRun, type AgentRun, type RunOutput as OutputEntry } from '../../../shared/bridge';
import { Avatar, Icon, StatusPill } from '../common';
import { ProfileMark } from '../profile-mark';
import { Button } from '../ui/button';
import { ProjectTerminal } from '../project-terminal';
import { ProjectPreviewPanel } from '../project-preview';
import { RunOverview } from './overview';
import type { RunInspectorTab, GitView } from '@/lib/session-overview';

function ToolOutput({entry}:{entry:OutputEntry}){
  const {m}=useApp();const [open,setOpen]=useState(()=>!m.settings.values.toolsCollapsed);
  return <details className={`run-entry run-${entry.kind}`} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{entry.kind} · {entry.text.split('\n')[0].slice(0,100)}</summary><pre className="whitespace-pre-wrap break-words">{entry.text}</pre></details>;
}
export function RunOutput({run}:{run:AgentRun}){
  const ref=useRef<HTMLDivElement>(null);const follow=useRef(true);
  useEffect(()=>{if(ref.current&&follow.current)ref.current.scrollTop=ref.current.scrollHeight;},[run.revision]);
  return <div className="thread live-output" ref={ref} role="log" aria-label="Live Codex output" onScroll={()=>{const el=ref.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;}}>
    {run.truncated&&<p className="demo-note">Earlier output was trimmed to keep the app responsive.</p>}
    {run.output.map(entry=>['command','output','file'].includes(entry.kind)?<ToolOutput key={entry.sequence} entry={entry}/>:<pre key={entry.sequence} className={`run-entry run-${entry.kind}`}><span className="run-entry-kind">{entry.kind}</span>{entry.text}</pre>)}
    {run.status==='starting'&&<div className="think"><span className="dots"><i/><i/><i/></span>Checking Codex…</div>}
  </div>;
}
export function LiveRunConversation({id}:{id:string}){
  const {m,cancelLive,update,select}=useApp();const run=m.runs[id];
  if(!run)return <div className="empty-note">Loading run…</div>;
  return <section className="cv" data-run-id={run.id}><header className="cv-h"><>{run.agentConfiguration?.profile?<ProfileMark profile={run.agentConfiguration.profile} size={30}/>:<Avatar id={run.crew?.role??"forge"} agent={m.agents[run.crew?.role??"forge"]} size={30}/>}</><div className="ttl"><b className="trunc">{gitWorkTitle(run).slice(0,60)}</b><span>Codex · {run.crew?m.agents[run.crew.role].n:run.agentConfiguration?.profile?.name??'live'} · {run.projectName}</span></div><StatusPill status={run.status}/>{isActiveRun(run.status)&&<Button size="sm" variant="destructive" disabled={run.status==='cancelling'} onClick={()=>void cancelLive(run.id)}><Icon name="x" size={12}/>{run.status==='cancelling'?'Cancelling…':'Cancel run'}</Button>}</header>
    <div className="run-context">{run.persistenceError&&<div className="run-error sec" role="alert">{run.persistenceError}</div>}
    <div className="run-task"><span className="live-badge">LIVE CODEX</span><span className="mono trunc" title={run.executionPath??run.projectPath}>{run.executionPath??run.projectPath}</span>{run.gitWorkflow?<><p>{run.gitWorkflow.kind==='review'?'Review Git changes and report actionable findings.':'Fix selected findings, verify changes, and report any remaining issues.'}</p><details><summary>Task instructions</summary><pre className="git-task-instructions">{run.task}</pre></details></>:<><p>{run.task}</p><RememberThis seed={{text:run.task,scope:{kind:'project',projectPath:run.projectPath},source:{kind:'run-task',runId:run.id}}}/></>}</div>
    {run.taskContextSelection&&<details className="run-task"><summary>Included task context · {run.taskContextSelection.files.length} file(s)</summary><p>Reviewed file snapshots were supplied at task start. Follow-ups use the saved Codex conversation; reruns require a new context selection.</p>{run.taskContextSelection.files.map(file=><p key={file.fileId}><b>{file.path}</b> · reviewed {new Date(file.reviewedAt).toLocaleString()}<br/><small>SHA-256 {file.sha256}</small></p>)}{run.taskContextSelection.invocationIds.map(id=><p key={id}>{taskInvocations.find(item=>item.id===id)?.token} · built-in prompt workflow</p>)}</details>}
    {!!run.pageSelection?.length&&<div className="run-task"><b>Selected web page context · {run.pageSelection.length}</b>{run.pageSelection.map(p=><p key={p.id} className="browser-source">{p.title} · {p.url} · captured {new Date(p.capturedAt).toLocaleString()}</p>)}</div>}
    {run.crew&&<nav className="run-task" aria-label="Live crew steps"><b>Crew · {m.agents[run.crew.role].role} · {executionSandbox(run)}</b><div className="btns">{Object.values(m.runs).filter(r=>r.crew?.id===run.crew!.id).map(step=><Button key={step.id} size="sm" aria-current={step.id===run.id?'step':undefined} onClick={()=>select(step.id)}>{m.agents[step.crew!.role].n} · {step.status}</Button>)}</div></nav>}
    </div><RunOutput run={run}/>
    <div className="run-bottom"><footer className="run-footer"><span data-testid="run-status" data-status={run.status}>{run.status==='queued'?'Queued':run.status==='starting'?'Starting':run.status==='running'?'Running':run.status==='cancelling'?'Cancelling':run.status==='completed'?'Completed':run.status==='cancelled'?'Cancelled':run.status==='interrupted'?'Interrupted':'Failed'}</span><span className="muted">{run.status==='queued'?'Waiting for a live slot or project checkout.':isActiveRun(run.status)?'Output comes directly from Codex.':run.status==='interrupted'?'Tracking ended · not resumed or rerun.':run.status==='cancelled'?'Process stopped · existing file changes were kept.':run.status==='completed'?'Codex exited successfully.':'Review the error above before continuing.'}</span>{!isActiveRun(run.status)&&<Button size="sm" onClick={()=>update(d=>{d.page='home';})}>New task</Button>}</footer><FollowUpComposer key={run.id} run={run}/></div>
  </section>;
}
function FollowUpComposer({run}:{run:AgentRun}){
  const {m,update,continueLive}=useApp();
  const [sending,setSending]=useState(false);const [error,setError]=useState('');const pending=useRef(false);
  const draft=m.drafts[run.id]??'';
  const unavailable=!run.threadId;
  const crewBusy=!!run.crew&&Object.values(m.runs).some(r=>r.crew?.id===run.crew!.id&&isActiveRun(r.status));
  const busy=isActiveRun(run.status)||crewBusy;
  const hint=crewBusy?'Wait for all crew steps to finish before sending a follow-up.':busy?'Wait for this turn to finish, or cancel it before sending a follow-up.':unavailable?'Continuation unavailable: this run has no saved Codex thread. Start a new task to work on it.':run.status==='interrupted'?'Tracking was interrupted. Review the output and files before continuing the saved conversation.':'Continue this conversation in the same folder with its saved agent configuration.';
  const submit=async()=>{
    if(pending.current||busy||unavailable||!draft.trim())return;
    pending.current=true;setSending(true);setError('');
    try{await continueLive(run.id,draft);update(d=>{if(d.drafts[run.id]===draft)d.drafts[run.id]='';});}
    catch(e){setError(e instanceof Error?e.message:'Could not continue Codex. Your message has been kept.');}
    finally{pending.current=false;setSending(false);}
  };
  return <form className="cmp live-follow-up" onSubmit={e=>{e.preventDefault();void submit();}}>
    <p id={`follow-up-hint-${run.id}`} className="demo-note">{hint}</p>
    <div className="box"><textarea aria-label="Follow-up message" aria-describedby={`follow-up-hint-${run.id}`} placeholder="Message Codex…" maxLength={32000} disabled={unavailable||sending} value={draft} onChange={e=>update(d=>{d.drafts[run.id]=e.target.value;})} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit();}}}/>
    <div className="box-f"><span className="muted">Shift+Enter for a new line</span><span style={{flex:1}}/><Button type="submit" size="sm" disabled={busy||unavailable||sending||!draft.trim()}>{sending?'Sending…':'Send follow-up'}</Button></div></div>
    {error&&<p role="alert" className="run-error">{error}</p>}
  </form>;
}
export function LiveRunInspector({id}:{id:string}){
  const {m,update}=useApp();
  const {tab='overview',gitView,artifactKind}=m.runInspectorViews[id]??{};
  const open=(tab:RunInspectorTab,gitView?:GitView)=>update(d=>{d.runInspectorViews[id]={tab,gitView,artifactKind};});
  const run=m.runs[id];
  return <aside className="insp session-inspector"><nav className="itabs research-run-tabs" aria-label="Run inspector">{(['overview','changes','research','terminal','preview','details'] as const).map(key=><button key={key} aria-current={tab===key?'page':undefined} className={tab===key?'on':''} onClick={()=>open(key)}>{({overview:'Overview',changes:'Git changes',research:'Research',terminal:'Terminal',preview:'Preview',details:'Run details'})[key]}</button>)}</nav><div className="ibody"><div hidden={tab!=='research'}><ResearchPanel key={`${id}-${artifactKind??'draft'}`} id={id} initialKind={artifactKind}/></div>{tab==='overview'?(run?<RunOverview key={id} run={run} open={open}/>:<p className="empty-note">Loading run…</p>):tab==='research'?null:tab==='changes'?<GitChanges key={`${id}-${gitView??'default'}`} id={id} initialView={gitView}/>:tab==='terminal'?<ProjectTerminal target={{runId:id}}/>:tab==='preview'?<ProjectPreviewPanel target={{runId:id}}/>:<RunDetails id={id}/>}</div></aside>;
}
function RunDetails({id}:{id:string}){
  const {m}=useApp();const {graph}=useMemory();const run=m.runs[id];if(!run)return null;
  return <><div className="sec"><div className="sec-h"><Icon name="code" size={12}/>Codex · real execution</div><dl className="run-details"><dt>Status</dt><dd><StatusPill status={run.status}/></dd><dt>Project</dt><dd>{run.projectName}</dd><dt>Folder</dt><dd className="mono break-all">{run.projectPath}</dd>{run.executionPath&&<><dt>Worktree</dt><dd className="mono break-all">{run.executionPath}</dd></>}<dt>Started</dt><dd>{new Date(run.startedAt).toLocaleString()}</dd>{run.endedAt&&<><dt>{run.status==='interrupted'?'Tracking ended':'Ended'}</dt><dd>{new Date(run.endedAt).toLocaleString()}</dd></>}{run.exitCode!==undefined&&<><dt>Exit code</dt><dd>{run.exitCode}</dd></>}{run.signal&&<><dt>Signal</dt><dd>{run.signal}</dd></>}</dl></div>{run.agentConfiguration?.profile&&<div className="sec"><div className="sec-h"><Icon name="users" size={12}/>Saved configuration snapshot</div><dl className="run-details"><dt>Agent</dt><dd>{run.agentConfiguration.profile.name}</dd><dt>Version</dt><dd>{new Date(run.agentConfiguration.profile.updatedAt).toLocaleString()}</dd><dt>Model</dt><dd>{run.agentConfiguration.profile.model??'Runtime default'}</dd><dt>Reasoning</dt><dd>{run.agentConfiguration.profile.reasoningEffort??'Runtime default'}</dd><dt>Sandbox</dt><dd>{executionSandbox(run)}</dd><dt>Time limit</dt><dd>{run.agentConfiguration.timeoutSeconds}s</dd><dt>Runtime</dt><dd>{run.agentConfiguration.runtimeVersion??'Version unknown'}</dd></dl><details className="mt-4"><summary>Saved instructions</summary><pre className="whitespace-pre-wrap break-words text-xs mt-3">{run.agentConfiguration.profile.instructions||'No additional instructions'}</pre></details></div>}{run.memorySelection&&run.memorySelection.length>0&&<div className="sec"><div className="sec-h">Selected memory references · {run.memorySelection.length}</div><p className="demo-note">Versions explicitly approved for this run. Deleting memory removes its text from this store; run output remains separate.</p>{run.memorySelection.map(ref=>{const fact=graph.records.find(r=>r.id===ref.id);return <div key={ref.id} className="memory-run-reference"><b>{fact?.label??'Memory removed'}</b>{fact&&<p>{fact.meaning}</p>}<small>{fact?.status??'deleted'} · {ref.id}</small></div>;})}</div>}{run.error&&<div className="sec run-error" role="alert">{run.error}</div>}<div className="sec"><div className="sec-h"><Icon name="shield" size={12}/>Execution policy</div><p className="why">Codex runs in its {executionSandbox(run)} sandbox. {executionSandbox(run)==='read-only'?'Project writes are restricted by Codex.':'It can modify the selected project.'} Non-interactive approvals are set to never; operations requiring approval are denied rather than shown as a mock approval.</p>{run.agentConfiguration?.safetyPolicy&&<p className="why">Sandbox command network: blocked. Run time limit: {run.agentConfiguration.timeoutSeconds}s. Command allowlists and ask-first rules are unsupported. Browser and configured MCP tools have separate access controls.</p>}<p className="demo-note">Sample memories, skills, and usage meters are not connected to this run. Cancellation does not undo files already changed.</p></div></>;
}
