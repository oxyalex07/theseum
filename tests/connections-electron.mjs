// Fixture Codex + actual Electron/preload/renderer. No external auth, provider usage, or agent turns.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'theseus-connections-')),profile=join(root,'profile'),project=join(root,'project'),fake=join(root,'codex');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
await writeFile(fake,`#!${process.execPath}
const fs=require('node:fs');const path=require('node:path');const readline=require('node:readline');
const root=process.env.THESEUS_CONNECTION_TEST_ROOT;const auth=path.join(root,'auth');
if(process.argv.includes('--version')){console.log('codex fixture 1');process.exit(0);}
if(process.argv.includes('status')){process.exit(fs.existsSync(auth)?0:1);}
if(process.argv.includes('list')){console.log('[]');process.exit(0);}
if(process.argv.includes('exec')){fs.writeFileSync(path.join(root,'run-args.json'),JSON.stringify(process.argv));process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'turn.completed'}));});return;}
const send=r=>console.log(JSON.stringify(r));
readline.createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(r.id===undefined)return;let result={};switch(r.method){
case 'account/read':result={account:fs.existsSync(auth)?{type:'chatgpt',email:'fixture@example.com',planType:'plus'}:null};break;
case 'account/rateLimits/read':result={rateLimits:{primary:{usedPercent:42,windowDurationMins:300,resetsAt:1800000000}}};break;
case 'account/login/start':result={loginId:'fixture',authUrl:'https://auth.openai.com/fixture'};setTimeout(()=>{fs.writeFileSync(auth,'logged in');send({method:'account/login/completed',params:{success:true}})},100);break;
case 'account/logout':fs.rmSync(auth,{force:true});break;
case 'mcpServerStatus/list':result={data:[{name:'linear',runtimeStatus:'connected',tools:{read:{}},authStatus:'oAuth'}]};break;
case 'mcpServer/oauth/login':result={authorizationUrl:'https://linear.app/oauth/authorize'};break;
}send({id:r.id,result});});
`,{mode:0o700});
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake,THESEUS_CONNECTION_TEST_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();await desktop.evaluate(({shell})=>{globalThis.connectionUrls=[];shell.openExternal=async url=>{globalThis.connectionUrls.push(url);};});return page;}
async function settings(page,section){await page.getByRole('button',{name:'Settings',exact:true}).first().click();await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:section,exact:true}).click();}
try{
  let page=await launch();await settings(page,'Models & usage');await page.getByRole('button',{name:'Sign in to Codex'}).click();await expect(page.getByText('fixture@example.com · plus',{exact:true})).toBeVisible();await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow','42');
  await page.getByRole('button',{name:'Manage subscription'}).click();assert.deepEqual(await desktop.evaluate(()=>globalThis.connectionUrls),['https://auth.openai.com/fixture','https://chatgpt.com/#settings/Account']);
  await page.screenshot({path:'artifacts/verification/connections-account.png'});
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Integrations',exact:true}).click();await page.getByRole('button',{name:'Linear',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('MCP URL')).toHaveValue('https://mcp.linear.app/mcp');await dialog.getByRole('button',{name:'Save server'}).click();await expect(dialog).toHaveCount(0);
  await page.getByText('Saved · connection not checked',{exact:true}).waitFor();await page.getByRole('button',{name:'Check connection'}).click();await page.getByText(/Verified · 1 tools discovered/).waitFor();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect.poll(()=>desktop.evaluate(()=>globalThis.connectionUrls)).toContain('https://linear.app/oauth/authorize');
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'artifacts/verification/connections-integrations.png'});
  await page.getByRole('button',{name:'Add MCP server'}).click();await dialog.getByLabel('Server name').fill('bad');await dialog.getByLabel('MCP URL').fill('http://remote.example.com');await dialog.getByRole('button',{name:'Save server'}).click();await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await assert.rejects(()=>page.evaluate(()=>window.theseus.mcpServerAction('linear','arbitrary')));
  await desktop.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},project);
  const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());await page.evaluate(id=>window.theseus.startAgentRun({workspaceId:id,task:'Fixture MCP propagation'}),workspace.id);
  await expect.poll(async()=>{try{return JSON.parse(await readFile(join(root,'run-args.json'),'utf8'));}catch{return [];}}).toContain('mcp_servers.linear={enabled=true, url="https://mcp.linear.app/mcp"}');
  await expect.poll(()=>page.evaluate(async()=>(await window.theseus.getExecutionState()).runs[0]?.status)).toBe('completed');
  await page.getByRole('switch',{name:'Enable linear'}).click();await expect(page.getByRole('switch',{name:'Enable linear'})).not.toBeChecked();
  await desktop.close();desktop=undefined;page=await launch();await settings(page,'Integrations');await expect(page.getByRole('switch',{name:'Enable linear'})).not.toBeChecked();await expect(page.getByRole('button',{name:'Check connection'})).toBeDisabled();
  await page.getByRole('button',{name:'Remove…',exact:true}).click();await page.getByRole('button',{name:'Remove server',exact:true}).click();await page.getByText('No MCP servers configured.',{exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Models & usage',exact:true}).click();await page.getByRole('button',{name:'Sign out…',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in to Codex',exact:true}).waitFor();assert.equal(await page.getByRole('meter').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS account login/usage/manage/logout; MCP presets, validation, discovery, OAuth URL, run propagation, disable, restart persistence, removal; no page errors');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
