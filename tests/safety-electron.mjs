// Uses real Electron/IPC and shell processes, with no model calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'theseus-safety-e2e-'));
const profile=join(root,'profile'),project=join(root,'project');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:join(root,'no-codex')};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'Open your profile'}).waitFor();return page;
}
async function openSafety(page){
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Approvals & safety',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Run time limit'})).toBeEnabled();
}
try{
  let page=await launch();await openSafety(page);
  const state=await page.evaluate(()=>window.theseus.getSafetyState());
  assert.equal(state.capabilities.pendingApprovals,false);assert.equal(state.capabilities.commandAllowlist,false);
  for(const patch of [{network:'on'},{askFirst:true},{commandAllowlist:['rm']},{approval:'on-request'},{timeoutSeconds:0},{stepTimeout:30}]){
    await assert.rejects(()=>page.evaluate(patch=>window.theseus.getSafetyState().then(state=>window.theseus.saveSafetyPolicy({...state.policy,...patch})),patch));
  }
  await page.getByRole('combobox',{name:'Run time limit'}).selectOption('60');
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getSafetyState())).policy.timeoutSeconds).toBe(60);
  await page.reload();await openSafety(page);assert.equal(await page.getByRole('combobox',{name:'Run time limit'}).inputValue(),'60');
  await page.screenshot({path:'artifacts/verification/safety-settings.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await page.waitForFunction(()=>window.innerWidth<=1100);
  await page.screenshot({path:'artifacts/verification/safety-settings-1100.png'});
  assert.equal(await page.locator('.page-w').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());
  // The renderer cannot supply its own permissions at the start boundary.
  await assert.rejects(()=>page.evaluate(workspace=>window.theseus.startAgentRun({workspaceId:workspace.id,task:'test',safetyPolicy:{network:'on'}}),workspace));
  const run=await page.evaluate(workspace=>window.theseus.startAgentRun({workspaceId:workspace.id,task:'No executable is present; no provider calls can occur.'}),workspace);
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getExecutionState())).runs.at(-1)?.status).toBe('failed');
  assert.equal(run.agentConfiguration.timeoutSeconds,60);assert.equal(run.agentConfiguration.safetyPolicy.network,'off');
  await page.evaluate(workspace=>window.theseus.startTerminalCommand({workspaceId:workspace.id,command:'sleep 30 &\nprintf "child:%s\\n" "$!"\nwait'}),workspace);
  await expect.poll(async()=>/child:\d+/.test((await page.evaluate(()=>window.theseus.getTerminalState())).commands.at(-1)?.output??'')).toBe(true);
  const child=Number((await page.evaluate(()=>window.theseus.getTerminalState())).commands.at(-1).output.match(/child:(\d+)/)[1]);
  await page.getByRole('button',{name:'Stop all execution',exact:true}).click();
  await expect(page.getByText('All local execution stopped.',{exact:true})).toBeVisible();
  assert.equal((await page.evaluate(()=>window.theseus.getTerminalState())).commands.at(-1).status,'cancelled');
  await expect.poll(()=>{try{process.kill(child,0);return false;}catch{return true;}}).toBe(true);
  // Explicit commands can start again after stopping; Stop all is not a persistent pause.
  await page.evaluate(workspace=>window.theseus.startTerminalCommand({workspaceId:workspace.id,command:'printf restarted'}),workspace);
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getTerminalState())).commands.at(-1).status).toBe('completed');
  await desktop.close();desktop=undefined;page=await launch();await openSafety(page);
  assert.equal(await page.getByRole('combobox',{name:'Run time limit'}).inputValue(),'60');
  const restored=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===run.id);
  assert.equal(restored.agentConfiguration.safetyPolicy.timeoutSeconds,60);
  await desktop.close();desktop=undefined;
  await writeFile(join(profile,'safety-policy.json'),'{broken');page=await launch();
  assert.ok((await page.evaluate(()=>window.theseus.getSafetyState())).error);
  await assert.rejects(()=>page.evaluate(()=>window.theseus.startAgentRun({workspaceId:'11111111-1111-4111-8111-111111111111',task:'Must refuse damaged safety policy'})),/Safety policy/);
  assert.deepEqual(errors,[]);
  console.log('PASS capability gating, unsupported IPC rejection, durable policy, run snapshot, real process Stop all, subsequent explicit start, restart history, corrupt-policy refusal, 1100px layout; no model calls or renderer exceptions');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
