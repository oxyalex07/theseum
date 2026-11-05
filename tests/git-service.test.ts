import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitService, gitExecute, githubUrl, type GitExecute } from '../electron/git-service';
import { reviewResult, type PullRequest } from '../shared/git';
import type { AgentRun } from '../shared/bridge';
let path:string;
const git=(...args:string[])=>execFileSync('git',args,{cwd:path,encoding:'utf8'}).trim();
const pr:PullRequest={number:14,title:'Actual PR',url:'https://github.com/example/repo/pull/14',headRefName:'feature',baseRefName:'main',headRefOid:'a'.repeat(40),state:'OPEN',isDraft:false,mergeStateStatus:'CLEAN',reviewDecision:'APPROVED',statusCheckRollup:[{name:'test',status:'COMPLETED',conclusion:'SUCCESS'}]};
beforeEach(async()=>{path=await realpath(await mkdtemp(join(tmpdir(),'theseus-git-')));git('init','-b','main');git('config','user.email','test@example.com');git('config','user.name','Fixture');await writeFile(join(path,'tracked'),'original\n');git('add','.');git('commit','-m','initial commit');});
afterEach(async()=>{await rm(path,{recursive:true,force:true});});
it('reads staged, unstaged, untracked, local commits and PR diff from the actual checkout',async()=>{
  await writeFile(join(path,'tracked'),'staged\n');git('add','.');await writeFile(join(path,'tracked'),'staged\nunstaged\n');await writeFile(join(path,'space name'),'untracked contents\n');await symlink('/etc/passwd',join(path,'link'));
  const execute:GitExecute=(bin,args,cwd)=>bin==='git'?gitExecute(bin,args,cwd):Promise.resolve(args[1]==='diff'?'real PR diff':JSON.stringify(pr));
  const service=new GitService(execute),snapshot=await service.snapshot(path);
  expect(snapshot.status).toContain('MM tracked');expect(snapshot.status).toContain('space name');expect(snapshot.diff).toContain('+staged');expect(snapshot.diff).toContain('+unstaged');expect(snapshot.diff).toContain('untracked contents');expect(snapshot.diff).not.toContain('root:');expect(snapshot.commits).toContain('initial commit');expect(snapshot.prDiff).toBe('real PR diff');expect(snapshot.pr?.number).toBe(14);
  const before=service.baseline(snapshot);await writeFile(join(path,'space name'),'changed');expect(service.baseline(await service.snapshot(path))).not.toBe(before);
});
it('shows staged and unstaged changes even when they cancel out relative to HEAD',async()=>{
  await writeFile(join(path,'tracked'),'staged change\n');git('add','.');await writeFile(join(path,'tracked'),'original\n');
  const snapshot=await new GitService((bin,args,cwd)=>bin==='git'?gitExecute(bin,args,cwd):Promise.reject(new Error('No PR'))).snapshot(path);
  expect(snapshot.diff).toContain('Staged changes');expect(snapshot.diff).toContain('+staged change');expect(snapshot.diff).toContain('Unstaged changes');expect(snapshot.diff).toContain('-staged change');
});
it('supports Git repositories before their initial commit',async()=>{
  await rm(join(path,'.git'),{recursive:true});git('init','-b','main');git('add','.');
  const snapshot=await new GitService((bin,args,cwd)=>bin==='git'?gitExecute(bin,args,cwd):Promise.reject(new Error('No PR'))).snapshot(path);
  expect(snapshot.head).toBe('');expect(snapshot.commits).toBe('');expect(snapshot.status).toContain('A  tracked');expect(snapshot.diff).toContain('+original');
});
it('keeps Git data usable when GitHub authentication is missing',async()=>{
  const service=new GitService((bin,args,cwd)=>bin==='git'?gitExecute(bin,args,cwd):Promise.reject(new Error('Sign in with gh auth login')));
  const snapshot=await service.snapshot(path);expect(snapshot.head).toBe(git('rev-parse','HEAD'));expect(snapshot.pr).toBeNull();expect(snapshot.githubError).toContain('gh auth login');
});
it('rejects non-Git folders instead of returning fake changes',async()=>{
  await rm(join(path,'.git'),{recursive:true});await expect(new GitService().snapshot(path)).rejects.toThrow('Git operation failed');
});
it('blocks stale heads, failed or pending checks, drafts, missing reviews and unknown mergeability',async()=>{
  for(const patch of [{headRefOid:'b'.repeat(40)},{isDraft:true},{state:'CLOSED'},{mergeStateStatus:'UNKNOWN'},{reviewDecision:'REVIEW_REQUIRED'},{reviewDecision:'CHANGES_REQUESTED'},{statusCheckRollup:[{name:'CI',status:'IN_PROGRESS',conclusion:''}]},{statusCheckRollup:[{context:'CI',state:'FAILURE'}]}]){
    const exec=vi.fn<GitExecute>().mockResolvedValue(JSON.stringify({...pr,...patch}));const confirm=vi.fn().mockResolvedValue(true);
    await expect(new GitService(exec).merge(path,pr,confirm)).rejects.toThrow();expect(confirm).not.toHaveBeenCalled();expect(exec.mock.calls.some(([,a])=>a[1]==='merge')).toBe(false);
  }
});
it('honors cancellation and rechecks checks after native confirmation',async()=>{
  const exec=vi.fn<GitExecute>().mockResolvedValue(JSON.stringify(pr));const service=new GitService(exec);
  expect((await service.merge(path,pr,async()=>false)).state).toBe('cancelled');expect(exec).toHaveBeenCalledTimes(1);
  exec.mockReset().mockResolvedValueOnce(JSON.stringify(pr)).mockResolvedValueOnce(JSON.stringify({...pr,mergeStateStatus:'BLOCKED'}));
  await expect(service.merge(path,pr,async()=>true)).rejects.toThrow('changed during confirmation');expect(exec.mock.calls.some(([,a])=>a[1]==='merge')).toBe(false);
});
it('pins the approved SHA and reports merged, queued and failed results accurately',async()=>{
  for(const state of ['MERGED','OPEN']){
    const exec=vi.fn<GitExecute>().mockResolvedValueOnce(JSON.stringify(pr)).mockResolvedValueOnce(JSON.stringify(pr)).mockResolvedValueOnce('').mockResolvedValueOnce(JSON.stringify({...pr,state}));
    const result=await new GitService(exec).merge(path,pr,async()=>true);expect(result.state).toBe(state==='MERGED'?'merged':'pending');expect(exec.mock.calls[2][1]).toEqual(['pr','merge',pr.url,'--merge','--match-head-commit',pr.headRefOid]);
  }
  const exec=vi.fn<GitExecute>().mockResolvedValueOnce(JSON.stringify(pr)).mockResolvedValueOnce(JSON.stringify(pr)).mockRejectedValueOnce(new Error('GitHub rejected merge'));
  await expect(new GitService(exec).merge(path,pr,async()=>true)).rejects.toThrow('rejected');
});
it('only accepts canonical GitHub PR URLs',()=>{
  for(const url of ['https://evil.test/a/b/pull/1','https://github.com/a/b/pull/1?x=1','--admin','https://user@github.com/a/b/pull/1'])expect(()=>githubUrl(url)).toThrow();
});
it('derives findings only from a successful run with a valid structured final message',()=>{
  const run={status:'completed',gitWorkflow:{kind:'review'},output:[{kind:'message',text:JSON.stringify({summary:'Reviewed',findings:[{severity:'high',title:'bug',path:'a:1',detail:'evidence'}]})}]} as AgentRun;
  expect(reviewResult(run)?.findings).toHaveLength(1);
  expect(reviewResult({...run,status:'failed'})).toBeNull();expect(reviewResult({...run,output:[{sequence:1,kind:'message',text:'Done!'}]})).toBeNull();expect(reviewResult({...run,gitWorkflow:undefined})).toBeNull();
});
