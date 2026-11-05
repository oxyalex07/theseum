import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { agentAvailability, findCodex } from './agent-runner';
import type { RuntimeCheck, RuntimeModel } from '../shared/bridge';
export function parseModels(value:unknown):RuntimeModel[]{
  if(!Array.isArray(value))throw new Error('Model catalog unavailable');
  return value.slice(0,100).flatMap(raw=>{
    if(!raw||typeof raw!=='object')return [];
    const m=raw as Record<string,unknown>;
    if(m.hidden===true||typeof m.model!=='string'||!/^[a-zA-Z0-9._:/-]{1,120}$/.test(m.model))return [];
    const efforts=Array.isArray(m.supportedReasoningEfforts)?m.supportedReasoningEfforts.slice(0,20).flatMap(e=>{
      if(!e||typeof e.reasoningEffort!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(e.reasoningEffort))return [];
      return [{value:e.reasoningEffort,description:typeof e.description==='string'?e.description.slice(0,300):e.reasoningEffort}];
    }):[];
    return [{id:m.model,label:typeof m.displayName==='string'?m.displayName.slice(0,120):m.model,efforts}];
  });
}
async function catalog(binary:string):Promise<RuntimeModel[]>{
  return new Promise((resolve,reject)=>{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.NODE_INSPECT_RESUME_ON_START;
    // Read-only RPCs only: no thread/start, turn/start, config/write or authentication output.
    const child=spawn(binary,['--no-daemon','-c','model_provider="openai"','app-server','--stdio'],{cwd:homedir(),env,shell:false,stdio:['pipe','pipe','ignore'],windowsHide:true});
    let settled=false,buffer='',total=0;const models:RuntimeModel[]=[];const decoder=new StringDecoder('utf8');
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);child.stdin.end();child.kill();if(error)reject(error);else resolve(models);};
    const timer=setTimeout(()=>finish(new Error('Runtime check timed out')),10000);
    const send=(value:unknown)=>child.stdin.write(JSON.stringify(value)+'\n');
    child.stdin.on('error',()=>finish(new Error('Runtime connection closed')));
    child.on('error',()=>finish(new Error('Runtime could not start')));child.on('close',()=>finish(new Error('Runtime check ended')));
    child.stdout.on('data',(chunk:Buffer)=>{
      total+=chunk.length;if(total>2_000_000){finish(new Error('Runtime response too large'));return;}
      buffer+=decoder.write(chunk);let newline;
      while((newline=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
        try{
          const r=JSON.parse(line);if(r.error){finish(new Error('Runtime capability request failed'));return;}
          if(r.id===1){send({method:'initialized',params:{}});send({id:2,method:'model/list',params:{limit:100,includeHidden:false}});}
          if(r.id===2){models.push(...parseModels(r.result?.data));if(r.result?.nextCursor&&models.length<100)send({id:2,method:'model/list',params:{limit:100,cursor:r.result.nextCursor,includeHidden:false}});else finish();}
        }catch{finish(new Error('Runtime capability response was invalid'));}
      }
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'orbit_profiles',title:'Orbit agent profiles',version:'0.1.0'}}});
  });
}
export async function checkRuntime():Promise<RuntimeCheck>{
  const availability=await agentAvailability();
  const result:RuntimeCheck={state:availability.authenticated?'verified':availability.installed?'unknown':'unavailable',authentication:availability.authenticated?'verified':'unknown',version:availability.version,checkedAt:new Date().toISOString(),message:availability.message,models:[],catalogState:'unknown'};
  const binary=await findCodex();if(!binary||!availability.version)return result;
  try{result.models=await catalog(binary);result.catalogState='verified';}
  catch{result.message+=' Model capabilities could not be verified. Use runtime defaults or check again.';}
  return result;
}
