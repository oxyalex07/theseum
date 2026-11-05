// Real Electron PTYs and HTTP app; only Codex is a disposable local fixture.
import { _electron, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-project-tools-'))),project=join(root,'project with spaces'),profile=join(root,'profile');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:project,encoding:'utf8'}).trim();
git('init','-b','main');git('config','user.email','fixture@example.com');git('config','user.name','Fixture');
await writeFile(join(project,'app.txt'),'real project\n');git('add','.');git('commit','-m','fixture');
const runtime=join(root,'fixture-codex');
await writeFile(runtime,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
(async()=>{for await(const chunk of process.stdin){}console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Distinct Codex event output'}}));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(runtime,0o700);
let outsideHits=0;
const outside=createServer((_q,res)=>{outsideHits++;res.end('blocked resource');});await new Promise(r=>outside.listen(0,'127.0.0.1',r));const outsideUrl=`http://127.0.0.1:${outside.address().port}`;
await writeFile(join(project,'server.mjs'),`import {createServer} from 'node:http';import {writeFileSync} from 'node:fs';
const server=createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:${JSON.stringify(outsideUrl)}}).end();return;}if(req.url==='/file'){res.writeHead(302,{Location:'file:///etc/passwd'}).end();return;}const send=()=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Real local app</title><main><h1>Actual running project</h1><button onclick="this.textContent=\\'Clicked in app\\'">Test app</button></main><script src="${outsideUrl}/external.js"></script>');};if(req.url==='/slow')setTimeout(send,700);else send();});server.listen(0,'127.0.0.1',()=>{const url='http://127.0.0.1:'+server.address().port;writeFileSync('server.json',JSON.stringify({url,pid:process.pid}));console.log('Local: '+url+'/');});
`);
let desktop;const errors=[];
const shQuote=s=>"'"+s.replaceAll("'","'\\''")+"'";
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:runtime};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('button',{name:'Open your profile'}).waitFor();return page;}
const shell=(page,target)=>page.evaluate(t=>window.theseus.getProjectShell(t),target);
const write=(page,id,data)=>page.evaluate(r=>window.theseus.writeProjectShell(r),{id,data});
const preview=page=>page.evaluate(()=>window.theseus.getProjectPreview());
const dead=pid=>{try{process.kill(pid,0);return false;}catch{return true;}};
try{
  let page=await launch();
  await assert.rejects(()=>page.evaluate(()=>window.theseus.openProjectShell({target:{workspaceId:'11111111-1111-1111-1111-111111111111'},size:{cols:80,rows:24}})));
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Project terminal fixture');await page.getByRole('button',{name:'Start Codex',exact:true}).click();await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  const runId=await page.locator('.cv').getAttribute('data-run-id'),target={runId};
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Terminal',exact:true}).click();await page.getByRole('button',{name:'Open shell',exact:true}).click();
  await expect.poll(async()=>(await shell(page,target))?.status).toBe('running');let current=await shell(page,target);assert.equal(current.projectPath,project);
  await page.locator('.project-shell-screen').click();await page.keyboard.type("test -t 0 && printf 'TTY_OK\\n'; printf 'PROMPT>'; read answer; printf 'ANSWER=%s\\n' \"$answer\"");await page.keyboard.press('Enter');
  await expect.poll(async()=>(await shell(page,target)).output.includes('TTY_OK\r\nPROMPT>')).toBe(true);await page.keyboard.type('interactive answer');await page.keyboard.press('Enter');await expect.poll(async()=>(await shell(page,target)).output.includes('ANSWER=interactive answer')).toBe(true);
  await assert.rejects(()=>page.evaluate(id=>window.theseus.writeProjectShell({id,data:'a'.repeat(16001)}),current.id));
  await assert.rejects(()=>page.evaluate(id=>window.theseus.resizeProjectShell({id,size:{cols:0,rows:24}}),current.id));
  const oldCols=(await shell(page,target)).cols;await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await expect.poll(async()=>(await shell(page,target)).cols).not.toBe(oldCols);
  await write(page,current.id,'stty size\r');current=await shell(page,target);await expect.poll(async()=>(await shell(page,target)).output.includes(`${current.rows} ${current.cols}`)).toBe(true);
  await page.locator('.project-shell-screen').click();await page.keyboard.type("printf 'SLEEP_STARTED\\n'; sleep 60");await page.keyboard.press('Enter');await expect.poll(async()=>(await shell(page,target)).output.includes('SLEEP_STARTED\r\n')).toBe(true);await page.keyboard.press('Control+c');await page.keyboard.type("printf 'RECOVERED:%s\\n' \"$?\"");await page.keyboard.press('Enter');await expect.poll(async()=>(await shell(page,target)).output.includes('RECOVERED:130')).toBe(true).catch(async e=>{console.log(JSON.stringify((await shell(page,target)).output));throw e;});
  assert.equal(await page.locator('.insp').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.screenshot({path:'artifacts/verification/project-shell-small.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  const reopened=new URL(page.url());reopened.searchParams.set('page','session');reopened.searchParams.set('s',runId);await page.goto(reopened.href);await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Terminal',exact:true}).click();assert.equal((await shell(page,target)).id,current.id);await expect(page.locator('.project-shell-screen')).toContainText('ANSWER=interactive answer');
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Preview',exact:true}).click();
  await page.getByRole('textbox',{name:'Local preview URL'}).fill('https://example.com');await page.getByRole('button',{name:'Open app',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Preview requires');
  await page.getByText('Start a development server',{exact:true}).click();await page.getByRole('textbox',{name:'Development server command'}).fill(`${shQuote(process.execPath)} server.mjs`);await page.getByRole('button',{name:'Run in project shell',exact:true}).click();
  await expect.poll(async()=>{try{return JSON.parse(await readFile(join(project,'server.json'),'utf8'));}catch{return null;}}).not.toBeNull();const server=JSON.parse(await readFile(join(project,'server.json'),'utf8'));
  await page.getByRole('button',{name:'Find URLs',exact:true}).click();await page.getByRole('button',{name:server.url+'/',exact:true}).click();await expect.poll(async()=>(await preview(page)).title).toBe('Real local app');await expect.poll(async()=>(await preview(page)).loading).toBe(false);
  const actual=await desktop.evaluate(async({webContents})=>{const wc=webContents.getAllWebContents().find(w=>!w.getLastWebPreferences().preload);const prefs=wc.getLastWebPreferences();return {prefs:{node:prefs.nodeIntegration,sandbox:prefs.sandbox,contextIsolation:prefs.contextIsolation,preload:prefs.preload},content:await wc.executeJavaScript('document.querySelector("h1").textContent'),access:await wc.executeJavaScript('({bridge:typeof window.theseus,node:typeof require})')};});
  assert.equal(actual.content,'Actual running project');assert.deepEqual(actual.prefs,{node:false,sandbox:true,contextIsolation:true,preload:undefined});assert.deepEqual(actual.access,{bridge:'undefined',node:'undefined'});assert.equal(outsideHits,0);
  assert.equal(await desktop.evaluate(async({webContents})=>{const wc=webContents.getAllWebContents().find(w=>!w.getLastWebPreferences().preload);return wc.executeJavaScript('document.querySelector("button").click(); document.querySelector("button").textContent');}),'Clicked in app');
  await page.getByRole('textbox',{name:'Local preview URL'}).fill(server.url+'/slow');const opening=page.getByRole('button',{name:'Open app',exact:true}).click();await expect.poll(async()=>(await preview(page)).loading).toBe(true);await opening;await expect.poll(async()=>(await preview(page)).loading).toBe(false);
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents)?.getVisible()),true);
  await writeFile('artifacts/verification/project-preview-app.png',Buffer.from(await desktop.evaluate(async({webContents})=>(await webContents.getAllWebContents().find(w=>!w.getLastWebPreferences().preload).capturePage()).toPNG().toString('base64')),'base64'));
  await writeFile('artifacts/verification/project-preview.png',Buffer.from(await desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64')),'base64'));
  for(const path of ['/redirect','/file']){await page.getByRole('textbox',{name:'Local preview URL'}).fill(server.url+path);await page.getByRole('button',{name:'Open app',exact:true}).click();await expect.poll(async()=>(await preview(page)).error).not.toBe('');assert.equal(outsideHits,0);}
  await page.getByRole('textbox',{name:'Local preview URL'}).fill(server.url);await page.getByRole('button',{name:'Open app',exact:true}).click();await expect.poll(async()=>(await preview(page)).error).toBe('');
  await page.getByRole('button',{name:/^Notifications/}).click();await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents)?.getVisible())).toBe(false);await page.getByRole('button',{name:'Close notifications'}).click();await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents)?.getVisible())).toBe(true);
  const visible=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents).some(v=>v.getVisible()));
  const liveUrl=page.url();await page.reload();await page.getByRole('navigation',{name:'Run inspector'}).waitFor();
  assert.equal(await page.locator('.project-preview').count(),0);await expect(page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Overview',exact:true})).toHaveClass('on');await expect.poll(visible).toBe(false);
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Preview',exact:true}).click();await expect.poll(visible).toBe(true);assert.equal((await preview(page)).url,server.url+'/');
  await page.goto(new URL('index.html',page.url()).href);await page.getByRole('button',{name:'Open your profile'}).waitFor();assert.equal(await page.locator('.project-preview').count(),0);await expect.poll(visible).toBe(false);
  await page.goto(liveUrl);await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Preview',exact:true}).click();await expect.poll(visible).toBe(true);
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Terminal',exact:true}).click();assert.equal((await shell(page,target)).id,current.id);await page.getByRole('button',{name:'Close shell',exact:true}).click();await expect.poll(()=>dead(server.pid)).toBe(true);await expect.poll(async()=>(await shell(page,target)).status).toBe('exited');
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Retry / Reload',exact:true}).click();await expect.poll(async()=>(await preview(page)).error).toContain('could not load');
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Terminal',exact:true}).click();await page.getByRole('button',{name:'New shell',exact:true}).click();await expect.poll(async()=>(await shell(page,target))?.status).toBe('running');const next=await shell(page,target);await write(page,next.id,'exit 7\r');await expect.poll(async()=>(await shell(page,target)).status).toBe('exited');assert.equal((await shell(page,target)).exitCode,7);
  // Registered workspace and run scopes stay distinct; a second checkout is not caller supplied.
  const ws=(await page.evaluate(()=>window.theseus.getExecutionState())).workspace;
  const workspaceShell=await page.evaluate(target=>window.theseus.openProjectShell({target,size:{cols:80,rows:24}}),{workspaceId:ws.id});assert.notEqual(workspaceShell.id,next.id);
  await page.evaluate(location=>window.theseus.saveWorktreePreferences({location,removeMerged:false}),join(root,'worktrees'));
  const isolated=await page.evaluate(workspaceId=>window.theseus.startAgentRun({workspaceId,task:'Isolated checkout fixture',useWorktree:true}),ws.id);await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(r=>r.id===isolated.id)?.status).toBe('completed');
  const isolatedRun=(await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(r=>r.id===isolated.id);
  const isolatedShell=await page.evaluate(target=>window.theseus.openProjectShell({target,size:{cols:80,rows:24}}),{runId:isolated.id});assert.equal(isolatedShell.projectPath,isolatedRun.executionPath);assert.notEqual(isolatedShell.projectPath,project);
  assert.ok((await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(r=>r.id===runId).output.some(entry=>entry.text==='Distinct Codex event output'));
  await write(page,workspaceShell.id,'sleep 60 & echo CLEANUP_PID:$!\r');await expect.poll(async()=>/CLEANUP_PID:\d+/.test((await shell(page,{workspaceId:ws.id})).output)).toBe(true).catch(async e=>{console.log('CLEANUP OUTPUT',JSON.stringify((await shell(page,{workspaceId:ws.id})).output));throw e;});const childPid=Number((await shell(page,{workspaceId:ws.id})).output.match(/CLEANUP_PID:(\d+)/)[1]);
  await page.evaluate(()=>window.theseus.stopAllExecution());await expect.poll(()=>dead(childPid)).toBe(true);assert.equal((await shell(page,{workspaceId:ws.id})).status,'exited');assert.equal((await shell(page,{runId:isolated.id})).status,'exited');
  const finalShell=await page.evaluate(target=>window.theseus.openProjectShell({target,size:{cols:80,rows:24}}),{workspaceId:ws.id});await write(page,finalShell.id,'sleep 60 & echo QUIT_PID:$!\r');await expect.poll(async()=>/QUIT_PID:\d+/.test((await shell(page,{workspaceId:ws.id})).output)).toBe(true);const quitPid=Number((await shell(page,{workspaceId:ws.id})).output.match(/QUIT_PID:(\d+)/)[1]);
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('textbox',{name:'Local preview URL'}).fill(outsideUrl);await page.getByRole('button',{name:'Open app',exact:true}).click();await expect.poll(visible).toBe(true);await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());await expect.poll(visible).toBe(false);
  await desktop.close();desktop=undefined;await expect.poll(()=>dead(quitPid)).toBe(true);page=await launch();await assert.rejects(()=>shell(page,{workspaceId:ws.id}));assert.equal(await shell(page,target),null);
  assert.deepEqual(errors,[]);console.log('PASS real Electron PTY input/read/Ctrl+C/resize/reconnect/exit/restart, actual app launch/discovery/render/loading/failure/retry/isolation/origin/resource/redirect/modal checks, project+worktree scopes, Stop all and quit process teardown; no provider calls.');
}finally{await desktop?.close();await new Promise(r=>outside.close(r));await rm(root,{recursive:true,force:true});}
