import type { RunStatus } from './bridge';

export type RoutineTrigger = { kind:'interval'; minutes:number } | { kind:'weekly'; time:string; days:number[] } | { kind:'run-completed'|'run-failed' };
export interface RoutineFields { name:string; task:string; trigger:RoutineTrigger; enabled:boolean; profileId:string; profileUpdatedAt:string; useWorktree:boolean }
export interface Routine extends RoutineFields { id:string; revision:number; projectPath:string; profileName:string; sandbox:'read-only'|'workspace-write'; createdAt:string; updatedAt:string; nextRunAt:string|null }
export interface SaveRoutineRequest extends RoutineFields { id?:string; expectedRevision?:number; folderChoice:string|null; executionConsent:boolean }
export interface RoutineReference { id:string; expectedRevision:number }
export interface RoutineExecution { id:string; routineId:string; routineName:string; revision:number; triggerKey:string; triggeredAt:string; status:RunStatus|'preparing'|'skipped'; runId?:string; endedAt?:string; detail?:string }
export interface RoutineState { routines:Routine[]; executions:RoutineExecution[]; paused:boolean; warning?:string }
export const routineId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const routineTimestamp=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid routine configuration.');return value as Record<string,unknown>;}
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Unknown routine configuration field.');}
function text(value:unknown,label:string,max:number){if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw new Error(`${label} must contain 1–${max} characters.`);return value.trim();}
export function routineTrigger(input:unknown):RoutineTrigger {
  const t=object(input);
  if(t.kind==='interval'){keys(t,['kind','minutes']);if(!Number.isInteger(t.minutes)||Number(t.minutes)<1||Number(t.minutes)>10080)throw new Error('Choose an interval from 1 to 10,080 minutes.');return {kind:'interval',minutes:Number(t.minutes)};}
  if(t.kind==='weekly'){keys(t,['kind','time','days']);if(typeof t.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)||!Array.isArray(t.days)||!t.days.length||t.days.length>7||t.days.some(day=>!Number.isInteger(day)||day<0||day>6)||new Set(t.days).size!==t.days.length)throw new Error('Choose a UTC time and at least one distinct day.');return {kind:'weekly',time:t.time,days:[...t.days].sort()};}
  if(t.kind==='run-completed'||t.kind==='run-failed'){keys(t,['kind']);return {kind:t.kind};}
  throw new Error('Choose a supported schedule or execution event.');
}
export function routineFields(input:unknown):RoutineFields {
  const r=object(input);
  if(typeof r.enabled!=='boolean'||typeof r.useWorktree!=='boolean'||!routineId(r.profileId)||!routineTimestamp(r.profileUpdatedAt))throw new Error('Select a current saved agent and valid execution settings.');
  return {name:text(r.name,'Name',80),task:text(r.task,'Task',32000),trigger:routineTrigger(r.trigger),enabled:r.enabled,profileId:r.profileId,profileUpdatedAt:r.profileUpdatedAt,useWorktree:r.useWorktree};
}
export function saveRoutineRequest(input:unknown):SaveRoutineRequest {
  const r=object(input);keys(r,['name','task','trigger','enabled','profileId','profileUpdatedAt','useWorktree','id','expectedRevision','folderChoice','executionConsent']);
  if(r.id!==undefined&&(!routineId(r.id)||!Number.isSafeInteger(r.expectedRevision)||Number(r.expectedRevision)<1)||r.id===undefined&&r.expectedRevision!==undefined)throw new Error('Invalid routine revision.');
  if(r.folderChoice!==null&&!routineId(r.folderChoice)||typeof r.executionConsent!=='boolean'||r.enabled&&!r.executionConsent)throw new Error('Choose a project and explicitly allow automatic live execution.');
  return {...routineFields(r),id:r.id as string|undefined,expectedRevision:r.expectedRevision as number|undefined,folderChoice:r.folderChoice as string|null,executionConsent:r.executionConsent};
}
export function routineReference(input:unknown):RoutineReference {
  const r=object(input);keys(r,['id','expectedRevision']);if(!routineId(r.id)||!Number.isSafeInteger(r.expectedRevision)||Number(r.expectedRevision)<1)throw new Error('Choose a saved routine with a current revision.');return {id:r.id,expectedRevision:Number(r.expectedRevision)};
}
/** UTC avoids ambiguous/nonexistent local times and is displayed explicitly in the editor. */
export function nextRoutineTime(trigger:RoutineTrigger,after:number):string|null {
  if(!Number.isFinite(after))throw new Error('Invalid scheduler time.');
  if(trigger.kind==='interval')return new Date(after+trigger.minutes*60000).toISOString();
  if(trigger.kind!=='weekly')return null;
  const [hour,minute]=trigger.time.split(':').map(Number),date=new Date(after);
  date.setUTCHours(hour,minute,0,0);
  for(let i=0;i<8;i++){if(date.getTime()>after&&trigger.days.includes(date.getUTCDay()))return date.toISOString();date.setUTCDate(date.getUTCDate()+1);}
  throw new Error('Invalid routine days.');
}
export function routineTriggerLabel(trigger:RoutineTrigger):string {
  if(trigger.kind==='interval')return `Every ${trigger.minutes} minute${trigger.minutes===1?'':'s'}`;
  if(trigger.kind==='weekly')return `${trigger.days.map(day=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(', ')} at ${trigger.time} UTC`;
  return trigger.kind==='run-completed'?'After a manual live run succeeds in this project':'After a manual live run fails in this project';
}
