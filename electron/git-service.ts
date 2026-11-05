import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath, readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { GitSnapshot, PullRequest } from '../shared/git';
import { checksPass } from '../shared/git';
import { redact } from './codex-protocol';
const execute=promisify(execFile);
export type GitExecute=(binary:string,args:string[],cwd:string)=>Promise<string>;
export const gitExecute:GitExecute=async(binary,args,cwd)=>{
  const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key];
  delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;delete env.GH_REPO;
  try{return (await execute(binary,args,{cwd,env:{...env,GIT_TERMINAL_PROMPT:'0',GH_PROMPT_DISABLED:'1',GH_PAGER:'cat'},encoding:'utf8',timeout:30_000,maxBuffer:2_000_000})).stdout;}
  catch(error){const e=error as {stderr?:string;message?:string};throw new Error(`${binary==='gh'?'GitHub: install GitHub CLI and sign in with gh auth login if needed.':'Git operation failed.'} ${redact(e.stderr||e.message||'Unknown error').trim().slice(0,1000)}`);}
};
const fields='number,title,url,headRefName,baseRefName,headRefOid,state,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup';
export function githubUrl(url:string){if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*$/.test(url))throw new Error('Unsupported GitHub PR URL.');return url;}
export class GitService {
  constructor(private execute:GitExecute=gitExecute){}
  private git(path:string,...args:string[]){return this.execute('git',['--no-pager',...args],path);}
  async snapshot(path:string):Promise<GitSnapshot>{
    if(await realpath(path)!==path)throw new Error('Project folder changed. Choose it again.');
    if((await this.git(path,'rev-parse','--is-inside-work-tree')).trim()!=='true')throw new Error('Choose a Git checkout.');
    const head=await this.git(path,'rev-parse','--verify','HEAD').then(s=>s.trim()).catch(()=>'');
    const [branch,status,staged,unstaged,commits]=await Promise.all([
      this.git(path,'branch','--show-current'),
      this.git(path,'status','--short','--untracked-files=normal'),
      this.git(path,'diff','--no-ext-diff','--no-textconv','--cached','--'),
      this.git(path,'diff','--no-ext-diff','--no-textconv','--'),
      head?this.git(path,'log','-20','--format=%h %s'):Promise.resolve('')]);
    const diff=(staged?`Staged changes\n${staged}`:'')+(unstaged?`\nUnstaged changes\n${unstaged}`:'');
    let upstream:string|undefined,branchDiff:string|undefined,upstreamError:string|undefined;
    try{upstream=(await this.git(path,'rev-parse','--abbrev-ref','--symbolic-full-name','@{upstream}')).trim();}catch{/* local-only branches have no upstream */}
    if(upstream)try{branchDiff=await this.git(path,'diff','--no-ext-diff','--no-textconv','@{upstream}...HEAD','--');}catch(error){upstreamError=error instanceof Error?error.message:'Could not read upstream diff.';}
    let pr:PullRequest|null=null,githubError:string|undefined,prDiff:string|undefined;
    try{
      if(!branch.trim())throw new Error('Detached HEAD: check out a branch to find its PR.');
      pr=await this.pr(path);
      prDiff=await this.execute('gh',['pr','diff',githubUrl(pr.url),'--color=never'],path);
    }catch(error){githubError=error instanceof Error?error.message:'Could not load GitHub PR.';}
    const untracked=(await this.git(path,'ls-files','--others','--exclude-standard','-z')).split('\0').filter(Boolean);
    let extra='',budget=200_000;
    for(const file of untracked.slice(0,100)){
      const full=path+'/'+file,info=await lstat(full);
      if(!info.isFile()||info.size>budget){extra+=`\nUntracked ${JSON.stringify(file)} (content omitted: size or file type)\n`;continue;}
      const content=await readFile(full,'utf8');budget-=info.size;
      extra+=`\nUntracked ${JSON.stringify(file)}\n${content.includes('\0')?'Binary file':content}`;
    }
    if(untracked.length>100)extra+='\nAdditional untracked files omitted.\n';
    return {path,branch:branch.trim()||'Detached HEAD',head:head.trim(),status,diff:diff+extra,commits,upstream,upstreamError,branchDiff,prDiff,pr,githubError};
  }
  async pr(path:string,url?:string):Promise<PullRequest>{
    const pr=JSON.parse(await this.execute('gh',['pr','view',...(url?[githubUrl(url)]:[]),'--json',fields],path)) as PullRequest;
    githubUrl(pr.url);if(!/^[a-f0-9]{40}$/.test(pr.headRefOid)||!Array.isArray(pr.statusCheckRollup))throw new Error('Invalid PR data from GitHub.');return pr;
  }
  baseline(s:GitSnapshot){return createHash('sha256').update(JSON.stringify([s.head,s.status,s.diff,s.branchDiff])).digest('hex');}
  async merge(path:string,expected:PullRequest,confirm:(pr:PullRequest)=>Promise<boolean>){
    const current=await this.pr(path,expected.url);
    if(current.headRefOid!==expected.headRefOid)throw new Error('PR head changed. Refresh and review before merging.');
    if(current.state!=='OPEN'||current.isDraft||current.mergeStateStatus!=='CLEAN'||!checksPass(current)||current.reviewDecision==='CHANGES_REQUESTED'||current.reviewDecision==='REVIEW_REQUIRED')throw new Error('Merge blocked: GitHub must report a ready PR with passing checks and required reviews. Refresh after resolving blockers.');
    if(!await confirm(current))return {state:'cancelled' as const,message:'Merge cancelled.'};
    const refreshed=await this.pr(path,current.url);
    if(refreshed.headRefOid!==current.headRefOid||refreshed.state!=='OPEN'||refreshed.isDraft||refreshed.mergeStateStatus!=='CLEAN'||!checksPass(refreshed)||['CHANGES_REQUESTED','REVIEW_REQUIRED'].includes(refreshed.reviewDecision))throw new Error('PR checks or head changed during confirmation. Refresh and try again.');
    // GitHub enforces branch protection; matching the head closes the confirmation race.
    await this.execute('gh',['pr','merge',githubUrl(current.url),'--merge','--match-head-commit',current.headRefOid],path);
    let result:PullRequest;
    try{result=await this.pr(path,current.url);}catch{return {state:'pending' as const,message:'Merge request sent, but GitHub status could not be confirmed. Open the PR before retrying.'};}
    return {state:result.state==='MERGED'?'merged' as const:'pending' as const,message:result.state==='MERGED'?`Merged PR #${result.number}.`:`GitHub accepted the request; PR is ${result.state.toLowerCase()}. Refresh GitHub for merge queue progress.`};
  }
}
