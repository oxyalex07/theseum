import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentProfiles, storedProfile, validateConfiguration, validateCapabilities } from '../electron/agent-profiles';
import { parseModels } from '../electron/runtime-check';
import { argumentsForProfile, promptForProfile } from '../electron/agent-runner';
import { RunHistory } from '../electron/run-history';
import type { AgentSnapshot, RuntimeCheck, SaveAgentRequest, AgentRun } from '../shared/bridge';
import { randomUUID } from 'node:crypto';
const directories:string[]=[];
const temporary=()=>{const path=mkdtempSync(join(tmpdir(),'orbit-profiles-'));directories.push(path);return path;};
const draft=():SaveAgentRequest=>({name:'Reviewer',icon:'shield',color:'green',description:'Reviews code',runtime:'codex',model:null,reasoningEffort:null,instructions:'Keep edits focused.',memory:'none',sandbox:'workspace-write',timeoutSeconds:1800,folderChoice:null});
const capabilities:RuntimeCheck={state:'verified',authentication:'verified',catalogState:'verified',checkedAt:new Date().toISOString(),message:'Test catalog',models:[{id:'fixture-runtime-model',label:'Fixture',efforts:[{value:'fixture-effort',description:'From fixture catalog'}]}]};
afterEach(()=>{for(const path of directories.splice(0))rmSync(path,{recursive:true,force:true});});
describe('saved agent configurations',()=>{
  it('creates, updates and duplicates stable versioned records across fresh store instances',()=>{
    const path=temporary(),store=new AgentProfiles(path);const first=store.save(draft(),null,null);
    const edited=store.save({...draft(),id:first.id,expectedUpdatedAt:first.updatedAt,name:'Edited'},'/approved/project',null);
    expect(edited.id).toBe(first.id);expect(edited.createdAt).toBe(first.createdAt);expect(edited.updatedAt>first.updatedAt).toBe(true);expect(edited.configurationVersion).toBe(1);
    const duplicate=store.save({...draft(),name:'Edited copy'},edited.defaultProjectPath,null);expect(duplicate.id).not.toBe(first.id);
    expect(new AgentProfiles(path).list()).toEqual([edited,duplicate].sort((a,b)=>a.id.localeCompare(b.id)));
  });
  it.each([{name:''},{runtime:'unknown'},{memory:'unsupported'},{sandbox:'danger-full-access'},{timeoutSeconds:0},{timeoutSeconds:1801},{timeoutSeconds:NaN},{instructions:'x'.repeat(32001)},{name:'bad\0name'},{model:'--model x'}])('rejects invalid or unsupported values %j',override=>{
    expect(()=>validateConfiguration({...draft(),...override})).toThrow();
  });
  it('accepts runtime defaults offline and rejects fabricated model/effort choices',()=>{
    expect(()=>validateCapabilities(draft(),null)).not.toThrow();
    expect(()=>validateCapabilities({...draft(),model:'invented'},capabilities)).toThrow();
    expect(()=>validateCapabilities({...draft(),model:'fixture-runtime-model',reasoningEffort:'invented'},capabilities)).toThrow();
    expect(()=>validateCapabilities({...draft(),model:'fixture-runtime-model',reasoningEffort:'fixture-effort'},capabilities)).not.toThrow();
  });
  it('does not overwrite stale edits or accept arbitrary file IDs',()=>{
    const store=new AgentProfiles(temporary()),first=store.save(draft(),null,null);
    store.save({...draft(),id:first.id,expectedUpdatedAt:first.updatedAt},null,null);
    expect(()=>store.save({...draft(),id:first.id,expectedUpdatedAt:first.updatedAt},null,null)).toThrow(/changed/);
    expect(()=>store.get('../../outside')).toThrow();expect(()=>storedProfile({...first,id:'../../outside'})).toThrow();
  });
  it('does not add unsaved drafts to storage and keeps records when a write fails',()=>{
    const path=temporary(),store=new AgentProfiles(path);expect(store.list()).toEqual([]);
    const first=store.save(draft(),null,null);mkdirSync(join(store.directory,`${first.id}.json.tmp`));
    expect(()=>store.save({...draft(),id:first.id,expectedUpdatedAt:first.updatedAt,name:'Lost'},null,null)).toThrow(/Could not save/);
    expect(new AgentProfiles(path).get(first.id).name).toBe('Reviewer');
  });
  it('leaves corrupt files untouched and reports them alongside healthy profiles',()=>{
    const path=temporary(),store=new AgentProfiles(path),first=store.save(draft(),null,null);
    writeFileSync(join(store.directory,'damaged.json'),'broken');const restored=new AgentProfiles(path);
    expect(restored.get(first.id)).toEqual(first);expect(restored.warning).toBeTruthy();expect(readFileSync(join(store.directory,'damaged.json'),'utf8')).toBe('broken');
  });
  it('whitelists profile fields and redacts credentials rather than storing arbitrary payloads',()=>{
    const store=new AgentProfiles(temporary()),secret='sk-profilecredential123456789';
    const profile=store.save({...draft(),instructions:`Never store ${secret}`,credentials:secret} as SaveAgentRequest,null,null);
    const raw=readFileSync(join(store.directory,`${profile.id}.json`),'utf8');expect(raw).not.toContain(secret);expect(raw).not.toContain('credentials');
  });
  it('keeps task and instruction text in stdin and uses only advertised argument values',()=>{
    const store=new AgentProfiles(temporary());const instructions='$(touch /tmp/nope)\n`echo nope`';
    const profile=store.save({...draft(),model:'fixture-runtime-model',reasoningEffort:'fixture-effort',instructions,sandbox:'read-only'},null,capabilities);
    const snapshot:AgentSnapshot={profile,approvalPolicy:'never',timeoutSeconds:60};const args=argumentsForProfile(snapshot);
    expect(args.at(-1)).toBe('-');expect(args).toContain('read-only');expect(args).not.toContain('workspace-write');expect(args).not.toContain(instructions);expect(args).toContain('fixture-runtime-model');expect(args).toContain('model_reasoning_effort="fixture-effort"');
    expect(promptForProfile('Task text',snapshot)).toContain(instructions);expect(promptForProfile('Task text',snapshot)).toContain('Task text');
  });
  it('round trips an immutable historical snapshot after profile edits',()=>{
    const path=temporary(),store=new AgentProfiles(path),first=store.save(draft(),null,null),history=new RunHistory(path);history.load();
    const run:AgentRun={id:randomUUID(),workspaceId:randomUUID(),revision:1,projectName:'Fixture',projectPath:'/fixture',task:'Task',startedAt:new Date().toISOString(),status:'completed',endedAt:new Date().toISOString(),exitCode:0,output:[],truncated:false,agentConfiguration:{profile:first,approvalPolicy:'never',timeoutSeconds:1800}};history.save(run);
    store.save({...draft(),id:first.id,expectedUpdatedAt:first.updatedAt,instructions:'New instructions'},null,null);
    expect(new RunHistory(path).load()[0].agentConfiguration?.profile?.instructions).toBe(first.instructions);
  });
  it('persists archive, restore and deletion while rejecting stale lifecycle changes',()=>{
    const path=temporary(),store=new AgentProfiles(path),first=store.save(draft(),null,null);
    const change=(action:'archive'|'restore'|'delete')=>store.change({id:first.id,expectedUpdatedAt:store.get(first.id).updatedAt,action});
    change('archive');const archived=store.get(first.id);
    expect(archived.archivedAt).toBe(archived.updatedAt);expect(new AgentProfiles(path).get(first.id)).toEqual(archived);
    expect(()=>store.getAvailable(first.id)).toThrow(/archived/);
    expect(()=>store.save({...draft(),id:first.id,expectedUpdatedAt:archived.updatedAt},null,null)).toThrow(/Restore/);
    expect(()=>store.change({id:first.id,expectedUpdatedAt:first.updatedAt,action:'delete'})).toThrow(/changed/);
    change('restore');expect(store.getAvailable(first.id).archivedAt).toBeUndefined();
    expect(new AgentProfiles(path).getAvailable(first.id)).toEqual(store.get(first.id));
    expect(()=>store.getAvailable(first.id,first.updatedAt)).toThrow(/changed/);
    change('delete');expect(new AgentProfiles(path).list()).toEqual([]);expect(()=>store.get(first.id)).toThrow(/not found/);
    expect(()=>store.change({id:'../../outside',action:'delete',expectedUpdatedAt:''})).toThrow();
    expect(()=>store.change({id:first.id,action:'invalid',expectedUpdatedAt:''} as any)).toThrow(/Invalid/);
  });
  it.each(['starting','running','cancelling'] as const)('blocks deletion during %s runs, allows archive, and retains historical snapshots',status=>{
    const path=temporary(),store=new AgentProfiles(path),first=store.save(draft(),null,null),history=new RunHistory(path);history.load();
    const run:AgentRun={id:randomUUID(),workspaceId:randomUUID(),revision:1,projectName:'Fixture',projectPath:'/fixture',task:'Task',startedAt:new Date().toISOString(),status,output:[],truncated:false,agentConfiguration:{profile:first,approvalPolicy:'never',timeoutSeconds:1800}};
    const change=(action:'archive'|'delete')=>store.change({id:first.id,expectedUpdatedAt:store.get(first.id).updatedAt,action},[run]);
    expect(()=>change('delete')).toThrow(/active run/);change('archive');expect(run.agentConfiguration?.profile).toEqual(first);
    expect(()=>change('delete')).toThrow(/active run/);
    run.status='completed';run.endedAt=new Date().toISOString();history.save(run);change('delete');
    expect(new RunHistory(path).load()[0].agentConfiguration?.profile).toEqual(first);
  });
  it('keeps the last saved state when lifecycle storage operations fail',()=>{
    const path=temporary(),store=new AgentProfiles(path),first=store.save(draft(),null,null);
    mkdirSync(join(store.directory,`${first.id}.json.tmp`));
    expect(()=>store.change({id:first.id,expectedUpdatedAt:first.updatedAt,action:'archive'})).toThrow(/Could not save/);
    expect(store.get(first.id)).toEqual(first);expect(new AgentProfiles(path).get(first.id)).toEqual(first);
    rmSync(join(store.directory,`${first.id}.json`));mkdirSync(join(store.directory,`${first.id}.json`));
    expect(()=>store.change({id:first.id,expectedUpdatedAt:first.updatedAt,action:'delete'})).toThrow(/Could not delete/);
    expect(store.get(first.id)).toEqual(first);
  });
  it('projects only bounded public model capabilities and respects hidden models',()=>{
    expect(parseModels([{model:'real-runtime-value',displayName:'From runtime',supportedReasoningEfforts:[{reasoningEffort:'advertised',description:'From runtime'}],secret:'not forwarded'},{model:'hidden',hidden:true},{model:'invalid model'}])).toEqual([{id:'real-runtime-value',label:'From runtime',efforts:[{value:'advertised',description:'From runtime'}]}]);
  });
});
