import { randomUUID } from 'node:crypto';
import { realpath, stat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { IPty } from 'node-pty';
import type { ProjectShell, TerminalSize } from '../shared/project-tools';
import { shellHost, windowsJobStopScript } from './project-shell-host';
const exec=promisify(execFile),pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
interface ProcessRow {pid:number;group:number;tty:string;start:string;status:string}
interface Managed {state:ProjectShell;pty:IPty;tty?:string;hostExited:boolean;cleaned:boolean;initialized:boolean;pendingOutput:string;token:string;controlRoot?:string;controlTimer?:ReturnType<typeof setInterval>;timer?:ReturnType<typeof setTimeout>;cleanup?:Promise<void>}
async function processes():Promise<ProcessRow[]>{
  const {stdout}=await exec('/bin/ps',['-axo','pid=,pgid=,tty=,stat=,lstart='],{timeout:2000,maxBuffer:4*1024*1024});
  return stdout.trim().split('\n').map(line=>{const [pid,group,tty,status,...start]=line.trim().split(/\s+/);return {pid:Number(pid),group:Number(group),tty,status,start:start.join(' ')};});
}
function alive(pid:number){try{process.kill(pid,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error;}}
function signal(rows:ProcessRow[],value:NodeJS.Signals,host:number){
  for(const row of rows){if(row.pid===host)continue;try{process.kill(row.pid,value);}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw new Error(`Could not signal ${JSON.stringify(row)}: ${(error as Error).message}`);}}
}
export class ProjectTerminals {
  private sessions=new Map<string,Managed>();
  private starting=new Set<string>();
  private generation=0;
  private stopping=false;
  private pending=new Set<Promise<unknown>>();
  readonly shell=process.platform==='win32'?(process.env.ComSpec??join(process.env.SystemRoot??'C:\\Windows','System32','cmd.exe')):process.platform==='darwin'?'/bin/zsh':'/bin/sh';
  constructor(private emit:(state:ProjectShell)=>void){}
  list(){return [...this.sessions.values()].map(c=>structuredClone(c.state));}
  protectedPaths(){return [...this.sessions.values()].filter(c=>!c.cleaned).map(c=>c.state.projectPath);}
  get(key:string){const c=[...this.sessions.values()].find(c=>c.state.targetKey===key);return c?.initialized?structuredClone(c.state):null;}
  private publish(c:Managed){clearTimeout(c.timer);c.timer=undefined;c.state.revision++;this.emit(structuredClone(c.state));}
  open(key:string,path:string,size:TerminalSize):Promise<ProjectShell>{
    const operation=this.start(key,path,size);this.pending.add(operation);void operation.finally(()=>this.pending.delete(operation)).catch(()=>{});return operation;
  }
  private async start(key:string,path:string,size:TerminalSize):Promise<ProjectShell>{
    if(this.stopping)throw new Error('Terminals are stopping. Try again when shutdown finishes.');
    const owned=[...this.sessions.values()].find(c=>c.state.targetKey===key&&!c.cleaned);
    if(owned){if(!owned.initialized)throw new Error('This project shell is starting.');return structuredClone(owned.state);}
    if(this.starting.has(key))throw new Error('This project shell is starting.');
    if(this.protectedPaths().length+this.starting.size>=8)throw new Error('Close a project shell before opening another (limit 8).');
    const generation=this.generation;this.starting.add(key);
    try{
      if(await realpath(path)!==path||!(await stat(path)).isDirectory())throw new Error('The project folder moved or changed. Choose it again.');
      if(this.stopping||generation!==this.generation)throw new Error('Stop all cancelled this pending shell.');
      const token=randomUUID(),controlRoot=process.platform==='win32'?await mkdtemp(join(tmpdir(),'theseus-shell-')):undefined;
      const statusFile=controlRoot?join(controlRoot,'state'):'';
      const host=shellHost(this.shell,token,statusFile,path);
      let pty:IPty;
      try{const native=await import('node-pty');if(this.stopping||generation!==this.generation)throw new Error('Shell start cancelled');pty=native.spawn(host.file,host.args,{name:'xterm-256color',...size,cwd:path,useConpty:true,env:{...process.env,ENV:'',TERM:'xterm-256color',COLORTERM:'truecolor'}});}
      catch{if(controlRoot)await rm(controlRoot,{recursive:true,force:true});throw new Error('Could not open the interactive shell. Run pnpm install and pnpm build to prepare node-pty, then restart.');}
      const state:ProjectShell={id:randomUUID(),targetKey:key,projectPath:path,shell:this.shell,status:'running',revision:0,output:'',outputStart:0,...size,startedAt:new Date().toISOString()};
      const c:Managed={state,pty,token,controlRoot,hostExited:false,cleaned:false,initialized:false,pendingOutput:''};
      // An owned session is never evicted until its jobs and host actually exit.
      for(const [id,old] of this.sessions)if(old.state.targetKey===key&&old.cleaned)this.sessions.delete(id);
      if(this.sessions.size>=24){const old=[...this.sessions].find(([,c])=>c.cleaned);if(old)this.sessions.delete(old[0]);}
      this.sessions.set(state.id,c);
      let ready=process.platform!=='win32';
      if(controlRoot)c.controlTimer=setInterval(()=>{void readFile(statusFile,'utf8').then(value=>{
        if(c.cleaned)return;
        if(value==='ready')ready=true;
        if(value==='error'){c.state.error='Windows could not create the terminal process job. Check PowerShell and Windows 10 1809 or newer.';void this.close(c.state.id).catch(()=>{});}
        if(/^exit:-?\d+$/.test(value)){c.state.exitCode=Number(value.slice(5));void this.close(c.state.id).catch(()=>{});}
      }).catch(error=>{if(error.code!=='ENOENT'){c.state.error='Could not read terminal host status.';void this.close(c.state.id).catch(()=>{});}});},40);
      pty.onData(data=>{
        c.pendingOutput+=data;
        const prefix=`\x1b]777;${token};`;
        while(c.pendingOutput){
          const index=c.pendingOutput.indexOf(prefix);
          if(index===-1){
            // Keep a split control record until the next PTY chunk.
            let keep=0;for(let n=1;n<prefix.length;n++)if(c.pendingOutput.endsWith(prefix.slice(0,n)))keep=n;
            this.append(c,c.pendingOutput.slice(0,c.pendingOutput.length-keep));c.pendingOutput=c.pendingOutput.slice(c.pendingOutput.length-keep);break;
          }
          this.append(c,c.pendingOutput.slice(0,index));c.pendingOutput=c.pendingOutput.slice(index);
          const end=c.pendingOutput.indexOf('\x07');if(end===-1){if(c.pendingOutput.length>128){this.append(c,c.pendingOutput[0]);c.pendingOutput=c.pendingOutput.slice(1);continue;}break;}
          const [event,value]=c.pendingOutput.slice(prefix.length,end).split(';');c.pendingOutput=c.pendingOutput.slice(end+1);
          if(event==='ready')ready=true;
          if(event==='error'){c.state.error='Windows could not create the terminal process job. Check PowerShell and Windows 10 1809 or newer.';void this.close(c.state.id).catch(()=>{});}
          if(event==='exit'){c.state.exitCode=Number(value);void this.close(c.state.id).catch(()=>{});}
        }
      });
      pty.onExit(({exitCode,signal})=>{c.hostExited=true;if(c.state.exitCode===undefined&&c.state.status==='running'){c.state.exitCode=exitCode;c.state.signal=signal;}void this.close(c.state.id).catch(()=>{});});
      try{
        if(process.platform!=='win32'){
          const deadline=Date.now()+3000;
          while(!c.tty&&Date.now()<deadline){const tty=(await processes()).find(p=>p.pid===pty.pid)?.tty;if(tty&&!['??','?'].includes(tty))c.tty=tty;else await pause(20);}
          if(!c.tty)throw new Error('Could not establish terminal ownership.');
          // Interactive shells may flush pending keyboard input during startup.
          // Expose the session only after its first prompt has reached the PTY.
          while(!c.state.output&&!c.hostExited&&Date.now()<deadline)await pause(20);
          if(!c.state.output||c.hostExited)throw new Error('Interactive shell did not become ready.');
        }else{
          const deadline=Date.now()+20000;while((!ready||!c.state.output)&&!c.hostExited&&!c.state.error&&Date.now()<deadline)await pause(40);
          if(!ready||!c.state.output||c.state.error)throw new Error(c.state.error??'Windows terminal startup timed out.');
        }
        if(this.stopping||generation!==this.generation)throw new Error('Stop all cancelled this pending shell.');
        c.initialized=true;this.publish(c);return structuredClone(state);
      }catch(error){c.initialized=true;await this.close(state.id);throw error;}
    }finally{this.starting.delete(key);}
  }
  private append(c:Managed,data:string){if(!data)return;c.state.output+=data;if(c.state.output.length>120000){const drop=c.state.output.length-120000;c.state.outputStart+=drop;c.state.output=c.state.output.slice(drop);}if(c.initialized&&!c.timer)c.timer=setTimeout(()=>this.publish(c),40);}
  private require(id:unknown){if(typeof id!=='string'||!this.sessions.has(id))throw new Error('Project shell no longer exists.');return this.sessions.get(id)!;}
  write(id:string,data:string){const c=this.require(id);if(c.state.status!=='running')throw new Error('The project shell has exited. Open a new shell.');c.pty.write(data);}
  resize(id:unknown,size:TerminalSize){const c=this.require(id);if(c.state.status!=='running')throw new Error('The project shell has exited.');c.pty.resize(size.cols,size.rows);Object.assign(c.state,size);this.publish(c);}
  async close(id:unknown){
    const c=this.require(id);if(c.cleanup)return c.cleanup;if(c.cleaned)return;
    c.state.status='stopping';c.state.error=undefined;this.publish(c);
    c.cleanup=this.cleanup(c).catch(error=>{c.state.error=`Shell cleanup could not be confirmed: ${error.message}. Retry Close shell or Stop all.`;this.publish(c);throw error;}).finally(()=>{c.cleanup=undefined;});
    return c.cleanup;
  }
  private async cleanup(c:Managed){
    if(process.platform==='win32'){
      const script=windowsJobStopScript(c.token),host=shellHost(this.shell,c.token,'');
      const {stdout}=await exec(host.file,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{timeout:15000,maxBuffer:1024*1024,windowsHide:true});
      if(stdout!=='STOPPED')throw new Error('Windows job termination could not be confirmed');
      // If startup failed before creating a job, only the supervisor exists.
      if(!c.hostExited&&alive(c.pty.pid))process.kill(c.pty.pid);
    }else{
      if(!c.tty&&!c.hostExited)throw new Error('Terminal ownership is unavailable');
      // Freeze the supervisor before draining jobs so its keepalive wait cannot
      // spawn another sleep between the last membership check and host exit.
      if(!c.hostExited&&alive(c.pty.pid))process.kill(c.pty.pid,'SIGSTOP');
      if(c.tty){
        const members=async()=>(await processes()).filter(p=>p.tty===c.tty&&p.pid!==c.pty.pid&&!p.status.startsWith('Z'));
        signal(await members(),'SIGTERM',c.pty.pid);await pause(180);
        const deadline=Date.now()+3000;
        while(true){const remaining=await members();if(!remaining.length)break;signal(remaining,'SIGKILL',c.pty.pid);if(Date.now()>deadline)throw new Error('Owned terminal jobs remain alive');await pause(50);}
      }
      if(!c.hostExited&&alive(c.pty.pid))process.kill(c.pty.pid,'SIGKILL');
    }
    const deadline=Date.now()+5000;
    while(!c.hostExited&&alive(c.pty.pid)){if(Date.now()>deadline)throw new Error('Terminal host remains alive');await pause(40);}
    c.cleaned=true;clearInterval(c.controlTimer);if(c.controlRoot)await rm(c.controlRoot,{recursive:true,force:true});c.state.status='exited';c.state.endedAt=new Date().toISOString();this.publish(c);
  }
  async shutdown(){
    this.stopping=true;this.generation++;
    try{await Promise.allSettled([...this.pending]);await Promise.all([...this.sessions.values()].map(c=>this.close(c.state.id)));}
    finally{this.stopping=false;}
  }
}
