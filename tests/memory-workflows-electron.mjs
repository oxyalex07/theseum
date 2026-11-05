// Disposable Electron workflow integration. No agent runs or cloud memory services.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const directory=await mkdtemp(join(tmpdir(),'theseus-memory-workflow-electron-'));
const portable=join(directory,'my-real-memory.json');
const demoFile=join(directory,'demo.json');
let desktop;
const errors=[];
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();}
async function graph(page){return page.evaluate(()=>window.theseus.getMemoryGraph());}
async function action(page,request){return page.evaluate(request=>window.theseus.memoryWorkflow(request),request);}
async function dialogFile(path){await desktop.evaluate(({dialog},path)=>{dialog.showOpenDialog=async()=>({canceled:!path,filePaths:path?[path]:[]});dialog.showSaveDialog=async()=>({canceled:!path,filePath:path});},path);}
try{
  await mkdir('artifacts/verification',{recursive:true});
  const env={...process.env,THESEUS_USER_DATA_DIR:join(directory,'profile')};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});let page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  await dialogFile(portable);await nav(page,'Memory');
  await page.getByRole('button',{name:'Extract proposals',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Text to extract',{exact:true}).fill('I prefer concise responses.\nWe must verify every change.\nWe use TypeScript.');
  await dialog.getByRole('button',{name:'Generate proposals',exact:true}).click();await expect(dialog).toContainText('3 proposals');await page.setViewportSize({width:1100,height:700});await page.screenshot({path:'artifacts/verification/memory-extraction-review-1100.png'});assert.equal((await graph(page)).records.length,0);
  const checks=dialog.getByRole('checkbox');assert.equal(await checks.count(),3);for(let i=0;i<3;i++)await expect(checks.nth(i)).not.toBeChecked();
  await checks.nth(0).check();await checks.nth(1).check();await dialog.getByRole('button',{name:'Save 2 reviewed proposals',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal((await graph(page)).records.length,2);
  let state=await graph(page);assert.equal(state.records[0].source.kind,'extraction');assert.equal(state.records[0].source.excerpt,'I prefer concise responses.');
  // Add a relationship, a previous version, and a duplicate; all provenance must survive a file round trip.
  state=await page.evaluate(async()=>{
    const graph=await window.theseus.getMemoryGraph(),[a,b]=graph.records;
    await window.theseus.saveMemory({kind:'relationship',from:a.rootId,to:b.rootId,label:'supports',meaning:'Concise responses support review.',scope:{kind:'personal'},source:{kind:'manual',note:'Reviewed edge'}});
    await window.theseus.saveMemory({id:a.id,kind:'node',nodeType:'preference',label:'Reply style',meaning:'Prefer concise responses.',scope:{kind:'personal'},source:{kind:'manual',note:'Revised wording'}});
    await window.theseus.moveMemoryNode(a.rootId,{x:100,y:80});
    return window.theseus.saveMemory({kind:'node',nodeType:'preference',label:'Response preference',meaning:'Prefer brief replies.',scope:{kind:'personal'},source:{kind:'manual',note:'Redundant note'}});
  });
  await page.reload();await nav(page,'Memory');await page.getByText('Import, export & portable sync',{exact:true}).click();
  await page.getByLabel('Export owner label',{exact:true}).fill('Test-owned graph');await page.getByRole('button',{name:'Export real graph…',exact:true}).click();await expect(page.locator('.memory-workflow-tools [role="status"]')).toContainText('Real memory graph exported.');
  const exported=JSON.parse(await readFile(portable,'utf8'));assert.equal(exported.format,'theseus-memory');assert.equal(exported.demo,false);assert.equal(exported.owner.label,'Test-owned graph');assert.deepEqual(exported.graph.records,state.records);assert.deepEqual(exported.graph.positions,state.positions);
  // Bulk impact includes the edge only once, all old versions, and layout. Cancel is inert.
  await page.getByRole('button',{name:'Select visible results',exact:true}).click();await page.getByRole('button',{name:'Delete selected…',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog.getByTestId('memory-delete-impact')).toContainText('3 facts · 1 relationships · 5 total versions · 1 saved positions');await page.screenshot({path:'artifacts/verification/memory-bulk-review-1100.png'});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await graph(page)).records.length,5);
  await page.getByRole('button',{name:'Delete selected…',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog.getByTestId('memory-delete-impact')).toBeVisible();await dialog.getByRole('button',{name:'Delete permanently',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal((await graph(page)).records.length,0);assert.equal(JSON.parse(await readFile(join(directory,'profile','memory','graph.json'),'utf8')).records.length,0);
  // Import is reviewed and does not silently add context.
  await page.getByRole('button',{name:'Import real graph…',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog).toContainText('Test-owned graph');assert.equal((await graph(page)).records.length,0);
  await dialog.getByRole('button',{name:'Import reviewed graph',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal((await graph(page)).records.length,5);
  await page.getByRole('checkbox',{name:'Local semantic search',exact:true}).check();await page.getByRole('textbox',{name:'Search memories',exact:true}).fill('succinct replies');await expect(page.locator('.memory-results')).toContainText('Reply style');await expect(page.locator('.memory-results')).toContainText('Response preference');await page.getByRole('textbox',{name:'Search memories',exact:true}).fill('');
  await page.locator('.memory-duplicates>summary').click();await expect(page.locator('.memory-duplicates')).toContainText('Similar local concepts');await page.getByRole('button',{name:'Select second for deletion',exact:true}).first().click();await expect(page.locator('.memory-bulk-toolbar')).toContainText('1 selected for deletion');await page.getByRole('button',{name:'Clear bulk selection',exact:true}).click();
  // Layout-only changes are visible conflicts even when every fact/version is identical.
  const layoutRoot=Object.keys(exported.graph.positions)[0],layoutFile=JSON.parse(await readFile(portable,'utf8'));
  layoutFile.graph.positions[layoutRoot]={x:900,y:800};await writeFile(portable,JSON.stringify(layoutFile));
  await page.getByRole('button',{name:'Import real graph…',exact:true}).click();dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Layout conflict');await expect(dialog).toContainText('Saved position: x 100, y 80');await expect(dialog).toContainText('Saved position: x 900, y 800');
  await expect(dialog.getByRole('button',{name:'Import reviewed graph',exact:true})).toBeDisabled();await page.screenshot({path:'artifacts/verification/memory-layout-conflict-1100.png'});
  await dialog.getByRole('combobox').selectOption('local');await dialog.getByRole('button',{name:'Import reviewed graph',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual((await graph(page)).positions[layoutRoot],{x:100,y:80});
  await page.getByRole('button',{name:'Import real graph…',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('combobox').selectOption('incoming');await dialog.getByRole('button',{name:'Import reviewed graph',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual((await graph(page)).positions[layoutRoot],{x:900,y:800});
  assert.equal((await action(page,{action:'import'})).transfer.groups.find(g=>g.rootId===layoutRoot).status,'identical');
  delete layoutFile.graph.positions[layoutRoot];await writeFile(portable,JSON.stringify(layoutFile));
  await page.getByRole('button',{name:'Import real graph…',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog).toContainText('No saved position (automatic layout)');
  await dialog.getByRole('combobox').selectOption('incoming');await dialog.getByRole('button',{name:'Import reviewed graph',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal((await graph(page)).positions[layoutRoot],undefined);
  await action(page,{action:'export',ownerLabel:'Test-owned graph'});assert.deepEqual(JSON.parse(await readFile(portable,'utf8')).graph.positions,{});
  // Unbounded envelope and stored metadata dates reject through actual IPC without changing disk or memory.
  const validPortable=await readFile(portable,'utf8'),secureBefore=await graph(page),secureDisk=await readFile(join(directory,'profile','memory','graph.json'),'utf8');
  const badDate=JSON.parse(validPortable);badDate.exportedAt=' '.repeat(1_000_000)+'2026-10-29';await writeFile(portable,JSON.stringify(badDate));await assert.rejects(()=>action(page,{action:'import'}),/export date/);
  assert.deepEqual(await graph(page),secureBefore);assert.equal(await readFile(join(directory,'profile','memory','graph.json'),'utf8'),secureDisk);await writeFile(portable,validPortable);
  // FIFO selections and replaced connected files must return while Electron remains responsive.
  if(process.platform!=='win32'){
    const fifo=join(directory,'pipe.json');execFileSync('mkfifo',[fifo]);await dialogFile(fifo);await assert.rejects(()=>action(page,{action:'import'}),/regular JSON file/);await dialogFile(portable);
    await action(page,{action:'sync-connect'});await rm(portable);execFileSync('mkfifo',[portable]);await assert.rejects(()=>action(page,{action:'sync-pull'}),/regular JSON file/);
    assert.deepEqual(await graph(page),secureBefore);await rm(portable);await writeFile(portable,validPortable);await action(page,{action:'sync-disconnect'});
  }
  // Same lineage diverges. Local/incoming choices are mandatory, and the complete losing lineage is discarded only on confirmation.
  const before=(await graph(page)).records.filter(r=>r.status==='current'&&r.kind==='node')[0];
  await page.evaluate(async before=>window.theseus.saveMemory({id:before.id,kind:'node',nodeType:before.nodeType,label:before.label,meaning:'Local revision preserved.',scope:before.scope,source:{kind:'manual',note:'Local edit'}}),before);
  await page.getByRole('button',{name:'Import real graph…',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Import reviewed graph',exact:true})).toBeDisabled();await page.screenshot({path:'artifacts/verification/memory-conflict-review-1100.png'});await dialog.getByRole('combobox').selectOption('local');await dialog.getByRole('button',{name:'Import reviewed graph',exact:true}).click();await dialog.waitFor({state:'hidden'});assert((await graph(page)).records.some(r=>r.meaning==='Local revision preserved.'));
  // Sync is a chosen portable file: connect/pull, review replacement, verify real file writes, disconnect.
  await page.getByRole('button',{name:'Choose portable sync file…',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Review sync publish',exact:true}).click();dialog=page.getByRole('dialog');await expect(dialog).toContainText('Publish this device’s graph?');await dialog.getByRole('button',{name:'Replace portable file',exact:true}).click();await dialog.waitFor({state:'hidden'});assert(JSON.parse(await readFile(portable,'utf8')).graph.records.some(r=>r.meaning==='Local revision preserved.'));
  // External file changes invalidate pending review; the backend leaves local graph intact.
  const pending=(await action(page,{action:'sync-pull'})).transfer;const prior=await graph(page);const changed=JSON.parse(await readFile(portable,'utf8'));changed.owner.label='Updated externally';await writeFile(portable,JSON.stringify(changed));await assert.rejects(()=>action(page,{action:'apply-transfer',id:pending.id,choices:{}}),/file changed/);assert.deepEqual(await graph(page),prior);
  await page.getByRole('button',{name:'Disconnect sync',exact:true}).click();
  await writeFile(demoFile,JSON.stringify({version:1,mock:true,memory:{code:['Simulated']}}));await dialogFile(demoFile);await assert.rejects(()=>action(page,{action:'import'}),/real-memory export/);
  // Malformed actions and renderer-provided paths cannot read/write arbitrary files.
  for(const request of [{action:'arbitrary-file',path:portable},{action:'delete-confirm',ids:['bad'],revision:0},{action:'extract',scope:{kind:'project',projectPath:'/unknown'},source:{kind:'user-text',title:'Notes',text:'Always test.'}},{action:'save-extraction',id:'bad',candidates:[]}])await assert.rejects(()=>action(page,request));
  await page.setViewportSize({width:1100,height:700});await page.locator('.memory-workflow-tools>summary').click();await page.locator('.memory-duplicates>summary').click();await page.locator('.memory-page').evaluate(el=>{el.scrollTop=0;});assert(await page.locator('.memory-page').evaluate(el=>el.scrollWidth<=el.clientWidth));await page.screenshot({path:'artifacts/verification/memory-workflows-1100.png'});await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'artifacts/verification/memory-workflows-1440.png'});
  // Semantic suggestions remain unchecked; only an explicit checkbox affects the task selection.
  const project=join(directory,'project');await mkdir(project);await dialogFile(project);await nav(page,'Home');await page.getByRole('radio',{name:'Codex · Live',exact:true}).click();await page.getByRole('button',{name:'Choose project folder',exact:true}).click();await expect(page.getByRole('button',{name:'Change project',exact:true})).toBeVisible();
  await page.locator('.memory-picker>summary').click();await expect(page.locator('.memory-picker>summary')).toContainText('0 selected');await page.getByRole('textbox',{name:'Search memories to include',exact:true}).fill('succinct replies');
  const suggestions=page.locator('.memory-picker-list input[type=checkbox]');assert((await suggestions.count())>=2);await expect(page.getByRole('checkbox',{name:'Include Reply style',exact:true})).toBeVisible();await expect(page.getByRole('checkbox',{name:'Include Response preference',exact:true})).toBeVisible();for(let i=0;i<await suggestions.count();i++)await expect(suggestions.nth(i)).not.toBeChecked();
  await page.getByRole('checkbox',{name:'Include Reply style',exact:true}).check();await expect(page.locator('.memory-picker>summary')).toContainText('1 selected');await expect(page.getByTestId('selected-memory-summary')).toContainText('Will include 1 memories');
  const selectedWorkspace=await page.evaluate(async()=>(await window.theseus.getExecutionState()).workspace);const selectedFact=(await graph(page)).records.find(r=>r.status==='current'&&r.label==='Reply style');
  await assert.rejects(()=>page.evaluate(({workspaceId,id})=>window.theseus.startAgentRun({workspaceId,task:'Stale revision must reject before execution.',memoryIds:[id],memoryRevision:0}),{workspaceId:selectedWorkspace.id,id:selectedFact.id}),/Memory changed/);assert.equal((await page.evaluate(()=>window.theseus.getExecutionState())).runs.length,0);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await expect(page.locator('.memory-picker>summary')).toContainText('0 selected');
  const persisted=await graph(page);await desktop.close();desktop=await _electron.launch({args:['.'],env});page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();assert.deepEqual((await graph(page)).records,persisted.records);assert.equal((await action(page,{action:'status'})).sync,undefined);
  await nav(page,'Settings');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Memory & privacy',exact:true}).click();await expect(page.getByRole('button',{name:'Export demo preferences',exact:true})).toBeVisible();assert.deepEqual(errors,[]);
  console.log('PASS reviewed extraction, real export/import, complete history/relationships/provenance/layout, conflict review, moved/removed layout choices, whitespace-date/FIFO rejection, local semantic search/dedup, bulk impact/cancel/delete, native-file sync, external-change refusal, validation, restart, demo separation, and 1100/1440 layouts; no provider tasks.');
}finally{await desktop?.close();await rm(directory,{recursive:true,force:true});}
