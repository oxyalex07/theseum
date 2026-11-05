// Real Electron and IPC with a local fake Codex executable; no provider calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-profile-lifecycle-')));
const directory=join(root,'data'),project=join(root,'project'),binary=join(root,'codex');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
await writeFile(binary,'#!/bin/sh\ncase "$*" in\n*app-server*) exit 1;;\n--version) sleep 0.1; echo "fixture codex";;\nlogin*) exit 0;;\n*exec*) cat >/dev/null; sleep 30;;\n*) echo "[]";;\nesac\n',{mode:0o700});
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:directory,THESEUS_CODEX_PATH:binary};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
async function agents(page){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Agents',exact:true}).click();}
async function home(page){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();}
async function records(page){return (await page.evaluate(()=>window.theseus.listAgentProfiles())).profiles;}
async function change(page,profile,action){return page.evaluate(({profile,action})=>window.theseus.changeAgentProfile({id:profile.id,expectedUpdatedAt:profile.updatedAt,action}),{profile,action});}
try{
  let page=await launch();
  await agents(page);await page.getByRole('button',{name:'Create agent',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.getByLabel('Name · required',{exact:true}).fill('Lifecycle agent');
  await dialog.getByRole('button',{name:'Create agent',exact:true}).click();await expect(dialog).toHaveCount(0);
  let profile=(await records(page))[0];const original=structuredClone(profile);
  await page.getByRole('button',{name:'Use agent',exact:true}).click();
  await expect(page.getByLabel('Run agent')).toHaveValue(profile.id);
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Keep this draft');
  await agents(page);await page.getByRole('button',{name:'Archive',exact:true}).click();
  await expect(page.getByRole('button',{name:'Archived (1)',exact:true})).toBeVisible();
  await home(page);await expect(page.getByLabel('Run agent')).toHaveValue('');
  assert.equal(await page.getByLabel('Run agent').locator('option').count(),1);
  assert.equal(await page.getByRole('textbox',{name:'Start a task',exact:true}).inputValue(),'Keep this draft');
  await assert.rejects(()=>page.evaluate(id=>window.theseus.useAgentProfile(id),profile.id),/archived/);
  await page.getByRole('button',{name:'Open your profile',exact:true}).click();
  await expect(page.getByRole('button',{name:/Saved agents/})).toContainText('0');
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Library',exact:true}).click();
  assert.equal(await page.locator(`[data-library-id="${profile.id}"]`).count(),0);
  await desktop.close();desktop=undefined;page=await launch();
  await agents(page);await page.getByRole('button',{name:'Archived (1)',exact:true}).click();
  await page.screenshot({path:'artifacts/verification/agents-archived.png'});
  await page.getByRole('button',{name:'Restore',exact:true}).click();
  await page.getByRole('button',{name:'Active (1)',exact:true}).click();
  await page.getByRole('button',{name:'Use agent',exact:true}).click();await expect(page.getByLabel('Run agent')).toHaveValue(profile.id);
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());profile=(await records(page))[0];
  await assert.rejects(()=>change(page,original,'delete'),/changed/);
  // Deletion during asynchronous runtime discovery must invalidate the pending start.
  const raceResult=await page.evaluate(async({workspace,profile})=>{
    const race=await window.theseus.saveAgentProfile({...profile,id:undefined,expectedUpdatedAt:undefined,name:'Pending start fixture',folderChoice:null});
    const starting=window.theseus.startAgentRun({workspaceId:workspace.id,task:'Must never launch',profileId:race.id,profileUpdatedAt:race.updatedAt}).then(()=>'',e=>e.message);
    await window.theseus.changeAgentProfile({id:race.id,expectedUpdatedAt:race.updatedAt,action:'delete'});
    return starting;
  },{workspace,profile});
  assert.match(raceResult,/not found/);
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).runs.length,0);
  const run=await page.evaluate(({workspace,profile})=>window.theseus.startAgentRun({workspaceId:workspace.id,task:'Fixture task',profileId:profile.id,profileUpdatedAt:profile.updatedAt}),{workspace,profile});
  await assert.rejects(()=>change(page,profile,'delete'),/active run/);
  await agents(page);await page.getByRole('button',{name:'Archive',exact:true}).click();
  profile=(await records(page))[0];await assert.rejects(()=>change(page,profile,'delete'),/active run/);
  assert.deepEqual((await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===run.id).agentConfiguration.profile,run.agentConfiguration.profile);
  await page.evaluate(id=>window.theseus.cancelAgentRun(id),run.id);
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===run.id).status).toBe('cancelled');
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Library',exact:true}).click();
  await page.getByRole('button',{name:'Run history',exact:true}).click();
  await page.locator(`[data-history-id="${run.id}"]`).getByRole('button',{name:'Review rerun',exact:true}).click();
  await expect(page.getByLabel('Run agent')).toHaveValue('');
  await expect(page.getByRole('status').filter({hasText:'Review rerun:'})).toContainText('original agent is unavailable');
  await agents(page);await page.getByRole('button',{name:'Archived (1)',exact:true}).click();
  await page.getByRole('button',{name:'Restore',exact:true}).click();await page.getByRole('button',{name:'Active (1)',exact:true}).click();
  await page.getByRole('button',{name:'Use agent',exact:true}).click();await expect(page.getByLabel('Run agent')).toHaveValue(profile.id);
  await agents(page);await page.getByRole('button',{name:'Delete…',exact:true}).click();dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Keep agent',exact:true})).toBeFocused();
  await dialog.getByRole('button',{name:'Keep agent',exact:true}).click();assert.equal((await records(page)).length,1);
  await page.getByRole('button',{name:'Delete…',exact:true}).click();dialog=page.getByRole('dialog');
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await page.screenshot({path:'artifacts/verification/agents-delete-confirmation.png'});
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await dialog.getByRole('button',{name:'Delete agent',exact:true}).click();await expect(dialog).toHaveCount(0);
  await home(page);await expect(page.getByLabel('Run agent')).toHaveValue('');
  await desktop.close();desktop=undefined;page=await launch();
  assert.equal((await records(page)).length,0);
  const savedRun=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===run.id);
  assert.deepEqual(savedRun.agentConfiguration.profile,run.agentConfiguration.profile);assert.equal(savedRun.status,'cancelled');
  assert.deepEqual(errors,[]);
  console.log('PASS archive/restore/delete UI and IPC, stale changes, active-run protection, selection and draft preservation, restart persistence, immutable history, confirmation keyboard focus and layout; no provider calls');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
