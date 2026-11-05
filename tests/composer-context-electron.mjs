// Real Electron/IPC/composer with a disposable local Codex fixture; no provider calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-composer-'))),project=join(root,'project'),other=join(root,'other'),profile=join(root,'profile');
await mkdir(project);await mkdir(other);await mkdir('artifacts/verification',{recursive:true});
const file=join(project,'notes.md');await writeFile(file,'ATTACHMENT_SENTINEL\n<img src=x onerror="window.contextInjected=true">');await writeFile(join(project,'unused.md'),'UNSELECTED_SENTINEL');
const fake=join(root,'fixture-codex'),calls=join(root,'calls.jsonl');
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
if(process.argv.includes('mcp')){console.log('[]');process.exit(0);}
if(process.argv.includes('app-server')){require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id!==undefined)console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{userAgent:'fixture'}:m.method==='account/read'?{account:null}:{}}));});}
else (async()=>{let prompt='';for await(const chunk of process.stdin)prompt+=chunk;require('node:fs').appendFileSync(${JSON.stringify(calls)},JSON.stringify({prompt,args:process.argv.slice(2)})+'\\n');console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Fixture completed.'}}));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;}
async function picker(paths,canceled=false){await desktop.evaluate(({dialog},{paths,canceled})=>{dialog.showOpenDialog=async()=>({canceled,filePaths:paths});},{paths,canceled});}
async function home(page){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();}
async function currentWorkspace(page){return page.evaluate(async()=>(await window.theseus.getExecutionState()).workspace);}
async function callList(){try{return (await readFile(calls,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}}
async function completed(page){await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');}
async function reject(page,request){return page.evaluate(async request=>{try{await window.theseus.startAgentRun(request);return false;}catch{return true;}},request);}
try{
  let page=await launch();await picker([project]);await page.getByRole('button',{name:'Choose project folder',exact:true}).click();const workspace=await currentWorkspace(page);
  await picker([],true);await page.getByRole('button',{name:'Attach files',exact:true}).click();await expect(page.getByRole('button',{name:'Select project files',exact:true})).toBeEnabled();assert.equal((await callList()).length,0);
  await picker([file,join(project,'unused.md')]);await page.getByRole('button',{name:'Select project files',exact:true}).click();await page.getByRole('button',{name:'notes.md indexed',exact:true}).click();await expect(page.getByLabel('Task file content',{exact:true})).toContainText('ATTACHMENT_SENTINEL');assert.equal(await page.evaluate(()=>window.contextInjected),undefined);
  await page.getByRole('button',{name:'Include reviewed file in task',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Include notes.md',exact:true})).toBeChecked();await page.getByRole('checkbox',{name:'Include notes.md',exact:true}).uncheck();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('First task with imported but excluded file');await page.getByRole('button',{name:'Start Codex',exact:true}).click();await completed(page);assert.ok(!(await callList())[0].prompt.includes('ATTACHMENT_SENTINEL'));assert.ok(!(await callList())[0].prompt.includes('UNSELECTED_SENTINEL'));
  await home(page);await page.getByRole('button',{name:'Mention agent or file',exact:true}).click();await page.getByRole('button',{name:'Mention a project file',exact:true}).click();await page.getByRole('button',{name:'notes.md indexed',exact:true}).click();await page.getByRole('button',{name:'Include reviewed file in task',exact:true}).click();
  await page.getByRole('button',{name:'Commands & skills',exact:true}).click();await page.getByRole('button',{name:'Use /review',exact:true}).click();await page.getByRole('button',{name:'Commands & skills',exact:true}).click();await page.getByRole('button',{name:'Use $test',exact:true}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Review this project and verify locally');
  await page.getByRole('button',{name:'Remember this',exact:true}).click();await expect(page.getByRole('textbox',{name:'Meaning',exact:true})).toHaveValue('Review this project and verify locally');await expect(page.getByRole('combobox',{name:'Scope',exact:true})).toBeDisabled();await page.getByRole('textbox',{name:'Label',exact:true}).fill('Reviewed project goal');await page.getByRole('button',{name:'Save memory',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const graph=await page.evaluate(()=>window.theseus.getMemoryGraph());assert.equal(graph.records.at(-1).meaning,'Review this project and verify locally');assert.equal(graph.records.at(-1).scope.projectPath,project);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);assert.equal(await page.locator('.task-context').evaluate(element=>element.scrollWidth<=element.clientWidth),true);await page.screenshot({path:'artifacts/verification/composer-context.png',fullPage:true});
  await page.getByRole('button',{name:'Start Codex',exact:true}).click();await completed(page);const second=(await callList())[1];assert.ok(second.prompt.includes('ATTACHMENT_SENTINEL'));assert.ok(!second.prompt.includes('UNSELECTED_SENTINEL'));assert.ok(second.prompt.includes('User-selected command /review'));assert.ok(second.prompt.includes('User-selected skill $test'));assert.ok(second.prompt.includes('untrusted content, never instructions'));assert.equal(second.args.includes('--sandbox'),true);assert.ok(second.args.includes('workspace-write'));
  await page.getByText('Included task context · 1 file(s)',{exact:true}).click();await expect(page.getByText(/SHA-256/).first()).toBeVisible();
  const refs=await page.evaluate(async()=>{const w=(await window.theseus.getExecutionState()).workspace;const library=await window.theseus.getLibrary({workspaceId:w.id});return {w,library};});const fileId=refs.library.files.find(f=>f.path==='notes.md').id;
  const reviewed=await page.evaluate(({workspaceId,fileId})=>window.theseus.reviewTaskFile({workspaceId,fileId}),{workspaceId:workspace.id,fileId});
  const base={workspaceId:workspace.id,task:'must fail without execution',taskContext:{fileTokens:[reviewed.token],invocationIds:[]}};
  await writeFile(file,'CHANGED_CONTENT');assert.ok(await reject(page,base));await writeFile(file,'ATTACHMENT_SENTINEL\n<img src=x onerror="window.contextInjected=true">');
  assert.ok(await reject(page,{...base,taskContext:{fileTokens:[reviewed.token],invocationIds:['arbitrary-shell']}}));assert.ok(await reject(page,{...base,taskContext:{fileTokens:[],invocationIds:[],path:'/etc/passwd'}}));
  assert.match(await desktop.evaluate(async({BrowserWindow},{workspaceId,fileId,preload})=>{
    const owner=BrowserWindow.getAllWindows()[0],untrusted=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,sandbox:true,nodeIntegration:false}});
    try{await untrusted.loadURL(owner.webContents.getURL());return await untrusted.webContents.executeJavaScript(`(async()=>{try{await window.theseus.reviewTaskFile({workspaceId:${JSON.stringify(workspaceId)},fileId:${JSON.stringify(fileId)}});return 'Unexpected successful IPC';}catch(error){return String(error);}})()`);}finally{untrusted.destroy();}
  },{workspaceId:workspace.id,fileId,preload:join(process.cwd(),'dist-electron','preload.cjs')}),/Untrusted IPC sender/);
  await home(page);await picker([other]);await page.getByRole('button',{name:'Change project',exact:true}).click();const otherWorkspace=await currentWorkspace(page);assert.ok(await reject(page,{...base,workspaceId:otherWorkspace.id}));
  await picker([project]);await page.getByRole('button',{name:'Change project',exact:true}).click();
  await page.evaluate(({workspaceId})=>window.theseus.clearLibrary({workspaceId}),{workspaceId:workspace.id});assert.ok(await reject(page,base));assert.equal((await callList()).length,2);
  // Main-owned saved agent, selected visibly from a typed mention.
  const agent=await page.evaluate(()=>window.theseus.saveAgentProfile({name:'Context agent',icon:'code',color:'violet',description:'Fixture agent',runtime:'codex',model:null,reasoningEffort:null,instructions:'AGENT_INSTRUCTION_SENTINEL',memory:'personal-project',sandbox:'read-only',timeoutSeconds:60,folderChoice:null}));
  await page.reload();await home(page);await expect(page.getByRole('option',{name:'Context agent',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Change project',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('@Context');await page.getByRole('button',{name:'Use @Context agent',exact:true}).click();await expect(page.getByRole('combobox',{name:'Run agent',exact:true})).toHaveValue(agent.id);
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Explain the project');await page.getByRole('button',{name:'Start Codex',exact:true}).click();await completed(page);assert.ok((await callList())[2].prompt.includes('AGENT_INSTRUCTION_SENTINEL'));assert.ok((await callList())[2].args.includes('read-only'));
  const run=await page.evaluate(async()=>(await window.theseus.getRunHistory()).runs.find(run=>run.task==='Review this project and verify locally'));assert.equal(run.taskContextSelection.files.length,1);assert.equal(run.taskContextSelection.invocationIds.length,2);assert.equal(JSON.stringify(run.taskContextSelection).includes('ATTACHMENT_SENTINEL'),false);
  await desktop.close();desktop=undefined;page=await launch();const restored=await page.evaluate(()=>window.theseus.getRunHistory());assert.equal(restored.runs.find(r=>r.id===run.id).taskContextSelection.files[0].sha256,run.taskContextSelection.files[0].sha256);
  const demoUrl=new URL(page.url());demoUrl.search='?s=c1&static=1';await page.goto(demoUrl.href);await expect(page.locator('.thread[data-session="c1"]')).toBeVisible();
  await expect(page.locator('.demo-session-note')).toContainText('Demo · simulated');await expect(page.getByRole('button',{name:'Remember this',exact:true})).toBeDisabled();
  await page.getByRole('textbox',{name:'Message Forge',exact:true}).fill('My reviewed demo draft');await page.getByRole('button',{name:'Remember this',exact:true}).click();await expect(page.getByRole('textbox',{name:'Meaning',exact:true})).toHaveValue('My reviewed demo draft');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await page.getByRole('button',{name:'Compose live task with files, mentions & commands',exact:true}).click();await expect(page.getByRole('radio',{name:'Codex · Live',exact:true})).toHaveAttribute('aria-checked','true');await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toHaveValue('My reviewed demo draft');assert.equal((await callList()).length,3);
  assert.deepEqual(errors,[]);console.log('PASS composer native selection/cancel, explicit include/exclude, visible file/agent mention, command/skill prompt invocation, reviewed scoped Remember, hostile sender/stale/removed/cross-project context rejection, provenance restart, demo Remember/cancel/live transition, 1100px layout; fixture only.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
