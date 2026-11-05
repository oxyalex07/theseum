import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { constants, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import type { ManagedWorktree, WorktreeCleanup, WorktreePreferences, WorktreeState } from '../shared/worktrees';
const execute=promisify(execFile);
function gitEnvironment(){const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key];return {...env,GIT_TERMINAL_PROMPT:'0'};}
const contains=(parent:string,child:string)=>{const path=relative(parent,child);return path===''||path!=='..'&&!path.startsWith(`..${process.platform==='win32'?'\\':'/'}`)&&!isAbsolute(path);};
async function git(args:string[]){
  try{return (await execute('git',args,{encoding:'utf8',timeout:30_000,maxBuffer:4_000_000,env:gitEnvironment()})).stdout.trim();}
  catch(error){const e=error as {stderr?:string;message?:string};throw new Error(`Git worktree operation failed: ${e.stderr?.trim()||e.message||'Check Git installation and repository permissions.'}`);}
}
const uuid=/^[a-f0-9-]{36}$/;
function storedRecord(value:ManagedWorktree):ManagedWorktree {
  if(!value||!uuid.test(value.id)||value.runId!==value.id||!['creating','ready','removed'].includes(value.state)||!([value.sourcePath,value.path,value.commonDir].every(path=>typeof path==='string'&&isAbsolute(path)))||value.branch!==`theseus/${value.id}`||typeof value.baseRef!=='string'||!value.baseRef.startsWith('refs/heads/')||!Number.isFinite(Date.parse(value.createdAt)))throw new Error('Invalid worktree ownership record.');
  return {id:value.id,runId:value.runId,sourcePath:value.sourcePath,path:value.path,commonDir:value.commonDir,branch:value.branch,baseRef:value.baseRef,createdAt:value.createdAt,state:value.state};
}
export class Worktrees {
  private file:string;
  private preferences:WorktreePreferences={location:join(homedir(),'.theseus','worktrees'),removeMerged:false};
  private records:ManagedWorktree[]=[];
  private warning?:string;
  private storageError=false;
  private busy=false;
  private pendingOperations=0;
  private operationTail:Promise<unknown>=Promise.resolve();
  private startup:Promise<void>=Promise.resolve();
  constructor(userData:string){
    this.file=join(userData,'worktrees.json');
    if(existsSync(this.file))try{
      const data=JSON.parse(readFileSync(this.file,'utf8'));
      if(data.version!==1||!data.preferences||!isAbsolute(data.preferences.location)||typeof data.preferences.removeMerged!=='boolean'||!Array.isArray(data.records))throw new Error('Invalid worktree storage.');
      this.preferences=data.preferences;this.records=data.records.map(storedRecord);
    }catch{this.storageError=true;this.warning='Worktree ownership storage could not be read. Creation and cleanup are disabled. Check worktrees.json in the app user-data folder.';}
    // Reconcile intent on restart without changing Git or admitting it to cleanup.
    if(!this.storageError)this.operationTail=this.startup=this.reconcile();
  }
  isBusy(){return this.busy;}
  state():WorktreeState{return structuredClone({preferences:this.preferences,worktrees:this.records,warning:this.warning});}
  async inspect(){await this.operationTail;return this.state();}
  private async registrations(record:ManagedWorktree){
    if(await realpath(record.commonDir)!==record.commonDir)throw new Error('Repository metadata was moved or replaced.');
    return (await git(['--git-dir',record.commonDir,'worktree','list','--porcelain','-z'])).split('\0\0').filter(Boolean).map(block=>{
      const fields=block.split('\0');return {path:fields.find(f=>f.startsWith('worktree '))?.slice(9),branch:fields.find(f=>f.startsWith('branch '))?.slice(7)};
    });
  }
  private async reconcileRecord(record:ManagedWorktree){
    try{
      const registrations=await this.registrations(record);
      const present=await lstat(record.path).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
      if(present){
        await this.verify(record);
        record.recovery={status:'recoverable',message:'Git created this worktree before creation tracking finished. Recover it to enable selection and normal cleanup. Recovery keeps all files and branches.'};
      }else if(registrations.some(r=>r.path===record.path||r.branch===`refs/heads/${record.branch}`)||await git(['--git-dir',record.commonDir,'branch','--list',record.branch])){
        record.recovery={status:'manual',message:'The folder is missing, but Git still has a worktree registration or branch. Inspect Git worktree list and the retained branch before manual repair. Nothing was removed.'};
      }else record.recovery={status:'missing',message:'Creation did not leave a folder, Git worktree registration, or branch. Forget this creation record, then start a new task.'};
    }catch(error){record.recovery={status:'manual',message:`Ownership could not be verified. Inspect this folder and Git worktree list before manual repair; keep local and ignored files. Restart Theseus after repair to recheck. ${error instanceof Error?error.message:'Check repository access.'}`};}
  }
  private async reconcile(){for(const record of this.records.filter(r=>r.state==='creating'))await this.reconcileRecord(record);}
  async recover(id:unknown,action:unknown){return this.exclusive(async()=>{
    const record=this.records.find(r=>r.id===id&&r.state==='creating');
    if(!record||!['recover','forget'].includes(action as string))throw new Error('Invalid worktree recovery request.');
    await this.reconcileRecord(record);
    if((action==='recover'&&record.recovery?.status!=='recoverable')||(action==='forget'&&record.recovery?.status!=='missing'))throw new Error(record.recovery?.message||'Inspect this worktree before recovery.');
    const previous=record.recovery;
    record.state=action==='recover'?'ready':'removed';delete record.recovery;
    try{this.save();}catch(error){record.state='creating';record.recovery=previous;throw error;}
    return this.state();
  });}
  private save(){
    if(this.storageError)throw new Error(this.warning);
    mkdirSync(dirname(this.file),{recursive:true,mode:0o700});
    const temp=`${this.file}.tmp`;
    const file=openSync(temp,'w',0o600);
    try{writeFileSync(file,JSON.stringify({version:1,preferences:this.preferences,records:this.records.map(storedRecord)}));fsyncSync(file);}finally{closeSync(file);}
    renameSync(temp,this.file);
    if(process.platform!=='win32'){const directory=openSync(dirname(this.file),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
  }
  private async exclusive<T>(action:()=>Promise<T>):Promise<T>{
    if(this.storageError)throw new Error(this.warning);
    // Git and the ownership journal mutate together, even when several runs launch.
    this.pendingOperations++;this.busy=true;
    const operation=this.operationTail.then(action);
    this.operationTail=operation.catch(()=>{});
    try{return await operation;}finally{this.pendingOperations--;this.busy=this.pendingOperations>0;}
  }
  private async location(input:unknown){
    if(typeof input!=='string'||!input.trim()||input.includes('\0'))throw new Error('Enter an absolute worktree storage folder.');
    const expanded=input==='~'?homedir():input.startsWith('~/')?join(homedir(),input.slice(2)):input;
    if(!isAbsolute(expanded))throw new Error('Worktree storage must be an absolute path or start with ~/.');
    try{await mkdir(expanded,{recursive:true});const path=await realpath(expanded);if(!(await stat(path)).isDirectory())throw new Error('Not a folder');await access(path,constants.W_OK|constants.X_OK);return path;}
    catch(error){throw new Error(`Cannot use worktree storage at ${expanded}: ${error instanceof Error?error.message:'Check folder permissions and disk space.'}`);}
  }
  async configure(input:unknown){return this.exclusive(async()=>{
    const value=input as WorktreePreferences;
    if(!value||typeof value.removeMerged!=='boolean')throw new Error('Invalid worktree preferences.');
    const next={location:await this.location(value.location),removeMerged:value.removeMerged},previous=this.preferences;
    this.preferences=next;try{this.save();}catch(error){this.preferences=previous;throw error;}return this.state();
  });}
  async create(sourcePath:string,runId:string){return this.exclusive(async()=>{
    if(!uuid.test(runId)||this.records.some(r=>r.id===runId))throw new Error('Invalid or duplicate worktree owner.');
    const source=await realpath(sourcePath);
    if(await git(['-C',source,'rev-parse','--is-inside-work-tree'])!=='true')throw new Error('Choose a Git working checkout to create a worktree.');
    const root=await realpath(await git(['-C',source,'rev-parse','--show-toplevel']));
    if(root!==source)throw new Error('Select the repository root to create a worktree.');
    const commonDir=await realpath(await git(['-C',source,'rev-parse','--path-format=absolute','--git-common-dir']));
    const baseRef=await git(['-C',source,'symbolic-ref','--quiet','HEAD']).catch(()=>{throw new Error('The source checkout has a detached HEAD. Check out a branch before creating a worktree.');});
    const commit=await git(['-C',source,'rev-parse','--verify','HEAD^{commit}']).catch(()=>{throw new Error('The source branch has no readable commit. Create an initial commit before creating a worktree.');});
    const location=await this.location(this.preferences.location);
    if(contains(source,location)||contains(commonDir,location))throw new Error('Choose worktree storage outside the source repository.');
    const record:ManagedWorktree={id:runId,runId,sourcePath:source,path:join(location,runId),commonDir,branch:`theseus/${runId}`,baseRef,createdAt:new Date().toISOString(),state:'creating'};
    // Persist intent before Git mutates anything. Failed or interrupted creations remain reviewable.
    this.records.push(record);try{this.save();}catch(error){this.records.pop();throw error;}
    try{
      await git(['--git-dir',commonDir,'worktree','add','-b',record.branch,record.path,commit]);
      record.state='ready';this.save();return structuredClone(record);
    }catch(error){
      record.state='creating';await this.reconcileRecord(record);
      throw new Error(`${error instanceof Error?error.message:'Worktree creation failed.'} Review recovery in Settings → Spaces & folders → Worktrees. ${record.recovery?.message}`);
    }
  });}
  async select<T>(id:unknown,select:(record:ManagedWorktree)=>Promise<T>){return this.exclusive(async()=>select(await this.get(id)));}
  async get(id:unknown){
    await this.startup;
    const record=this.records.find(r=>r.id===id&&r.state==='ready');if(!record)throw new Error('Managed worktree was not found. Review incomplete creation in Settings → Spaces & folders → Worktrees.');
    await this.verify(record);return structuredClone(record);
  }
  private async verify(record:ManagedWorktree){
    if(await realpath(record.path)!==record.path)throw new Error('Worktree folder was moved or replaced.');
    if(await realpath(await git(['-C',record.path,'rev-parse','--path-format=absolute','--git-common-dir']))!==record.commonDir||await git(['-C',record.path,'symbolic-ref','--quiet','HEAD'])!==`refs/heads/${record.branch}`)throw new Error('Worktree repository or branch changed; left untouched.');
    if(!(await this.registrations(record)).some(r=>r.path===record.path&&r.branch===`refs/heads/${record.branch}`))throw new Error('Git worktree registration changed; left untouched.');
  }
  async cleanup(protectedPaths:()=>string[],activeRunIds:()=>string[],automatic=false):Promise<WorktreeCleanup>{return this.exclusive(async()=>{
    const result:WorktreeCleanup={removed:[],skipped:[],errors:[]};
    if(automatic&&!this.preferences.removeMerged)return result;
    // Interrupted creations require explicit review, even when already clean and merged.
    result.skipped.push(...this.records.filter(r=>r.state==='creating').map(r=>r.path));
    for(const record of this.records.filter(r=>r.state==='ready')){
      try{
        if(activeRunIds().includes(record.runId)||protectedPaths().some(path=>contains(record.path,path)||contains(path,record.path))){result.skipped.push(record.path);continue;}
        await this.verify(record);
        // Include ignored files: generated files may also be valuable local work.
        const gitDir=await git(['-C',record.path,'rev-parse','--absolute-git-dir']);
        if(['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply','sequencer','BISECT_LOG'].some(name=>existsSync(join(gitDir,name)))){result.skipped.push(record.path);continue;}
        const dirty=await git(['-C',record.path,'status','--porcelain','--untracked-files=all','--ignored','--ignore-submodules=none']);
        if(dirty){result.skipped.push(record.path);continue;}
        const head=await git(['-C',record.path,'rev-parse','HEAD']);
        const base=await git(['--git-dir',record.commonDir,'rev-parse','--verify',`${record.baseRef}^{commit}`]);
        if(await git(['--git-dir',record.commonDir,'merge-base',head,base])!==head){result.skipped.push(record.path);continue;}
        if(activeRunIds().includes(record.runId)||protectedPaths().some(path=>contains(record.path,path)||contains(path,record.path))){result.skipped.push(record.path);continue;}
        // No --force: Git also refuses dirty, locked, and submodule worktrees.
        await git(['--git-dir',record.commonDir,'worktree','remove',record.path]);
        record.state='removed';this.save();result.removed.push(record.path);
      }catch(error){result.errors.push(`${record.path}: ${error instanceof Error?error.message:'Cleanup failed.'}`);}
    }
    this.warning=result.errors.length?result.errors.join('\n'):undefined;
    return result;
  });}
}
