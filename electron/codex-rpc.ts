import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { homedir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { findCodex } from './agent-runner';
// Dedicated control channel: never starts a thread or turn. No raw runtime errors or credentials cross IPC.
export async function disableConfiguredMcp(binary:string,env:NodeJS.ProcessEnv):Promise<string[]>{
  return new Promise((resolve,reject)=>{execFile(binary,['--no-daemon','mcp','list','--json'],{cwd:homedir(),env,timeout:6000,maxBuffer:2_000_000},(error,stdout)=>{
    if(error){reject(new Error('Codex MCP configuration could not be isolated. Update Codex CLI and retry.'));return;}
    try{const servers=JSON.parse(stdout);if(!Array.isArray(servers))throw new Error();resolve(servers.flatMap((s:unknown)=>{const name=(s as {name?:unknown})?.name;if(typeof name!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(name))throw new Error();return ['-c',`mcp_servers.${name}={command=${JSON.stringify(binary)}, enabled=false}`];}));}
    catch{reject(new Error('Codex MCP inventory was invalid. Update Codex CLI and retry.'));}
  });});
}
export class CodexRpc {
  private child?:ChildProcessWithoutNullStreams;
  private ready?:Promise<void>;
  private nextId=0;
  private epoch=0;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(private args:string[]=[],private notification:(method:string,params:any)=>void=()=>{}){}
  private async start(){
    const epoch=this.epoch;
    const binary=await findCodex();if(!binary)throw new Error('Install Codex CLI to manage this connection.');
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.NODE_INSPECT_RESUME_ON_START;
    const isolation=await disableConfiguredMcp(binary,env);
    if(this.epoch!==epoch)throw new Error('Codex connection closed. Retry the request.');
    const child=spawn(binary,['--no-daemon','-c','features.apps=false',...isolation,...this.args,'app-server','--stdio'],{cwd:homedir(),env,shell:false,stdio:['pipe','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});this.child=child;
    let buffer='',total=0;const decoder=new StringDecoder('utf8');
    const disconnected=()=>{if(this.child===child)this.close();};
    child.stderr.resume();child.stdin.on('error',disconnected);child.on('error',disconnected);child.on('close',disconnected);
    child.stdout.on('data',(chunk:Buffer)=>{
      if(this.child!==child)return;
      total+=chunk.length;if(total>8_000_000){this.close();return;}buffer+=decoder.write(chunk);let index;
      while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
        try{const response=JSON.parse(line);
          if(typeof response.id==='number'&&this.pending.has(response.id)){const p=this.pending.get(response.id)!;this.pending.delete(response.id);clearTimeout(p.timer);if(response.error)p.reject(new Error('Codex could not complete this request. Check runtime version, authentication, and server configuration.'));else p.resolve(response.result);}
          else if(typeof response.method==='string'&&response.id===undefined)this.notification(response.method,response.params);
          else if(response.id!==undefined)child.stdin.write(JSON.stringify({id:response.id,error:{code:-32601,message:'Unsupported control request'}})+'\n');
        }catch{this.close();return;}
      }
    });
    await this.send('initialize',{clientInfo:{name:'theseus_connections',version:'0.1.0'}});
    child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
  }
  private send(method:string,params:unknown):Promise<any>{return new Promise((resolve,reject)=>{
    if(!this.child||this.child.stdin.destroyed){reject(new Error('Codex connection closed. Retry the request.'));return;}
    const id=++this.nextId;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex request timed out. Retry or check your connection.'));},20000);
    this.pending.set(id,{resolve,reject,timer});this.child!.stdin.write(JSON.stringify({id,method,params})+'\n');
  });}
  async call(method:string,params:unknown={}){if(!this.ready){const attempt=this.start();this.ready=attempt;void attempt.catch(()=>{if(this.ready===attempt)this.close();});}await this.ready;return this.send(method,params);}
  close(){this.epoch++;const child=this.child;this.child=undefined;this.ready=undefined;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Codex connection closed. Retry the request.'));}this.pending.clear();child?.stdin.end();if(child?.pid&&process.platform!=='win32'){try{process.kill(-child.pid,'SIGTERM');}catch{/* already exited */}}else child?.kill();}
}
