// Disposable profile + fixture runtime; no provider calls or account usage.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile, readFile, realpath, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-history-e2e-'))),profile=join(root,'profile'),project=join(root,'project');
await mkdir(join(profile,'run-history'),{recursive:true});await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
const record=(task,endedAt=new Date().toISOString())=>({id:randomUUID(),workspaceId:randomUUID(),revision:1,projectName:'project',projectPath:project,task,status:'completed',startedAt:endedAt,endedAt,output:[{sequence:1,kind:'message',text:'Saved fixture output'}],truncated:false,agentConfiguration:{runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:1800}});
const a=record('Review this saved task'),old=record('Expired task','2020-01-01T00:00:00.000Z'),missing=record('Missing project task');missing.projectPath=join(root,'missing');
for(const run of [a,old,missing])await writeFile(join(profile,'run-history',`${run.id}.json`),JSON.stringify({version:1,run}));
const fake=join(root,'fixture-codex');
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
(async()=>{for await(const chunk of process.stdin){} await new Promise(r=>setTimeout(r,1500));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;}
const history=async page=>{await page.getByRole('button',{name:'Run history',exact:true}).click();await page.getByRole('heading',{name:'Run history',exact:true}).waitFor();};
const state=page=>page.evaluate(()=>window.theseus.getRunHistory());
try{
  let page=await launch();await history(page);await expect(page.locator('[data-history-id]')).toHaveCount(3);
  for(const input of [{ids:['../outside']},{ids:[randomUUID()]},{all:true,ids:[]}])await assert.rejects(()=>page.evaluate(input=>window.theseus.deleteRunHistory(input),input));
  await assert.rejects(()=>page.evaluate(()=>window.theseus.setRunRetention('7')));
  await page.locator(`[data-history-id="${missing.id}"]`).getByRole('button',{name:'Review rerun'}).click();await page.getByRole('alert').filter({hasText:'missing, moved'}).waitFor();
  await page.locator(`[data-history-id="${a.id}"]`).getByRole('button',{name:'Review rerun'}).click();
  await page.getByRole('status').filter({hasText:'Review rerun:'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Start a task',exact:true}).inputValue(),a.task);assert.equal((await state(page)).runs.length,3,'Review does not execute');
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).workspace.path,project);
  await page.screenshot({path:'artifacts/verification/history-rerun.png'});
  const memory=await page.evaluate(run=>window.theseus.saveMemory({kind:'node',nodeType:'goal',label:'Retained source',meaning:'Keep this excerpt',scope:{kind:'project',projectPath:run.projectPath},source:{kind:'run-task',runId:run.id}}),a);
  await history(page);await page.locator(`[data-history-id="${a.id}"] input`).check();await page.getByRole('button',{name:'Delete selected (1)',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await state(page)).runs.length,3);
  await page.getByRole('button',{name:'Delete selected (1)',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete permanently',exact:true}).click();await expect(page.locator('[data-history-id]')).toHaveCount(2);
  assert.deepEqual((await page.evaluate(()=>window.theseus.getMemoryGraph())).records,memory.records);await assert.rejects(()=>readFile(join(profile,'run-history',`${a.id}.json`)));
  await page.reload();await history(page);await expect(page.locator('[data-history-id]')).toHaveCount(2);
  await page.getByLabel('Keep run history',{exact:true}).selectOption('30');await page.getByRole('dialog').getByRole('button',{name:'Apply retention'}).click();await expect(page.locator('[data-history-id]')).toHaveCount(1);assert.equal((await state(page)).retention,'30');
  // A fixture live run proves active protection through the actual IPC and runner.
  await desktop.evaluate(({dialog},project)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});},project);
  const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());
  const run=await page.evaluate(workspaceId=>window.theseus.startAgentRun({workspaceId,task:'Fixture live task'}),workspace.id);
  await assert.rejects(()=>page.evaluate(id=>window.theseus.deleteRunHistory({ids:[id]}),run.id));
  await assert.rejects(()=>page.evaluate(id=>window.theseus.prepareRunRerun(id),run.id));
  await page.evaluate(()=>window.theseus.deleteRunHistory({all:true}));assert.equal((await state(page)).runs.length,1);
  await expect.poll(async()=>(await state(page)).runs[0]?.status).toBe('completed');
  await expect(page.locator('[data-history-id]')).toHaveCount(1);await page.screenshot({path:'artifacts/verification/history-controls.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  assert.equal(await page.locator('.history-row').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'artifacts/verification/history-controls-small.png'});
  await page.locator(`[data-history-id="${run.id}"]`).getByRole('button',{name:'Review rerun'}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Edited and reviewed rerun');await page.getByRole('button',{name:'Start Codex',exact:true}).click();
  await expect.poll(async()=>(await state(page)).runs.find(r=>r.task==='Edited and reviewed rerun')?.status).toBe('completed');
  const rerun=(await state(page)).runs.find(r=>r.task==='Edited and reviewed rerun');assert.notEqual(rerun.id,run.id);assert.equal(rerun.projectPath,project);assert.deepEqual(rerun.memorySelection??[],[]);
  await desktop.close();desktop=undefined;
  // Enforcement on startup, including records added while the app was closed.
  const expired=record('Startup expiry','2020-01-01T00:00:00.000Z');await writeFile(join(profile,'run-history',`${expired.id}.json`),JSON.stringify({version:1,run:expired}));
  page=await launch();await history(page);await expect(page.locator('[data-history-id]')).toHaveCount(2);assert.equal((await state(page)).retention,'30');await assert.rejects(()=>readFile(join(profile,'run-history',`${expired.id}.json`)));
  await page.getByRole('textbox',{name:'Search run history'}).fill('does not match');await page.getByRole('button',{name:'Delete all finished runs',exact:true}).click();await page.getByRole('dialog').getByText(/hidden by search/).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Delete permanently'}).click();await expect.poll(async()=>(await state(page)).runs.length).toBe(0);
  assert.deepEqual((await page.evaluate(()=>window.theseus.getMemoryGraph())).records,memory.records);assert.deepEqual(errors,[]);
  console.log('PASS history selection/confirmation, validated IPC, physical deletion/reload, memory source preservation, rerun review/missing project, active protection, persisted retention/startup expiry, delete-all across search; no provider calls');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
