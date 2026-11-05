import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import type { WorkspaceSummary } from '../shared/bridge';
import { terminalActive, type TerminalCommand, type TerminalState } from '../shared/terminal';
interface Managed {
  state:TerminalCommand;child:ChildProcessWithoutNullStreams;done:Promise<void>;
  timeout?:ReturnType<typeof setTimeout>;killTimer?:ReturnType<typeof setTimeout>;publishTimer?:ReturnType<typeof setTimeout>;
}
export class CommandTerminal {
  readonly shell=process.platform==='darwin'?'/bin/zsh':'/bin/sh';
  private commands:Managed[]=[];
  private starting=false;
  private stopping=false;
  private generation=0;
  constructor(private publish:(command:TerminalCommand)=>void,private timeoutMs=10*60*1000){}
  state():TerminalState{return {shell:this.shell,commands:this.commands.map(c=>structuredClone(c.state))};}
  private send(c:Managed){clearTimeout(c.publishTimer);c.publishTimer=undefined;c.state.revision++;this.publish(structuredClone(c.state));}
  private append(c:Managed,text:string){
    c.state.output+=text;
    if(c.state.output.length>120000){c.state.output=c.state.output.slice(-120000);c.state.truncated=true;}
    if(!c.publishTimer)c.publishTimer=setTimeout(()=>this.send(c),40);
  }
  private kill(c:Managed,signal:NodeJS.Signals){try{if(c.child.pid)process.kill(-c.child.pid,signal);}catch{/* Process group already exited. */}}
  private stop(c:Managed){this.kill(c,'SIGTERM');if(!c.killTimer)c.killTimer=setTimeout(()=>{this.kill(c,'SIGKILL');c.child.stdin.destroy();c.child.stdout.destroy();c.child.stderr.destroy();},800);}
  async start(workspace:WorkspaceSummary,command:string):Promise<TerminalCommand>{
    if(this.stopping)throw new Error('The terminal is shutting down.');
    if(process.platform==='win32')throw new Error('The command terminal currently supports macOS and Linux.');
    if(this.starting||this.commands.some(c=>terminalActive(c.state.status)))throw new Error('Cancel or wait for the current command before starting another.');
    const generation=this.generation;
    this.starting=true;
    try{
      if(!(await stat(workspace.path)).isDirectory()||await realpath(workspace.path)!==workspace.path)throw new Error('The project folder moved or changed. Choose it again.');
      if(this.stopping||generation!==this.generation)throw new Error('The terminal is shutting down.');
      // The user-authored shell program goes to stdin, never into an interpolated spawn argument.
      const child=spawn(this.shell,['-f','-s'],{cwd:workspace.path,env:{...process.env,TERM:'dumb',NO_COLOR:'1'},shell:false,detached:true,stdio:['pipe','pipe','pipe']});
      let resolve!:()=>void;const done=new Promise<void>(r=>{resolve=r;});
      const c:Managed={state:{id:randomUUID(),revision:0,workspaceId:workspace.id,projectPath:workspace.path,command,status:'running',startedAt:new Date().toISOString(),output:'',truncated:false},child,done};
      this.commands=this.commands.slice(-19);this.commands.push(c);
      const finish=(code:number|null,signal:NodeJS.Signals|null,error?:string)=>{
        if(!terminalActive(c.state.status))return;
        clearTimeout(c.timeout);clearTimeout(c.killTimer);this.kill(c,'SIGKILL');
        const cancelled=c.state.status==='cancelling';
        c.state.status=cancelled?'cancelled':error||c.state.error||code!==0?'failed':'completed';
        c.state.endedAt=new Date().toISOString();
        if(code!==null)c.state.exitCode=code;if(signal)c.state.signal=signal;
        if(error)c.state.error=error;
        if(c.state.status==='failed'&&!c.state.error)c.state.error=`Command exited ${code===null?`with signal ${signal??'unknown'}`:`with code ${code}`}.`;
        this.send(c);resolve();
      };
      child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
      child.stdout.on('data',(text:string)=>this.append(c,text));child.stderr.on('data',(text:string)=>this.append(c,text));
      child.stdin.on('error',()=>{/* Spawn errors and exits are handled below. */});
      child.on('error',(error:NodeJS.ErrnoException)=>finish(null,null,`Could not start the shell (${error.code??'process error'}). Check the project folder and shell permissions.`));
      // Clean up background children that stay in the command's process group.
      child.on('exit',()=>this.kill(c,'SIGKILL'));
      child.on('close',(code,signal)=>finish(code,signal));
      c.timeout=setTimeout(()=>{c.state.error='Command exceeded the 10-minute time limit and was stopped.';this.stop(c);},this.timeoutMs);
      this.send(c);child.stdin.end(command+'\n');
      return structuredClone(c.state);
    }catch(error){if(error instanceof Error&&'code' in error)throw new Error('Could not access the project folder. Choose it again.');throw error;}
    finally{this.starting=false;}
  }
  cancel(id:unknown):TerminalCommand{
    if(typeof id!=='string')throw new Error('Invalid command ID.');
    const c=this.commands.find(c=>c.state.id===id);if(!c)throw new Error('Terminal command was not found.');
    if(terminalActive(c.state.status)&&c.state.status!=='cancelling'){c.state.status='cancelling';this.send(c);this.stop(c);}
    return structuredClone(c.state);
  }
  async shutdown(){this.stopping=true;this.generation++;const active=this.commands.filter(c=>terminalActive(c.state.status));for(const c of active)this.cancel(c.state.id);await Promise.all(active.map(c=>c.done));this.stopping=false;}
}
