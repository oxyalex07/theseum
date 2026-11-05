import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { McpConfiguration, IntegrationState, McpConnection, UsageWindow, ProviderState } from '../shared/integrations';
import { CodexRpc } from './codex-rpc';
const envName=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,100}$/.test(value);
export function validateMcp(input:unknown):McpConfiguration{
  if(!input||typeof input!=='object')throw new Error('Enter a server configuration.');const r=input as McpConfiguration;
  if(typeof r.name!=='string'||! /^[a-z][a-z0-9_-]{0,63}$/.test(r.name)||r.name==='theseus_browser')throw new Error('Use a unique lowercase server name (letters, numbers, underscores, dashes).');
  if(typeof r.enabled!=='boolean'||!r.transport)throw new Error('Choose a transport and enabled state.');const t=r.transport;
  if(t.type==='http'){
    let url:URL;try{url=new URL(t.url);}catch{throw new Error('Enter a valid MCP URL.');}
    if(!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.href.length>2048)throw new Error('Use HTTPS (or local HTTP), without credentials, query parameters, or fragments.');
    if(t.bearerTokenEnvVar!==undefined&&!envName(t.bearerTokenEnvVar))throw new Error('Use an environment variable name for the bearer token.');
    return {name:r.name,enabled:r.enabled,transport:{type:'http',url:url.href,...(t.bearerTokenEnvVar?{bearerTokenEnvVar:t.bearerTokenEnvVar}:{})}};
  }
  if(t.type!=='stdio'||typeof t.command!=='string'||!isAbsolute(t.command)||t.command.includes('\0')||t.command.length>4096)throw new Error('Choose an absolute executable path for a stdio server.');
  if(!Array.isArray(t.args)||t.args.length>100||t.args.some(a=>typeof a!=='string'||a.length>4096||a.includes('\0'))||!Array.isArray(t.envVars)||t.envVars.length>100||t.envVars.some(e=>!envName(e)))throw new Error('Arguments must be a JSON string array; environment entries must be variable names.');
  return {name:r.name,enabled:r.enabled,transport:{type:'stdio',command:t.command,args:[...t.args],envVars:[...new Set(t.envVars)]}};
}
// JSON strings are valid TOML basic strings; no shell interpolation or user configuration writes.
export function mcpArguments(servers:McpConfiguration[]):string[]{return servers.filter(s=>s.enabled).flatMap(s=>{
  const fields:Record<string,unknown>=s.transport.type==='http'?{url:s.transport.url,...(s.transport.bearerTokenEnvVar?{bearer_token_env_var:s.transport.bearerTokenEnvVar}:{})}:{command:s.transport.command,args:s.transport.args,env_vars:s.transport.envVars};
  return ['-c',`mcp_servers.${s.name}={${Object.entries({enabled:true,...fields}).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join(', ')}}`];
});}
export class Integrations {
  private servers:McpConfiguration[]=[];private connections=new Map<string,McpConnection>();private warning?:string;private fatal=false;
  private file:string;
  constructor(directory:string){this.file=join(directory,'mcp-servers.json');try{const raw=readFileSync(this.file,'utf8');if(raw.length>1_000_000)throw new Error();const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>50)throw new Error();this.servers=parsed.map(validateMcp);if(new Set(this.servers.map(s=>s.name)).size!==this.servers.length)throw new Error();}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'){this.fatal=true;this.warning='MCP configuration could not be read. Repair mcp-servers.json before saving; existing data was preserved.';}}}
  state():IntegrationState{return {servers:structuredClone(this.servers),connections:this.servers.map(s=>this.connections.get(s.name)??{name:s.name,state:s.enabled?'configured':'disabled',message:s.enabled?'Saved · connection not checked':'Disabled for new tasks'}),warning:this.warning};}
  args(){if(this.fatal)throw new Error(this.warning);return mcpArguments(this.servers);}
  save(input:unknown){const config=validateMcp(input);const next=this.servers.filter(s=>s.name!==config.name);if(next.length>=50)throw new Error('Maximum of 50 servers.');next.push(config);this.persist(next);this.connections.delete(config.name);return this.state();}
  remove(name:unknown){this.get(name);this.persist(this.servers.filter(s=>s.name!==name));this.connections.delete(name as string);return this.state();}
  get(name:unknown){const server=this.servers.find(s=>s.name===name);if(!server)throw new Error('Server was not found.');return server;}
  private persist(next:McpConfiguration[]){if(this.fatal)throw new Error(this.warning);mkdirSync(join(this.file,'..'),{recursive:true,mode:0o700});const temp=`${this.file}.${randomUUID()}.tmp`;writeFileSync(temp,JSON.stringify(next,null,2),{mode:0o600});renameSync(temp,this.file);this.servers=next;}
  status(name:string,message:string){this.get(name);this.connections.set(name,{name,state:'configured',message});}
  async test(name:unknown){const server=this.get(name);if(!server.enabled)throw new Error('Enable this server before checking it.');const rpc=new CodexRpc(mcpArguments([server]));
    let connection:McpConnection={name:server.name,state:'error',message:'Connection could not be verified. Check the executable, endpoint, and authentication.',checkedAt:new Date().toISOString()};
    try{const result=await rpc.call('mcpServerStatus/list',{limit:100,serverName:server.name});const status=result?.data?.find((s:any)=>s.name===server.name);
      if(status?.runtimeStatus==='connected'||status?.runtimeStatus==null&&!status?.toolsError&&(status?.serverInfo||Object.keys(status?.tools??{}).length>0))connection={...connection,state:'connected',message:`Verified · ${Object.keys(status.tools??{}).length} tools discovered`};
      else if(status?.authStatus==='notLoggedIn'||status?.runtimeStatus==='authenticationRequired')connection.message='Authentication required. Sign in, or set the configured token environment variable and restart Theseus.';
    }catch{/* sanitized diagnostic above */}finally{rpc.close();}
    // Ignore a result if its configuration changed while discovery was in flight.
    if(JSON.stringify(this.servers.find(s=>s.name===name))===JSON.stringify(server))this.connections.set(server.name,connection);return this.state();
  }
}
export function parseUsage(result:any):UsageWindow[]{
  const buckets=result?.rateLimitsByLimitId&&typeof result.rateLimitsByLimitId==='object'?Object.entries(result.rateLimitsByLimitId):[['codex',result?.rateLimits]];
  return buckets.slice(0,20).flatMap(([id,raw])=>{const bucket=raw as any;return ['primary','secondary'].flatMap(key=>{const w=bucket?.[key];if(!w||typeof w.usedPercent!=='number'||!Number.isFinite(w.usedPercent)||w.usedPercent<0||w.usedPercent>100)return [];const reset=typeof w.resetsAt==='number'?new Date(w.resetsAt*1000):null;return [{label:`${String(id).slice(0,100)} · ${key}`,usedPercent:w.usedPercent,windowMinutes:Number.isFinite(w.windowDurationMins)&&w.windowDurationMins>0?w.windowDurationMins:null,resetsAt:reset&&Number.isFinite(reset.getTime())?reset.toISOString():null}];});});
}
export class ProviderAccount {
  loginId:string|null=null;private loginMessage='';
  readonly rpc=new CodexRpc([], (method,params)=>{if(method==='account/login/completed'){this.loginId=null;this.loginMessage=params?.success?'Sign-in completed.':'Sign-in did not complete. Try again.';}});
  async state():Promise<ProviderState>{const base:ProviderState={checkedAt:new Date().toISOString(),state:'unavailable',message:'Codex account unavailable. Install or update Codex CLI and refresh.',usage:[],loginPending:!!this.loginId};
    try{const result=await this.rpc.call('account/read',{refreshToken:false});const account=result?.account;if(!account)return {...base,state:'disconnected',message:this.loginMessage||'No Codex account connected.'};
      if(typeof account!=='object'||!['apiKey','chatgpt','amazonBedrock'].includes(account.type))throw new Error('Unsupported account response.');
      base.state='connected';base.message='Uses the account shared with Codex CLI.';if(account.type==='chatgpt'){base.email=typeof account.email==='string'?account.email.slice(0,200):undefined;base.plan=typeof account.planType==='string'?account.planType:undefined;}
      if(account.type!=='chatgpt'){base.usageMessage='Usage windows are unavailable for this authentication method.';return base;}
      try{base.usage=parseUsage(await this.rpc.call('account/rateLimits/read'));if(!base.usage.length)base.usageMessage='The provider returned no usage windows.';}catch{base.usageMessage='Usage unavailable. Refresh to retry.';}return base;
    }catch{this.loginId=null;return {...base,loginPending:false};}
  }
  async login(){if(this.loginId)throw new Error('A sign-in is already pending. Complete or cancel it first.');const result=await this.rpc.call('account/login/start',{type:'chatgpt'});if(typeof result?.loginId!=='string'||typeof result?.authUrl!=='string')throw new Error('This runtime does not support browser sign-in. Use codex login in a terminal.');this.loginId=result.loginId;return result.authUrl as string;}
  async cancel(){const loginId=this.loginId;this.loginId=null;if(loginId)try{await this.rpc.call('account/login/cancel',{loginId});}catch(error){this.rpc.close();throw error;}}
  async logout(){await this.cancel();await this.rpc.call('account/logout');this.loginMessage='Signed out of the shared Codex CLI account.';}
}
