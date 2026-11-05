import { storedTaskContext } from '../shared/task-context';
import { crewRoles } from '../shared/crew';
import { validateSafetyPolicy } from '../shared/safety';
import { mkdirSync, readdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, chmodSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { isActiveRun, type AgentRun, type RunStatus, type RunOutput, type RunRetention } from '../shared/bridge';
import { storedProfile } from './agent-profiles';
import { validateBrowserUrl } from '../shared/browser';
import { redact } from './codex-protocol';

const statuses:RunStatus[]=['queued','starting','running','cancelling','completed','cancelled','failed','interrupted'];
const kinds:RunOutput['kind'][]=['user','system','message','command','output','file','error'];
const threadIdPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const uuid=/^[a-f0-9-]{36}$/;
const retentionWarning='Could not read retention policy. Automatic deletion is disabled; choose a policy again in Settings.';
// Explicit whitelist: never serialize a child process, environment, login response, or arbitrary IPC fields.
export function storedRun(input:unknown):AgentRun {
  if(!input||typeof input!=='object')throw new Error('Invalid run record');
  const r=input as AgentRun;
  for(const key of ['id','workspaceId','projectName','projectPath','task','startedAt'] as const)if(typeof r[key]!=='string')throw new Error(`Invalid ${key}`);
  if(!uuid.test(r.id)||!uuid.test(r.workspaceId)||!statuses.includes(r.status)||!Number.isSafeInteger(r.revision)||r.revision<0||!Number.isFinite(Date.parse(r.startedAt))||!Array.isArray(r.output)||r.output.length>300)throw new Error('Invalid run metadata');
  if(r.endedAt!==undefined&&(typeof r.endedAt!=='string'||!Number.isFinite(Date.parse(r.endedAt))))throw new Error('Invalid end timestamp');
  let size=0,sequence=0;
  const output=r.output.map(entry=>{
    if(!entry||!kinds.includes(entry.kind)||typeof entry.text!=='string'||!Number.isSafeInteger(entry.sequence)||entry.sequence<=sequence)throw new Error('Invalid output');
    sequence=entry.sequence;size+=entry.text.length;if(size>150_000)throw new Error('Oversized output');
    return {sequence:entry.sequence,kind:entry.kind,text:redact(entry.text)};
  });
  let agentConfiguration:AgentRun['agentConfiguration'];
  if(r.agentConfiguration){
    const c=r.agentConfiguration;
    if(c.approvalPolicy!=='never'||typeof c.timeoutSeconds!=='number'||!Number.isFinite(c.timeoutSeconds)||c.timeoutSeconds<1||c.timeoutSeconds>1800)throw new Error('Invalid run configuration');
    if(!c.profile&&c.runtimeDefaults!==true)throw new Error('Missing execution configuration');
    agentConfiguration={...(c.safetyPolicy?{safetyPolicy:validateSafetyPolicy(c.safetyPolicy)}:{}),...(c.profile?{profile:storedProfile(c.profile)}:{runtimeDefaults:true as const}),approvalPolicy:'never',timeoutSeconds:c.timeoutSeconds,...(typeof c.runtimeVersion==='string'?{runtimeVersion:redact(c.runtimeVersion).slice(0,80)}:{})};
  }
  let memorySelection:AgentRun['memorySelection'];
  if(r.memorySelection!==undefined){
    if(!Array.isArray(r.memorySelection)||r.memorySelection.length>20||r.memorySelection.some(ref=>!ref||typeof ref.id!=='string'||!uuid.test(ref.id)||typeof ref.rootId!=='string'||!uuid.test(ref.rootId)))throw new Error('Invalid memory references');
    memorySelection=r.memorySelection.map(({id,rootId})=>({id,rootId}));
  }
  let pageSelection:AgentRun['pageSelection'];
  if(r.pageSelection!==undefined){
    if(!Array.isArray(r.pageSelection)||r.pageSelection.length>5)throw new Error('Invalid page references');
    pageSelection=r.pageSelection.map(p=>{if(!p||!uuid.test(p.id)||typeof p.title!=='string'||p.title.length>500||!Number.isFinite(Date.parse(p.capturedAt)))throw new Error('Invalid page reference');return {id:p.id,url:validateBrowserUrl(p.url),title:redact(p.title),capturedAt:p.capturedAt};});
  }
  if(r.threadId!==undefined&&(typeof r.threadId!=='string'||!threadIdPattern.test(r.threadId)))throw new Error('Invalid Codex thread ID');
  if(r.executionPath!==undefined&&(typeof r.executionPath!=='string'||!isAbsolute(r.executionPath))||r.worktreeId!==undefined&&(typeof r.worktreeId!=='string'||!uuid.test(r.worktreeId)))throw new Error('Invalid worktree reference');
  if(r.gitWorkflow&&(!uuid.test(r.gitWorkflow.rootRunId)||!['review','fix'].includes(r.gitWorkflow.kind)||!/^([a-f0-9]{64})$/.test(r.gitWorkflow.baseline)))throw new Error('Invalid Git workflow');
  let crew:AgentRun['crew'];
  if(r.crew){
    const c=r.crew;
    if(!uuid.test(c.id)||!crewRoles.includes(c.role)||!Array.isArray(c.dependsOn)||c.dependsOn.length>5||c.dependsOn.some(id=>typeof id!=='string'||!uuid.test(id)||id===r.id))throw new Error('Invalid crew execution');
    crew={id:c.id,role:c.role,dependsOn:[...c.dependsOn]};
  }
  return {...(r.taskContextSelection?{taskContextSelection:storedTaskContext(r.taskContextSelection)}:{}),...(crew?{crew}:{}),...(r.threadId?{threadId:r.threadId}:{}),...(r.gitWorkflow?{gitWorkflow:{rootRunId:r.gitWorkflow.rootRunId,kind:r.gitWorkflow.kind,baseline:r.gitWorkflow.baseline}}:{}),...(r.executionPath?{executionPath:r.executionPath}:{}),...(r.worktreeId?{worktreeId:r.worktreeId}:{}),...(pageSelection?{pageSelection}:{}),...(memorySelection?{memorySelection}:{}),...(agentConfiguration?{agentConfiguration}:{}),id:r.id,revision:r.revision,workspaceId:r.workspaceId,projectName:redact(r.projectName),projectPath:redact(r.projectPath),task:redact(r.task),status:r.status,startedAt:r.startedAt,
    ...(r.endedAt?{endedAt:r.endedAt}:{}),...(Number.isInteger(r.exitCode)?{exitCode:r.exitCode}:{}),...(typeof r.signal==='string'?{signal:redact(r.signal)}:{}),...(typeof r.error==='string'?{error:redact(r.error)}:{}),output,truncated:!!r.truncated};
}
export function recoverRun(run:AgentRun,now=new Date().toISOString()):AgentRun {
  if(!isActiveRun(run.status))return run;
  const next=structuredClone(run);
  next.status='interrupted';next.endedAt=now;next.revision++;
  next.error=run.status==='queued'?'The app exited while this task was queued. It was never started and will not be resumed or rerun. Start a new task to run it.':'The app exited before a final result was recorded. Execution tracking was interrupted; completion is unknown. This run was not resumed or rerun. Check the project before starting a new task.';
  // Keep the same bounded output policy as live execution.
  next.output.push({sequence:(next.output.at(-1)?.sequence??0)+1,kind:'error',text:next.error});
  while(next.output.length>300||next.output.reduce((n,e)=>n+e.text.length,0)>150_000){next.output.shift();next.truncated=true;}
  return next;
}

/** One versioned JSON document per run. Main process only. Atomic rename prevents partial records. */
export class RunHistory {
  readonly directory:string;
  error:string|undefined;
  warnings:string[]=[];
  retention:RunRetention='all';
  constructor(userData:string){this.directory=join(userData,'run-history');}
  private fail(){this.error='Run history could not be saved. Check free disk space and permissions in the app user-data directory. New runs are disabled until the app is restarted and storage is writable.';}
  load():AgentRun[]{
    const runs:AgentRun[]=[];
    try{mkdirSync(this.directory,{recursive:true,mode:0o700});chmodSync(this.directory,0o700);}catch{this.fail();return runs;}
    try{
      const policy=JSON.parse(readFileSync(join(this.directory,'retention.json'),'utf8'));
      if(policy.version!==1)throw new Error('Unsupported retention version');
      this.retention=validateRetention(policy.retention);
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')this.warnings.push(retentionWarning);}
    let files:string[];
    try{files=readdirSync(this.directory);}catch{this.fail();return runs;}
    for(const file of files){
      if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;
      try{
        const raw=readFileSync(join(this.directory,file),'utf8');if(raw.length>2_000_000)throw new Error('Oversized record');
        const envelope=JSON.parse(raw);if(envelope.version!==1)throw new Error('Unsupported record version');
        const run=storedRun(envelope.run);if(file!==`${run.id}.json`)throw new Error('Mismatched run ID');
        const recovered=recoverRun(run);if(recovered!==run)try{this.save(recovered);}catch{/* Present recovered status in memory even when storage is unavailable. */}
        runs.push(recovered);
      }catch{this.warnings.push(`Could not read history record ${file}. It was left untouched for review.`);}
    }
    return runs.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.id.localeCompare(b.id));
  }
  private syncDirectory(){
    if(process.platform!=='win32'){const fd=openSync(this.directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
  }
  setRetention(input:unknown){
    const retention=validateRetention(input);
    const target=join(this.directory,'retention.json'),temporary=`${target}.tmp`;
    try{
      const fd=openSync(temporary,'w',0o600);
      try{writeFileSync(fd,JSON.stringify({version:1,retention}));fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(temporary,target);this.syncDirectory();this.retention=retention;this.warnings=this.warnings.filter(w=>w!==retentionWarning);
    }finally{try{unlinkSync(temporary);}catch{/* no temporary file */}}
  }
  delete(runs:AgentRun[],input:unknown,onDeleted:(id:string)=>void=()=>{}):{deletedIds:string[];warning?:string}{
    const selected=historyDeletionCandidates(runs,input),deletedIds:string[]=[],failed:string[]=[];
    for(const run of selected){
      try{try{unlinkSync(join(this.directory,`${run.id}.json`));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
        onDeleted(run.id);deletedIds.push(run.id);
      }catch{failed.push(run.id);}
    }
    let syncWarning:string|undefined;
    if(deletedIds.length)try{this.syncDirectory();}catch{syncWarning='History was deleted, but its directory could not be synced to disk. Check storage permissions.';}
    return {deletedIds,...(syncWarning?{warning:syncWarning}:{}),...(failed.length?{warning:`Could not delete ${failed.length} history record(s). Check storage permissions and try again.`}:{})};
  }
  prune(runs:AgentRun[],onDeleted:(id:string)=>void=()=>{},now=Date.now()){
    const cutoff=this.retention==='all'?-Infinity:now-Number(this.retention)*86400000;
    const protectedCrews=new Set(runs.filter(r=>isActiveRun(r.status)).map(r=>r.crew?.id).filter(Boolean));
    const ids=runs.filter(r=>!isActiveRun(r.status)&&!protectedCrews.has(r.crew?.id)&&Date.parse(r.endedAt??r.startedAt)<cutoff).map(r=>r.id);
    return this.delete(runs,{ids},onDeleted);
  }
  save(run:AgentRun){
    let temporary:string|undefined;
    try{
      const safe=storedRun(run),target=join(this.directory,`${safe.id}.json`);
      temporary=`${target}.tmp`;
      const fd=openSync(temporary,'w',0o600);
      try{writeFileSync(fd,JSON.stringify({version:1,run:safe}),'utf8');fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(temporary,target);temporary=undefined;
      // Persist the directory entry as well as the file on platforms that support it.
      if(process.platform!=='win32'){const dir=openSync(this.directory,'r');try{fsyncSync(dir);}finally{closeSync(dir);}}
    }catch(error){this.fail();throw error;}
    finally{if(temporary)try{unlinkSync(temporary);}catch{/* keep original committed record */}}
  }
}

export function validateRetention(value:unknown):RunRetention {
  if(value!=='30'&&value!=='90'&&value!=='365'&&value!=='all')throw new Error('Invalid run retention policy');
  return value;
}
export function historyDeletionCandidates(runs:AgentRun[],input:unknown):AgentRun[]{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid history deletion request');
  const request=input as {all?:unknown;ids?:unknown};
  const protectedCrews=new Set(runs.filter(r=>isActiveRun(r.status)).map(r=>r.crew?.id).filter(Boolean));
  const protectedRun=(r:AgentRun)=>isActiveRun(r.status)||!!r.crew&&protectedCrews.has(r.crew.id);
  if(request.all===true&&Object.keys(request).length===1)return runs.filter(r=>!protectedRun(r));
  if(Object.keys(request).length!==1||!Array.isArray(request.ids)||request.ids.length>10000||request.ids.some(id=>typeof id!=='string'||!uuid.test(id)))throw new Error('Invalid history IDs');
  const selected=new Set(request.ids),matches=runs.filter(r=>selected.has(r.id));
  if(matches.length!==selected.size)throw new Error('A selected run no longer exists. Refresh history.');
  if(matches.some(protectedRun))throw new Error('Active runs and their crew history cannot be deleted. Cancel or wait for completion.');
  return matches;
}
