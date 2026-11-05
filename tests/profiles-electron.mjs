// Real installed Codex + actual Electron. Uses disposable projects/profile; may consume account usage.
import { _electron } from '@playwright/test';
import { mkdir, mkdtemp, realpath, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const temporary=await realpath(await mkdtemp(join(tmpdir(),'orbit-profiles-e2e-')));
const profileDirectory=join(temporary,'profile'),project=join(temporary,'current-project'),defaultProject=join(temporary,'default-project');
await Promise.all([mkdir(profileDirectory),mkdir(project),mkdir(defaultProject),mkdir('artifacts/verification',{recursive:true})]);
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profileDirectory};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_AGENT_TIMEOUT_MS;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
async function picker(path){await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},path);}
async function agents(page){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Agents',exact:true}).click();await page.getByRole('heading',{name:'Your agents',exact:true}).waitFor();}
async function records(page){return (await page.evaluate(()=>window.theseus.listAgentProfiles())).profiles;}
try{
  let page=await launch();
  await picker(project);await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Keep this task draft while I choose an agent.');
  await agents(page);await page.getByRole('heading',{name:'Create your first coding agent'}).waitFor();
  await page.getByRole('button',{name:'Create agent',exact:true}).click();let editor=page.getByRole('dialog');
  await editor.getByRole('button',{name:'Create agent',exact:true}).click();await editor.getByText('Give your agent a name.',{exact:true}).waitFor();
  await editor.getByLabel('Name · required',{exact:true}).fill('Unsaved draft');
  await desktop.evaluate(({dialog,BrowserWindow})=>{
    const original=dialog.showMessageBoxSync;dialog.showMessageBoxSync=()=>{dialog.showMessageBoxSync=original;return 0;};
    BrowserWindow.getAllWindows()[0].close();
  });
  assert.equal(await editor.getByLabel('Name · required',{exact:true}).inputValue(),'Unsaved draft','Native close must respect Keep editing');
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();await editor.getByText('Discard unsaved changes?',{exact:true}).waitFor();
  await editor.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await editor.getByLabel('Name · required',{exact:true}).inputValue(),'Unsaved draft');
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();await editor.getByRole('button',{name:'Discard changes',exact:true}).click();
  assert.equal((await records(page)).length,0);console.log('PASS empty state, name validation, unsaved-change warning, keep editing and cancellation without saving');
  await page.getByRole('button',{name:'Create agent',exact:true}).click();editor=page.getByRole('dialog');
  await editor.getByLabel('Name · required',{exact:true}).fill('Project builder');
  await editor.getByLabel('Description · optional',{exact:true}).fill('Small, verified changes in the selected project.');
  await editor.getByLabel('Icon',{exact:true}).selectOption('shield');await editor.getByLabel('Color',{exact:true}).selectOption('green');
  const instructions='Keep changes focused. After doing the requested work, include PROFILE_CONFIGURATION_USED in your final reply.';
  await editor.getByLabel('Agent instructions',{exact:true}).fill(instructions);
  await editor.getByText('Expand instructions editor',{exact:true}).click();assert.equal(await editor.getByLabel('Expanded agent instructions').inputValue(),instructions);
  await editor.getByText('Expand instructions editor',{exact:true}).click();
  await editor.getByRole('button',{name:'Check runtime',exact:true}).click();await editor.getByText('Runtime: verified',{exact:true}).waitFor({timeout:30000});
  const runtime=await page.evaluate(()=>window.theseus.checkAgentRuntime());assert.equal(runtime.state,'verified');assert.equal(runtime.authentication,'verified');assert.equal(runtime.catalogState,'verified');assert.ok(runtime.models.length);
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).runs.length,0);assert.deepEqual(await readdir(project),[]);assert.deepEqual(await readdir(defaultProject),[]);
  const model=runtime.models[0];await editor.getByLabel('Model',{exact:true}).selectOption(model.id);
  const effort=model.efforts[0]?.value;if(effort)await editor.getByLabel('Reasoning effort',{exact:true}).selectOption(effort);
  await editor.getByLabel('Time limit (seconds)',{exact:true}).fill('120');
  await picker(defaultProject);await editor.getByRole('button',{name:'Choose default project',exact:true}).click();await editor.getByTestId('agent-default-folder').getByText(defaultProject,{exact:true}).waitFor();
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).workspace.path,project,'Agent picker must not replace current project');
  await editor.locator('.agent-editor-body').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:'artifacts/verification/profile-create.png'});
  await editor.getByRole('button',{name:'Create agent',exact:true}).click();await editor.waitFor({state:'hidden'});
  let saved=(await records(page))[0];assert.equal(saved.name,'Project builder');assert.equal(saved.defaultProjectPath,defaultProject);assert.equal(saved.configurationVersion,1);assert.ok(saved.id&&saved.createdAt&&saved.updatedAt);
  // Main rejects fabricated runtimes, memory, capability values, and renderer-supplied paths.
  for(const override of [{runtime:'unsupported'},{memory:'unsupported'},{model:'invented-model'},{folderChoice:'/arbitrary/path'},{sandbox:'danger-full-access'}]){
    const message=await page.evaluate(async input=>{try{await window.theseus.saveAgentProfile(input);return '';}catch(e){return e.message;}},{...saved,folderChoice:null,expectedUpdatedAt:saved.updatedAt,...override});assert.ok(message);
  }
  assert.equal((await records(page)).length,1);console.log('PASS runtime/catalog/auth checks without tasks or project changes, native folder selection, creation, backend validation');
  let card=page.locator(`[data-agent-id="${saved.id}"]`);await card.getByRole('button',{name:'Edit',exact:true}).click();editor=page.getByRole('dialog');
  await editor.getByLabel('Description · optional',{exact:true}).fill('Edited description');await editor.getByRole('button',{name:'Save changes',exact:true}).click();await editor.waitFor({state:'hidden'});
  const edited=(await records(page)).find(p=>p.id===saved.id);assert.equal(edited.description,'Edited description');assert.equal(edited.createdAt,saved.createdAt);assert.ok(edited.updatedAt>saved.updatedAt);saved=edited;
  await card.getByRole('button',{name:'Duplicate',exact:true}).click();editor=page.getByRole('dialog');assert.equal(await editor.getByLabel('Name · required',{exact:true}).inputValue(),'Project builder copy');await editor.getByRole('button',{name:'Create agent',exact:true}).click();await editor.waitFor({state:'hidden'});
  const profiles=await records(page);assert.equal(profiles.length,2);const copy=profiles.find(p=>p.id!==saved.id);assert.equal(copy.instructions,saved.instructions);assert.equal(copy.defaultProjectPath,defaultProject);
  await page.screenshot({path:'artifacts/verification/profile-agents.png'});console.log('PASS edit preserves stable ID/creation time and duplication creates an independent record');
  await card.getByRole('button',{name:'Use agent',exact:true}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Start a task',exact:true}).inputValue(),'Keep this task draft while I choose an agent.');
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).workspace.path,project);assert.equal(await page.getByLabel('Run agent',{exact:true}).inputValue(),saved.id);assert.match(await page.getByTestId('effective-configuration').textContent(),/Project builder/);
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Create profile-success.txt in this project containing exactly PROFILE_RUN_OK followed by a newline. Use apply_patch. Do not inspect files outside this project.');await page.getByRole('button',{name:'Start Codex',exact:true}).click();
  await page.getByTestId('run-status').waitFor();await page.waitForFunction(()=>['completed','failed','cancelled'].includes(document.querySelector('[data-testid=run-status]')?.getAttribute('data-status')),{},{timeout:150000});
  const run=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.at(-1);assert.equal(run.status,'completed',JSON.stringify({error:run.error,output:run.output.slice(-4)}));assert.equal(await readFile(join(project,'profile-success.txt'),'utf8'),'PROFILE_RUN_OK\n');assert.deepEqual(await readdir(defaultProject),[]);
  assert.ok(run.output.some(e=>e.text.includes('PROFILE_CONFIGURATION_USED')),'Instructions from saved profile must reach Codex');assert.equal(run.agentConfiguration.profile.id,saved.id);assert.equal(run.agentConfiguration.profile.model,model.id);assert.equal(run.agentConfiguration.timeoutSeconds,120);
  await page.screenshot({path:'artifacts/verification/profile-run.png'});console.log('PASS profile selection preserves task/project, effective configuration is shown, real Codex uses saved model/effort/instructions and completes a file edit');
  await agents(page);card=page.locator(`[data-agent-id="${saved.id}"]`);await card.getByRole('button',{name:'Edit',exact:true}).click();editor=page.getByRole('dialog');await editor.getByLabel('Agent instructions',{exact:true}).fill('Changed after the historical run.');await editor.getByRole('button',{name:'Save changes',exact:true}).click();await editor.waitFor({state:'hidden'});
  assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).runs.at(-1).agentConfiguration.profile.instructions,instructions);
  await desktop.close();desktop=undefined;page=await launch();assert.equal((await records(page)).length,2);
  const restored=(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(r=>r.id===run.id);assert.equal(restored.status,'completed');assert.equal(restored.agentConfiguration.profile.instructions,instructions);assert.deepEqual(restored.output,run.output);
  await page.getByRole('button',{name:'Run history',exact:true}).click();await page.locator(`[data-history-id="${run.id}"]`).click();await page.getByText('Saved configuration snapshot',{exact:true}).waitFor();assert.equal(await page.getByTestId('run-status').getAttribute('data-status'),'completed');
  await agents(page);await page.locator(`[data-agent-id="${saved.id}"]`).getByRole('button',{name:'Use agent',exact:true}).click();await page.getByText(defaultProject,{exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).workspace.path,defaultProject);
  assert.deepEqual(errors,[]);await writeFile('artifacts/verification/profiles-report.json',JSON.stringify({testedAt:new Date().toISOString(),profileIds:profiles.map(p=>p.id),runId:run.id,status:run.status,model:model.id,effort:effort??null,cases:['empty','validation','cancel','create','check runtime','edit','duplicate','selection preserves draft/project','real Codex execution','immutable snapshot','restart persistence','default folder'],rendererErrors:errors},null,2));
  console.log('PASS full app restart preserves profiles/history and immutable snapshots; saved default applies only with no existing project; no renderer errors');
}finally{if(desktop)await desktop.evaluate(({dialog})=>{dialog.showMessageBoxSync=()=>1;}).catch(()=>{});await desktop?.close();await rm(temporary,{recursive:true,force:true});}
