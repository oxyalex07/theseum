// Fixture runtime integration; exercises real Electron/IPC/UI without provider calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile, readFile, realpath, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-continuation-')));
const profile=join(root,'profile'),project=join(root,'project'),codexHome=join(root,'codex');
const threadId='33333333-3333-4333-8333-333333333333';
const session=join(codexHome,'sessions','2026','10','24',`rollout-test-${threadId}.jsonl`);
await mkdir(project);await mkdir(join(codexHome,'sessions','2026','10','24'),{recursive:true});
await mkdir('artifacts/verification',{recursive:true});
const fake=join(root,'fixture-codex');
await writeFile(fake,`#!${process.execPath}
const fs=require('node:fs');
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('fixture continuation 1.0');process.exit(0);}
if(args.includes('login')){console.log('Logged in');process.exit(0);}
if(!args.includes('exec'))process.exit(1);
(async()=>{
  let task='';for await(const chunk of process.stdin)task+=chunk;
  fs.appendFileSync(${JSON.stringify(join(root,'calls.jsonl'))},JSON.stringify({args,cwd:process.cwd(),task})+'\\n');
  if(!args.includes('resume'))fs.writeFileSync(${JSON.stringify(session)},'{}\\n');
  if(task!=='Unconfirmed fixture turn')console.log(JSON.stringify({type:'thread.started',thread_id:task==='Wrong thread fixture turn'?'44444444-4444-4444-8444-444444444444':task==='Malformed thread fixture turn'?'--last':${JSON.stringify(threadId)}}));
  console.log(JSON.stringify({type:'turn.started'}));
  await new Promise(r=>setTimeout(r,700));
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Fixture reply: '+task}}));
  console.log(JSON.stringify({type:'turn.completed'}));
})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake,CODEX_HOME:codexHome};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
const runs=page=>page.evaluate(async()=>(await window.theseus.getExecutionState()).runs);
const open=async(page,id)=>{await page.getByRole('button',{name:'Run history',exact:true}).click();await page.locator(`[data-history-id="${id}"] .history-open`).click();};
try{
  let page=await launch();
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Initial fixture task');
  await page.getByRole('button',{name:'Start Codex',exact:true}).click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','running');
  await expect(page.getByRole('button',{name:'Send follow-up',exact:true})).toBeDisabled();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  const first=(await runs(page))[0];assert.equal(first.threadId,threadId);
  await desktop.close();desktop=undefined;
  page=await launch();await open(page,first.id);
  const draft=page.getByRole('textbox',{name:'Follow-up message',exact:true});
  await draft.fill('Continue the existing conversation');
  await page.getByRole('button',{name:'Send follow-up',exact:true}).click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','running');
  await assert.rejects(()=>page.evaluate(run=>window.theseus.continueAgentRun({runId:run.id,task:'overlap',expectedRevision:run.revision}),first));
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  assert.equal((await runs(page)).length,1);assert.equal((await runs(page))[0].id,first.id);
  await expect(page.getByRole('log')).toContainText('Fixture reply: Continue the existing conversation');
  const calls=(await readFile(join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length,2);assert.deepEqual(calls[1].args.slice(-3),['resume',threadId,'-']);assert.equal(calls[1].cwd,project);assert.equal(calls[1].task,'Continue the existing conversation');
  assert.equal(calls[1].args.includes('--ephemeral'),false);
  await page.screenshot({path:'artifacts/verification/continuation-completed.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,760));
  await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  const form=page.locator('.live-follow-up');assert.equal(await form.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'artifacts/verification/continuation-small.png'});
  // An incompatible resume implementation cannot contaminate the saved conversation.
  for(const task of ['Unconfirmed fixture turn','Malformed thread fixture turn','Wrong thread fixture turn']){
    await draft.fill(task);await draft.press('Enter');
    await expect(page.getByRole('log')).toContainText(task);
    await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','failed');
    const current=(await runs(page))[0];assert.equal(current.threadId,threadId);
    assert.match(current.error,/thread/);assert.equal(current.output.some(entry=>entry.text==='Fixture reply: '+task),false);
    assert.equal((await runs(page)).length,1);
  }
  // A verified retry after failure still uses the original thread and conversation.
  await draft.fill('Verified recovery');await draft.press('Enter');
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','running');
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  await expect(page.getByRole('log')).toContainText('Fixture reply: Verified recovery');
  const executed=(await readFile(join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(executed.length,6);assert.ok(executed.slice(1).every(call=>call.args.slice(-3).join(' ')==='resume '+threadId+' -'));
  // Missing runtime files fail before any execution; the accepted message remains in history.
  await rm(session);await draft.fill('Try the missing saved thread');await draft.press('Enter');
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','failed');
  await expect(page.getByRole('log')).toContainText('unavailable or expired');
  assert.equal((await readFile(join(root,'calls.jsonl'),'utf8')).trim().split('\n').length,executed.length);
  // Rejected submissions retain the draft and present a persistent inline error.
  await draft.fill('Keep this rejected draft');
  await desktop.evaluate(({ipcMain})=>{ipcMain.removeHandler('theseus:continue-run');ipcMain.handle('theseus:continue-run',()=>{throw new Error('Fixture continuation rejection');});});
  await page.getByRole('button',{name:'Send follow-up',exact:true}).click();
  await expect(page.locator('.live-follow-up').getByRole('alert')).toContainText('Fixture continuation rejection');
  await expect(draft).toHaveValue('Keep this rejected draft');
  await page.screenshot({path:'artifacts/verification/continuation-unavailable.png'});
  await desktop.close();desktop=undefined;
  // Restore a legacy run without a runtime identifier and verify explicit disabled UI.
  const file=join(profile,'run-history',`${first.id}.json`),stored=JSON.parse(await readFile(file,'utf8'));delete stored.run.threadId;
  await writeFile(file,JSON.stringify(stored));page=await launch();await open(page,first.id);
  await expect(page.getByRole('textbox',{name:'Follow-up message',exact:true})).toBeDisabled();
  await expect(page.locator('.live-follow-up')).toContainText('no saved Codex thread');
  assert.deepEqual(errors,[]);
  console.log('PASS fixture continuation: composer, active exclusion, exact thread/stdin/cwd, single conversation across restart, unconfirmed/malformed/wrong-thread refusal, verified recovery, missing-session refusal, legacy disabled UI, responsive screenshots; no provider calls');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
