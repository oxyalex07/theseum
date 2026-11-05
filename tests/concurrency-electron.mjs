// Actual Electron IPC, disposable Git worktrees, and local fixture processes. No provider calls.
import { _electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-concurrency-')));
const profile=join(root,'profile'),project=join(root,'project'),fake=join(root,'codex');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
const git=(...args)=>execFileSync('git',['-C',project,...args],{encoding:'utf8'});
git('init','-b','main');git('config','user.email','fixture@example.com');git('config','user.name','Fixture');
await writeFile(join(project,'source'),'initial');git('add','.');git('commit','-m','Initial');
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1');process.exit(0);}
if(process.argv.includes('login'))process.exit(0);
let task='';process.stdin.on('data',c=>task+=c);process.stdin.on('end',()=>{
 const fs=require('node:fs'),path=require('node:path');
 fs.writeFileSync('fixture-output',JSON.stringify({task,pid:process.pid,cwd:process.cwd()}));
 const timer=setInterval(()=>{if(fs.existsSync(path.join(${JSON.stringify(root)},'finish-'+task))){clearInterval(timer);console.log(JSON.stringify({type:'turn.completed'}));}},50);
});
`,{mode:0o700});
let desktop;const errors=[];
async function launch(){
 const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};
 delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
 desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
try{
 let page=await launch();
 await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
 const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());
 await page.evaluate(location=>window.theseus.saveWorktreePreferences({location,removeMerged:false}),join(root,'worktrees'));
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Models & usage',exact:true}).click();
 await page.getByRole('combobox',{name:'Agent slots',exact:true}).selectOption('2');
 await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getDesktopState())).preferences.slots).toBe(2);
 await page.getByRole('combobox',{name:'When execution is busy'}).selectOption('ask');
 await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getDesktopState())).preferences.overflow).toBe('ask');
 await page.screenshot({path:'artifacts/verification/concurrency-settings.png'});
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
 await page.waitForFunction(()=>window.innerWidth===1100);
 assert.equal(await page.locator('.page-w').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:'artifacts/verification/concurrency-settings-1100.png'});
 await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
 const start=task=>page.evaluate(({id,task})=>window.theseus.startAgentRun({workspaceId:id,task,useWorktree:true}),{id:workspace.id,task});
 const runs=()=>page.evaluate(async()=>(await window.theseus.getExecutionState()).runs);
 const status=async id=>(await runs()).find(r=>r.id===id)?.status;
 const [one,two]=await Promise.all([start('one'),start('two')]);
 await expect.poll(()=>status(one.id)).toBe('running');await expect.poll(()=>status(two.id)).toBe('running');
 const live=await runs();assert.notEqual(live[0].executionPath,live[1].executionPath);
 await expect.poll(async()=>JSON.parse(await readFile(join(live[0].executionPath,'fixture-output'),'utf8')).task).toBe('one');
 await desktop.evaluate(({dialog})=>{globalThis.queuePrompts=0;dialog.showMessageBox=async()=>{globalThis.queuePrompts++;return {response:0};};});
 await assert.rejects(()=>start('declined'),/not queued/);assert.equal((await runs()).length,2);
 await desktop.evaluate(({dialog})=>{dialog.showMessageBox=async()=>{globalThis.queuePrompts++;return {response:1};};});
 const three=await start('three');assert.equal(three.status,'queued');assert.equal(await desktop.evaluate(()=>globalThis.queuePrompts),2);
 assert.equal((await runs()).find(r=>r.id===three.id).worktreeId,undefined);
 assert.match(await page.locator('.slots').textContent(),/2\/2 live · 1 queued/);
 await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start Codex',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Run history',exact:true}).click();
 await page.locator(`[data-history-id="${three.id}"] .history-open`).click();
 await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','queued');
 await page.screenshot({path:'artifacts/verification/concurrency-queued.png'});
 await page.getByRole('button',{name:'Cancel run',exact:true}).click();
 await expect.poll(()=>status(three.id)).toBe('cancelled');assert.equal(await status(two.id),'running');
 const four=await start('four');assert.equal(four.status,'queued');
 await writeFile(join(root,'finish-one'),'done');
 await expect.poll(()=>status(one.id)).toBe('completed');await expect.poll(()=>status(four.id)).toBe('running');
 assert.equal(await status(two.id),'running');
 await page.evaluate(()=>window.theseus.stopAllExecution());
 assert.equal(await status(two.id),'cancelled');assert.equal(await status(four.id),'cancelled');
 await desktop.close();desktop=undefined;page=await launch();
 assert.equal((await page.evaluate(()=>window.theseus.getDesktopState())).preferences.slots,2);
 assert.equal((await page.evaluate(()=>window.theseus.getDesktopState())).preferences.overflow,'ask');
 const restored=await runs();assert.equal(restored.length,4);assert.equal(restored.find(r=>r.id===three.id).status,'cancelled');
 assert.deepEqual(errors,[]);
 console.log('PASS live capacity, simultaneous real worktree creation, overflow prompt accept/decline, queued UI/cancellation, automatic drain, per-run ownership, Stop all, preferences/history restart, 1100px layout; no provider calls');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
