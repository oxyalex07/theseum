// Explicit integration test: uses the installed/authenticated Codex and may consume account usage.
// No fake agent executable, fabricated output, or forced run statuses are used here.
import { _electron } from '@playwright/test';
import { mkdir, mkdtemp, realpath, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const temporary=await realpath(await mkdtemp(join(tmpdir(),'theseus-agent-e2e-')));
await mkdir('artifacts/verification',{recursive:true});
const report=[];const errors=[];
let desktop;
async function launch(name,extra={}){
  const profile=join(temporary,`${name}-profile`);await mkdir(profile,{recursive:true});
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,...extra};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  return page;
}
async function choose(page,path){
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},path);
  await page.getByRole('button',{name:/^(Choose project folder|Change project)$/}).click();
  await page.getByText(path,{exact:true}).waitFor();
}
async function start(page,task){await page.getByRole('textbox',{name:'Start a task',exact:true}).fill(task);await page.getByRole('button',{name:'Start Codex',exact:true}).click();await page.getByTestId('run-status').waitFor();}
async function terminal(page,status,name,timeout=120000){
  await page.waitForFunction(()=>['completed','failed','cancelled'].includes(document.querySelector('[data-testid=run-status]')?.getAttribute('data-status')),{},{timeout});
  const run=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.at(-1);
  assert.equal(run.status,status,JSON.stringify({status:run.status,error:run.error,output:run.output.slice(-4)}));assert.ok(run.endedAt);
  await page.screenshot({path:`artifacts/verification/agent-${name}.png`});
  report.push({name,status:run.status,exitCode:run.exitCode,signal:run.signal,error:run.error,output:run.output});
  return run;
}
try{
  const project=join(temporary,'project');await mkdir(project);
  let page=await launch('real');
  const state=await page.evaluate(()=>window.theseus.getExecutionState());assert.equal(state.availability.authenticated,true,state.availability.message);
  await choose(page,project);
  await start(page,'Create success.txt in the current project containing exactly REAL_CODEX_OK followed by a newline. Use apply_patch. Do not inspect files outside this project. Reply SUCCESS_VERIFIED.');
  await page.getByRole('log',{name:'Live Codex output'}).getByText('Codex session connected.',{exact:false}).waitFor({timeout:120000});
  const success=await terminal(page,'completed','success');assert.equal(success.exitCode,0);assert.equal(await readFile(join(project,'success.txt'),'utf8'),'REAL_CODEX_OK\n');
  assert.ok(success.output.some(item=>item.kind==='file'));console.log('PASS real Codex success: wrote and verified success.txt, streamed events, completed with exit 0');
  // Reload reconstructs the real run from main, without starting another process.
  await page.reload();await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  const history=(await page.evaluate(()=>window.theseus.getExecutionState())).runs;assert.equal(history.length,1);assert.equal(history[0].status,'completed');
  await choose(page,project);
  await start(page,`Run this command exactly in the current project and wait for it, without backgrounding it: node -e 'require("fs").writeFileSync("cancel-child.pid",String(process.pid)); console.log("CANCEL_READY"); setTimeout(()=>{},120000)'. Do not inspect any files outside this project. This command is for testing cancellation.`);
  let childPid;
  const deadline=Date.now()+120000;
  while(Date.now()<deadline){try{childPid=Number(await readFile(join(project,'cancel-child.pid'),'utf8'));if(childPid)break;}catch{}await new Promise(r=>setTimeout(r,300));}
  assert.ok(childPid,'Codex must start the long-running child before cancellation');
  assert.equal(await page.getByTestId('run-status').getAttribute('data-status'),'running');
  // Stop all must stop main-owned execution and the agent-created command.
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Approvals & safety',exact:true}).click();
  await page.getByRole('button',{name:'Stop all execution',exact:true}).click();
  await page.getByRole('navigation',{name:'Session tabs'}).locator('.tab-title').last().click();

  await terminal(page,'cancelled','cancel',20000);
  const alive=()=>{try{process.kill(childPid,0);return true;}catch{return false;}};
  for(let i=0;i<30&&alive();i++)await new Promise(r=>setTimeout(r,100));
  assert.equal(alive(),false,'Cancellation must also stop the agent-created command process');
  assert.equal(await readFile(join(project,'success.txt'),'utf8'),'REAL_CODEX_OK\n');
  console.log('PASS real Codex cancellation: command actually started; agent and its child stopped; existing edits retained');
  // A moved/removed folder is a real startup failure, distinct from process/provider failure below.
  await page.getByRole('button',{name:'New task',exact:true}).click();
  const removed=join(temporary,'removed');await mkdir(removed);await choose(page,removed);await rm(removed,{recursive:true});
  await start(page,'Create a test file in this folder.');
  const startup=await terminal(page,'failed','missing-project');assert.match(startup.error,/folder.*missing|folder.*moved|folder.*removed/i);
  console.log('PASS missing project: failed state and actionable error without executing elsewhere');
  await desktop.close();desktop=undefined;
  page=await launch('real');
  const restored=(await page.evaluate(()=>window.theseus.getExecutionState())).runs;
  assert.equal(restored.length,3);assert.equal(restored.find(r=>r.id===success.id).status,'completed');
  assert.deepEqual(restored.find(r=>r.id===success.id).output,success.output);
  assert.ok(restored.some(r=>r.status==='cancelled'));assert.ok(restored.some(r=>r.status==='failed'));
  await page.getByRole('button',{name:'Run history',exact:true}).click();
  await page.locator(`[data-history-id="${success.id}"]`).click();
  assert.equal(await page.getByTestId('run-status').getAttribute('data-status'),'completed');
  await page.getByRole('log',{name:'Live Codex output'}).getByText('SUCCESS_VERIFIED',{exact:false}).waitFor();
  console.log('PASS full Electron restart: completed, cancelled and failed runs retain timestamps, errors and output; history opens saved output');
  await page.getByRole('button',{name:'New task',exact:true}).click();await choose(page,project);
  await start(page,'Wait by running node -e "setTimeout(()=>{},120000)" in the project, without backgrounding it. This tests app shutdown. Do not inspect files outside the project.');
  await page.getByRole('log',{name:'Live Codex output'}).getByText('Codex started',{exact:false}).waitFor({timeout:30000});
  const closing=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.at(-1);
  assert.equal(closing.status,'running');
  await desktop.close();desktop=undefined;
  page=await launch('real');
  const interrupted=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===closing.id);
  assert.equal(interrupted.status,'interrupted');assert.ok(interrupted.endedAt);assert.match(interrupted.error,/not resumed or rerun/);
  assert.ok(interrupted.output.some(e=>e.text.includes('Codex started')));
  console.log('PASS graceful shutdown: active Codex run stopped, saved and recovered as Interrupted');
  await choose(page,project);
  await start(page,'Wait by running node -e "setTimeout(()=>{},120000)" in this project. Do not background it. This tests abrupt app interruption.');
  await page.getByRole('log',{name:'Live Codex output'}).getByText('Codex started',{exact:false}).waitFor({timeout:30000});
  const crashing=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.at(-1);
  // Record the actual process tree solely for test cleanup after intentionally killing main.
  const mainPid=desktop.process().pid;
  const pairs=execFileSync('/bin/ps',['-axo','pid=,ppid='],{encoding:'utf8'}).trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));
  const descendants=new Set([mainPid]);let changed=true;
  while(changed){changed=false;for(const [pid,parent] of pairs)if(descendants.has(parent)&&!descendants.has(pid)){descendants.add(pid);changed=true;}}
  const died=new Promise(resolve=>desktop.process().once('exit',resolve));desktop.process().kill('SIGKILL');await died;desktop=undefined;
  // An OS-level kill cannot run app shutdown hooks. Stop owned test children explicitly.
  for(const pid of [...descendants].reverse()){if(pid===mainPid)continue;try{process.kill(-pid,'SIGINT');}catch{}try{process.kill(pid,'SIGINT');}catch{}}
  page=await launch('real');
  const recovered=(await page.evaluate(()=>window.theseus.getExecutionState())).runs;
  const crashed=recovered.find(r=>r.id===crashing.id);assert.equal(crashed.status,'interrupted');assert.ok(crashed.endedAt);assert.match(crashed.error,/completion is unknown/);
  assert.ok(!recovered.some(r=>['starting','running','cancelling'].includes(r.status)));
  await page.getByRole('button',{name:'Run history',exact:true}).click();
  await page.getByRole('textbox',{name:'Search run history'}).fill('abrupt app interruption');
  await page.locator(`[data-history-id="${crashing.id}"]`).click();assert.equal(await page.getByTestId('run-status').getAttribute('data-status'),'interrupted');
  await page.screenshot({path:'artifacts/verification/history-interrupted.png'});
  await page.waitForTimeout(1000);assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).runs.length,5);
  console.log('PASS abrupt main-process kill: persisted live output recovered as Interrupted, inspectable through search, no automatic rerun');
  report.push({name:'restart-and-recovery',runs:recovered.map(r=>({id:r.id,status:r.status,startedAt:r.startedAt,endedAt:r.endedAt}))});
  await desktop.close();desktop=undefined;
  // Real Codex process failure through the main-owned duration limit, not an injected status.
  page=await launch('time-limit',{THESEUS_AGENT_TIMEOUT_MS:'8000'});
  await choose(page,project);await start(page,`Run node -e "require('fs').writeFileSync('timeout-child.pid',String(process.pid));setTimeout(()=>{},120000)" in this project and wait for it to finish. Do not background it or inspect files outside the project.`);
  const failed=await terminal(page,'failed','time-limit',30000);
  assert.match(failed.error,/time limit/);assert.ok(failed.signal||failed.exitCode!==0);
  assert.ok(failed.output.some(item=>item.text.includes('Codex started')),'The real executable must start for the timeout test');
  try{
    const timeoutChild=Number(await readFile(join(project,'timeout-child.pid'),'utf8'));
    let stillAlive=false;try{process.kill(timeoutChild,0);stillAlive=true;}catch{}
    assert.equal(stillAlive,false,'Timeout must not leave its command process running');
  }catch(error){if(error.code!=='ENOENT')throw error;}
  console.log('PASS real Codex failure: duration limit stops the real process and its command, and shows Failed');
  await desktop.close();desktop=undefined;
  page=await launch('missing-agent',{THESEUS_CODEX_PATH:join(temporary,'codex-not-installed')});
  await choose(page,project);await start(page,'This cannot start because Codex is absent.');
  const missing=await terminal(page,'failed','missing-agent');assert.match(missing.error,/not found/i);
  console.log('PASS missing executable: actionable installation/login guidance');
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/verification/agent-report.json',JSON.stringify({testedAt:new Date().toISOString(),cases:report,rendererErrors:errors},null,2));
  console.log('PASS no renderer exceptions; screenshots and evidence in artifacts/verification/');
}finally{await desktop?.close();await rm(temporary,{recursive:true,force:true});}
