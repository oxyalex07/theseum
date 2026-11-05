// Actual AgentRunner, filesystem and disposable executable. No process/runner mocks or providers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, realpathSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, renameSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentRunner } from '../electron/agent-runner';
import { Routines, type RoutineEffects } from '../electron/routines';
import { RoutineStore } from '../electron/routine-store';
import type { AgentProfile, AgentRun } from '../shared/bridge';
import type { Routine, SaveRoutineRequest } from '../shared/routines';

const cleanups:(()=>Promise<void>)[]=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();vi.restoreAllMocks();vi.unstubAllEnvs();});
const stamp='2026-10-29T08:00:00.000Z';
const ref=(r:Routine)=>({id:r.id,expectedRevision:r.revision});
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const until=(check:()=>void)=>vi.waitFor(check,{timeout:10000,interval:20});
async function harness(){
  const root=realpathSync(mkdtempSync(join(tmpdir(),'theseus-routine-real-runner-'))),project=join(root,'project'),calls=join(root,'calls.jsonl'),release=join(root,'release'),fixture=join(root,'codex-fixture');mkdirSync(project);
  writeFileSync(fixture,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
(async()=>{let task='';for await(const chunk of process.stdin)task+=chunk;const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify({task,cwd:process.cwd()})+'\\n');if(task.includes('HOLD'))await new Promise(resolve=>{const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);resolve();}},10);});console.log('{"type":"turn.completed"}');})();
`,{mode:0o700});vi.stubEnv('THESEUS_CODEX_PATH',fixture);
  const id=randomUUID(),profile:AgentProfile={id:randomUUID(),configurationVersion:1,createdAt:stamp,updatedAt:stamp,name:'Fixture',icon:'code',color:'violet',description:'',runtime:'codex',model:null,reasoningEffort:null,instructions:'',memory:'none',sandbox:'read-only',timeoutSeconds:30,defaultProjectPath:null};
  let service:Routines|undefined,now=Date.parse(stamp);
  const runner=new AgentRunner(run=>service?.runChanged(run),30000);runner.registerWorkspace({id,name:'Project',path:project,entries:[],truncated:false});
  const store=new RoutineStore(root),cancel=vi.fn((id:string)=>{runner.cancel(id);});
  const effects:RoutineEffects={resolveFolder:choice=>choice===id?project:undefined,profile:()=>profile,runs:()=>runner.list(),cancel,changed:()=>{},launch:async(r,guard,reserved,beforeLaunch)=>{guard();return runner.start({workspaceId:id,task:r.task},{profile,approvalPolicy:'never',timeoutSeconds:30},[],[],undefined,undefined,reserved,beforeLaunch);}};
  const makeService=()=>{service=new Routines(root,effects,()=>now,store);service.start();return service;};
  makeService();
  const request=(patch:Partial<SaveRoutineRequest>={}):SaveRoutineRequest=>({name:'Routine',task:'QUEUED_ROUTINE',trigger:{kind:'interval',minutes:1},enabled:true,profileId:profile.id,profileUpdatedAt:profile.updatedAt,useWorktree:false,folderChoice:id,executionConsent:true,...patch});
  cleanups.push(async()=>{service?.stop();await runner.shutdown();rmSync(root,{recursive:true,force:true});});
  return {root,store,runner,effects,cancel,request,makeService,get service(){return service!;},advance:(ms:number)=>{now+=ms;},manual:(task:string)=>runner.start({workspaceId:id,task}),release:()=>writeFileSync(release,''),calls:()=>existsSync(calls)?readFileSync(calls,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line) as {task:string;cwd:string}):[]};
}

describe.skipIf(process.platform==='win32')('routine storage faults with the real runner and disposable child',()=>{
  it.each(['retained','expired'] as const)('reconciles the first repaired load after shutdown with %s runner history and executes only a new occurrence',async history=>{
    const h=await harness(),r=h.service.save(h.request()).routines[0];
    await h.manual('HOLD owner');await until(()=>expect(h.calls()).toHaveLength(1));
    h.service.runNow(ref(r));await until(()=>expect(h.service.state().executions[0].status).toBe('queued'));
    const old=h.service.state().executions[0],file=join(h.root,'routines.json'),preserved=join(h.root,'preserved.json');
    renameSync(file,preserved);mkdirSync(file);h.service.stop();await h.runner.shutdown();await flush();h.service.finishSession();
    expect(h.runner.getRun(old.runId!)?.status).toBe('interrupted');
    const endedAt=h.runner.getRun(old.runId!)!.endedAt;
    if(history==='expired')h.runner.forgetRun(old.runId!);
    const restarted=h.makeService();expect(restarted.state()).toMatchObject({paused:true,warning:expect.stringContaining('storage'),routines:[]});
    expect(()=>restarted.resume()).toThrow();expect(restarted.state().paused).toBe(true);
    rmSync(file,{recursive:true});renameSync(preserved,file);h.advance(3600000);
    restarted.start();restarted.tick();expect(restarted.state().paused).toBe(true);expect(h.calls()).toHaveLength(1);
    restarted.resume();
    const repaired=restarted.state().executions.find(e=>e.id===old.id)!;
    expect(repaired).toMatchObject({runId:old.runId,status:'interrupted',endedAt:history==='retained'?endedAt:expect.any(String)});
    if(history==='expired')expect(repaired.detail).toMatch(/will not be retried/);
    expect(restarted.state()).toMatchObject({paused:false,warning:undefined});
    expect(restarted.state().executions.some(e=>e.status==='skipped'&&e.detail?.includes('Missed'))).toBe(true);
    expect(h.calls()).toHaveLength(1);expect(h.store.load().executions.find(e=>e.id===old.id)).toEqual(repaired);
    restarted.runNow(ref(r));await until(()=>expect(restarted.state().executions.at(-1)?.status).toBe('completed'));
    expect(h.calls().map(c=>c.task)).toEqual(['HOLD owner',expect.stringContaining('QUEUED_ROUTINE')]);
    expect(restarted.state().executions.filter(e=>e.runId&&e.runId!==old.runId)).toHaveLength(1);
  },20000);

  it.each(['nonregular','permission','capacity'] as const)('blocks queued work after an actual %s filesystem/store rejection',async fault=>{
    const h=await harness(),r=h.service.save(h.request()).routines[0];await h.manual('HOLD owner');await until(()=>expect(h.calls()).toHaveLength(1));h.service.runNow(ref(r));await until(()=>expect(h.service.state().executions[0].status).toBe('queued'));
    const file=join(h.root,'routines.json'),preserved=join(h.root,'preserved.json');
    try{
      if(fault==='nonregular'){renameSync(file,preserved);mkdirSync(file);}
      if(fault==='permission')chmodSync(h.root,0o500);
      if(fault==='capacity'){
        expect(()=>{for(let i=0;i<100;i++)h.service.save(h.request({name:`Large ${i}`,task:'x'.repeat(32000)}));}).toThrow(/3 MB/);
      }else expect(()=>h.service.runNow(ref(r))).toThrow();
      expect(h.service.state().paused).toBe(true);expect(h.service.state().executions[0].status).toBe('cancelled');chmodSync(h.root,0o700);h.release();await until(()=>expect(h.runner.list().every(r=>['completed','cancelled'].includes(r.status))).toBe(true));expect(h.calls()).toHaveLength(1);
    }finally{chmodSync(h.root,0o700);if(fault==='nonregular'){rmSync(file,{recursive:true});renameSync(preserved,file);}}
  },20000);

  it('isolates a throwing cancellation callback and permanently revokes the old queue even after healthy resume',async()=>{
    const h=await harness(),first=h.service.save(h.request({name:'First'})).routines[0],second=h.service.save(h.request({name:'Second'})).routines.find(r=>r.name==='Second')!;
    await h.manual('HOLD owner');await until(()=>expect(h.calls()).toHaveLength(1));h.service.runNow(ref(first));h.service.runNow(ref(second));await until(()=>expect(h.service.state().executions.filter(e=>e.status==='queued')).toHaveLength(2));
    const firstId=h.service.state().executions.find(e=>e.routineId===first.id)!.runId!,secondId=h.service.state().executions.find(e=>e.routineId===second.id)!.runId!;
    const cancel=h.effects.cancel;h.effects.cancel=vi.fn(id=>{if(id===firstId)throw new Error('transient cancel callback');cancel(id);});
    const failure=vi.spyOn(h.store,'save').mockImplementation(()=>{throw new Error('disk full');});expect(()=>h.service.save(h.request())).toThrow('disk full');
    expect(h.effects.cancel).toHaveBeenCalledWith(secondId);expect(h.runner.getRun(secondId)?.status).toBe('cancelled');expect(h.service.state().executions.find(e=>e.runId===firstId)?.status).toBe('queued');
    failure.mockRestore();h.effects.cancel=cancel;h.service.resume();h.release();await until(()=>expect(h.runner.list().every(r=>['completed','cancelled'].includes(r.status))).toBe(true));expect(h.runner.getRun(firstId)?.status).toBe('cancelled');expect(h.calls()).toHaveLength(1);expect(h.service.state().executions.every(e=>e.status==='cancelled')).toBe(true);
    const manual=await h.manual('Manual after revoked queue');await until(()=>expect(h.runner.getRun(manual.id)?.status).toBe('completed'));expect(h.calls()).toHaveLength(2);
  },20000);

  it('cancels durable queued routines before slot release, preserves unrelated manual work, and only recovers by explicit healthy resume',async()=>{
    const h=await harness(),r=h.service.save(h.request()).routines[0];
    const owner=await h.manual('HOLD unrelated manual owner');await until(()=>expect(h.calls()).toHaveLength(1));
    h.service.runNow(ref(r));await until(()=>expect(h.service.state().executions[0]).toMatchObject({status:'queued',runId:expect.any(String)}));
    const queuedId=h.service.state().executions[0].runId!,manual=await h.manual('Unrelated queued manual');expect(manual.status).toBe('queued');
    const bytes=readFileSync(join(h.root,'routines.json'));
    const failure=vi.spyOn(h.store,'save').mockImplementation(()=>{throw new Error('disk full');});
    expect(()=>h.service.save(h.request({name:'Failed write'}))).toThrow('disk full');
    expect(h.service.state()).toMatchObject({paused:true,warning:expect.stringContaining('Automatic execution is stopped')});
    expect(h.runner.getRun(queuedId)?.status).toBe('cancelled');expect(h.service.state().executions[0].status).toBe('cancelled');expect(h.cancel).toHaveBeenCalledWith(queuedId);
    expect(h.runner.getRun(owner.id)?.status).toBe('running');expect(h.runner.getRun(manual.id)?.status).toBe('queued');expect(readFileSync(join(h.root,'routines.json'))).toEqual(bytes);
    expect(()=>h.service.resume()).toThrow('disk full');h.release();await until(()=>expect(h.runner.getRun(manual.id)?.status).toBe('completed'));
    expect(h.runner.getRun(owner.id)?.status).toBe('completed');expect(h.calls().map(c=>c.task)).toEqual(['HOLD unrelated manual owner','Unrelated queued manual']);
    failure.mockRestore();h.advance(3600000);h.service.start();h.service.tick();expect(()=>h.service.runNow(ref(r))).toThrow(/Resume/);expect(h.calls()).toHaveLength(2);
    h.service.resume();expect(h.service.state().warning).toBeUndefined();expect(h.service.state().paused).toBe(false);expect(h.service.state().executions.some(e=>e.status==='skipped')).toBe(true);expect(h.calls()).toHaveLength(2);
    h.service.runNow(ref(r));await until(()=>expect(h.service.state().executions.at(-1)?.status).toBe('completed'));expect(h.calls().at(-1)?.task).toContain('QUEUED_ROUTINE');
    expect(new RoutineStore(h.root).load().executions.find(e=>e.runId===queuedId)?.status).toBe('cancelled');
  },20000);

  it.each(['queued','starting'] as const)('stops a %s reservation when persistence fails before start returns its run ID',async stage=>{
    const h=await harness(),r=h.service.save(h.request()).routines[0];
    if(stage==='queued'){await h.manual('HOLD owner');await until(()=>expect(h.calls()).toHaveLength(1));}
    let returned=false,reservationStatus:string|undefined,reservedId:string|undefined;
    h.effects.launch=async(r,guard,reserved,beforeLaunch)=>{guard();const result=h.runner.start({workspaceId:h.runner.getWorkspace()!.id,task:r.task},undefined,[],[],undefined,undefined,run=>{reservationStatus=run.status;reservedId=run.id;expect(returned).toBe(false);reserved(run);});const run=await result;returned=true;return run;};
    const save=h.store.save.bind(h.store);vi.spyOn(h.store,'save').mockImplementation(document=>{if(document.executions.some(e=>e.runId))throw new Error('reservation write failed');save(document);});
    h.service.runNow(ref(r));await until(()=>expect(reservedId).toBeDefined());await flush();
    expect(reservationStatus).toBe(stage);expect(h.runner.getRun(reservedId!)?.status).toBe('cancelled');expect(h.service.state().executions[0]).toMatchObject({runId:reservedId,status:'cancelled'});expect(h.service.state().warning).toMatch(/in memory only/);
    h.release();await until(()=>expect(h.runner.list().every(r=>['completed','cancelled'].includes(r.status))).toBe(true));
    expect(h.calls().some(c=>c.task.includes('QUEUED_ROUTINE'))).toBe(false);
  },20000);

  it.each(['preparing','delayed-return'] as const)('blocks %s launch races and cannot revive them after healthy resume',async stage=>{
    const h=await harness(),r=h.service.save(h.request()).routines[0];
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let entered=false;let reservedId:string|undefined;
    h.effects.launch=async(r,guard,reserved,beforeLaunch)=>{entered=true;if(stage==='preparing')await gate;guard();const run=await h.runner.start({workspaceId:h.runner.getWorkspace()!.id,task:r.task},undefined,[],[],undefined,undefined,reserved,beforeLaunch);reservedId=run.id;if(stage==='delayed-return')await gate;return run;};
    if(stage==='delayed-return'){await h.manual('HOLD owner');await until(()=>expect(h.calls()).toHaveLength(1));}
    h.service.runNow(ref(r));await until(()=>expect(stage==='preparing'?entered:!!reservedId).toBe(true));
    const fault=vi.spyOn(h.store,'save').mockImplementation(()=>{throw new Error('fault');});expect(()=>h.service.save(h.request())).toThrow('fault');fault.mockRestore();
    h.service.resume();release();await flush();await flush();h.release();
    await until(()=>expect(h.runner.list().every(r=>['completed','cancelled'].includes(r.status))).toBe(true));
    expect(h.calls().some(c=>c.task.includes('QUEUED_ROUTINE'))).toBe(false);expect(h.service.state().executions[0].status).toBe(stage==='preparing'?'failed':'cancelled');
  },20000);

  it('cancels an async starting reservation while preserving an already running routine snapshot and recording its real completion during the fault',async()=>{
    const h=await harness();
    const active=h.service.save(h.request({name:'Active',task:'HOLD active routine snapshot'})).routines[0];h.service.runNow(ref(active));await until(()=>expect(h.calls()).toHaveLength(1));
    const r=h.service.save(h.request()).routines.find(r=>r.name==='Routine')!;
    h.runner.setCapacity(2);const other=join(h.root,'other');mkdirSync(other);const workspaceId=randomUUID();h.runner.registerWorkspace({id:workspaceId,name:'Other',path:other,entries:[],truncated:false});
    let release!:()=>void,entered=false;const gate=new Promise<void>(resolve=>{release=resolve;});
    // Hold real runner startup at browser-tool preparation, after reservation but before spawn.
    const delayedRunner=new AgentRunner(run=>h.service.runChanged(run),30000,()=>{},[],async()=>{entered=true;await gate;return {args:[],env:{},dispose:()=>{}};});delayedRunner.registerWorkspace({id:workspaceId,name:'Other',path:other,entries:[],truncated:false});
    const baseRuns=h.effects.runs,baseCancel=h.effects.cancel;h.effects.runs=()=>[...baseRuns(),...delayedRunner.list()];h.effects.cancel=id=>{if(delayedRunner.getRun(id))delayedRunner.cancel(id);else baseCancel(id);};
    h.effects.launch=async(r,guard,reserved,beforeLaunch)=>{guard();return delayedRunner.start({workspaceId,task:r.task},undefined,[],[],undefined,undefined,reserved,beforeLaunch);};
    cleanups.push(async()=>{release();await delayedRunner.shutdown();});
    h.service.runNow(ref(r));await until(()=>expect(entered).toBe(true));const starting=delayedRunner.list()[0];expect(starting.status).toBe('starting');
    vi.spyOn(h.store,'save').mockImplementation(()=>{throw new Error('disk full');});expect(()=>h.service.save(h.request())).toThrow('disk full');
    expect(delayedRunner.getRun(starting.id)?.status).toBe('cancelled');expect(h.runner.list()[0].status).toBe('running');release();h.release();
    await until(()=>expect(h.runner.list()[0].status).toBe('completed'));await flush();expect(h.service.state().executions.find(e=>e.routineId===active.id)?.status).toBe('completed');expect(h.calls().some(c=>c.task.includes('QUEUED_ROUTINE'))).toBe(false);
  },20000);

  it('keeps a failed session paused across restart even if no fault/pause/cancellation write succeeded',async()=>{
    const h=await harness(),r=h.service.save(h.request()).routines[0];await h.manual('HOLD owner');await until(()=>expect(h.calls()).toHaveLength(1));h.service.runNow(ref(r));await until(()=>expect(h.service.state().executions[0].status).toBe('queued'));
    const failure=vi.spyOn(h.store,'save').mockImplementation(()=>{throw new Error('offline storage');});expect(()=>h.service.save(h.request())).toThrow('offline storage');h.service.stop();failure.mockRestore();
    expect(new RoutineStore(h.root).load()).toMatchObject({sessionActive:true,paused:false});h.release();await until(()=>expect(h.runner.list().every(r=>['completed','cancelled'].includes(r.status))).toBe(true));
    h.advance(3600000);const restarted=h.makeService();expect(restarted.state().paused).toBe(true);expect(restarted.state().executions[0].status).toBe('cancelled');expect(()=>restarted.runNow(ref(r))).toThrow(/Resume/);restarted.tick();expect(h.calls()).toHaveLength(1);
    restarted.resume();expect(restarted.state().paused).toBe(false);expect(h.calls()).toHaveLength(1);restarted.runNow(ref(r));await until(()=>expect(restarted.state().executions.at(-1)?.status).toBe('completed'));expect(h.calls()).toHaveLength(2);
  },20000);
});
