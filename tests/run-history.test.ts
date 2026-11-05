import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RunHistory, storedRun } from '../electron/run-history';
import { AgentRunner } from '../electron/agent-runner';
import type { AgentRun, RunStatus } from '../shared/bridge';
const directories:string[]=[];
const temporary=()=>{const dir=mkdtempSync(join(tmpdir(),'theseus-history-'));directories.push(dir);return dir;};
const fixture=(status:RunStatus='completed'):AgentRun=>({id:randomUUID(),workspaceId:randomUUID(),revision:3,projectName:'test',projectPath:'/test',task:'Test task',status,startedAt:'2026-10-19T10:00:00.000Z',...(status==='completed'?{endedAt:'2026-10-19T10:01:00.000Z',exitCode:0}:{}),output:[{sequence:1,kind:'message',text:'Saved output'}],truncated:false});
afterEach(()=>{for(const dir of directories.splice(0))rmSync(dir,{recursive:true,force:true});});
describe('main-owned run history',()=>{
  it('round trips metadata, output and terminal errors across independent instances without a 20-run cap',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();
    const runs=Array.from({length:25},()=>fixture());runs[1].status='failed';runs[1].error='Provider failed';runs[1].exitCode=1;runs[2].status='cancelled';
    for(const run of runs)store.save(run);
    const loaded=new RunHistory(path).load();expect(loaded).toHaveLength(25);
    for(const run of runs)expect(loaded.find(r=>r.id===run.id)).toEqual(run);
    if(process.platform!=='win32')expect(statSync(join(store.directory,`${runs[0].id}.json`)).mode&0o777).toBe(0o600);
  });
  it.each(['queued','starting','running','cancelling'] as const)('recovers %s exactly once as Interrupted without inferring success or resuming',status=>{
    const path=temporary(),store=new RunHistory(path);store.load();const run=fixture(status);store.save(run);
    const recovered=new RunHistory(path).load()[0];expect(recovered.status).toBe('interrupted');expect(recovered.endedAt).toBeTruthy();expect(recovered.error).toContain(status==='queued'?'never started':'completion is unknown');expect(recovered.output[0]).toEqual(run.output[0]);expect(recovered.revision).toBe(run.revision+1);
    expect(new RunHistory(path).load()[0]).toEqual(recovered);
    const runner=new AgentRunner(()=>{},1000,()=>{},[recovered]);expect(runner.list()).toEqual([recovered]);
  });
  it('redacts secrets in every saved text field and drops non-whitelisted data',()=>{
    const run=fixture();const secret='sk-examplecredential123456789';run.task=`Do not store ${secret}`;run.error=`Bearer ${secret}`;run.output[0].text=secret;
    const safe=storedRun({...run,environment:{SECRET:secret},credentials:secret});expect(JSON.stringify(safe)).not.toContain(secret);expect(safe).not.toHaveProperty('credentials');expect(safe).not.toHaveProperty('environment');
  });
  it('leaves corrupt and unsupported records untouched while loading healthy records',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();const run=fixture();store.save(run);
    const bad=join(store.directory,`${randomUUID()}.json`);writeFileSync(bad,'broken');
    const newer=join(store.directory,`${randomUUID()}.json`);writeFileSync(newer,JSON.stringify({version:999,run}));
    const loaded=new RunHistory(path);expect(loaded.load()).toEqual([run]);expect(loaded.warnings).toHaveLength(2);expect(readFileSync(bad,'utf8')).toBe('broken');
  });
  it('keeps the last committed record when replacement fails and reports storage failure',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();const run=fixture();store.save(run);
    mkdirSync(join(store.directory,`${run.id}.json.tmp`));
    expect(()=>store.save({...run,status:'failed'})).toThrow();expect(store.error).toContain('New runs are disabled');
    expect(new RunHistory(path).load()).toEqual([run]);
  });
  it('fails closed if the history directory cannot be created',()=>{
    const path=temporary();writeFileSync(join(path,'run-history'),'not a directory');const store=new RunHistory(path);expect(store.load()).toEqual([]);expect(store.error).toBeTruthy();
  });
  it('does not launch an agent when the initial record cannot be persisted',async()=>{
    const runner=new AgentRunner(()=>{},1000,()=>{throw new Error('disk full');});
    const workspace={id:randomUUID(),name:'test',path:temporary(),entries:[],truncated:false};runner.registerWorkspace(workspace);
    const run=await runner.start({workspaceId:workspace.id,task:'Must not execute'});
    expect(run.status).toBe('failed');expect(run.error).toContain('storage failed');expect(run.persistenceError).toBeTruthy();expect(run.output.some(e=>e.text.includes('Codex started'))).toBe(false);await runner.shutdown();
  });
  it('rejects path traversal IDs and malformed output before writing',()=>{
    expect(()=>storedRun({...fixture(),id:'../outside'})).toThrow();
    expect(()=>storedRun({...fixture(),output:[{sequence:1,kind:'token',text:'x'}]})).toThrow();
  });
});

describe('runtime-default configuration snapshots',()=>{
  it('preserves effective defaults and CLI version without inventing a saved profile',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();const run=fixture();
    run.agentConfiguration={runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:8,runtimeVersion:'codex-cli fixture'};
    store.save(run);expect(new RunHistory(path).load()[0].agentConfiguration).toEqual(run.agentConfiguration);
  });
});

describe('history deletion and persisted retention',()=>{
  it('validates the full selection before deletion and protects active records',()=>{
    const store=new RunHistory(temporary());store.load();const done=fixture(),active=fixture('running');[done,active].forEach(r=>store.save(r));
    for(const request of [{ids:[done.id,active.id]},{ids:['../outside']},{ids:[randomUUID()]},{all:true,ids:[]},null])expect(()=>store.delete([done,active],request)).toThrow();
    expect(readFileSync(join(store.directory,`${done.id}.json`),'utf8')).toContain(done.id);
    expect(store.delete([done,active],{all:true}).deletedIds).toEqual([done.id]);
    expect(readFileSync(join(store.directory,`${active.id}.json`),'utf8')).toContain('running');
  });
  it('deletes selected records across restarts and removes them from runner truth',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();const a=fixture(),b=fixture();[a,b].forEach(r=>store.save(r));
    const runner=new AgentRunner(()=>{},1000,r=>store.save(r),[a,b]);
    expect(store.delete(runner.list(),{ids:[a.id,a.id]},id=>runner.forgetRun(id)).deletedIds).toEqual([a.id]);
    expect(runner.list()).toEqual([b]);expect(new RunHistory(path).load()).toEqual([b]);
  });
  it('reports partial deletion failures without forgetting records still on disk',()=>{
    const store=new RunHistory(temporary());store.load();const a=fixture(),b=fixture();store.save(a);
    mkdirSync(join(store.directory,`${b.id}.json`));const removed:string[]=[];
    const result=store.delete([a,b],{all:true},id=>removed.push(id));expect(result.deletedIds).toEqual([a.id]);expect(removed).toEqual([a.id]);expect(result.warning).toContain('Could not delete 1');
  });
  it('persists a validated policy and expires only terminal runs older than its end-time boundary',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();expect(store.retention).toBe('all');
    for(const value of [30,'0','forever',null,{},'../outside'])expect(()=>store.setRetention(value)).toThrow();
    const now=Date.parse('2026-10-20T00:00:00Z'),cutoff=new Date(now-30*86400000).toISOString();
    const old=fixture(),recent=fixture(),boundary=fixture(),active=fixture('running');
    old.endedAt=new Date(Date.parse(cutoff)-1).toISOString();recent.endedAt=new Date(now).toISOString();boundary.endedAt=cutoff;
    active.startedAt='2020-01-01T00:00:00Z';
    [old,recent,boundary,active].forEach(r=>store.save(r));expect(store.prune([old,recent,boundary,active],()=>{},now).deletedIds).toEqual([]);
    store.setRetention('30');const restarted=new RunHistory(path);restarted.load();expect(restarted.retention).toBe('30');
    expect(restarted.prune([old,recent,boundary,active],()=>{},now).deletedIds).toEqual([old.id]);
    expect(restarted.prune([recent,boundary,active],()=>{},now+1).deletedIds).toEqual([boundary.id]);
  });
  it('keeps records with an unreadable policy and does not commit a failed policy change',()=>{
    const path=temporary(),store=new RunHistory(path);store.load();store.save(fixture());
    writeFileSync(join(store.directory,'retention.json'),'broken');const restarted=new RunHistory(path);expect(restarted.load()).toHaveLength(1);expect(restarted.retention).toBe('all');expect(restarted.warnings.join(' ')).toContain('Automatic deletion is disabled');
    mkdirSync(join(store.directory,'retention.json.tmp'));expect(()=>restarted.setRetention('30')).toThrow();expect(restarted.retention).toBe('all');
  });
});

it('persists thread identifiers and follow-up messages through interrupted recovery',()=>{
  const path=temporary(),store=new RunHistory(path);store.load();const run=fixture('running');
  run.threadId='33333333-3333-4333-8333-333333333333';run.output.push({sequence:2,kind:'user',text:'Please continue'});
  store.save(run);const recovered=new RunHistory(path).load()[0];
  expect(recovered.status).toBe('interrupted');expect(recovered.threadId).toBe(run.threadId);expect(recovered.output).toContainEqual(run.output[1]);
  expect(()=>storedRun({...run,threadId:'--last'})).toThrow('Invalid Codex thread ID');
});
