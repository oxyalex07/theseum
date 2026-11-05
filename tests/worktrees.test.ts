import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Worktrees } from '../electron/worktrees';
import type { ManagedWorktree } from '../shared/worktrees';
import { RunHistory } from '../electron/run-history';
let root:string,source:string,storage:string,userData:string,store:Worktrees;
const git=(path:string,...args:string[])=>execFileSync('git',['-C',path,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
beforeEach(async()=>{
  root=realpathSync(mkdtempSync(join(tmpdir(),'theseus-worktrees-')));source=join(root,'source');storage=join(root,'storage with spaces');userData=join(root,'profile');mkdirSync(source);
  git(source,'init','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
  writeFileSync(join(source,'file.txt'),'original');writeFileSync(join(source,'.gitignore'),'ignored\n');git(source,'add','.');git(source,'commit','-m','initial');
  store=new Worktrees(userData);await store.configure({location:storage,removeMerged:false});
});
afterEach(()=>rmSync(root,{recursive:true,force:true}));
it('creates an isolated branch at configured storage, and retains ownership independently of run history',async()=>{
  writeFileSync(join(source,'file.txt'),'source changes');
  const id=randomUUID(),record=await store.create(source,id);
  expect(readFileSync(join(record.path,'file.txt'),'utf8')).toBe('original');expect(readFileSync(join(source,'file.txt'),'utf8')).toBe('source changes');
  expect(git(record.path,'branch','--show-current')).toBe(`theseus/${id}`);
  const history=new RunHistory(userData);history.load();history.save({id,workspaceId:randomUUID(),revision:0,projectName:'source',projectPath:source,executionPath:record.path,worktreeId:id,task:'test',status:'completed',startedAt:new Date().toISOString(),output:[],truncated:false});
  const runs=history.load();expect(runs[0].executionPath).toBe(record.path);expect(runs[0].worktreeId).toBe(id);history.delete(runs,{all:true});
  store=new Worktrees(userData);expect((await store.get(id)).path).toBe(join(storage,id));
  const next=join(root,'new-storage');await store.configure({location:next,removeMerged:true});
  expect((await store.get(id)).path).toBe(record.path);expect((await store.create(source,randomUUID())).path).toContain(next);
});
it('keeps active and selected worktrees, all local changes including ignored files, and unmerged commits',async()=>{
  const active=await store.create(source,randomUUID()),selected=await store.create(source,randomUUID()),modified=await store.create(source,randomUUID()),untracked=await store.create(source,randomUUID()),ignored=await store.create(source,randomUUID()),ahead=await store.create(source,randomUUID());
  writeFileSync(join(modified.path,'file.txt'),'modified');writeFileSync(join(untracked.path,'new'),'local');writeFileSync(join(ignored.path,'ignored'),'valuable');
  writeFileSync(join(ahead.path,'new'),'committed');git(ahead.path,'add','.');git(ahead.path,'commit','-m','unmerged');
  let result=await store.cleanup(()=>[join(selected.path,'subfolder')],()=>[active.runId]);
  expect(result.removed).toHaveLength(0);expect(result.skipped).toHaveLength(6);expect(result.errors).toEqual([]);
  git(source,'merge','--ff-only',ahead.branch);
  result=await store.cleanup(()=>[selected.path],()=>[active.runId]);expect(result.removed).toEqual([ahead.path]);expect(existsSync(ahead.path)).toBe(false);expect(git(source,'branch','--list',ahead.branch)).toContain(ahead.branch);
});
it('does not touch external worktrees or run automatic cleanup without the saved preference',async()=>{
  const owned=await store.create(source,randomUUID()),external=join(root,'external');git(source,'worktree','add','-b','external',external);
  expect((await store.cleanup(()=>[],()=>[],true)).removed).toEqual([]);
  await store.configure({location:storage,removeMerged:true});store=new Worktrees(userData);
  expect((await store.cleanup(()=>[],()=>[],true)).removed).toEqual([owned.path]);expect(existsSync(external)).toBe(true);expect(store.state().worktrees[0].state).toBe('removed');
});
it('reports missing/replaced repositories and locked worktrees without forcing removal',async()=>{
  const locked=await store.create(source,randomUUID()),changed=await store.create(source,randomUUID());git(source,'worktree','lock',locked.path);git(changed.path,'switch','-c','different');
  const result=await store.cleanup(()=>[],()=>[]);expect(result.errors).toHaveLength(2);expect(existsSync(locked.path)).toBe(true);expect(existsSync(changed.path)).toBe(true);expect(store.state().warning).toContain('branch changed');
});
it('validates storage, repository roots, and Git state with actionable errors',async()=>{
  await expect(store.configure({location:'relative',removeMerged:true})).rejects.toThrow('absolute');
  const file=join(root,'file');writeFileSync(file,'not a directory');await expect(store.configure({location:file,removeMerged:true})).rejects.toThrow('Cannot use');
  await store.configure({location:join(source,'worktrees'),removeMerged:false});await expect(store.create(source,randomUUID())).rejects.toThrow('outside');
  await store.configure({location:storage,removeMerged:false});const notGit=join(root,'plain');mkdirSync(notGit);await expect(store.create(notGit,randomUUID())).rejects.toThrow('Git');
  const nested=join(source,'nested');mkdirSync(nested);await expect(store.create(nested,randomUUID())).rejects.toThrow('repository root');
  git(source,'checkout','--detach');await expect(store.create(source,randomUUID())).rejects.toThrow('detached HEAD');
});
it('does not follow a replacement symlink or delete worktrees if ownership storage is unreadable',async()=>{
  const owned=await store.create(source,randomUUID());git(source,'worktree','remove',owned.path);symlinkSync(source,owned.path);
  expect((await store.cleanup(()=>[],()=>[])).errors[0]).toContain('replaced');expect(existsSync(source)).toBe(true);
  writeFileSync(join(userData,'worktrees.json'),'broken');store=new Worktrees(userData);expect(store.state().warning).toContain('could not be read');await expect(store.cleanup(()=>[],()=>[])).rejects.toThrow('disabled');await expect(store.create(source,randomUUID())).rejects.toThrow('disabled');
});
it('resolves storage symlinks and keeps records when the original linked checkout disappears',async()=>{
  const linked=join(root,'linked');git(source,'worktree','add','-b','linked',linked);
  const alias=join(root,'alias');symlinkSync(storage,alias);await store.configure({location:alias,removeMerged:true});
  const record=await store.create(linked,randomUUID());git(source,'worktree','remove',linked);store=new Worktrees(userData);
  expect((await store.get(record.id)).path).toBe(join(storage,record.id));expect((await store.cleanup(()=>[],()=>[])).removed).toEqual([record.path]);
});

it('preserves a clean worktree with an unfinished Git operation',async()=>{
  const record=await store.create(source,randomUUID());const gitDir=git(record.path,'rev-parse','--absolute-git-dir');
  writeFileSync(join(gitDir,'MERGE_HEAD'),git(record.path,'rev-parse','HEAD'));
  expect((await store.cleanup(()=>[],()=>[])).skipped).toEqual([record.path]);expect(existsSync(record.path)).toBe(true);
});

it('keeps incomplete creation intent and pre-existing files after a Git/filesystem failure',async()=>{
  const id=randomUUID(),path=join(storage,id);mkdirSync(path);writeFileSync(join(path,'keep'),'valuable');
  await expect(store.create(source,id)).rejects.toThrow('Git worktree operation failed');
  store=new Worktrees(userData);expect(store.state().worktrees[0]).toMatchObject({id,state:'creating',path});
  await expect(store.get(id)).rejects.toThrow('not found');expect((await store.cleanup(()=>[],()=>[])).removed).toEqual([]);expect(readFileSync(join(path,'keep'),'utf8')).toBe('valuable');
});

function interrupted(recordIndex=0){
  const file=join(userData,'worktrees.json'),journal=JSON.parse(readFileSync(file,'utf8'));
  journal.records[recordIndex].state='creating';writeFileSync(file,JSON.stringify(journal));
  return new Worktrees(userData);
}
it('reconciles an after-Git interruption at startup and recovers without recreating Git work',async()=>{
  const record=await store.create(source,randomUUID());store=interrupted();
  expect((await store.inspect()).worktrees[0]).toMatchObject({state:'creating',recovery:{status:'recoverable'}});
  await expect(store.get(record.id)).rejects.toThrow('Settings');
  expect(await store.cleanup(()=>[],()=>[])).toEqual({removed:[],skipped:[record.path],errors:[]});
  expect(existsSync(record.path)).toBe(true);
  await expect(store.recover(record.id,'forget')).rejects.toThrow('Git created');
  await store.recover(record.id,'recover');
  expect((await store.get(record.id)).path).toBe(record.path);
  expect((await new Worktrees(userData).get(record.id)).state).toBe('ready');
  expect((await store.cleanup(()=>[],()=>[])).removed).toEqual([record.path]);
  expect(git(source,'branch','--list',record.branch)).toContain(record.branch);
});
it('distinguishes a before-Git interruption and forgets only absent intent',async()=>{
  const id=randomUUID(),journal=store as unknown as {save:()=>void},save=journal.save.bind(store);
  const fault=vi.spyOn(journal,'save').mockImplementationOnce(()=>{save();throw new Error('interrupted before Git');});
  await expect(store.create(source,id)).rejects.toThrow('interrupted before Git');fault.mockRestore();
  store=new Worktrees(userData);
  expect((await store.inspect()).worktrees[0]).toMatchObject({id,state:'creating',recovery:{status:'missing'}});
  expect(git(source,'branch','--list',`theseus/${id}`)).toBe('');
  await expect(store.recover(id,'recover')).rejects.toThrow('did not leave');
  await store.recover(id,'forget');expect((await store.inspect()).worktrees[0].state).toBe('removed');
  expect(existsSync(join(storage,id))).toBe(false);
});
it('does not run Git when the intent journal cannot be written',async()=>{
  const id=randomUUID(),fault=vi.spyOn(store as unknown as {save:()=>void},'save').mockImplementationOnce(()=>{throw new Error('disk unavailable');});
  await expect(store.create(source,id)).rejects.toThrow('disk unavailable');fault.mockRestore();
  expect(git(source,'branch','--list',`theseus/${id}`)).toBe('');
  expect(existsSync(join(storage,id))).toBe(false);expect(store.state().worktrees).toEqual([]);
});
it('retains recoverable intent in memory and on disk when final journal writing fails',async()=>{
  const id=randomUUID(),journal=store as unknown as {save:()=>void},save=journal.save.bind(store);
  const temp=join(userData,'worktrees.json.tmp');let writes=0;
  const fault=vi.spyOn(journal,'save').mockImplementation(()=>{if(++writes===2)mkdirSync(temp);save();});
  await expect(store.create(source,id)).rejects.toThrow('Review recovery');fault.mockRestore();rmSync(temp,{recursive:true});
  expect(store.state().worktrees[0]).toMatchObject({state:'creating',recovery:{status:'recoverable'}});
  store=new Worktrees(userData);expect((await store.inspect()).worktrees[0].recovery?.status).toBe('recoverable');
  await store.recover(id,'recover');expect((await store.get(id)).state).toBe('ready');
});
it('accepts completed final persistence after restart, including an error after rename',async()=>{
  const id=randomUUID(),journal=store as unknown as {save:()=>void},save=journal.save.bind(store);let writes=0;
  const fault=vi.spyOn(journal,'save').mockImplementation(()=>{save();if(++writes===2)throw new Error('directory sync failed');});
  await expect(store.create(source,id)).rejects.toThrow('directory sync failed');fault.mockRestore();
  expect(store.state().worktrees[0].state).toBe('creating');
  store=new Worktrees(userData);expect((await store.get(id)).state).toBe('ready');
});
it('keeps recovered dirty, ignored, locked, selected and active work',async()=>{
  const records:ManagedWorktree[]=[];
  for(let i=0;i<5;i++)records.push(await store.create(source,randomUUID()));
  writeFileSync(join(records[0].path,'file.txt'),'valuable');writeFileSync(join(records[1].path,'ignored'),'generated');git(source,'worktree','lock',records[2].path);
  const file=join(userData,'worktrees.json'),journal=JSON.parse(readFileSync(file,'utf8'));journal.records.forEach((r:{state:string})=>r.state='creating');writeFileSync(file,JSON.stringify(journal));
  store=new Worktrees(userData);expect((await store.inspect()).worktrees.every(r=>r.recovery?.status==='recoverable')).toBe(true);
  for(const r of records)await store.recover(r.id,'recover');
  const result=await store.cleanup(()=>[records[3].path],()=>[records[4].id]);
  expect(result.removed).toEqual([]);expect(result.skipped).toHaveLength(4);expect(result.errors).toHaveLength(1);
  expect(records.every(r=>existsSync(r.path))).toBe(true);expect(readFileSync(join(records[0].path,'file.txt'),'utf8')).toBe('valuable');expect(readFileSync(join(records[1].path,'ignored'),'utf8')).toBe('generated');
});
it('requires manual repair for missing registered work, changed branches, replacement files and symlinks',async()=>{
  const records:ManagedWorktree[]=[];for(let i=0;i<4;i++)records.push(await store.create(source,randomUUID()));
  rmSync(records[0].path,{recursive:true});git(records[1].path,'switch','-c','changed');
  git(source,'worktree','remove',records[2].path);mkdirSync(records[2].path);writeFileSync(join(records[2].path,'keep'),'valuable');
  git(source,'worktree','remove',records[3].path);symlinkSync(source,records[3].path);
  const file=join(userData,'worktrees.json'),journal=JSON.parse(readFileSync(file,'utf8'));journal.records.forEach((r:{state:string})=>r.state='creating');writeFileSync(file,JSON.stringify(journal));store=new Worktrees(userData);
  expect((await store.inspect()).worktrees.every(r=>r.recovery?.status==='manual')).toBe(true);
  for(const r of records){await expect(store.recover(r.id,'recover')).rejects.toThrow();await expect(store.recover(r.id,'forget')).rejects.toThrow();}
  expect((await store.cleanup(()=>[],()=>[])).skipped).toHaveLength(4);expect(readFileSync(join(records[2].path,'keep'),'utf8')).toBe('valuable');expect(existsSync(source)).toBe(true);
});
it('rechecks ownership when recovery is requested and rolls back a failed recovery journal write',async()=>{
  const record=await store.create(source,randomUUID());store=interrupted();await store.inspect();
  git(record.path,'switch','-c','replacement');await expect(store.recover(record.id,'recover')).rejects.toThrow('Ownership could not');
  git(record.path,'switch',record.branch);
  const fault=vi.spyOn(store as unknown as {save:()=>void},'save').mockImplementationOnce(()=>{throw new Error('read only');});
  await expect(store.recover(record.id,'recover')).rejects.toThrow('read only');fault.mockRestore();
  expect(store.state().worktrees[0]).toMatchObject({state:'creating',recovery:{status:'recoverable'}});
  await store.recover(record.id,'recover');expect((await store.select(record.id,async r=>r.id))).toBe(record.id);
});

it('does not forget absent intent if a retained branch or new local folder appears',async()=>{
  const record=await store.create(source,randomUUID());git(source,'worktree','remove',record.path);
  store=interrupted();expect((await store.inspect()).worktrees[0].recovery?.status).toBe('manual');
  await expect(store.recover(record.id,'forget')).rejects.toThrow('branch');
  // Use another before-add intent to exercise a path that appears after inspection.
  const id=randomUUID(),file=join(userData,'worktrees.json'),journal=JSON.parse(readFileSync(file,'utf8'));
  const pending={...journal.records[0],id,runId:id,path:join(storage,id),branch:`theseus/${id}`};journal.records.push(pending);writeFileSync(file,JSON.stringify(journal));
  store=new Worktrees(userData);expect((await store.inspect()).worktrees[1].recovery?.status).toBe('missing');
  mkdirSync(pending.path);writeFileSync(join(pending.path,'keep'),'new local work');
  await expect(store.recover(id,'forget')).rejects.toThrow('Ownership could not');
  expect(readFileSync(join(pending.path,'keep'),'utf8')).toBe('new local work');
});
