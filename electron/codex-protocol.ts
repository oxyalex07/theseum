import { validateTaskContext } from '../shared/task-context';
import { validateCrew } from '../shared/crew';
import type { RunOutput, RunStatus, StartRunRequest } from '../shared/bridge';
export function validateStartRun(input: unknown): StartRunRequest {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Invalid run request');
  const allowed=['taskContext','crew','useWorktree','workspaceId','task','profileId','profileUpdatedAt','memoryIds','memoryRevision','pageIds'];
  if(Object.keys(input).some(key=>!allowed.includes(key)))throw new Error('Unsupported run option. Configure live policy in Safety settings.');
  const {useWorktree}=input as Record<string,unknown>;
  if(useWorktree!==undefined&&typeof useWorktree!=='boolean')throw new Error('Invalid task location.');
  const {workspaceId,task}=input as Record<string,unknown>;
  if(typeof workspaceId!=='string'||!/^[a-f0-9-]{36}$/.test(workspaceId))throw new Error('Choose a project folder first.');
  if(typeof task!=='string'||!task.trim()||task.length>32_000||task.includes('\0'))throw new Error('Enter a task between 1 and 32,000 characters.');
  const {profileId,profileUpdatedAt,memoryIds,memoryRevision,pageIds}=input as Record<string,unknown>;
  if(profileId!==undefined&&(typeof profileId!=='string'||!/^[a-f0-9-]{36}$/.test(profileId)))throw new Error('Invalid agent profile.');
  if(profileUpdatedAt!==undefined&&(typeof profileUpdatedAt!=='string'||!Number.isFinite(Date.parse(profileUpdatedAt))))throw new Error('Invalid agent version.');
  if(memoryIds!==undefined&&(!Array.isArray(memoryIds)||memoryIds.length>20||memoryIds.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))||new Set(memoryIds).size!==memoryIds.length))throw new Error('Select at most 20 distinct memories.');
  if(memoryRevision!==undefined&&(!Number.isSafeInteger(memoryRevision)||(memoryRevision as number)<0))throw new Error('Invalid memory revision.');
  if(pageIds!==undefined&&(!Array.isArray(pageIds)||pageIds.length>5||pageIds.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))||new Set(pageIds).size!==pageIds.length))throw new Error('Select at most five page extracts.');
  const crew=(input as StartRunRequest).crew;
  if(crew!==undefined&&profileId!==undefined)throw new Error('Choose role profiles in crew mode.');
  return {...((input as StartRunRequest).taskContext!==undefined?{taskContext:validateTaskContext((input as StartRunRequest).taskContext)}:{}),...(crew!==undefined?{crew:validateCrew(crew)}:{}),...(useWorktree!==undefined?{useWorktree}:{}),...(pageIds?{pageIds:pageIds as string[]}:{}),workspaceId,task:task.trim(),...(memoryRevision!==undefined?{memoryRevision:memoryRevision as number}:{}),...(memoryIds?{memoryIds:memoryIds as string[]}:{}),...(profileId?{profileId:profileId as string}:{}),...(profileUpdatedAt?{profileUpdatedAt:profileUpdatedAt as string}:{})};
}
export function redact(text: string): string {
  let clean=text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g,'');
  for(const [key,value] of Object.entries(process.env)){
    if(/TOKEN|SECRET|PASSWORD|API_KEY/i.test(key)&&value&&value.length>=8)clean=clean.split(value).join('[REDACTED]');
  }
  return clean.replace(/\bsk-[a-zA-Z0-9_-]{12,}/g,'[REDACTED]')
    .replace(/(Bearer\s+)[a-zA-Z0-9._~+\/-]+/gi,'$1[REDACTED]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,'[REDACTED]');
}
type Output = Pick<RunOutput,'kind'|'text'>;
export function parseCodexEvent(line: string): { output?: Output; completed?: boolean; failed?: string; threadId?:string } {
  let event: Record<string,unknown>;
  try{event=JSON.parse(line);}catch{return {};}
  if(!event||typeof event!=='object')return {};
  const text=(value:unknown)=>typeof value==='string'?redact(value).slice(-40_000):'';
  if(event.type==='turn.completed')return {completed:true,output:{kind:'system',text:'Codex turn completed. Waiting for process exit…'}};
  if(event.type==='turn.failed'){
    const error=event.error as {message?:unknown}|undefined;
    return {failed:text(error?.message)||'Codex reported a failed turn.'};
  }
  if(event.type==='error')return {output:{kind:'error',text:text(event.message)||'Codex reported an error.'}};
  if(event.type==='thread.started')return {...(typeof event.thread_id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(event.thread_id)?{threadId:event.thread_id}:{}),output:{kind:'system',text:'Codex session connected.'}};
  if(event.type==='turn.started')return {output:{kind:'system',text:'Codex is working in the selected project.'}};
  if(!['item.started','item.updated','item.completed'].includes(String(event.type)))return {};
  const item=event.item as Record<string,unknown>|undefined;if(!item||typeof item!=='object')return {};
  if(item.type==='agent_message'&&event.type==='item.completed')return {output:{kind:'message',text:text(item.text)}};
  if(item.type==='command_execution'){
    if(event.type==='item.started')return {output:{kind:'command',text:`$ ${text(item.command)}`}};
    if(event.type==='item.completed')return {output:{kind:'output',text:`${text(item.aggregated_output)}\n[command exit ${typeof item.exit_code==='number'?item.exit_code:'unknown'}]`}};
  }
  if(item.type==='file_change'&&event.type==='item.completed'&&Array.isArray(item.changes))return {output:{kind:'file',text:item.changes.slice(0,100).map((v:unknown)=>{if(!v||typeof v!=='object')return '';const change=v as Record<string,unknown>;return `${text(change.kind)} ${text(change.path)}`;}).join('\n')}};
  return {};
}
export function finalRunStatus(cancelled: boolean, code: number|null, completed: boolean, failure?: string): RunStatus {
  return cancelled?'cancelled':code===0&&completed&&!failure?'completed':'failed';
}
