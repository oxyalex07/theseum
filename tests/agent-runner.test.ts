// Adapter lifecycle tests use controlled child-process streams; no provider calls or account usage.
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, realpath, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const children=vi.hoisted(()=>({runs:[] as any[],probes:[] as any[],hold:false}));
vi.mock('node:child_process',()=>({
  spawn:vi.fn((_binary:string,args:string[])=>{
    const child:any=new EventEmitter();
    child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();
    child.exitCode=null;child.signalCode=null;child.kill=vi.fn();
    if(args.includes('exec')){
      child.pid=987654+children.runs.length;children.runs.push(child);queueMicrotask(()=>child.emit('spawn'));
    }else{
      children.probes.push(child);
      if(!children.hold)queueMicrotask(()=>{child.stdout.write('test-runtime');child.emit('close',0);});
    }
    return child;
  }),
  execFile:vi.fn((_binary:unknown,_args:unknown,_opts:unknown,callback:any)=>callback(null,'987654 1\n987655 987654')),
}));
import { AgentRunner } from '../electron/agent-runner';
import { defaultSafetyPolicy } from '../shared/safety';
let directory:string,runner:AgentRunner;
const workspaceId='11111111-1111-4111-8111-111111111111';
const input={workspaceId,task:'test'};
beforeEach(async()=>{
  directory=await realpath(await mkdtemp(join(tmpdir(),'theseus-runner-')));
  children.runs=[];children.probes=[];children.hold=false;
  vi.stubEnv('CODEX_HOME',join(directory,'codex'));
  vi.stubEnv('THESEUS_CODEX_PATH',process.execPath);
  vi.spyOn(process,'kill').mockImplementation(((pid:number,signal:any)=>{
    const child=children.runs.find(c=>c.pid===-pid);if(child){queueMicrotask(()=>{child.signalCode=signal;child.emit('close',null,signal);});}
    return true;
  }) as any);
  runner=new AgentRunner(()=>{},1000);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
});
afterEach(async()=>{children.hold=false;for(const child of children.probes)child.emit('close',0);await runner.shutdown();vi.restoreAllMocks();vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true});});
it('stops active tasks, revokes browser tools, and allows a later explicit start',async()=>{
  const dispose=vi.fn();
  runner=new AgentRunner(()=>{},1000,()=>{},[],async()=>({args:[],env:{},dispose}));
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
  const run=await runner.start(input);
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('running'));
  await runner.stopAll();
  expect(runner.getRun(run.id)?.status).toBe('cancelled');expect(dispose).toHaveBeenCalled();
  expect(process.kill).toHaveBeenCalledWith(-987654,'SIGINT');
  const restarted=await runner.start(input);expect(restarted.status).toBe('starting');
  // Finish startup before cleanup so its probes cannot leak into the next test.
  await vi.waitFor(()=>expect(runner.getRun(restarted.id)?.status).toBe('running'));
});
it('stop all invalidates a starting task before any agent process is launched',async()=>{
  children.hold=true;
  const run=await runner.start(input);
  await vi.waitFor(()=>expect(children.probes.length).toBe(1));
  await runner.stopAll();
  expect(runner.getRun(run.id)?.status).toBe('cancelled');
  children.hold=false;children.probes[0].emit('close',0);
  await new Promise(resolve=>setTimeout(resolve,30));
  expect(children.runs).toHaveLength(0);
});
it('enforces the global policy timeout even if the snapshot duration is longer',async()=>{
  const run=await runner.start(input,{runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:1800,safetyPolicy:{...defaultSafetyPolicy(),timeoutSeconds:5}});
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('running'));
  // The main-owned launch ceiling is one second in this test.
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('failed'),{timeout:2500});
  expect(runner.getRun(run.id)?.error).toContain('time limit');
});
it('uses a shorter saved Safety duration rather than the longer profile duration',async()=>{
  runner=new AgentRunner(()=>{},6000);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
  vi.useFakeTimers();
  try{
    const run=await runner.start(input,{runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:1800,safetyPolicy:{...defaultSafetyPolicy(),timeoutSeconds:5}});
    await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('running'));
    await vi.advanceTimersByTimeAsync(4900);
    expect(runner.getRun(run.id)?.status).toBe('running');
    await vi.advanceTimersByTimeAsync(100);
    expect(runner.getRun(run.id)?.status).toBe('failed');
    expect(runner.getRun(run.id)?.error).toContain('5-second');
  }finally{vi.useRealTimers();}
});

it('launches in the managed worktree and records its path without changing project identity',async()=>{
  const create=vi.fn(async(_path:string,id:string)=>({id,path:directory,branch:`theseus/${id}`}));
  runner=new AgentRunner(()=>{},1000,()=>{},[],undefined,()=>[],{create} as any);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
  const run=await runner.start({...input,useWorktree:true});
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('running'));
  expect(create).toHaveBeenCalledWith(directory,run.id);
  expect(runner.getRun(run.id)).toMatchObject({projectPath:directory,executionPath:directory,worktreeId:run.id});
  expect([...vi.mocked(spawn).mock.calls].reverse().find(call=>call[1]?.includes('exec'))?.[2]).toMatchObject({cwd:directory});
});
it('does not launch an agent if cancellation occurs while a worktree is being created',async()=>{
  let release!:(value:any)=>void;
  const create=vi.fn(()=>new Promise<any>(resolve=>{release=resolve;}));
  runner=new AgentRunner(()=>{},1000,()=>{},[],undefined,()=>[],{create} as any);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
  const run=await runner.start({...input,useWorktree:true});await vi.waitFor(()=>expect(create).toHaveBeenCalled());
  await runner.stopAll();release({id:run.id,path:directory,branch:`theseus/${run.id}`});
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.worktreeId).toBe(run.id));
  expect(children.runs).toHaveLength(0);expect(runner.getRun(run.id)?.status).toBe('cancelled');
});

const complete=(child:any)=>{child.stdout.write(JSON.stringify({type:'turn.completed'})+'\n');child.exitCode=0;child.emit('close',0,null);};
it('queues at the configured limit, cancels pending work, and drains in order',async()=>{
  const first=await runner.start(input);
  const second=await runner.start({...input,task:'second'});
  const third=await runner.start({...input,task:'third'});
  expect(second.status).toBe('queued');expect(third.status).toBe('queued');
  expect(()=>runner.forgetRun(second.id)).toThrow('Active runs');
  expect(runner.cancel(second.id).status).toBe('cancelled');
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));
  complete(children.runs[0]);
  await vi.waitFor(()=>expect(runner.getRun(third.id)?.status).toBe('running'));
  expect(runner.getRun(first.id)?.status).toBe('completed');
  expect(children.runs).toHaveLength(2);
  expect(children.runs[1].stdin.read().toString()).toBe('third');
});
it('reserves slots before async checks, runs isolated worktrees concurrently, and cancels only the chosen run',async()=>{
  const create=vi.fn(async(_path:string,id:string)=>({id,path:directory,branch:`theseus/${id}`}));
  runner=new AgentRunner(()=>{},10000,()=>{},[],undefined,()=>[],{create} as any);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
  runner.setCapacity(2);
  const [first,second,third]=await Promise.all([1,2,3].map(n=>runner.start({...input,useWorktree:true,task:String(n)})));
  expect([first.status,second.status,third.status]).toEqual(['starting','starting','queued']);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  expect(create).toHaveBeenCalledTimes(2);
  runner.cancel(first.id);
  await vi.waitFor(()=>expect(runner.getRun(third.id)?.status).toBe('running'));
  expect(runner.getRun(first.id)?.status).toBe('cancelled');
  expect(runner.getRun(second.id)?.status).toBe('running');
  expect(create).toHaveBeenCalledTimes(3);
});
it('keeps checkout ownership across workspace IDs and drains when capacity grows',async()=>{
  runner.setCapacity(2);
  runner.registerWorkspace({id:'22222222-2222-4222-8222-222222222222',name:'alias',path:directory,entries:[],truncated:false});
  const first=await runner.start(input);
  const alias=await runner.start({...input,workspaceId:'22222222-2222-4222-8222-222222222222'});
  expect(alias.status).toBe('queued');
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));
  complete(children.runs[0]);
  await vi.waitFor(()=>expect(runner.getRun(alias.id)?.status).toBe('running'));
  expect(runner.getRun(first.id)?.status).toBe('completed');
});
it('changes capacity without stopping existing tasks and prevents pending work during stop all',async()=>{
  runner=new AgentRunner(()=>{},10000);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});
  const other=await realpath(await mkdtemp(join(directory,'other-')));
  runner.registerWorkspace({id:'22222222-2222-4222-8222-222222222222',name:'other',path:other,entries:[],truncated:false});
  const first=await runner.start(input);
  const second=await runner.start({...input,workspaceId:'22222222-2222-4222-8222-222222222222'});
  expect(second.status).toBe('queued');
  runner.setCapacity(2);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  runner.setCapacity(1);
  const pending=await runner.start(input);
  complete(children.runs[0]);
  await new Promise(resolve=>setTimeout(resolve,20));
  expect(children.runs).toHaveLength(2);expect(runner.getRun(pending.id)?.status).toBe('queued');
  await runner.stopAll();
  expect(runner.list().filter(r=>[first.id,second.id,pending.id].includes(r.id)).every(r=>['cancelled','completed'].includes(r.status))).toBe(true);
  expect(children.runs).toHaveLength(2);
});
it('finishes a failed startup and releases its slot to pending work',async()=>{
  const first=await runner.start(input);
  const pending=await runner.start(input);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));
  children.runs[0].emit('close',1,null);
  await vi.waitFor(()=>expect(runner.getRun(pending.id)?.status).toBe('running'));
  expect(runner.getRun(first.id)?.status).toBe('failed');
});

it('protects a running managed worktree when its execution folder is selected directly',async()=>{
  const create=vi.fn(async(_path:string,id:string)=>({id,path:directory,branch:`theseus/${id}`}));
  runner=new AgentRunner(()=>{},10000,()=>{},[],undefined,()=>[],{create} as any);
  runner.registerWorkspace({id:workspaceId,name:'test',path:directory,entries:[],truncated:false});runner.setCapacity(2);
  const first=await runner.start({...input,useWorktree:true});
  await vi.waitFor(()=>expect(runner.getRun(first.id)?.status).toBe('running'));
  expect((await runner.start(input)).status).toBe('queued');
  expect(children.runs).toHaveLength(1);
});

const threadId='33333333-3333-4333-8333-333333333333';
async function savedThread(){
  const folder=join(directory,'codex','sessions','2026','10','24');await mkdir(folder,{recursive:true});
  await writeFile(join(folder,`rollout-2026-10-24T00-00-00-${threadId}.jsonl`),'{}\n');
}
async function connected(){
  const run=await runner.start(input);
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('running'));
  children.runs[0].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');
  return run;
}
const followUp=(id:string,task='follow-up')=>runner.continue({runId:id,task,expectedRevision:runner.getRun(id)!.revision});
it('continues the same durable thread with stdin data and retained output',async()=>{
  await savedThread();const run=await connected();complete(children.runs[0]);
  const original=runner.getRun(run.id)!;
  const task='$(touch /tmp/never)\n--dangerously-bypass-approvals-and-sandbox';
  const next=await followUp(run.id,task);expect(next.id).toBe(run.id);expect(next.output).toEqual(expect.arrayContaining(original.output));
  await expect(followUp(run.id)).rejects.toThrow('Wait for this turn');
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  const call=[...vi.mocked(spawn).mock.calls].reverse().find(call=>call[1]?.includes('exec'))!;
  expect(call[1]!.slice(-3)).toEqual(['resume',threadId,'-']);expect(call[1]).not.toContain('--ephemeral');expect(call[1]).not.toContain(task);
  expect(children.runs[1].stdin.read().toString()).toBe(task);
  children.runs[1].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');
  complete(children.runs[1]);expect(runner.getRun(run.id)?.status).toBe('completed');expect(runner.list()).toHaveLength(1);
});
it.each(['completed','cancelled','failed','interrupted'] as const)('continues recovered %s runs in their saved checkout',async status=>{
  await savedThread();const run=await connected();complete(children.runs[0]);
  const execution=await realpath(await mkdtemp(join(directory,'checkout-')));
  const snapshot={...runner.getRun(run.id)!,status,executionPath:execution,worktreeId:run.id};
  runner=new AgentRunner(()=>{},1000,()=>{},[snapshot]);
  await followUp(run.id);await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  expect([...vi.mocked(spawn).mock.calls].reverse().find(call=>call[1]?.includes('exec'))?.[2]).toMatchObject({cwd:execution});
  children.runs[1].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');
  complete(children.runs[1]);expect(runner.getRun(run.id)?.status).toBe('completed');
});
it('fails visibly on expired sessions without spawning an unrelated task',async()=>{
  const run=await connected();complete(children.runs[0]);await followUp(run.id);
  await vi.waitFor(()=>expect(runner.getRun(run.id)?.status).toBe('failed'));
  expect(runner.getRun(run.id)?.error).toContain('unavailable or expired');expect(children.runs).toHaveLength(1);
});
it('rejects legacy runs, stale revisions, malformed requests, and active turns',async()=>{
  const run=await runner.start(input);
  await expect(followUp(run.id)).rejects.toThrow('Wait for this turn');
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));complete(children.runs[0]);
  await expect(followUp(run.id)).rejects.toThrow('no saved Codex thread');
  await expect(runner.continue({runId:run.id,task:'x',expectedRevision:-1})).rejects.toThrow('conversation changed');
  await expect(runner.continue({runId:run.id,task:'x',expectedRevision:1,threadId:'injected'})).rejects.toThrow('Invalid continuation');
});
it('queues continuation behind another checkout owner and sends it only once',async()=>{
  await savedThread();const run=await connected();complete(children.runs[0]);
  const owner=await runner.start(input);await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  expect((await followUp(run.id)).status).toBe('queued');
  complete(children.runs[1]);await vi.waitFor(()=>expect(children.runs).toHaveLength(3));
  expect(runner.getRun(owner.id)?.status).toBe('completed');expect(children.runs[2].stdin.read().toString()).toBe('follow-up');
});
it('does not turn a failed continuation into success on a completed event',async()=>{
  await savedThread();const run=await connected();complete(children.runs[0]);await followUp(run.id);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  children.runs[1].stderr.write('resume is unsupported');children.runs[1].emit('close',2,null);
  expect(runner.getRun(run.id)?.status).toBe('failed');expect(runner.getRun(run.id)?.error).toContain('expired, unavailable, or unsupported');
});
it('does not let an abandoned startup launch or overwrite a later follow-up',async()=>{
  await savedThread();const run=await connected();complete(children.runs[0]);
  children.hold=true;const before=children.probes.length;
  await followUp(run.id,'abandoned');await vi.waitFor(()=>expect(children.probes.length).toBe(before+1));
  await runner.stopAll();expect(runner.getRun(run.id)?.status).toBe('cancelled');
  children.hold=false;await followUp(run.id,'current follow-up');
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  children.probes[before].emit('close',0);
  await new Promise(resolve=>setTimeout(resolve,30));
  expect(children.runs).toHaveLength(2);expect(children.runs[1].stdin.read().toString()).toBe('current follow-up');
});
it('reapplies current Safety limits while keeping the saved sandbox and profile',async()=>{
  await savedThread();const run=await connected();complete(children.runs[0]);
  const original=runner.getRun(run.id)!;
  runner=new AgentRunner(()=>{},1000,()=>{},[{...original,agentConfiguration:{runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:100}}]);
  const next=await runner.continue({runId:run.id,task:'continue',expectedRevision:original.revision},{...defaultSafetyPolicy(),timeoutSeconds:5});
  expect(next.agentConfiguration?.timeoutSeconds).toBe(5);
  expect(next.agentConfiguration?.safetyPolicy?.timeoutSeconds).toBe(5);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  const args=[...vi.mocked(spawn).mock.calls].reverse().find(call=>call[1]?.includes('exec'))![1]!;
  expect(args).toContain('workspace-write');expect(args).toContain('never');expect(args).toContain('sandbox_workspace_write.network_access=false');
});

const crewSteps=()=>[
  {role:'forge' as const,configuration:{runtimeDefaults:true as const,approvalPolicy:'never' as const,timeoutSeconds:30},memory:[]},
  {role:'sentinel' as const,configuration:{runtimeDefaults:true as const,approvalPolicy:'never' as const,timeoutSeconds:30},memory:[]},
];
it('reserves crew steps, shares the checkout, passes handoffs and restricts the reviewer',async()=>{
  runner.setCapacity(2);
  const first=runner.startCrew(input,crewSteps(),[]);
  const second=runner.list().find(r=>r.id!==first.id)!;
  expect(second.status).toBe('queued');expect(second.crew?.dependsOn).toEqual([first.id]);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));
  expect(runner.getRun(second.id)?.status).toBe('queued');
  const builder=children.runs[0];
  builder.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Implemented in source.ts; checks passed.'}})+'\n');
  builder.stdout.write('{"type":"turn.completed"}\n');builder.emit('close',0);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  const reviewer=children.runs[1];
  expect(reviewer.stdin.read().toString()).toContain('Implemented in source.ts; checks passed.');
  const calls=vi.mocked(spawn).mock.calls.filter(([,args])=>(args as string[]).includes('exec'));
  expect(calls[1][1]).toContain('read-only');expect(calls[1][2]).toMatchObject({cwd:directory});
  expect(runner.getRun(first.id)?.status).toBe('completed');
});
it.each(['failed','cancelled'] as const)('does not launch a dependent after a %s prerequisite',async status=>{
  const first=runner.startCrew(input,crewSteps(),[]);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));
  if(status==='failed')children.runs[0].emit('close',1);else runner.cancel(first.id);
  await vi.waitFor(()=>expect(runner.list().every(r=>!['starting','queued','running','cancelling'].includes(r.status))).toBe(true));
  const second=runner.list().find(r=>r.id!==first.id)!;
  expect(second.status).toBe('failed');expect(second.error).toContain('prerequisite');expect(children.runs).toHaveLength(1);
});
it('keeps dependencies outside live capacity and stops all crew work without launching successors',async()=>{
  const first=runner.startCrew(input,crewSteps(),[]);
  const otherId='22222222-2222-4222-8222-222222222222';
  const otherPath=join(directory,'other');await mkdir(otherPath);
  runner.registerWorkspace({id:otherId,name:'other',path:otherPath,entries:[],truncated:false});
  runner.setCapacity(2);
  const other=await runner.start({...input,workspaceId:otherId});
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  expect(runner.getRun(other.id)?.status).toBe('running');
  await runner.stopAll();
  expect(runner.list().every(r=>r.status==='cancelled')).toBe(true);
  expect(children.runs).toHaveLength(2);
  expect(runner.getRun(first.id)?.status).toBe('cancelled');
});
it('rejects split crew worktrees before reserving any runs',()=>{
  expect(()=>runner.startCrew({...input,useWorktree:true},crewSteps(),[])).toThrow('same changes');
  expect(runner.list()).toEqual([]);
});
it('allows a finished crew conversation to continue after predecessor history is deleted',async()=>{
  await savedThread();const first=runner.startCrew(input,crewSteps(),[]);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));complete(children.runs[0]);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  const second=runner.list().find(r=>r.id!==first.id)!;
  children.runs[1].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');
  complete(children.runs[1]);runner.forgetRun(first.id);
  await followUp(second.id);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(3));
  expect(children.runs[2].stdin.read().toString()).toBe('follow-up');
  children.runs[2].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');
  complete(children.runs[2]);expect(runner.getRun(second.id)?.status).toBe('completed');
});


it.each(['missing','malformed','different'] as const)('refuses %s continuation identity even when the runtime claims success',async identity=>{
  await savedThread();const run=await connected();complete(children.runs[0]);await followUp(run.id);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  const child=children.runs[1];
  const events=[...(identity==='missing'?[]:[{type:'thread.started',thread_id:identity==='malformed'?'--last':'44444444-4444-4444-8444-444444444444'}]),
    {type:'item.completed',item:{type:'agent_message',text:'Unverified conversation output'}},
    {type:'turn.completed'}];
  child.stdout.write(events.map(event=>JSON.stringify(event)).join('\n')+'\n');
  child.exitCode=0;child.emit('close',0,null);
  const final=runner.getRun(run.id)!;
  expect(final.status).toBe('failed');expect(final.error).toMatch(/thread|conversation/i);
  expect(final.threadId).toBe(threadId);expect(final.output.some(entry=>entry.text==='Unverified conversation output')).toBe(false);
  expect(runner.list()).toHaveLength(1);
});
it('rejects follow-ups while a later crew step is active and never reruns failed successors',async()=>{
  await savedThread();const first=runner.startCrew(input,crewSteps(),[]);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(1));
  children.runs[0].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');complete(children.runs[0]);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));
  await expect(followUp(first.id)).rejects.toThrow('all crew steps');
  const second=runner.list().find(run=>run.id!==first.id)!;
  children.runs[1].emit('close',1,null);
  await followUp(first.id);await vi.waitFor(()=>expect(children.runs).toHaveLength(3));
  children.runs[2].stdout.write(JSON.stringify({type:'thread.started',thread_id:threadId})+'\n');complete(children.runs[2]);
  await new Promise(resolve=>setTimeout(resolve,20));
  expect(runner.getRun(first.id)?.status).toBe('completed');expect(runner.getRun(second.id)?.status).toBe('failed');expect(children.runs).toHaveLength(3);
});
it('requires main validation and keeps queued context immutable without persisting file bytes',async()=>{
  const request={...input,taskContext:{fileTokens:[],invocationIds:['review' as const]}};
  await expect(runner.start(request)).rejects.toThrow(/main process/);
  const first=await runner.start(input);await vi.waitFor(()=>expect(runner.getRun(first.id)?.status).toBe('running'));
  const resolved={selection:{files:[{fileId:'a'.repeat(64),path:'notes.md',sha256:'b'.repeat(64),reviewedAt:new Date().toISOString()}],invocationIds:['review' as const]},prompt:'SNAPSHOT_FILE_SENTINEL'};
  const queued=await runner.start(request,undefined,[],[],undefined,resolved);expect(queued.status).toBe('queued');
  resolved.prompt='MUTATED_SENTINEL';resolved.selection.files[0].path='mutated.md';
  expect(runner.getRun(queued.id)?.task).toBe('test');expect(runner.getRun(queued.id)?.taskContextSelection?.files[0].path).toBe('notes.md');expect(JSON.stringify(runner.getRun(queued.id))).not.toContain('SNAPSHOT_FILE_SENTINEL');
  children.runs[0].stdout.write(JSON.stringify({type:'turn.completed'})+'\n');children.runs[0].emit('close',0);
  await vi.waitFor(()=>expect(runner.getRun(queued.id)?.status).toBe('running'));
  const prompt=children.runs[1].stdin.read().toString();expect(prompt).toContain('SNAPSHOT_FILE_SENTINEL');expect(prompt).not.toContain('MUTATED_SENTINEL');
});
it('supplies the same reviewed context snapshot to each dependent crew step',async()=>{
  const configuration={runtimeDefaults:true as const,approvalPolicy:'never' as const,timeoutSeconds:60};
  const context={selection:{files:[],invocationIds:['test' as const]},prompt:'CREW_CONTEXT_SENTINEL'};
  const first=runner.startCrew(input,[{role:'forge',configuration,memory:[]},{role:'sentinel',configuration,memory:[]}],[],context);
  context.prompt='MUTATED_CREW';await vi.waitFor(()=>expect(runner.getRun(first.id)?.status).toBe('running'));expect(children.runs[0].stdin.read().toString()).toContain('CREW_CONTEXT_SENTINEL');
  children.runs[0].stdout.write(JSON.stringify({type:'turn.completed'})+'\n');children.runs[0].emit('close',0);
  await vi.waitFor(()=>expect(children.runs).toHaveLength(2));await vi.waitFor(()=>expect(runner.list().some(run=>run.crew?.role==='sentinel'&&run.status==='running')).toBe(true));expect(children.runs[1].stdin.read().toString()).toContain('CREW_CONTEXT_SENTINEL');
});
