import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Integrations, mcpArguments, parseUsage, ProviderAccount, validateMcp } from '../electron/integrations';
import { CodexRpc } from '../electron/codex-rpc';
const paths:string[]=[];const clients:CodexRpc[]=[];
const temporary=()=>{const dir=mkdtempSync(join(tmpdir(),'theseus-integrations-'));paths.push(dir);return dir;};
const remote=()=>({name:'linear',enabled:true,transport:{type:'http',url:'https://mcp.linear.app/mcp'}});
afterEach(()=>{for(const client of clients.splice(0))client.close();delete process.env.THESEUS_CODEX_PATH;for(const dir of paths.splice(0))rmSync(dir,{recursive:true,force:true});});
describe('MCP configuration',()=>{
  it.each([
    {...remote(),name:'theseus_browser'}, {...remote(),name:'a.b'}, {...remote(),name:'../bad'},
    {...remote(),transport:{type:'http',url:'https://user:secret@example.com'}},
    {...remote(),transport:{type:'http',url:'https://example.com?token=secret'}},
    {...remote(),transport:{type:'http',url:'http://remote.example.com'}},
    {...remote(),transport:{type:'http',url:'file:///tmp/test'}},
    {...remote(),transport:{type:'http',url:'https://example.com',bearerTokenEnvVar:'secret-value'}},
    {...remote(),transport:{type:'stdio',command:'npx',args:[],envVars:[]}},
    {...remote(),transport:{type:'stdio',command:'/bin/node',args:'shell string',envVars:[]}},
  ])('rejects unsafe or malformed server %j',input=>expect(()=>validateMcp(input)).toThrow());
  it('persists only validated configuration, disables new runs, and removes without touching unrelated data',()=>{
    const dir=temporary(),store=new Integrations(dir);store.save(remote());
    store.save({name:'filesystem',enabled:true,transport:{type:'stdio',command:'/opt/bin/mcp',args:['/approved folder','$(echo no-shell)'],envVars:['SERVICE_TOKEN']}});
    expect(statSync(join(dir,'mcp-servers.json')).mode&0o777).toBe(0o600);
    const fresh=new Integrations(dir);expect(fresh.state().servers).toHaveLength(2);expect(fresh.state().connections.every(c=>c.state==='configured')).toBe(true);
    fresh.save({...remote(),enabled:false});expect(fresh.args().join(' ')).not.toContain('mcp_servers.linear');expect(fresh.args().join(' ')).toContain('args=["/approved folder","$(echo no-shell)"]');
    fresh.remove('linear');expect(new Integrations(dir).state().servers.map(s=>s.name)).toEqual(['filesystem']);
  });
  it('preserves damaged files and blocks mutation and execution rather than silently dropping configuration',()=>{
    const dir=temporary(),file=join(dir,'mcp-servers.json');writeFileSync(file,'bad json');const store=new Integrations(dir);
    expect(store.state().warning).toBeTruthy();expect(()=>store.save(remote())).toThrow();expect(()=>store.args()).toThrow();expect(readFileSync(file,'utf8')).toBe('bad json');
  });
  it('does not export secret values and re-enables only explicitly configured servers',()=>{
    expect(mcpArguments([validateMcp({...remote(),transport:{type:'http',url:'https://example.com/mcp',bearerTokenEnvVar:'LINEAR_TOKEN'}})])).toEqual(['-c','mcp_servers.linear={enabled=true, url="https://example.com/mcp", bearer_token_env_var="LINEAR_TOKEN"}']);
  });
});
it('parses real multi-bucket quota windows and rejects missing, invalid and fabricated defaults',()=>{
  expect(parseUsage({})).toEqual([]);
  expect(parseUsage({rateLimitsByLimitId:{codex:{primary:{usedPercent:25,windowDurationMins:300,resetsAt:1800000000},secondary:{usedPercent:101}}}})).toEqual([{label:'codex · primary',usedPercent:25,windowMinutes:300,resetsAt:new Date(1800000000000).toISOString()}]);
  expect(parseUsage({rateLimits:{primary:{usedPercent:0}}})[0]).toEqual({label:'codex · primary',usedPercent:0,windowMinutes:null,resetsAt:null});
  expect(parseUsage({rateLimits:{primary:{usedPercent:NaN}}})).toEqual([]);
});
function fixture(){
  const dir=temporary(),binary=join(dir,'codex');writeFileSync(binary,`#!${process.execPath}
const readline=require('node:readline');
if(process.argv.includes('list')){console.log(JSON.stringify([{name:'outside_config'}]));process.exit(0);}
let loggedIn=false;
const send=(r)=>console.log(JSON.stringify(r));
readline.createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(r.id===undefined)return;
let result={};
switch(r.method){
case 'initialize':break;
case 'account/read':result={account:loggedIn?{type:'chatgpt',email:'test@example.com',planType:'plus'}:null};break;
case 'account/rateLimits/read':result={rateLimits:{primary:{usedPercent:42,windowDurationMins:300,resetsAt:1800000000}}};break;
case 'account/login/start':result={loginId:'fixture',authUrl:'https://auth.openai.com/fixture'};setTimeout(()=>{loggedIn=true;send({method:'account/login/completed',params:{success:true}})},20);break;
case 'account/logout':loggedIn=false;break;
case 'mcpServerStatus/list':result={data:[{name:'linear',runtimeStatus:'connected',tools:{read:{}},authStatus:'oAuth'}]};break;
case 'fixture/error':send({id:r.id,error:{message:'secret token must not leak'}});return;
case 'fixture/isolation':result=process.argv;break;
case 'fixture/exit':process.exit(1);
}
send({id:r.id,result});
});`,{mode:0o700});process.env.THESEUS_CODEX_PATH=binary;return dir;
}
it('reads account status, completes login, reads actual quota, signs out, and sanitizes RPC errors',async()=>{
  fixture();const account=new ProviderAccount();clients.push(account.rpc);
  expect((await account.state()).state).toBe('disconnected');expect(await account.login()).toBe('https://auth.openai.com/fixture');
  await new Promise(resolve=>setTimeout(resolve,50));const state=await account.state();expect(state.state).toBe('connected');expect(state.email).toBe('test@example.com');expect(state.usage[0].usedPercent).toBe(42);expect(state.loginPending).toBe(false);
  await expect(account.rpc.call('fixture/error')).rejects.toThrow('Codex could not complete');
  const args=await account.rpc.call('fixture/isolation');expect(args.some((a:string)=>a.startsWith('mcp_servers.outside_config={command=')&&a.endsWith('enabled=false}'))).toBe(true);
  await account.logout();expect((await account.state()).state).toBe('disconnected');
});
it('verifies a real runtime discovery response without treating saved state as connected',async()=>{
  const dir=fixture(),store=new Integrations(dir);store.save(remote());expect(store.state().connections[0].state).toBe('configured');
  expect((await store.test('linear')).connections[0].state).toBe('connected');store.save({...remote(),enabled:false});expect(store.state().connections[0].state).toBe('disabled');await expect(store.test('linear')).rejects.toThrow('Enable');
});
it('rejects outstanding requests when the runtime exits and can reconnect',async()=>{
  fixture();const rpc=new CodexRpc();clients.push(rpc);await expect(rpc.call('fixture/exit')).rejects.toThrow('closed');expect(await rpc.call('account/read')).toEqual({account:null});
});
