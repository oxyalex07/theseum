// Disposable Git repository and fixture runtime. No provider calls or account usage.
import { _electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-worktree-e2e-'))),profile=join(root,'profile'),project=join(root,'project'),storage=join(root,'storage with spaces');
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
const git=(path,...args)=>execFileSync('git',['-C',path,...args],{encoding:'utf8'}).trim();
git(project,'init','-b','main');git(project,'config','user.email','fixture@example.com');git(project,'config','user.name','Fixture');
await writeFile(join(project,'original'),'source');git(project,'add','.');git(project,'commit','-m','initial');
const fake=join(root,'fixture-codex');
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
(async()=>{for await(const chunk of process.stdin){}require('node:fs').writeFileSync('agent-output',process.cwd());await new Promise(r=>setTimeout(r,2000));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;}
async function settings(page){await page.getByRole('button',{name:'Settings',exact:true}).first().click();await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Spaces & folders',exact:true}).click();await page.getByLabel('Storage folder',{exact:true}).waitFor();}
try{
  let page=await launch();
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);
  await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
  await settings(page);await expect(page.getByRole('button',{name:'Save preferences',exact:true})).toBeEnabled();
  await page.getByLabel('Storage folder',{exact:true}).fill('relative');await page.getByRole('button',{name:'Save preferences',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'absolute'})).toBeVisible();
  await page.getByRole('switch',{name:'Remove merged worktrees',exact:true}).click();await page.getByLabel('Storage folder',{exact:true}).fill(storage);await page.getByRole('button',{name:'Save preferences',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'preferences saved'})).toBeVisible();
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  await page.getByLabel('Run location',{exact:true}).selectOption('worktree');await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Create isolated fixture output');await page.screenshot({path:'artifacts/verification/worktree-home.png'});
  await page.getByRole('button',{name:'Start Codex',exact:true}).click();
  const runs=()=>page.evaluate(()=>window.theseus.getRunHistory());
  await expect.poll(async()=>(await runs()).runs[0]?.status).toBe('running');
  const run=(await runs()).runs[0];assert.equal(run.projectPath,project);assert.equal(run.executionPath,join(storage,run.id));
  await expect.poll(()=>readFile(join(run.executionPath,'agent-output'),'utf8').catch(()=>null)).toBe(run.executionPath);await assert.rejects(()=>readFile(join(project,'agent-output')));
  assert.deepEqual((await page.evaluate(()=>window.theseus.cleanupWorktrees())).removed,[],'Active work is protected');
  await expect.poll(async()=>(await runs()).runs[0]?.status).toBe('completed');
  assert.equal((await page.evaluate(()=>window.theseus.cleanupWorktrees())).skipped.length,1,'Untracked files are protected');
  await settings(page);await page.getByRole('button',{name:'Select worktree',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Selected '+run.executionPath})).toBeVisible();
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).workspace.path,run.executionPath);
  git(run.executionPath,'add','.');git(run.executionPath,'commit','-m','agent changes');git(project,'merge','--ff-only',`theseus/${run.id}`);
  assert.equal((await page.evaluate(()=>window.theseus.cleanupWorktrees())).skipped.length,1,'Selected worktree is protected');
  const selectedWorkspace=(await page.evaluate(()=>window.theseus.getExecutionState())).workspace;
  const command=await page.evaluate(workspaceId=>window.theseus.startTerminalCommand({workspaceId,command:'sleep 30'}),selectedWorkspace.id);
  await page.evaluate(()=>window.theseus.selectWorkspace());
  assert.equal((await page.evaluate(()=>window.theseus.cleanupWorktrees())).skipped.length,1,'Active terminal is protected even after selecting a different project');
  await page.evaluate(id=>window.theseus.cancelTerminalCommand(id),command.id);
  await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getTerminalState())).commands[0]?.status).toBe('cancelled');
  await page.evaluate(id=>window.theseus.selectManagedWorktree(id),run.id);
  await page.getByRole('button',{name:'Select worktree',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/verification/worktree-settings.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  await page.locator('.worktree-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/verification/worktree-settings-small.png'});
  assert.equal(await page.locator('.sw').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.evaluate(()=>window.theseus.deleteRunHistory({all:true}));assert.equal((await page.evaluate(()=>window.theseus.getWorktreeState())).worktrees.length,1);
  await desktop.close();desktop=undefined;
  // Simulate a crash after Git succeeded but before final journal persistence.
  const journalPath=join(profile,'worktrees.json'),journal=JSON.parse(await readFile(journalPath,'utf8'));
  journal.records[0].state='creating';
  const missingId=randomUUID(),manualId=randomUUID();
  const missing={...journal.records[0],id:missingId,runId:missingId,path:join(storage,missingId),branch:`theseus/${missingId}`};
  const manual={...missing,id:manualId,runId:manualId,path:join(storage,manualId),branch:`theseus/${manualId}`};
  await mkdir(manual.path);await writeFile(join(manual.path,'keep'),'valuable local work');
  journal.records.push(missing,manual);await writeFile(journalPath,JSON.stringify(journal));
  page=await launch();
  assert.deepEqual((await page.evaluate(()=>window.theseus.getWorktreeState())).preferences,{location:storage,removeMerged:true});
  const recoveredState=await page.evaluate(()=>window.theseus.getWorktreeState());
  assert.deepEqual(recoveredState.worktrees.map(w=>w.recovery?.status),['recoverable','missing','manual']);
  assert.deepEqual((await page.evaluate(()=>window.theseus.cleanupWorktrees())).removed,[],'Interrupted records require review before cleanup');
  await settings(page);
  await expect(page.getByText('Ownership could not be verified.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Recover worktree',exact:true})).toBeEnabled();
  await page.locator('.worktree-settings').screenshot({path:'artifacts/verification/worktree-recovery.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  await page.locator('.worktree-settings').screenshot({path:'artifacts/verification/worktree-recovery-small.png'});
  assert.equal(await page.locator('.sw').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.getByRole('button',{name:'Recover worktree',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Worktree recovered.'})).toBeVisible();
  await page.getByRole('button',{name:'Forget creation record',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Creation record forgotten.'})).toBeVisible();
  assert.equal(await readFile(join(manual.path,'keep'),'utf8'),'valuable local work');
  await page.getByRole('button',{name:'Select worktree',exact:true}).filter({visible:true}).first().click();
  await expect(page.getByRole('status').filter({hasText:'Selected '+run.executionPath})).toBeVisible();
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).workspace.path,run.executionPath);
  await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},project);await page.evaluate(()=>window.theseus.selectWorkspace());
  await settings(page);await page.getByRole('button',{name:'Clean up merged worktrees',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'1 removed'})).toBeVisible();
  await assert.rejects(()=>readFile(join(run.executionPath,'original')));assert.equal((await page.evaluate(()=>window.theseus.getWorktreeState())).worktrees[0].state,'removed');
  await assert.rejects(()=>page.evaluate(id=>window.theseus.selectManagedWorktree(id),run.id));
  assert.equal(await readFile(join(project,'agent-output'),'utf8'),run.executionPath,'Merged changes are kept in the source checkout');
  assert.deepEqual(errors,[]);console.log('Worktree Electron checks passed: crash recovery/forget/manual guidance, preferences, live cwd, cleanup protection, selection, restart, history independence, and merged cleanup.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
