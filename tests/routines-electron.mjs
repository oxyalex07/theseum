// Real Electron/preload/runner using a disposable local CLI fixture; no provider/account calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, chmod, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-routines-electron-'))),project=join(root,'project'),other=join(root,'other'),profile=join(root,'profile'),fake=join(root,'fixture-codex'),calls=join(root,'calls.jsonl');
await mkdir(project);await mkdir(other);await mkdir('artifacts/verification',{recursive:true});
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
if(process.argv.includes('mcp')){console.log('[]');process.exit(0);}
if(process.argv.includes('app-server')){require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id!==undefined)console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{userAgent:'fixture'}:m.method==='model/list'?{data:[]}:m.method==='account/read'?{account:null}:{}}));});}
else (async()=>{let prompt='';for await(const chunk of process.stdin)prompt+=chunk;require('node:fs').appendFileSync(${JSON.stringify(calls)},JSON.stringify({prompt,args:process.argv.slice(2),cwd:process.cwd()})+'\\n');await new Promise(resolve=>setTimeout(resolve,prompt.includes('SLOW_FIXTURE')?6000:500));if(prompt.includes('FAIL_FIXTURE')){console.log(JSON.stringify({type:'turn.failed',error:{message:'Deliberate fixture failure'}}));process.exitCode=1;}else{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Actual result from the local routine fixture.'}}));console.log(JSON.stringify({type:'turn.completed'}));}})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.getByRole('button',{name:'Open your profile'}).waitFor();
  await desktop.evaluate(({Notification,dialog})=>{dialog.showMessageBoxSync=()=>1;globalThis.routineNotifications=[];Notification.isSupported=()=>true;Notification.prototype.show=function(){globalThis.routineNotifications.push({title:this.title,body:this.body});};});
  return page;
}
async function picker(folder){await desktop.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:!folder,filePaths:folder?[folder]:[]});},folder);}
const state=page=>page.evaluate(()=>window.theseus.getRoutines());
const ref=r=>({id:r.id,expectedRevision:r.revision});
const routines=page=>page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Routines',exact:true}).click();
async function callsList(){try{return (await readFile(calls,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return [];}}
async function completed(page,id,status='completed'){await expect.poll(async()=>((await state(page)).executions.find(e=>e.id===id)?.status),{timeout:20000}).toBe(status);}
try{
  let page=await launch();await page.evaluate(()=>window.theseus.saveDesktopPreferences({nDone:true,nFail:true,deliver:'banner',deepOn:false,overflow:'queue',menubar:false}));
  const agent=await page.evaluate(()=>window.theseus.saveAgentProfile({name:'Routine fixture agent',icon:'code',color:'violet',description:'Local test fixture',runtime:'codex',model:null,reasoningEffort:null,instructions:'ROUTINE_AGENT_SENTINEL',memory:'none',sandbox:'read-only',timeoutSeconds:60,folderChoice:null}));
  await page.reload();await page.getByRole('button',{name:'Open your profile'}).waitFor();await picker(project);const workspace=await page.evaluate(()=>window.theseus.selectAgentFolder());await routines(page);
  await expect(page.getByRole('heading',{name:'No saved routines',exact:true})).toBeVisible();assert.equal((await callsList()).length,0);
  // Real editor, native selection, explicit activation intent and persistent disabled creation.
  await page.getByRole('button',{name:'New routine',exact:true}).click();
  await page.getByLabel('Routine name',{exact:true}).fill('Scheduled review');await page.getByLabel('Task to execute',{exact:true}).fill('Review project ROUTINE_TASK_SENTINEL');
  await page.getByLabel('Saved agent',{exact:true}).selectOption(agent.id);await page.getByRole('button',{name:'Choose routine project',exact:true}).click();
  await page.getByLabel('Trigger',{exact:true}).selectOption('interval');await page.getByLabel('Interval in minutes',{exact:true}).fill('1');await page.getByRole('button',{name:'Save routine',exact:true}).click();
  let scheduled=(await state(page)).routines[0];assert.equal(scheduled.enabled,false);assert.equal(scheduled.nextRunAt,null);assert.equal(scheduled.projectPath,project);assert.equal((await callsList()).length,0);
  // Narrow layout with actual editor and real data.
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  await page.getByRole('button',{name:'Edit Scheduled review',exact:true}).click();await page.getByLabel('Task to execute',{exact:true}).fill('Review edited project ROUTINE_TASK_SENTINEL');await page.screenshot({path:'artifacts/verification/routine-editor-1100.png'});
  assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.getByRole('button',{name:'Save routine changes',exact:true}).click();scheduled=(await state(page)).routines[0];
  for(const patch of [{folderChoice:project},{trigger:{kind:'interval',minutes:0}},{profileUpdatedAt:'2026-01-01T00:00:00.000Z'},{sandbox:'danger-full-access'},{enabled:true,executionConsent:false}])await assert.rejects(()=>page.evaluate(request=>window.theseus.saveRoutine(request),{name:scheduled.name,task:scheduled.task,trigger:scheduled.trigger,enabled:false,profileId:scheduled.profileId,profileUpdatedAt:scheduled.profileUpdatedAt,useWorktree:false,folderChoice:workspace.id,executionConsent:false,...patch}));
  await assert.rejects(()=>page.evaluate(ref=>window.theseus.deleteRoutine(ref),{id:scheduled.id,expectedRevision:1}),/changed/);
  assert.match(await desktop.evaluate(async({BrowserWindow},preload)=>{const owner=BrowserWindow.getAllWindows()[0],window=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,sandbox:true,nodeIntegration:false}});try{await window.loadURL(owner.webContents.getURL());return await window.webContents.executeJavaScript('(async()=>{try{await window.theseus.getRoutines();return "unexpected";}catch(e){return String(e);}})()');}finally{window.destroy();}},join(process.cwd(),'dist-electron/preload.cjs')),/Untrusted IPC sender/);
  await page.getByRole('switch',{name:'Enable Scheduled review',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('may use your account');await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await state(page)).routines[0].enabled,false);
  await page.getByRole('switch',{name:'Enable Scheduled review',exact:true}).click();await page.getByRole('button',{name:'Allow and enable routine',exact:true}).click();scheduled=(await state(page)).routines[0];assert.ok(scheduled.nextRunAt);assert.equal((await callsList()).length,0);
  // Advance only the main-process clock, in two awake steps. Scheduler and execution remain real.
  await desktop.evaluate(()=>{const original=Date.now;globalThis.routineOriginalNow=original;globalThis.routineClockOffset=30000;Date.now=()=>original()+globalThis.routineClockOffset;});
  await new Promise(resolve=>setTimeout(resolve,1200));await desktop.evaluate(()=>{globalThis.routineClockOffset=61000;});
  await expect.poll(async()=>(await state(page)).executions.length).toBe(1);let execution=(await state(page)).executions[0];await completed(page,execution.id);
  const first=(await callsList())[0];assert.ok(first.prompt.includes('ROUTINE_TASK_SENTINEL'));assert.ok(first.prompt.includes('ROUTINE_AGENT_SENTINEL'));assert.ok(first.args.includes('read-only'));assert.equal(first.cwd,project);
  await expect.poll(()=>desktop.evaluate(()=>globalThis.routineNotifications.length)).toBe(1);assert.match((await desktop.evaluate(()=>globalThis.routineNotifications))[0].title,/finished/);
  await expect(page.getByRole('button',{name:'View result: Scheduled review',exact:true})).toBeVisible();await page.getByRole('button',{name:'View result: Scheduled review',exact:true}).click();await expect(page.getByRole('log',{name:'Live Codex output',exact:true})).toContainText('Actual result from the local routine fixture.');await routines(page);
  await page.getByRole('switch',{name:'Enable Scheduled review',exact:true}).click();scheduled=(await state(page)).routines[0];assert.equal(scheduled.enabled,false);assert.equal(scheduled.nextRunAt,null);
  // Success/failure events use actual manual runs, do not cross project scope or cascade from routine runs.
  const fields={name:'After success',task:'Success event task',trigger:{kind:'run-completed'},enabled:true,profileId:agent.id,profileUpdatedAt:agent.updatedAt,useWorktree:false,folderChoice:workspace.id,executionConsent:true};
  let success=(await page.evaluate(fields=>window.theseus.saveRoutine(fields),fields)).routines.find(r=>r.name==='After success');
  let failure=(await page.evaluate(fields=>window.theseus.saveRoutine(fields),{...fields,name:'After failure',task:'Failure event task',trigger:{kind:'run-failed'}})).routines.find(r=>r.name==='After failure');
  await picker(other);const different=await page.evaluate(()=>window.theseus.selectAgentFolder());let manual=await page.evaluate(id=>window.theseus.startAgentRun({workspaceId:id,task:'Other project fixture'}),different.id);
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(r=>r.id===manual.id)?.status).toBe('completed');assert.equal((await state(page)).executions.length,1);
  manual=await page.evaluate(id=>window.theseus.startAgentRun({workspaceId:id,task:'Manual success event fixture'}),workspace.id);await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===success.id).length).toBe(1);execution=(await state(page)).executions.find(e=>e.routineId===success.id);await completed(page,execution.id);
  const count=(await callsList()).length;await new Promise(resolve=>setTimeout(resolve,1200));assert.equal((await callsList()).length,count,'Routine completion must not recursively trigger itself');
  await page.evaluate(id=>window.theseus.startAgentRun({workspaceId:id,task:'FAIL_FIXTURE manual failure'}),workspace.id);await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===failure.id).length).toBe(1);execution=(await state(page)).executions.find(e=>e.routineId===failure.id);await completed(page,execution.id);
  assert.ok((await desktop.evaluate(()=>globalThis.routineNotifications)).some(n=>/failed/.test(n.title)));
  // Editing a saved agent invalidates automatic execution until explicit review; no silent new sandbox.
  const changed=await page.evaluate(agent=>window.theseus.saveAgentProfile({...agent,instructions:'Changed instructions',expectedUpdatedAt:agent.updatedAt,folderChoice:null}),agent);
  await assert.rejects(()=>page.evaluate(ref=>window.theseus.enableRoutine(ref,true,true),ref(scheduled)),/changed/);
  await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(success));await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===success.id).at(-1)?.status).toBe('failed');assert.equal((await state(page)).executions.filter(e=>e.routineId===success.id).at(-1).runId,undefined);
  // Disable both event listeners before the remaining manual execution and teardown checks.
  success=(await page.evaluate(ref=>window.theseus.enableRoutine(ref,false,false),ref(success))).routines.find(r=>r.id===success.id);failure=(await page.evaluate(ref=>window.theseus.enableRoutine(ref,false,false),ref(failure))).routines.find(r=>r.id===failure.id);
  scheduled=(await page.evaluate(fields=>window.theseus.saveRoutine(fields),{...fields,id:scheduled.id,expectedRevision:scheduled.revision,name:'Scheduled review',task:'SLOW_FIXTURE teardown',profileUpdatedAt:changed.updatedAt,trigger:{kind:'interval',minutes:1},enabled:true})).routines.find(r=>r.id===scheduled.id);
  await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(scheduled));await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===scheduled.id).at(-1)?.status).toBe('running');
  // Queue a second routine in the same checkout, then disable it before its slot is available.
  let queued=(await page.evaluate(fields=>window.theseus.saveRoutine(fields),{...fields,name:'Queued routine',profileUpdatedAt:changed.updatedAt,task:'MUST_NOT_EXECUTE',trigger:{kind:'interval',minutes:5}})).routines.find(r=>r.name==='Queued routine');await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(queued));await expect.poll(async()=>(await state(page)).executions.find(e=>e.routineId===queued.id)?.status).toBe('queued');queued=(await page.evaluate(ref=>window.theseus.enableRoutine(ref,false,false),ref(queued))).routines.find(r=>r.id===queued.id);await expect.poll(async()=>(await state(page)).executions.find(e=>e.routineId===queued.id)?.status).toBe('cancelled');
  await page.evaluate(()=>window.theseus.stopAllExecution());assert.equal((await state(page)).paused,true);assert.ok(!(await callsList()).some(c=>c.prompt.includes('MUST_NOT_EXECUTE')));
  await page.screenshot({path:'artifacts/verification/routines-list-1100.png'});await page.getByRole('region',{name:'Routine execution history',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/verification/routines-history-1100.png'});assert.equal(await page.locator('.routines-page').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  const beforeRestart=await state(page);await desktop.close();desktop=undefined;page=await launch();await routines(page);assert.equal((await state(page)).paused,true);assert.equal((await state(page)).routines.length,beforeRestart.routines.length);assert.equal((await state(page)).executions.length,beforeRestart.executions.length);
  await page.reload();await page.getByRole('button',{name:'Open your profile'}).waitFor();await routines(page);assert.equal((await state(page)).paused,true);
  // Startup/resume skips overdue occurrences without executing account work.
  const beforeResume=(await callsList()).length;await desktop.evaluate(()=>{const original=Date.now;Date.now=()=>original()+3600000;});await page.getByRole('button',{name:'Resume scheduling',exact:true}).click();assert.equal((await state(page)).paused,false);assert.ok((await state(page)).executions.some(e=>e.status==='skipped'&&/Missed/.test(e.detail??'')));assert.equal((await callsList()).length,beforeResume);
  const resultId=beforeRestart.executions.find(e=>e.status==='completed'&&e.runId).runId;await page.evaluate(id=>window.theseus.deleteRunHistory({ids:[id]}),resultId);assert.ok(!(await state(page)).executions.some(e=>e.runId===resultId));
  // Quitting a real active process records interruption, never a successful result or implicit retry.
  scheduled=(await state(page)).routines.find(r=>r.id===scheduled.id);await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(scheduled));await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===scheduled.id).at(-1)?.status).toBe('running');
  const beforeQuitCalls=(await callsList()).length;await desktop.close();desktop=undefined;page=await launch();await routines(page);assert.equal((await state(page)).executions.filter(e=>e.routineId===scheduled.id).at(-1).status,'interrupted');assert.equal((await callsList()).length,beforeQuitCalls);
  // R17-1: a real routine-store rejection must revoke queued automation before a
  // manual slot owner exits. Its stopped session must survive failed pause writes.
  await picker(project);const faultWorkspace=await page.evaluate(()=>window.theseus.selectAgentFolder());
  const faultRoutine=(await page.evaluate(fields=>window.theseus.saveRoutine(fields),{...fields,folderChoice:faultWorkspace.id,name:'Storage fault fixture',profileUpdatedAt:changed.updatedAt,task:'STORAGE_MUST_NOT_EXECUTE',trigger:{kind:'interval',minutes:5}})).routines.find(r=>r.name==='Storage fault fixture');
  const faultOwner=await page.evaluate(id=>window.theseus.startAgentRun({workspaceId:id,task:'SLOW_FIXTURE storage fault manual owner'}),faultWorkspace.id);await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===faultOwner.id)?.status).toBe('running');
  await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(faultRoutine));await expect.poll(async()=>(await state(page)).executions.find(e=>e.routineId===faultRoutine.id)?.status).toBe('queued');
  const routineFile=join(profile,'routines.json'),preservedFile=join(profile,'routines.preserved');await rename(routineFile,preservedFile);await mkdir(routineFile);
  const faultError=await page.evaluate(async ref=>{try{await window.theseus.runRoutineNow(ref);return '';}catch(e){return e.message;}},ref(faultRoutine));assert.match(faultError,/Routine storage/);assert.equal((await state(page)).paused,true);assert.match((await state(page)).warning,/Automatic execution is stopped/);await completed(page,(await state(page)).executions.find(e=>e.routineId===faultRoutine.id).id,'cancelled');
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===faultOwner.id)?.status,{timeout:15000}).toBe('completed');assert.ok(!(await callsList()).some(c=>c.prompt.includes('STORAGE_MUST_NOT_EXECUTE')));await expect(page.getByRole('alert').filter({hasText:'Automatic execution is stopped'})).toBeVisible();
  await desktop.close();desktop=undefined;await rm(routineFile,{recursive:true});await rename(preservedFile,routineFile);page=await launch();await routines(page);assert.equal((await state(page)).paused,true);assert.ok(!(await callsList()).some(c=>c.prompt.includes('STORAGE_MUST_NOT_EXECUTE')));
  await page.getByRole('button',{name:'Resume scheduling',exact:true}).click();assert.equal((await state(page)).paused,false);assert.equal((await state(page)).warning,undefined);assert.ok(!(await callsList()).some(c=>c.prompt.includes('STORAGE_MUST_NOT_EXECUTE')));
  await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(faultRoutine));await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===faultRoutine.id).at(-1)?.status).toBe('completed');assert.equal((await callsList()).filter(c=>c.prompt.includes('STORAGE_MUST_NOT_EXECUTE')).length,1);
  // R17-2: keep storage invalid across startup, then repair it in the open app.
  // The first successful load must reconcile old active rows before explicit resume.
  await picker(project);const repairWorkspace=await page.evaluate(()=>window.theseus.selectAgentFolder());
  const repairOwner=await page.evaluate(id=>window.theseus.startAgentRun({workspaceId:id,task:'SLOW_FIXTURE startup repair owner'}),repairWorkspace.id);await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===repairOwner.id)?.status).toBe('running');
  await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(faultRoutine));await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===faultRoutine.id).at(-1)?.status).toBe('queued');
  const stale=(await state(page)).executions.filter(e=>e.routineId===faultRoutine.id).at(-1),beforeRepair=(await callsList()).length;
  await rename(routineFile,preservedFile);await mkdir(routineFile);await desktop.close();desktop=undefined;
  page=await launch();await routines(page);assert.equal((await state(page)).paused,true);assert.match((await state(page)).warning,/Routine storage/);assert.deepEqual((await state(page)).routines,[]);
  const actualInterrupted=(await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(r=>r.id===stale.runId);assert.equal(actualInterrupted.status,'interrupted');
  await rm(routineFile,{recursive:true});await rename(preservedFile,routineFile);assert.equal((await state(page)).paused,true);assert.equal((await callsList()).length,beforeRepair);
  await page.getByRole('button',{name:'Resume scheduling',exact:true}).click();assert.equal((await state(page)).warning,undefined);assert.equal((await state(page)).paused,false);
  const repaired=(await state(page)).executions.find(e=>e.id===stale.id);assert.equal(repaired.status,actualInterrupted.status);assert.equal(repaired.endedAt,actualInterrupted.endedAt);assert.equal((await callsList()).length,beforeRepair);
  assert.deepEqual(JSON.parse(await readFile(routineFile,'utf8')).executions.find(e=>e.id===stale.id),repaired);
  await page.evaluate(ref=>window.theseus.runRoutineNow(ref),ref(faultRoutine));await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineId===faultRoutine.id).at(-1)?.status).toBe('completed');assert.equal((await callsList()).length,beforeRepair+1);
  await page.getByRole('button',{name:'Delete Scheduled review…',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.ok((await state(page)).routines.some(r=>r.id===scheduled.id));
  await page.getByRole('button',{name:'Delete Scheduled review…',exact:true}).click();await page.getByRole('button',{name:'Delete routine',exact:true}).click();assert.ok(!(await state(page)).routines.some(r=>r.id===scheduled.id));
  // Delete remaining routines and verify physical storage after a complete restart.
  for(const r of (await state(page)).routines)await page.evaluate(ref=>window.theseus.deleteRoutine(ref),ref(r));
  assert.deepEqual((await state(page)).routines,[]);assert.ok((await state(page)).executions.length>0);await desktop.close();desktop=undefined;page=await launch();assert.deepEqual((await state(page)).routines,[]);assert.deepEqual(JSON.parse(await readFile(join(profile,'routines.json'),'utf8')).routines,[]);
  // Home routines can create, enable with consent, run, inspect results, and edit.
  await picker(project);
  await page.getByRole('tab',{name:'Routines',exact:true}).click();
  const home=page.getByRole('tabpanel',{name:'Routines',exact:true});
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Keep this Home draft');
  await home.getByRole('button',{name:'New routine',exact:true}).click();
  await page.getByLabel('Routine name',{exact:true}).fill('Panel routine');
  await page.getByLabel('Task to execute',{exact:true}).fill('Home panel routine fixture');
  await page.getByRole('button',{name:'Choose routine project',exact:true}).click();
  await page.getByLabel('Trigger',{exact:true}).selectOption('interval');
  await page.getByLabel('Interval in minutes',{exact:true}).fill('10080');
  await page.getByRole('button',{name:'Save routine',exact:true}).click();
  await home.getByRole('switch',{name:'Enable Panel routine',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal((await state(page)).routines[0].enabled,false);
  await home.getByRole('switch',{name:'Enable Panel routine',exact:true}).click();
  await page.getByRole('button',{name:'Allow and enable routine',exact:true}).click();
  await home.getByRole('button',{name:'Run now: Panel routine',exact:true}).click();
  await expect.poll(async()=>(await state(page)).executions.filter(e=>e.routineName==='Panel routine').at(-1)?.status).toBe('completed');
  await home.getByText('Task & recent results',{exact:true}).click();
  await expect(home.getByRole('button',{name:'Open result',exact:true})).toBeVisible();
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  assert.equal(await home.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'artifacts/verification/home-routines-1100.png'});
  await home.getByRole('button',{name:'Open result',exact:true}).click();
  await expect(page.getByRole('log',{name:'Live Codex output',exact:true})).toContainText('Actual result');
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('tab',{name:'Routines',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toHaveValue('Keep this Home draft');
  await home.getByRole('switch',{name:'Enable Panel routine',exact:true}).click();
  await expect(home.getByRole('switch',{name:'Enable Panel routine',exact:true})).toHaveAttribute('aria-checked','false');
  await home.getByRole('button',{name:'Edit Panel routine',exact:true}).click();
  await page.getByLabel('Routine name',{exact:true}).fill('Updated panel routine');
  await page.getByRole('button',{name:'Save routine changes',exact:true}).click();
  await expect(home).toContainText('Updated panel routine');
  assert.deepEqual(errors,[]);
  console.log('PASS routine Electron CRUD/consent, native project/saved agent/sandbox, actual scheduled and event execution/results/notifications, stale/hostile IPC, recursion/project scope, queued disable, R17-1 storage fault/slot release/restart latch, R17-2 invalid-startup/repaired-first-load/terminal-history/new-occurrence, Stop all/restart/resume/offline/history pruning and 1100px layout; local fixture only, no providers.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
