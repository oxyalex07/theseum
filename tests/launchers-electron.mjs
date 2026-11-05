import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'theseus-launcher-ui-'));
const project=join(root,'downloaded agent');await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:join(root,'profile')};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('button',{name:'Open your profile'}).waitFor();await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Agents',exact:true}).click();await page.getByRole('button',{name:'GitHub launchers',exact:true}).click();return page;}
try{
  let page=await launch();await expect(page.getByRole('heading',{name:'Stop hunting for that command'})).toBeVisible();
  await desktop.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},project);
  await page.getByRole('button',{name:'Add launcher',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Code reviewer');await page.getByLabel('GitHub repository',{exact:true}).fill('https://github.com/example/reviewer');await page.getByLabel('Description · optional').fill('Review my changes with the downloaded agent.');await page.getByLabel('Launch command',{exact:true}).fill('claude --agent reviewer');await page.getByRole('button',{name:'Choose folder',exact:true}).click();await page.getByRole('button',{name:'Save launcher',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Code reviewer',exact:true})).toBeVisible();
  let state=await page.evaluate(()=>window.theseus.getAgentLaunchers());assert.equal(state.launchers.length,1);assert.equal(state.launchers[0].folder.endsWith('downloaded agent'),true);assert.equal(state.launchers[0].lastLaunchedAt,null);
  await assert.rejects(()=>page.evaluate(()=>window.theseus.saveAgentLauncher({name:'Forged',description:'',repository:'https://github.com/example/reviewer',runtime:'codex',command:'pwd',folderChoice:'/tmp'})));
  await assert.rejects(()=>page.evaluate(r=>window.theseus.launchAgentLauncher(r.id,'stale'),state.launchers[0]));
  await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Repository reviewer');await page.getByLabel('Runs with').selectOption('codex');await page.getByLabel('Launch command',{exact:true}).fill('codex');await page.getByRole('button',{name:'Save launcher',exact:true}).click();
  await page.getByLabel('Search agent launchers').fill('nothing-matches');await expect(page.getByRole('heading',{name:'No matching launchers'})).toBeVisible();await page.getByLabel('Search agent launchers').fill('');
  await page.getByLabel('Search agent launchers').blur();
  await page.screenshot({path:'artifacts/verification/agent-launchers.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await page.screenshot({path:'artifacts/verification/agent-launchers-minimum.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  await page.getByRole('button',{name:'Edit',exact:true}).click();await page.screenshot({path:'artifacts/verification/agent-launcher-editor.png'});await page.getByRole('button',{name:'Save launcher',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/verification/agent-launcher-editor-bottom.png'});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await desktop.close();desktop=undefined;page=await launch();await expect(page.getByRole('heading',{name:'Repository reviewer',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remove Repository reviewer',exact:true}).click();await page.getByRole('button',{name:'Keep',exact:true}).click();assert.equal((await page.evaluate(()=>window.theseus.getAgentLaunchers())).launchers.length,1);
  await page.getByRole('button',{name:'Remove Repository reviewer',exact:true}).click();await page.getByRole('button',{name:'Remove launcher',exact:true}).click();await expect(page.getByRole('heading',{name:'Stop hunting for that command'})).toBeVisible();
  assert.deepEqual(errors,[]);const saved=JSON.parse(await readFile(join(root,'profile','agent-launchers.json'),'utf8'));assert.equal(saved.launchers.length,0);
  console.log('PASS launcher UI, IPC validation, create/edit/search, restart persistence, remove/keep; native terminal handoff covered by unit tests.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
