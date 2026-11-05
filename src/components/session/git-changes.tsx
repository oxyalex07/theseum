import { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/state/app-context';
import { applyAgentRun, selectSession } from '@/state/model';
import { isActiveRun } from '../../../shared/bridge';
import { checksFor, reviewResult, type GitSnapshot } from '../../../shared/git';
import { Button } from '../ui/button';
import type { GitView } from '@/lib/session-overview';

export function GitChanges({id,initialView}:{id:string;initialView?:GitView}){
  const {m,update,select}=useApp();
  const run=m.runs[id];
  const [snapshot,setSnapshot]=useState<GitSnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[notice,setNotice]=useState('');
  const [tab,setTab]=useState<GitView>(initialView??(run?.gitWorkflow?'review':'files'));
  const root=run?.gitWorkflow?.rootRunId??id;
  const workflowRuns=Object.values(m.runs).filter(r=>r.gitWorkflow?.rootRunId===root).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  const work=workflowRuns[0],resultRun=workflowRuns.find(r=>reviewResult(r));
  const result=resultRun?reviewResult(resultRun):null;
  const active=Object.values(m.runs).some(r=>isActiveRun(r.status));
  const refresh=useCallback(async()=>{
    if(!window.theseus)return;
    setLoading(true);
    try{setSnapshot(await window.theseus.getGitSnapshot({runId:id}));setError('');}
    catch(e){setError(e instanceof Error?e.message:'Could not load Git changes.');setSnapshot(null);}
    finally{setLoading(false);}
  },[id]);
  useEffect(()=>{void refresh();},[refresh,run?.status,work?.status]);
  useEffect(()=>{const focus=()=>{void refresh();};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[refresh]);
  async function action(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Git action failed.');}finally{setBusy(false);}}
  async function start(kind:'review'|'fix',findingIndex?:number){await action(async()=>{
    const next=await window.theseus!.startGitWork({runId:id,kind,...(kind==='fix'?{reviewRunId:resultRun?.id,findingIndex}:{})});
    update(d=>{applyAgentRun(d,next);selectSession(d,next.id);});
  });}
  if(!window.theseus)return <p className="empty-note">Git changes require the desktop app.</p>;
  return <div className="git-changes">
    <div className="sec"><div className="sec-h">Repository <Button size="sm" disabled={loading||busy} onClick={()=>void refresh()}>{loading?'Loading…':'Refresh'}</Button></div>
      {error&&<p className="run-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
      {snapshot&&<><p className="mono break-all">{snapshot.branch} · {snapshot.head?snapshot.head.slice(0,10):'No commits yet'}</p><small className="muted break-all">{snapshot.path}</small>
        {snapshot.pr?<><h3>PR #{snapshot.pr.number} · {snapshot.pr.title}</h3><p>{snapshot.pr.headRefName} → {snapshot.pr.baseRefName} · {snapshot.pr.isDraft?'Draft':snapshot.pr.state.toLowerCase()} · {snapshot.pr.mergeStateStatus.toLowerCase()}</p><div className="btns"><Button size="sm" disabled={busy} onClick={()=>void action(()=>window.theseus!.openGitPullRequest({runId:id}))}>Open GitHub PR</Button><Button size="sm" disabled={busy||active||snapshot.pr.state!=='OPEN'} onClick={()=>void action(async()=>{const merged=await window.theseus!.mergeGitPullRequest({runId:id,url:snapshot.pr!.url,head:snapshot.pr!.headRefOid});setNotice(merged.message);await refresh();})}>Merge PR…</Button></div></>:<p className="demo-note">No PR loaded.</p>}
        {snapshot.githubError&&<p className="demo-note">{snapshot.githubError}</p>}
        <Button size="sm" variant="primary" disabled={busy||active||loading} onClick={()=>void start('review')}>Ask Sentinel to review</Button><p className="demo-note">Starts a real Codex review with read-only file access.</p>
      </>}
    </div>
    {snapshot&&<><div className="subt" aria-label="Git views">{(['files','commits','checks','review'] as const).map(key=><button key={key} className={tab===key?'on':''} onClick={()=>setTab(key)}>{key[0].toUpperCase()+key.slice(1)}</button>)}</div>
      {tab==='files'?<div className="sec"><b>Working tree status</b><pre className="git-code">{snapshot.status||'Clean working tree'}</pre><details open><summary>Working tree diff · staged, unstaged, untracked</summary><pre className="git-code">{snapshot.diff||'No local file changes.'}</pre></details>{snapshot.prDiff!==undefined&&<details><summary>Pull request diff</summary><pre className="git-code">{snapshot.prDiff||'No PR diff.'}</pre></details>}{snapshot.upstream&&<details><summary>Local branch vs {snapshot.upstream}</summary><pre className="git-code">{snapshot.upstreamError||snapshot.branchDiff||'No changes ahead of local upstream ref.'}</pre></details>}</div>:
      tab==='commits'?<div className="sec"><p className="demo-note">Latest 20 local commits</p><pre className="git-code">{snapshot.commits||'No commits yet.'}</pre></div>:
      tab==='checks'?<div className="sec">{snapshot.pr?<><p>GitHub review: {snapshot.pr.reviewDecision||'No review decision'}</p>{checksFor(snapshot.pr).length?checksFor(snapshot.pr).map((c,i)=><div className="git-check" key={i}><b>{c.name}</b><span>{c.conclusion||c.status}</span></div>):<p className="empty-note">GitHub reports no checks.</p>}</>:<p className="empty-note">Load a GitHub PR to view its checks.</p>}<p className="demo-note">Refresh to retrieve current checks. Merge rechecks GitHub before proceeding.</p></div>:
      <div className="sec">{!work?<p className="empty-note">Start a review to find actionable issues in this checkout.</p>:<><p><button onClick={()=>select(work.id)}>Open {work.gitWorkflow?.kind} run</button> · {work.status}</p>{result?<>{resultRun?.id!==work.id&&<p className="demo-note">Latest work has no completed review result. Earlier findings remain below until a new result is verified.</p>}<p className="git-summary">{result.summary}</p>{result.findings.length?<>{result.findings.map((f,i)=><div className="git-finding" key={i}><small>{f.severity.toUpperCase()} · {f.path}</small><b>{f.title}</b><p>{f.detail}</p><Button size="sm" disabled={busy||active} onClick={()=>void start('fix',i)}>Fix</Button></div>)}<Button size="sm" variant="primary" disabled={busy||active} onClick={()=>void start('fix')}>Have Forge fix all</Button></>:<p role="status">{resultRun?.gitWorkflow?.kind==='fix'?'Fix run reports no remaining findings.':'Review reports no actionable findings.'}</p>}<p className="demo-note">Results describe this run’s review. Refresh changes and review again after edits. Fixes start real Codex work and are only reported from its completed result.</p></>:<p className="empty-note">{isActiveRun(work.status)?'Work in progress. Findings appear after a completed result.':'No verified review result. Inspect the run output and review again; findings have not been marked fixed.'}</p>}</>}</div>}
    </>}
  </div>;
}
