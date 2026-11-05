import type { AgentRun } from './bridge';
export interface GitTarget { runId:string }
export interface GitCheck { name:string; status:string; conclusion:string }
export interface PullRequest { number:number; title:string; url:string; headRefName:string; baseRefName:string; headRefOid:string; state:string; isDraft:boolean; mergeStateStatus:string; reviewDecision:string; statusCheckRollup:({name?:string;context?:string;status?:string;state?:string;conclusion?:string})[] }
export interface GitSnapshot { path:string; branch:string; head:string; status:string; diff:string; commits:string; upstream?:string; upstreamError?:string; branchDiff?:string; prDiff?:string; pr:PullRequest|null; githubError?:string }
export interface GitWorkflow { rootRunId:string; kind:'review'|'fix'; baseline:string }
export interface Finding { severity:'high'|'medium'|'low'; title:string; path:string; detail:string }
export interface ReviewResult { findings:Finding[]; summary:string }
export function reviewResult(run:AgentRun):ReviewResult|null {
  if(run.status!=='completed'||!run.gitWorkflow)return null;
  const text=run.output.filter(e=>e.kind==='message').at(-1)?.text?.trim();if(!text)return null;
  try{const r=JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    if(typeof r.summary!=='string'||!Array.isArray(r.findings)||r.findings.length>100)return null;
    if(r.findings.some((f:Finding)=>!f||!['high','medium','low'].includes(f.severity)||['title','path','detail'].some(k=>typeof (f as unknown as Record<string,unknown>)[k]!=='string')))return null;
    return r;
  }catch{return null;}
}
export const checksFor=(pr:PullRequest):GitCheck[]=>pr.statusCheckRollup.map(c=>({name:c.name??c.context??'Check',status:c.status??c.state??'UNKNOWN',conclusion:c.conclusion??c.state??''}));
export const checksPass=(pr:PullRequest)=>checksFor(pr).every(c=>['SUCCESS','NEUTRAL','SKIPPED'].includes(c.conclusion));

export const gitWorkTitle=(run:AgentRun)=>run.gitWorkflow?`${run.gitWorkflow.kind==='fix'?'Fix review findings':'Review Git changes'} · ${run.projectName}`:run.task;
