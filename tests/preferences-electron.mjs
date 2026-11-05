// Disposable Electron profile + fixture Codex; never contacts a provider.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile, chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'theseus-preferences-'));
const profile=join(root,'profile'),project=join(root,'project'),fake=join(root,'fixture-codex');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
await writeFile(fake,`#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);
if(args.includes('--version')){console.log('fixture preferences 1.0');process.exit(0);}
if(args.includes('login')){console.log('Logged in');process.exit(0);}
if(!args.includes('exec'))process.exit(1);
(async()=>{let task='';for await(const chunk of process.stdin)task+=chunk;
fs.appendFileSync(${JSON.stringify(join(root,'calls'))},task+'\\n');
console.log(JSON.stringify({type:'thread.started',thread_id:'33333333-3333-4333-8333-333333333333'}));
console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution',command:'echo fixture',aggregated_output:'fixture output',exit_code:0}}));
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Preference fixture finished'}}));
console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){
 const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
 desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('.app').waitFor();return page;
}
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();}
async function radio(page,label,name){await page.getByRole('radiogroup',{name:label,exact:true}).getByRole('radio',{name,exact:true}).click();}
try{
 let page=await launch();await nav(page,'Settings');
 await radio(page,'Open to','Last session');await radio(page,'Default space','Research');await radio(page,'Session layout','Split');await radio(page,'Density','Compact');
 await page.getByLabel('New sessions start with',{exact:true}).selectOption('quill');await page.getByRole('switch',{name:'Collapse tool cards',exact:true}).click();
 await page.reload();await nav(page,'Settings');
 await expect(page.getByRole('radiogroup',{name:'Open to',exact:true}).getByRole('radio',{name:'Last session',exact:true})).toHaveAttribute('aria-checked','true');
 await expect(page.getByRole('radiogroup',{name:'Default space',exact:true}).getByRole('radio',{name:'Research',exact:true})).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.app')).toHaveClass(/density-compact/);
 await nav(page,'Home');await expect(page.locator('.side .ss').filter({hasText:'Streak chart on habit screen'})).toHaveCount(0);await expect(page.locator('.side .ss').filter({hasText:'Draft: Weekly AI notes #12'})).toHaveCount(1);await radio(page,'Execution mode','Demo crew');
 await expect(page.locator('.who-pick button.on')).toContainText('Quill');
 await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Preference demo task');await page.getByRole('button',{name:'Start',exact:true}).click();
 await expect(page.locator('.stage')).toHaveClass(/split/);await expect(page.locator('.stage .cv').first().locator('.ttl')).toContainText('Quill');
 await page.screenshot({path:'artifacts/verification/preferences-demo.png'});
 // Open a known demo with tool output through explicit navigation; query wins over persisted defaults.
 const url=new URL(page.url());url.search='?s=c1&view=focus&space=code&static=1';await page.goto(url.href);
 await expect(page.locator('.stage')).not.toHaveClass(/split/);await expect(page.locator('.tl-h').first()).toHaveAttribute('aria-expanded','true');
 await page.locator('.tl-h').first().click();await expect(page.locator('.tl-h').first()).toHaveAttribute('aria-expanded','false');
 await nav(page,'Settings');await page.getByRole('switch',{name:'Collapse tool cards',exact:true}).click();
 await page.goto(url.href);await expect(page.locator('.tl-h').first()).toHaveAttribute('aria-expanded','false');
 // Live run gets the configured layout; reopening is display-only and must not execute again.
 await nav(page,'Settings');await radio(page,'Default space','All');await nav(page,'Home');
 await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
 await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
 await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Live preference task');await page.getByRole('button',{name:'Start Codex',exact:true}).click();
 await expect(page.locator('.stage')).toHaveClass(/split/);
 await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
 const run=(await page.evaluate(()=>window.theseus.getExecutionState())).runs[0];
 await desktop.close();desktop=undefined;page=await launch();
 await expect(page.locator(`[data-run-id="${run.id}"]`)).toBeVisible();await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
 assert.equal((await readFile(join(root,'calls'),'utf8')).trim().split('\n').length,1);
 await expect(page.locator('.live-output details').first()).not.toHaveAttribute('open','');
 await nav(page,'Settings');await page.getByRole('switch',{name:'Collapse tool cards',exact:true}).click();
 const liveUrl=new URL(page.url());liveUrl.search=`?s=${run.id}&view=focus`;await page.goto(liveUrl.href);
 await expect(page.locator(`[data-run-id="${run.id}"]`)).toBeVisible();await expect(page.locator('.live-output details').first()).toHaveAttribute('open','');
 await page.locator('.live-output summary').first().click();await expect(page.locator('.live-output details').first()).not.toHaveAttribute('open','');
 // Delayed run recovery must respect a Home click even when already showing Home.
 const execution=await page.evaluate(()=>window.theseus.getExecutionState());
 await desktop.evaluate(({ipcMain},state)=>{ipcMain.removeHandler('theseus:execution-state');ipcMain.handle('theseus:execution-state',async()=>{await new Promise(resolve=>setTimeout(resolve,900));return state;});},execution);
 await page.reload();await nav(page,'Home');await page.waitForTimeout(1100);await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toBeVisible();
 await nav(page,'Settings');await expect(page.getByLabel('New sessions start with',{exact:true})).toHaveValue('quill');
 await radio(page,'Open to','Home');await desktop.close();desktop=undefined;page=await launch();await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toBeVisible();
 // Saved defaults hydrate asynchronously. Explicit Run agent choice wins the race.
 const saved=await page.evaluate(()=>window.theseus.saveAgentProfile({name:'Preferred fixture',icon:'code',color:'green',description:'Fixture',runtime:'codex',model:null,reasoningEffort:null,instructions:'PREFERRED',memory:'none',sandbox:'workspace-write',timeoutSeconds:60,folderChoice:null}));
 await nav(page,'Settings');await page.reload();await nav(page,'Settings');await page.getByLabel('New sessions start with',{exact:true}).selectOption(`profile:${saved.id}`);
 await desktop.close();desktop=undefined;page=await launch();await expect(page.getByLabel('Run agent')).toHaveValue(saved.id);
 // Deliberately delay the list IPC before reloading, then choose runtime defaults.
 const state=await page.evaluate(()=>window.theseus.listAgentProfiles());
 await desktop.evaluate(({ipcMain},state)=>{ipcMain.removeHandler('theseus:list-agents');ipcMain.handle('theseus:list-agents',async()=>{await new Promise(resolve=>setTimeout(resolve,1200));return state;});},state);
 await page.reload();await page.getByLabel('Run agent').selectOption('');
 await expect(page.getByLabel('Run agent').locator('option')).toHaveCount(2);await expect(page.getByLabel('Run agent')).toHaveValue('');
 await page.evaluate(saved=>window.theseus.changeAgentProfile({id:saved.id,expectedUpdatedAt:saved.updatedAt,action:'archive'}),saved);
 await desktop.close();desktop=undefined;page=await launch();await expect(page.getByLabel('Run agent')).toHaveValue('');await expect(page.getByText('Default saved agent is unavailable. Codex defaults are selected.',{exact:true})).toBeVisible();
 await page.evaluate(()=>{const key='theseus.renderer-preferences';const data=JSON.parse(localStorage.getItem(key));data.general.dag='profile:missing';localStorage.setItem(key,JSON.stringify(data));});
 await page.reload();await expect(page.getByLabel('Run agent')).toHaveValue('');await expect(page.getByText('Default saved agent is unavailable. Codex defaults are selected.',{exact:true})).toBeVisible();
 assert.deepEqual(errors,[]);
 console.log('PASS General preferences: reload/full restart, demo agent, space/layout, density, tool initial state/manual toggle, explicit query overrides, live layout/recovered last run without re-execution, Home startup; no provider calls');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
