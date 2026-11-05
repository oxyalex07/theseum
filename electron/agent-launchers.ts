import { mkdirSync, readFileSync, renameSync, writeFileSync, statSync, realpathSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { AgentLauncher, LauncherState, SaveLauncherRequest } from '../shared/agent-launchers';
import { validId } from './agent-profiles';

function text(value:unknown,label:string,max:number,required=false){
  if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw new Error(`${label} must be text of at most ${max} characters.`);
  const result=value.trim();if(required&&!result)throw new Error(`${label} is required.`);return result;
}
export function launcherFields(input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid launcher.');
  const r=input as SaveLauncherRequest;
  const name=text(r.name,'Name',80,true),description=text(r.description,'Description',500),command=text(r.command,'Launch command',8000,true);
  let repository=text(r.repository,'GitHub repository',500,true);
  try{const url=new URL(repository);if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname))throw new Error();repository=`https://github.com${url.pathname.replace(/\/$/,'').replace(/\.git$/,'')}`;}catch{throw new Error('Use a GitHub repository URL such as https://github.com/owner/repo.');}
  if(!['claude','codex','other'].includes(r.runtime))throw new Error('Choose Claude Code, Codex, or another CLI.');
  return {name,description,repository,runtime:r.runtime,command};
}
export function terminalProgram(folder:string,command:string){return `cd -- '${folder.replace(/'/g,"'\\''")}' && {\n${command}\n}`;}
// The shell program is an argv value, never AppleScript source.
export function openNativeTerminal(program:string):Promise<void>{
  return new Promise((resolve,reject)=>{
    const child=execFile('/usr/bin/osascript',['-',program],{timeout:15000,maxBuffer:16000},error=>error?reject(new Error('Could not open Terminal. Check macOS Automation access for Theseus and try again.')):resolve());
    child.stdin?.on('error',()=>{});
    child.stdin?.end('on run argv\n tell application "Terminal"\n activate\n do script (item 1 of argv)\n end tell\nend run\n');
  });
}
export class AgentLaunchers {
  private records:AgentLauncher[]=[];
  private warning:string|undefined;
  private readonly file:string;
  constructor(directory:string,private platform=process.platform,private open=openNativeTerminal){
    this.file=join(directory,'agent-launchers.json');
    try{
      mkdirSync(directory,{recursive:true,mode:0o700});
      if(!existsSync(this.file))return;
      if(statSync(this.file).size>3000000)throw new Error();
      const data=JSON.parse(readFileSync(this.file,'utf8'));
      if(data.version!==1||!Array.isArray(data.launchers)||data.launchers.length>200)throw new Error();
      const ids=new Set<string>();
      this.records=data.launchers.map((r:AgentLauncher)=>{
        const fields=launcherFields(r);
        if(!validId(r.id)||ids.has(r.id)||typeof r.folder!=='string'||!isAbsolute(r.folder)||r.folder.includes('\0')||!Number.isFinite(Date.parse(r.updatedAt))||r.lastLaunchedAt!==null&&!Number.isFinite(Date.parse(r.lastLaunchedAt)))throw new Error();
        ids.add(r.id);return {...fields,id:r.id,folder:r.folder,updatedAt:r.updatedAt,lastLaunchedAt:r.lastLaunchedAt};
      });
    }catch{this.records=[];this.warning='The agent launcher library could not be read. The original file was preserved. Repair agent-launchers.json in app user data and restart.';}
  }
  state():LauncherState{return {launchers:structuredClone(this.records),supported:this.platform==='darwin',warning:this.warning};}
  private get(id:unknown){if(!validId(id))throw new Error('Invalid launcher ID.');const record=this.records.find(r=>r.id===id);if(!record)throw new Error('Launcher not found.');return record;}
  private commit(records:AgentLauncher[]){
    if(this.warning)throw new Error(this.warning);
    writeFileSync(`${this.file}.tmp`,JSON.stringify({version:1,launchers:records},null,2),{mode:0o600});
    renameSync(`${this.file}.tmp`,this.file);this.records=records;
  }
  save(input:unknown,resolveFolder:(id:string)=>string|undefined){
    if(this.warning)throw new Error(this.warning);
    const fields=launcherFields(input),r=input as SaveLauncherRequest,old=r.id===undefined?undefined:this.get(r.id);
    if(old&&old.updatedAt!==r.expectedUpdatedAt)throw new Error('This launcher changed. Reopen it before saving.');
    if(!old&&this.records.length>=200)throw new Error('The library holds up to 200 launchers. Remove one before adding another.');
    const folder=r.folderChoice===null?old?.folder:typeof r.folderChoice==='string'?resolveFolder(r.folderChoice):undefined;
    if(!folder)throw new Error('Choose a working folder using the folder picker.');
    const updatedAt=new Date(Math.max(Date.now(),old?Date.parse(old.updatedAt)+1:0)).toISOString();
    const record:AgentLauncher={...fields,id:old?.id??randomUUID(),folder,updatedAt,lastLaunchedAt:old?.lastLaunchedAt??null};
    this.commit([...this.records.filter(v=>v.id!==record.id),record]);return this.state();
  }
  remove(id:unknown,expectedUpdatedAt:unknown){const record=this.get(id);if(record.updatedAt!==expectedUpdatedAt)throw new Error('This launcher changed. Refresh the library before removing it.');this.commit(this.records.filter(v=>v.id!==id));return this.state();}
  async launch(id:unknown,expectedUpdatedAt:unknown){
    if(this.warning)throw new Error(this.warning);
    if(this.platform!=='darwin')throw new Error('Native agent launching currently requires macOS.');
    const record=this.get(id);
    if(record.updatedAt!==expectedUpdatedAt)throw new Error('This launcher changed. Refresh the library before launching it.');
    try{if(realpathSync(record.folder)!==record.folder||!statSync(record.folder).isDirectory())throw new Error();}catch{throw new Error('The working folder moved or is unavailable. Edit the launcher and choose it again.');}
    await this.open(terminalProgram(record.folder,record.command));
    // Edits/removal while Terminal opens must not be overwritten by this completion.
    const lastLaunchedAt=new Date().toISOString();
    this.commit(this.records.map(v=>v.id===id?{...v,lastLaunchedAt}:v));return this.state();
  }
}
