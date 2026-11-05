import { randomUUID } from 'node:crypto';
import { isActiveRun, type AgentRun, type AgentProfile } from '../shared/bridge';
import { nextRoutineTime, routineReference, saveRoutineRequest, type Routine, type RoutineExecution, type RoutineState } from '../shared/routines';
import { RoutineStore, routineStorageError, type RoutineDocument } from './routine-store';

export interface RoutineEffects {
  resolveFolder:(id:string)=>string|undefined;
  profile:(id:string,updatedAt:string)=>AgentProfile;
  // Check guard after async checks; deliver reserved synchronously before runner
  // publish/launch. Keep beforeLaunch on the runner through queue drain and spawn.
  launch:(routine:Routine,guard:()=>void,reserved:(run:AgentRun)=>void,beforeLaunch:()=>void)=>Promise<AgentRun>;
  cancel:(id:string)=>void;
  runs:()=>AgentRun[];
  changed:()=>void;
}
const pending=(e:RoutineExecution)=>e.status==='preparing'||isActiveRun(e.status as AgentRun['status']);
const terminal=(e:RoutineExecution)=>!pending(e);
const interrupted='App closed before a final result was recorded. This execution will not be retried.';

export class Routines {
  private document:RoutineDocument={version:1,routines:[],executions:[]};
  private store:RoutineStore;
  private warning?:string;
  private timer?:ReturnType<typeof setInterval>;
  private running=false;
  private paused=false;
  private generation=0;
  private lastTick=0;
  private seen=new Set<string>();
  private origins=new Set<string>();
  private reservations=new Map<string,string>();
  private loaded=false;
  constructor(directory:string,private effects:RoutineEffects,private now=()=>Date.now(),store?:RoutineStore){
    this.store=store??new RoutineStore(directory);
    // Historical events are never replayed after launch, including interrupted runs.
    for(const run of effects.runs())this.seen.add(run.id);
    try{
      const stored=this.store.load();this.document=this.reconcileLoaded(stored);this.loaded=true;this.paused=!!(stored.paused||stored.sessionActive);
      if(JSON.stringify(this.document)!==JSON.stringify(stored))this.commit(this.document);
    }catch{this.warning=routineStorageError;this.paused=true;}
  }
  private reconcileLoaded(document:RoutineDocument):RoutineDocument {
    // Startup and the first repaired load share the same no-retry boundary.
    // Seed suppression before publishing repaired history or resuming scheduling.
    const runs=this.effects.runs();for(const run of runs)this.seen.add(run.id);
    for(const e of document.executions)if(e.runId)this.origins.add(e.runId);
    return {...document,executions:document.executions.map(e=>{
      if(terminal(e))return e;
      const run=e.runId?runs.find(r=>r.id===e.runId):undefined;
      return run&&!isActiveRun(run.status)?{...e,status:run.status,endedAt:run.endedAt??new Date(this.now()).toISOString(),...(run.error?{detail:run.error.slice(0,2000)}:{})}:{...e,status:'interrupted' as const,endedAt:new Date(this.now()).toISOString(),detail:interrupted};
    })};
  }
  state():RoutineState{return {...structuredClone(this.document),paused:this.paused,warning:this.warning};}
  private commit(document:RoutineDocument,recover=false){
    if(this.warning&&!recover)throw new Error(this.warning);
    // Preserve active attempts; retain the newest 500 entries with bounded metadata only.
    const active=document.executions.filter(pending),past=document.executions.filter(terminal).slice(-(500-active.length));
    const next={...document,executions:[...past,...active].sort((a,b)=>a.triggeredAt.localeCompare(b.triggeredAt))};
    try{this.store.save(next);this.document=next;if(recover)this.warning=undefined;this.effects.changed();}
    catch(error){this.storageFailed();throw error;}
  }
  private storageFailed(){
    // Stop first, before cancellation callbacks can publish run updates or drain slots.
    this.warning=routineStorageError;this.paused=true;this.running=false;this.generation++;
    clearInterval(this.timer);this.timer=undefined;
    const ids=new Set([...this.reservations.values(),...this.document.executions.filter(pending).flatMap(e=>e.runId?[e.runId]:[])]);
    for(const id of ids){const run=this.effects.runs().find(r=>r.id===id);if(run?.status==='queued'||run?.status==='starting')try{this.effects.cancel(id);}catch{/* Keep the actual status visible; guards still prevent delayed reservations. */}}
    const now=new Date(this.now()).toISOString(),runs=this.effects.runs();
    this.document={...this.document,paused:true,executions:this.document.executions.map(e=>{
      if(!pending(e))return e;
      const runId=this.reservations.get(e.id)??e.runId,run=runs.find(r=>r.id===runId);
      return run?{...e,runId,status:run.status,endedAt:run.endedAt,...(run.error?{detail:run.error.slice(0,2000)}:{})}:{...e,status:'failed',endedAt:now,detail:'Routine storage failed before execution. This occurrence will not be retried.'};
    })};
    this.effects.changed();
  }
  private get(input:unknown){const ref=routineReference(input),r=this.document.routines.find(r=>r.id===ref.id);if(!r)throw new Error('Routine no longer exists. Refresh routines.');if(r.revision!==ref.expectedRevision)throw new Error('Routine changed. Reopen it before trying again.');return r;}
  private invalidate(id:string){
    // Config is committed first, so pending guards fail. Queued work is cancelled; running work keeps its immutable snapshot.
    for(const e of this.document.executions.filter(e=>e.routineId===id&&e.runId&&pending(e))){const run=this.effects.runs().find(r=>r.id===e.runId);if(run?.status==='queued')this.effects.cancel(run.id);}
  }
  save(input:unknown){
    const request=saveRoutineRequest(input),old=request.id?this.get({id:request.id,expectedRevision:request.expectedRevision}):undefined;
    if(!old&&this.document.routines.length>=100)throw new Error('Up to 100 routines can be saved. Delete one before adding another.');
    const profile=this.effects.profile(request.profileId,request.profileUpdatedAt);
    const path=request.folderChoice===null?old?.projectPath:this.effects.resolveFolder(request.folderChoice);
    if(!path)throw new Error('Choose a project using the native folder picker.');
    const now=new Date(this.now()).toISOString();
    const r:Routine={name:request.name,task:request.task,trigger:request.trigger,enabled:request.enabled,profileId:profile.id,profileUpdatedAt:profile.updatedAt,useWorktree:request.useWorktree,id:old?.id??randomUUID(),revision:(old?.revision??0)+1,projectPath:path,profileName:profile.name,sandbox:profile.sandbox,createdAt:old?.createdAt??now,updatedAt:now,nextRunAt:request.enabled?nextRoutineTime(request.trigger,this.now()):null};
    this.commit({...this.document,routines:[...this.document.routines.filter(v=>v.id!==r.id),r]});this.invalidate(r.id);return this.state();
  }
  enable(input:unknown,enabled:unknown,consent:unknown){
    if(typeof enabled!=='boolean'||enabled&&consent!==true)throw new Error('Explicitly allow automatic live execution before enabling.');
    const r=this.get(input);if(enabled)this.effects.profile(r.profileId,r.profileUpdatedAt);
    this.commit({...this.document,routines:this.document.routines.map(v=>v.id===r.id?{...v,enabled,revision:v.revision+1,updatedAt:new Date(this.now()).toISOString(),nextRunAt:enabled?nextRoutineTime(v.trigger,this.now()):null}:v)});
    this.invalidate(r.id);return this.state();
  }
  remove(input:unknown){const r=this.get(input);this.commit({...this.document,routines:this.document.routines.filter(v=>v.id!==r.id)});this.invalidate(r.id);return this.state();}
  start(){
    if(this.running||this.warning||this.paused)return;
    // A prior healthy write arms a restart latch. If a later write fails, even
    // persisting paused may fail: an unclosed session therefore requires resume.
    try{this.commit({...this.document,sessionActive:true});}catch{return;}
    this.running=true;this.generation++;this.lastTick=this.now();
    // Reopening skips all offline due occurrences, even a recent one. No daemon or catch-up queue.
    try{this.tick(true);}catch{this.running=false;return;}
    this.timer=setInterval(()=>{try{this.tick();}catch{/* warning is visible; fail closed */}},1000);this.timer.unref?.();
  }
  stop(pause=false){this.running=false;this.generation++;clearInterval(this.timer);this.timer=undefined;if(pause){this.paused=true;try{this.commit({...this.document,paused:true});}catch{/* in-memory stop still takes effect; storage warning remains visible */}}this.effects.changed();}
  finishSession(){
    // Main calls this only after runner shutdown and its final status deliveries.
    // Clearing earlier could hide a storage failure in a late terminal update.
    if(!this.running&&!this.warning)try{this.commit({...this.document,paused:this.paused,sessionActive:false});}catch{/* Preserve the armed marker if this last write fails. */}
  }
  resume(){
    if(this.warning){
      // Validate repaired storage before accepting explicit consent. Do not discard
      // in-memory cancellation/results after a runtime write failure.
      const stored=this.store.load();if(!this.loaded){this.document=this.reconcileLoaded(stored);this.loaded=true;}
    }
    this.commit({...this.document,paused:false,sessionActive:true},true);this.paused=false;this.start();this.effects.changed();return this.state();
  }
  private entry(r:Routine,key:string,status:RoutineExecution['status'],detail?:string):RoutineExecution {const now=new Date(this.now()).toISOString();return {id:randomUUID(),routineId:r.id,routineName:r.name,revision:r.revision,triggerKey:key,triggeredAt:now,status,...(status==='skipped'?{endedAt:now}:{}),...(detail?{detail}:{})};}
  private next(r:Routine,now:number){if(r.trigger.kind==='interval'&&r.nextRunAt){const due=Date.parse(r.nextRunAt),period=r.trigger.minutes*60000;return new Date(due+(Math.floor(Math.max(0,now-due)/period)+1)*period).toISOString();}return nextRoutineTime(r.trigger,now);}
  tick(offline=false){
    if(!this.running||this.paused||this.warning)return;
    const now=this.now(),missed=offline||now-this.lastTick>60000;this.lastTick=now;
    for(const r of [...this.document.routines]){
      if(!r.enabled||!r.nextRunAt||Date.parse(r.nextRunAt)>now)continue;
      const key=`schedule:${r.nextRunAt}`,tooLate=missed||now-Date.parse(r.nextRunAt)>60000;
      this.fire(r,key,tooLate?'Missed while the app was closed, asleep, or unavailable; no catch-up execution.':undefined,this.next(r,now));
    }
  }
  runNow(input:unknown){const r=this.get(input);if(!r.enabled)throw new Error('Enable this routine before running it.');if(!this.running||this.paused)throw new Error('Resume scheduling before running a routine.');return this.fire(r,`manual:${randomUUID()}`);}
  private fire(r:Routine,key:string,skip?:string,nextRunAt=r.nextRunAt):RoutineState {
    if(!this.running||this.paused||this.warning)throw new Error(this.warning??'Automatic execution is stopped.');
    if(this.document.executions.some(e=>e.routineId===r.id&&e.triggerKey===key)){
      // A backwards clock adjustment can revisit an already reserved schedule time.
      if(nextRunAt!==r.nextRunAt)this.commit({...this.document,routines:this.document.routines.map(v=>v.id===r.id?{...v,nextRunAt}:v)});
      return this.state();
    }
    const busy=this.document.executions.some(e=>e.routineId===r.id&&pending(e));
    const detail=skip??(busy?'Skipped because this routine already has a pending or active execution.':undefined),e=this.entry(r,key,detail?'skipped':'preparing',detail),generation=this.generation;
    this.commit({...this.document,routines:this.document.routines.map(v=>v.id===r.id?{...v,nextRunAt}:v),executions:[...this.document.executions,e]});
    if(detail)return this.state();
    const guard=()=>{const current=this.document.routines.find(v=>v.id===r.id);if(!this.running||this.paused||this.warning||this.generation!==generation||!current?.enabled||current.revision!==r.revision)throw new Error('Routine was changed, disabled, deleted, or stopped before execution reservation.');};
    // The durable preparing row reserves this routine before any asynchronous runtime/project checks.
    void Promise.resolve().then(async()=>{
      let reserved:AgentRun|undefined;
      try{
        guard();this.effects.profile(r.profileId,r.profileUpdatedAt);
        const run=await this.effects.launch(structuredClone(r),guard,run=>{
          reserved=run;
          this.reservations.set(e.id,run.id);
          this.origins.add(run.id);
          try{guard();this.update(e.id,{runId:run.id,status:run.status});}
          catch(error){this.effects.cancel(run.id);throw error;}
        },()=>{if(!this.running||this.paused||this.warning||this.generation!==generation)throw new Error('Automatic execution was stopped before this routine could launch.');});
        if(!reserved)throw new Error('The execution adapter did not record its reservation.');
        this.runChanged(this.effects.runs().find(v=>v.id===run.id)??run);
      }catch(error){
        if(reserved&&!this.document.executions.some(v=>v.id===e.id&&v.runId))try{this.effects.cancel(reserved.id);}catch{/* shutdown already owns it */}
        const actual=reserved?this.effects.runs().find(v=>v.id===reserved!.id):undefined;
        try{this.update(e.id,{...(reserved?{runId:reserved.id}:{}),status:actual?.status??(reserved?'cancelled':'failed'),endedAt:actual?.endedAt??(!actual||!isActiveRun(actual.status)?new Date(this.now()).toISOString():undefined),detail:(error instanceof Error?error.message:'Routine execution could not start.').slice(0,2000)});}catch{/* fail closed warning already published */}
      }
    });
    return this.state();
  }
  private update(id:string,patch:Partial<RoutineExecution>){
    const next={...this.document,executions:this.document.executions.map(e=>e.id===id?{...e,...patch}:e)};
    if(this.warning){this.document=next;this.effects.changed();}else this.commit(next);
  }
  runChanged(run:AgentRun){
    try{
      const execution=this.document.executions.find(e=>e.runId===run.id);
      if(execution){
        if(execution.status!==run.status||execution.endedAt!==run.endedAt)this.update(execution.id,{status:run.status,endedAt:run.endedAt,...(run.error?{detail:run.error.slice(0,2000)}:{})});
        if(!isActiveRun(run.status))this.reservations.delete(execution.id);
        return; // Routine executions and all their continuations never cascade into other routines.
      }
      if(isActiveRun(run.status)||this.seen.has(run.id)||this.origins.has(run.id))return;
      this.seen.add(run.id);
      if(!this.running||this.paused||this.warning||this.now()-this.lastTick>60000||!['completed','failed'].includes(run.status))return;
      for(const r of [...this.document.routines])if(r.enabled&&r.projectPath===run.projectPath&&r.trigger.kind===(run.status==='completed'?'run-completed':'run-failed'))this.fire(r,`event:${run.id}`);
    }catch{/* Storage failures stop future execution and are visible in state. */}
  }
  forgetRun(id:string){
    // Keep non-sensitive history status but remove result links when main history is deleted/expired.
    const executions=this.document.executions.map(e=>e.runId===id?{...e,runId:undefined,detail:'Run output was deleted or expired from history.'}:e);
    if(JSON.stringify(executions)!==JSON.stringify(this.document.executions))try{this.commit({...this.document,executions});}catch{/* warning published */}
  }
}
