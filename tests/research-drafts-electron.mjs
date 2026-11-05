// Real app navigation and process restart, disposable profile, saved-run fixtures.
// No providers, fixed ports, credentials or external requests.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-drafts-55-'))),profile=join(root,'profile'),project=join(root,'project');
await mkdir(project);await mkdir(join(profile,'run-history'),{recursive:true});await mkdir('artifacts/verification',{recursive:true});
const runs=['Research A','Research B'].map(task=>({id:randomUUID(),workspaceId:randomUUID(),revision:1,projectName:'fixture',projectPath:project,task,status:'completed',startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),output:[{sequence:1,kind:'message',text:`${task} saved findings`}],truncated:false,agentConfiguration:{runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:1800}}));
for(const run of runs)await writeFile(join(profile,'run-history',`${run.id}.json`),JSON.stringify({version:1,run}));
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:'/usr/bin/false'};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;
  desktop=await _electron.launch({args:['.'],env});
  const page=await desktop.firstWindow();
  await desktop.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.hide();window.on('show',()=>window.hide());});
  page.on('pageerror',error=>errors.push(error.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  return page;
}
const saved=(page,id)=>page.evaluate(runId=>window.theseus.getResearch({runId}),id);
async function open(page,id){
  await page.getByRole('button',{name:'Run history',exact:true}).click();await page.locator(`[data-history-id="${id}"] .history-open`).click();
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Research',exact:true}).click();
  const panel=page.getByRole('region',{name:'Saved research workspace'});await expect(panel).toHaveAttribute('aria-busy','false');return panel;
}
async function unloadChoice(choice){await desktop.evaluate(({dialog},choice)=>{dialog.showMessageBoxSync=(_owner,options)=>{globalThis.lastDraftUnload=options;return choice;};},choice);}
const home=page=>page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'Home',exact:true}).click();
const recovery=page=>page.getByRole('region',{name:'Recoverable Research drafts'}).getByRole('button');
async function capture(name){
  let timer;try{
    const bytes=await Promise.race([desktop.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64')),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Native screenshot capture timed out.')),10000);})]);
    await writeFile(`artifacts/verification/${name}.png`,Buffer.from(bytes,'base64'));
  }finally{clearTimeout(timer);}
}
try{
  let page=await launch(),panel=await open(page,runs[0].id);
  await panel.getByRole('button',{name:'Create draft from results'}).click();
  const initial=(await saved(page,runs[0].id)).document;
  await panel.getByRole('textbox',{name:'Draft Markdown'}).fill('UNSAVED_USER_RESEARCH');
  await expect(recovery(page)).toContainText('(1)');
  // Exact reported normal navigation, followed by session-switch isolation.
  await home(page);panel=await open(page,runs[0].id);await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('UNSAVED_USER_RESEARCH');
  panel=await open(page,runs[1].id);await panel.getByRole('button',{name:'Create draft from results'}).click();await panel.getByRole('textbox',{name:'Draft Markdown'}).fill('SECOND_RUN_DRAFT');
  panel=await open(page,runs[0].id);await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('UNSAVED_USER_RESEARCH');
  assert.equal((await saved(page,runs[0].id)).document.artifacts.draft.content,initial.artifacts.draft.content);
  // Native unload guard is global, even after navigating Home.
  await home(page);await unloadChoice(0);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.reload());
  await expect.poll(()=>desktop.evaluate(()=>globalThis.lastDraftUnload?.message)).toBe('Leave with unsaved changes?');
  await expect(recovery(page)).toContainText('(2)');
  await unloadChoice(1);await page.reload();await expect(recovery(page)).toContainText('(2)');
  panel=await open(page,runs[0].id);await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('UNSAVED_USER_RESEARCH');
  // Independent artifact edits survive reload without being saved.
  await panel.getByRole('combobox',{name:'Research artifact'}).selectOption('outline');await panel.getByRole('button',{name:'Create outline from results'}).click();await panel.getByRole('textbox',{name:'Outline Markdown'}).fill('LOCAL_OUTLINE');
  await home(page);await unloadChoice(0);await desktop.evaluate(({app})=>{app.quit();});
  await expect.poll(()=>desktop.evaluate(()=>globalThis.lastDraftUnload?.detail)).toContain('save or discard');await expect(recovery(page)).toContainText('(3)');
  await unloadChoice(1);const exited=desktop.waitForEvent('close');await desktop.evaluate(({app})=>{app.quit();});await exited;desktop=undefined;
  page=await launch();await expect(recovery(page)).toContainText('(3)');
  panel=await open(page,runs[0].id);await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('UNSAVED_USER_RESEARCH');
  await panel.getByRole('combobox',{name:'Research artifact'}).selectOption('outline');await expect(panel.getByRole('textbox',{name:'Outline Markdown'})).toHaveValue('LOCAL_OUTLINE');
  // Deliberate discard affects only this run, distinct from all incidental navigation.
  await panel.getByRole('button',{name:'Discard edits and refresh'}).click();await expect(recovery(page)).toContainText('(1)');await expect(panel.getByRole('textbox',{name:'Outline Markdown'})).not.toHaveValue('LOCAL_OUTLINE');
  // Global explicit save path is available away from the editor.
  await home(page);await recovery(page).click();let dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Save draft',exact:true}).click();await expect(dialog).toContainText('No unsaved Research drafts.');await dialog.getByRole('button',{name:'Keep drafts and close'}).click();
  assert.equal((await saved(page,runs[1].id)).document.artifacts.draft.content,'SECOND_RUN_DRAFT');
  // An external artifact mutation must never be overwritten by recovered text.
  panel=await open(page,runs[0].id);await panel.getByRole('combobox',{name:'Research artifact'}).selectOption('draft');await panel.getByRole('textbox',{name:'Draft Markdown'}).fill('LOCAL_BEFORE_EXTERNAL');
  const before=(await saved(page,runs[0].id)).document;
  await page.evaluate(request=>window.theseus.saveResearch(request),{runId:runs[0].id,kind:'draft',revision:before.revision,content:'EXTERNAL_RESEARCH_CHANGE'});
  await home(page);panel=await open(page,runs[0].id);await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('LOCAL_BEFORE_EXTERNAL');
  await expect(panel).toContainText('Saved research changed');await panel.getByRole('button',{name:'Save draft',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Research changed');
  assert.equal((await saved(page,runs[0].id)).document.artifacts.draft.content,'EXTERNAL_RESEARCH_CHANGE');
  await panel.getByText('Current saved draft · your local edits are kept above',{exact:true}).click();await expect(panel.locator('pre').filter({hasText:'EXTERNAL_RESEARCH_CHANGE'})).toBeVisible();
  await capture('issue-55-conflict');
  await home(page);await recovery(page).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Save draft',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Research changed');await expect(dialog.getByRole('alert')).not.toContainText('Error invoking remote method');await expect(dialog).toContainText('LOCAL_BEFORE_EXTERNAL');
  await desktop.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.removeAllListeners('show');window.setSize(1100,700);window.showInactive();});await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth),true);assert.equal(await page.locator('.sbar').evaluate(element=>element.scrollWidth<=element.clientWidth),true);await capture('issue-55-recovery-1100');await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());

  await dialog.getByRole('button',{name:'Discard draft edits',exact:true}).click();await dialog.getByRole('button',{name:'Keep drafts and close'}).click();await expect(recovery(page)).toHaveCount(0);
  await page.reload();await expect(recovery(page)).toHaveCount(0);panel=await open(page,runs[0].id);await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('EXTERNAL_RESEARCH_CHANGE');
  // Saving through recovery while the panel is mounted updates its saved document too.
  await panel.getByRole('textbox',{name:'Draft Markdown'}).fill('SAVED_FROM_RECOVERY');await recovery(page).click();dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click();await expect(dialog).toContainText('No unsaved Research drafts.');await dialog.getByRole('button',{name:'Keep drafts and close'}).click();
  await expect(panel.getByRole('textbox',{name:'Draft Markdown'})).toHaveValue('SAVED_FROM_RECOVERY');await expect(panel.getByRole('button',{name:'Save draft',exact:true})).toBeDisabled();
  assert.deepEqual(errors,[]);
  console.log('PASS issue55 normal Home/history navigation, run/artifact isolation, synchronous local recovery, native reload/quit cancel+continue, full process restart, explicit global save/discard, intentional refresh, external revision rejection and current saved text review; no providers or ports.');
}finally{if(desktop){await unloadChoice(1);await desktop.close();}await rm(root,{recursive:true,force:true});}
