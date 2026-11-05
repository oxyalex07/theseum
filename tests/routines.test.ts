import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync, linkSync, readdirSync, realpathSync, renameSync } from 'node:fs';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Routines, type RoutineEffects } from '../electron/routines';
import { RoutineStore } from '../electron/routine-store';
import { nextRoutineTime, routineTrigger, saveRoutineRequest, type Routine, type SaveRoutineRequest } from '../shared/routines';
import type { AgentProfile, AgentRun } from '../shared/bridge';

vi.mock('node:fs',async importOriginal=>{const actual=await importOriginal<typeof import('node:fs')>();return {...actual,renameSync:vi.fn(actual.renameSync),readSync:vi.fn(actual.readSync),openSync:vi.fn(actual.openSync)};});

const directories:string[]=[];const services:Routines[]=[];
afterEach(()=>{services.splice(0).forEach(s=>s.stop());directories.splice(0).forEach(d=>rmSync(d,{force:true,recursive:true}));vi.restoreAllMocks();});
const directory=()=>{const d=realpathSync(mkdtempSync(join(tmpdir(),'theseus-routines-')));directories.push(d);return d;};
const stamp='2026-10-29T08:00:00.000Z';
const profile:AgentProfile={id:randomUUID(),configurationVersion:1,createdAt:stamp,updatedAt:stamp,name:'Reviewer',icon:'code',color:'violet',description:'',runtime:'codex',model:null,reasoningEffort:null,instructions:'Inspect',memory:'none',sandbox:'read-only',timeoutSeconds:60,defaultProjectPath:null};
const choice=randomUUID();
const request=(patch:Partial<SaveRoutineRequest>={}):SaveRoutineRequest=>({name:'Review project',task:'Review actual changes',trigger:{kind:'interval',minutes:5},enabled:true,profileId:profile.id,profileUpdatedAt:profile.updatedAt,useWorktree:false,folderChoice:choice,executionConsent:true,...patch});
const ref=(r:Routine)=>({id:r.id,expectedRevision:r.revision});
const run=(patch:Partial<AgentRun>={}):AgentRun=>({id:randomUUID(),revision:1,workspaceId:choice,projectName:'Project',projectPath:'/tmp/routine-project',task:'Manual task',status:'completed',startedAt:stamp,endedAt:'2026-10-29T08:01:00.000Z',output:[{sequence:1,kind:'message',text:'Actual fixture result'}],truncated:false,...patch});
function harness(options:{launch?:RoutineEffects['launch'];store?:RoutineStore;dir?:string;runs?:AgentRun[]}={}){
  let now=Date.parse(stamp);const runs=options.runs??[],launched:Routine[]=[],cancelled:string[]=[],dir=options.dir??directory();
  const effects:RoutineEffects={resolveFolder:id=>id===choice?'/tmp/routine-project':undefined,profile:(id,updated)=>{if(id!==profile.id||updated!==profile.updatedAt)throw new Error('Agent changed');return profile;},runs:()=>runs,cancel:id=>{cancelled.push(id);const r=runs.find(r=>r.id===id);if(r)r.status='cancelled';},changed:()=>{},launch:options.launch??(async(r,guard,reserved)=>{guard();launched.push(r);const actual=run({status:'running',endedAt:undefined,task:r.task});runs.push(actual);reserved(actual);return actual;})};
  const service=new Routines(dir,effects,()=>now,options.store);services.push(service);service.start();
  return {service,dir,runs,launched,cancelled,effects,advance:(ms:number)=>{now+=ms;},clock:(ms:number)=>{now=ms;},flush:async()=>{await new Promise(resolve=>setImmediate(resolve));}};
}
describe('routine configuration and UTC schedules',()=>{
  it('validates all trigger forms, days and configuration without accepting privileged extra fields',()=>{
    for(const trigger of [{kind:'interval',minutes:0},{kind:'interval',minutes:1.2},{kind:'weekly',time:'25:00',days:[1]},{kind:'weekly',time:'09:00',days:[]},{kind:'weekly',time:'09:00',days:[1,1]},{kind:'run-completed',command:'rm'},{kind:'webhook'}])expect(()=>routineTrigger(trigger)).toThrow();
    expect(routineTrigger({kind:'weekly',time:'09:30',days:[5,1]})).toEqual({kind:'weekly',time:'09:30',days:[1,5]});
    for(const patch of [{enabled:true,executionConsent:false},{folderChoice:'/tmp'},{task:'\0'},{profileId:'defaults'},{command:'pwd'},{trigger:{kind:'interval',minutes:Infinity}}])expect(()=>saveRoutineRequest({...request(),...patch})).toThrow();
    expect(saveRoutineRequest(request({enabled:false,executionConsent:false})).enabled).toBe(false);
  });
  it('computes interval and weekly UTC next occurrences across exact boundaries, weeks and year rollover',()=>{
    expect(nextRoutineTime({kind:'interval',minutes:5},Date.parse(stamp))).toBe('2026-10-29T08:05:00.000Z');
    expect(nextRoutineTime({kind:'weekly',time:'08:00',days:[4]},Date.parse(stamp))).toBe('2026-11-05T08:00:00.000Z');
    expect(nextRoutineTime({kind:'weekly',time:'00:00',days:[5]},Date.parse('2026-12-31T23:59:00Z'))).toBe('2027-01-01T00:00:00.000Z');
    expect(nextRoutineTime({kind:'run-failed'},Date.parse(stamp))).toBeNull();
  });
});
describe('persistent routine lifecycle and scheduler',()=>{
  it('creates, edits, enables, disables and deletes persistent records, rejects stale/native-folder/profile forgery',()=>{
    const h=harness();let r=h.service.save(request()).routines[0];
    expect(()=>h.service.save(request({folderChoice:randomUUID()}))).toThrow(/native/);
    expect(()=>h.service.save(request({profileUpdatedAt:'2026-10-30T00:00:00.000Z'}))).toThrow(/changed/);
    expect(()=>h.service.enable(ref(r),true,false)).toThrow(/Explicitly/);
    const old=r;r=h.service.enable(ref(r),false,false).routines[0];expect(r.nextRunAt).toBeNull();
    expect(()=>h.service.remove(ref(old))).toThrow(/changed/);
    r=h.service.save(request({id:r.id,expectedRevision:r.revision,name:'Edited',folderChoice:null,enabled:false})).routines[0];
    const restarted=harness({dir:h.dir});expect(restarted.service.state().routines[0].name).toBe('Edited');
    r=restarted.service.enable(ref(r),true,true).routines[0];expect(r.nextRunAt).toBe('2026-10-29T08:05:00.000Z');
    restarted.service.remove(ref(r));expect(new RoutineStore(h.dir).load().routines).toEqual([]);
  });
  it('durably reserves before async work, fires once, rejects overlap and never replays the same occurrence',async()=>{
    const h=harness();h.service.save(request({trigger:{kind:'interval',minutes:1}}));
    h.advance(60000);h.service.tick();h.service.tick();
    expect(h.service.state().executions).toHaveLength(1);expect(h.service.state().executions[0].status).toBe('preparing');
    await h.flush();expect(h.launched).toHaveLength(1);
    h.advance(60000);h.service.tick();await h.flush();expect(h.launched).toHaveLength(1);expect(h.service.state().executions.at(-1)?.status).toBe('skipped');
    const actual=h.runs[0];actual.status='completed';actual.endedAt=new Date(Date.parse(stamp)+120000).toISOString();h.service.runChanged(actual);
    h.advance(60000);h.service.tick();await h.flush();expect(h.launched).toHaveLength(2);expect(new RoutineStore(h.dir).load().executions.filter(e=>e.runId)).toHaveLength(2);
  });
  it.each(['disable','edit','delete','stop'] as const)('invalidates pending %s before asynchronous reservation',async action=>{
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});let reservations=0;
    const h=harness({launch:async(_r,guard,reserved)=>{await gate;guard();reservations++;const actual=run();reserved(actual);return actual;}});
    const r=h.service.save(request()).routines[0];h.service.runNow(ref(r));await h.flush();
    if(action==='disable')h.service.enable(ref(r),false,false);
    if(action==='edit')h.service.save(request({id:r.id,expectedRevision:r.revision,folderChoice:null,task:'Changed'}));
    if(action==='delete')h.service.remove(ref(r));
    if(action==='stop')h.service.stop(true);
    release();await h.flush();expect(reservations).toBe(0);expect(h.service.state().executions[0].status).toBe('failed');
  });
  it('cancels queued work on disable and preserves already running execution and its immutable configuration',async()=>{
    const h=harness();const r=h.service.save(request()).routines[0];h.service.runNow(ref(r));await h.flush();
    const actual=h.runs[0];actual.status='queued';h.service.runChanged(actual);h.service.enable(ref(r),false,false);expect(h.cancelled).toEqual([actual.id]);
    const enabled=h.service.enable(ref(h.service.state().routines[0]),true,true).routines[0];actual.status='completed';h.service.runChanged(actual);
    h.service.runNow(ref(enabled));await h.flush();h.service.remove(ref(enabled));expect(h.cancelled).toHaveLength(1);expect(h.launched[1].task).toBe('Review actual changes');
  });
  it('skips sleep/offline misses and reconciles interrupted attempts without retrying after restart',async()=>{
    const h=harness();const r=h.service.save(request({trigger:{kind:'interval',minutes:1}})).routines[0];
    h.advance(60001*10);h.service.tick();await h.flush();expect(h.launched).toHaveLength(0);expect(h.service.state().executions[0].detail).toMatch(/Missed/);
    h.service.runNow(ref(r));await h.flush();h.service.stop();
    const restarted=harness({dir:h.dir});expect(restarted.service.state().executions.some(e=>e.status==='interrupted')).toBe(true);expect(restarted.launched).toHaveLength(0);
    restarted.service.stop(true);expect(()=>restarted.service.runNow(ref(r))).toThrow(/Resume/);restarted.service.resume();
  });
  it.each(['startup','repair'] as const)('reconciles %s history with actual terminal results and suppresses historical and routine-origin events',async load=>{
    const h=harness(),r=h.service.save(request({trigger:{kind:'run-completed'}})).routines[0];h.service.stop();
    const actual=['completed','failed','cancelled','interrupted'].map(status=>run({status:status as AgentRun['status'],error:status==='failed'?'Actual failure':undefined}));
    const oldStatuses=['running','starting','cancelling','queued'] as const;
    const executions=actual.map((actual,i)=>({id:randomUUID(),routineId:r.id,routineName:r.name,revision:r.revision,triggerKey:`manual:${randomUUID()}`,triggeredAt:stamp,status:oldStatuses[i],runId:actual.id}));
    const store=new RoutineStore(h.dir);store.save({...store.load(),executions});
    const file=join(h.dir,'routines.json'),preserved=join(h.dir,'preserved.json');
    if(load==='repair'){renameSync(file,preserved);mkdirSync(file);}
    const runs=load==='startup'?[...actual]:[],restarted=harness({dir:h.dir,runs});
    if(load==='repair'){
      expect(restarted.service.state().warning).toMatch(/storage/);runs.push(...actual);
      rmSync(file,{recursive:true});renameSync(preserved,file);
    }
    // This manual run is also historical by the time the repaired store first loads.
    const historical=run();runs.push(historical);restarted.service.resume();
    const reconciled=restarted.service.state().executions;
    actual.forEach((run,i)=>expect(reconciled[i]).toMatchObject({runId:run.id,status:run.status,endedAt:run.endedAt,...(run.error?{detail:run.error}:{})}));
    expect(store.load().executions).toEqual(reconciled);
    // Even after result-link pruning, loaded routine origins cannot cascade.
    restarted.service.forgetRun(actual[0].id);restarted.service.runChanged(actual[0]);
    if(load==='repair')restarted.service.runChanged(historical);
    await restarted.flush();expect(restarted.launched).toHaveLength(0);
    restarted.service.runChanged(run());await restarted.flush();expect(restarted.launched).toHaveLength(1);
  });
  it('honors actual run event type/project, deduplicates repeated updates and prevents recursive routine execution',async()=>{
    const prior=run();const h=harness({runs:[prior]});
    h.service.save(request({trigger:{kind:'run-completed'}}));h.service.save(request({name:'Failure',trigger:{kind:'run-failed'}}));
    h.service.runChanged(prior);h.service.runChanged(run({projectPath:'/other'}));h.service.runChanged(run({status:'cancelled'}));await h.flush();expect(h.launched).toHaveLength(0);
    const event=run();h.service.runChanged(event);h.service.runChanged(event);await h.flush();expect(h.launched).toHaveLength(1);
    const generated=h.runs.at(-1)!;generated.status='failed';h.service.runChanged(generated);await h.flush();expect(h.launched).toHaveLength(1);
    h.service.runChanged(run({status:'failed'}));await h.flush();expect(h.launched).toHaveLength(2);
    h.service.forgetRun(generated.id);expect(h.service.state().executions.some(e=>e.runId===generated.id)).toBe(false);
    h.service.runChanged(generated);await h.flush();expect(h.launched).toHaveLength(2);
  });
  it('records actual terminal status and errors, handles launch refusal without inventing run results',async()=>{
    const h=harness({launch:async()=>{throw new Error('Runtime unavailable');}});const r=h.service.save(request()).routines[0];h.service.runNow(ref(r));await h.flush();expect(h.service.state().executions[0]).toMatchObject({status:'failed',detail:'Runtime unavailable'});expect(h.service.state().executions[0].runId).toBeUndefined();
  });
  it('fails closed on reservation persistence failure before any execution',async()=>{
    const store=new RoutineStore(directory()),h=harness({store});const r=h.service.save(request()).routines[0];vi.spyOn(store,'save').mockImplementation(()=>{throw new Error('disk full');});
    expect(()=>h.service.runNow(ref(r))).toThrow(/disk/);await h.flush();expect(h.launched).toHaveLength(0);expect(h.service.state().warning).toMatch(/storage/);expect(()=>h.service.resume()).toThrow(/disk/);expect(h.service.state().paused).toBe(true);
  });
  it('persists Stop all pause across restart until explicitly resumed',()=>{
    const h=harness();h.service.save(request());h.service.stop(true);const restarted=harness({dir:h.dir});expect(restarted.service.state().paused).toBe(true);expect(()=>restarted.service.runNow(ref(restarted.service.state().routines[0]))).toThrow(/Resume/);restarted.service.resume();expect(new RoutineStore(h.dir).load().paused).toBe(false);
  });
  it('does not replay terminal events delivered after a long suspension or during shutdown',async()=>{
    const h=harness();h.service.save(request({trigger:{kind:'run-completed'}}));h.advance(3600000);const late=run();h.service.runChanged(late);h.service.tick();h.service.runChanged(late);await h.flush();expect(h.launched).toHaveLength(0);h.service.stop();h.service.runChanged(run());h.service.start();await h.flush();expect(h.launched).toHaveLength(0);
  });
  it('opens with a warning when startup catch-up bookkeeping cannot be persisted',()=>{
    const h=harness();h.service.save(request({trigger:{kind:'interval',minutes:1}}));h.service.stop();h.service.finishSession();h.advance(120000);
    const store=new RoutineStore(h.dir);vi.spyOn(store,'save').mockImplementation(()=>{throw new Error('Disk full');});const restarted=new Routines(h.dir,h.effects,()=>Date.parse(stamp)+120000,store);services.push(restarted);expect(()=>restarted.start()).not.toThrow();expect(restarted.state().warning).toMatch(/storage/);
  });
  it('retains only 500 attempts without evicting an active reservation',async()=>{
    const h=harness();const r=h.service.save(request()).routines[0];h.service.runNow(ref(r));await h.flush();for(let i=0;i<505;i++)h.service.runNow(ref(r));const records=h.service.state().executions;expect(records).toHaveLength(500);expect(records.filter(e=>e.status==='running')).toHaveLength(1);
  },15000);
});
describe('routine storage safety',()=>{
  it('bounds reads and rejects malformed schemas, duplicate records, symlink, hardlink, nonregular and FIFO paths without blocking',()=>{
    const dir=directory(),file=join(dir,'routines.json'),store=new RoutineStore(dir);
    for(const body of ['broken',JSON.stringify({version:2,routines:[],executions:[]}),JSON.stringify({version:1,routines:[{}],executions:[]}),JSON.stringify({version:1,routines:[],executions:[{}]}),'x'.repeat(3000001)]){writeFileSync(file,body);expect(()=>store.load()).toThrow();}
    rmSync(file);const outside=join(directory(),'outside.json');writeFileSync(outside,'{}');symlinkSync(outside,file);expect(()=>store.load()).toThrow();expect(()=>store.save({version:1,routines:[],executions:[]})).toThrow();rmSync(file);
    linkSync(outside,file);expect(()=>store.load()).toThrow();rmSync(file);mkdirSync(file);expect(()=>store.load()).toThrow();rmSync(file,{recursive:true});
    if(process.platform!=='win32'){execFileSync('mkfifo',[file]);expect(()=>store.load()).toThrow();rmSync(file);}
    expect(readFileSync(outside,'utf8')).toBe('{}');
  });
  it('atomically writes private bounded valid documents without leftover temporary files, rejects a symlinked directory',()=>{
    const h=harness();h.service.save(request());expect(new RoutineStore(h.dir).load().routines).toHaveLength(1);expect(readdirSync(h.dir)).toEqual(['routines.json']);
    const parent=directory(),alias=join(parent,'alias');symlinkSync(h.dir,alias);expect(()=>new RoutineStore(alias).load()).toThrow();
  });
  it('rejects malformed UTF-8 and preserves damaged bytes with an actionable fail-closed warning',()=>{
    const dir=directory(),path=join(dir,'routines.json'),bytes=Buffer.concat([Buffer.from('{"version":1,"routines":[],"executions":[],"x":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}')]);writeFileSync(path,bytes);const h=harness({dir});expect(h.service.state().warning).toMatch(/storage/);expect(()=>h.service.save(request())).toThrow();expect(readFileSync(path)).toEqual(bytes);
  });
  it('rejects a file that grows while reading, and atomic replacement failure preserves saved bytes and state',()=>{
    const h=harness();h.service.save(request());const path=join(h.dir,'routines.json'),before=readFileSync(path);const read=fs.readSync;
    vi.mocked(fs.readSync).mockImplementationOnce(((fd:number,buffer:Buffer,offset:number,length:number,position:number|null)=>{writeFileSync(path,Buffer.concat([before,Buffer.from(' ')]));return read(fd,buffer,offset,length,position);}) as typeof fs.readSync);
    expect(()=>new RoutineStore(h.dir).load()).toThrow();writeFileSync(path,before);
    vi.mocked(fs.renameSync).mockImplementationOnce(()=>{throw new Error('Atomic replacement failed');});expect(()=>h.service.save(request({name:'Must not replace'}))).toThrow(/Atomic/);expect(h.service.state().routines).toHaveLength(1);expect(readFileSync(path)).toEqual(before);expect(readdirSync(h.dir)).toEqual(['routines.json']);
  });
  it.skipIf(process.platform==='win32')('does not block if a regular file is replaced by a FIFO between precheck and open',()=>{
    const dir=directory(),path=join(dir,'routines.json');writeFileSync(path,JSON.stringify({version:1,routines:[],executions:[]}));const open=fs.openSync;
    vi.mocked(fs.openSync).mockImplementationOnce(((file:fs.PathLike,flags:string|number,mode?:fs.Mode)=>{rmSync(path);execFileSync('mkfifo',[path]);return open(file,flags,mode);}) as typeof fs.openSync);
    expect(()=>new RoutineStore(dir).load()).toThrow();
  });
  it('rejects replacement of its storage directory after it has loaded',()=>{
    const h=harness();h.service.save(request());renameSync(h.dir,h.dir+'-old');directories.push(h.dir+'-old');mkdirSync(h.dir);expect(()=>h.service.save(request({name:'Replacement'}))).toThrow();expect(readdirSync(h.dir)).toEqual([]);
  });
});
