// Saved-run fixtures, disposable profile, real navigation/restart and IPC. No providers or ports.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-concurrency-56-'))),profile=join(root,'profile'),project=join(root,'project');
await mkdir(project);await mkdir(join(profile,'run-history'),{recursive:true});
const run={id:randomUUID(),workspaceId:randomUUID(),revision:1,projectName:'fixture',projectPath:project,task:'Research concurrency',status:'completed',startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),output:[{sequence:1,kind:'message',text:'Saved findings https://example.test/source'}],truncated:false,agentConfiguration:{runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:1800}};
await writeFile(join(profile,'run-history',`${run.id}.json`),JSON.stringify({version:1,run}));
let desktop;const errors=[],kinds=['draft','outline','comparison'];
const labels={draft:'Draft',outline:'Outline',comparison:'Comparison'};
const orders=[['draft','outline','comparison'],['draft','comparison','outline'],['outline','draft','comparison'],['outline','comparison','draft'],['comparison','draft','outline'],['comparison','outline','draft']];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:'/usr/bin/false'};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();
  await desktop.evaluate(({BrowserWindow,dialog})=>{const window=BrowserWindow.getAllWindows()[0];window.hide();window.on('show',()=>window.hide());dialog.showMessageBoxSync=()=>1;});
  page.on('pageerror',error=>errors.push(error.message));await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
const saved=page=>page.evaluate(runId=>window.theseus.getResearch({runId}),run.id);
const home=page=>page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'Home',exact:true}).click();
const recovery=page=>page.getByRole('region',{name:'Recoverable Research drafts'}).getByRole('button');
async function open(page){
  await page.getByRole('button',{name:'Run history',exact:true}).click();await page.locator(`[data-history-id="${run.id}"] .history-open`).click();
  await page.getByRole('navigation',{name:'Run inspector'}).getByRole('button',{name:'Research',exact:true}).click();
  const panel=page.getByRole('region',{name:'Saved research workspace'});await expect(panel).toHaveAttribute('aria-busy','false');return panel;
}
const select=(panel,kind)=>panel.getByRole('combobox',{name:'Research artifact'}).selectOption(kind);
const editor=(panel,kind)=>panel.getByRole('textbox',{name:`${labels[kind]} Markdown`});
const draftData=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('theseus.research-drafts.v1')).drafts);
try{
  let page=await launch(),panel=await open(page);
  // The generation response keeps Draft before Outline. Do not refresh, navigate,
  // remount or create Comparison before editing: that used to conceal the defect.
  for(const createThird of [false,true])for(const order of [['draft','outline'],['outline','draft']]){
    for(const kind of ['draft','outline']){
      await select(panel,kind);await panel.getByRole('button',{name:`Create ${kind} from results`}).click();
      await expect(panel).toContainText(`${labels[kind]} created from saved assistant results.`);
    }
    const before=(await saved(page)).document,contents={};
    for(const kind of ['draft','outline']){
      contents[kind]=before.artifacts[kind].content+`\nTWO_ARTIFACTS_${createThird}_${order[0]}_${kind}`;
      await select(panel,kind);await editor(panel,kind).fill(contents[kind]);
    }
    if(createThird){
      await select(panel,'comparison');await panel.getByRole('button',{name:'Create comparison from results'}).click();
      await expect(panel).toContainText('Comparison created from saved assistant results.');
      const current=(await saved(page)).document,drafts=await draftData(page);assert.equal(drafts.length,2);
      for(const draft of drafts){assert.equal(draft.revision,current.revision);assert.equal(draft.content,contents[draft.kind]);assert.equal(draft.baseContent,before.artifacts[draft.kind].content);}
    }
    for(const [index,kind] of order.entries()){
      await select(panel,kind);await expect(editor(panel,kind)).toHaveValue(contents[kind]);
      await panel.getByRole('button',{name:`Save ${kind}`,exact:true}).click();
      await expect(panel).toContainText(`${labels[kind]} saved with citations.`);await expect(panel.getByRole('alert')).toHaveCount(0);
      const current=(await saved(page)).document,drafts=await draftData(page);assert.equal(drafts.length,1-index);
      for(const savedKind of order.slice(0,index+1))assert.equal(current.artifacts[savedKind].content,contents[savedKind]);
      for(const draft of drafts){assert.equal(draft.revision,current.revision);assert.equal(draft.content,contents[draft.kind]);assert.equal(draft.baseContent,before.artifacts[draft.kind].content);}
      assert.equal(!!current.artifacts.comparison,createThird);
    }
    console.log(`PASS fresh Draft/Outline, save ${order.join(' then ')}, create third with siblings: ${createThird}`);
    await home(page);run.id=randomUUID();await writeFile(join(profile,'run-history',`${run.id}.json`),JSON.stringify({version:1,run}));
    // Relaunch to load the new saved-run fixture only after the uninterrupted scenario.
    await desktop.close();desktop=undefined;page=await launch();panel=await open(page);
  }
  for(const kind of kinds){await select(panel,kind);await panel.getByRole('button',{name:`Create ${kind} from results`}).click();}
  for(const [cycle,order] of orders.entries()){
    const before=(await saved(page)).document,contents={};
    for(const kind of kinds){contents[kind]=before.artifacts[kind].content+`\nLOCAL_${cycle}_${kind}`;await select(panel,kind);await editor(panel,kind).fill(contents[kind]);}
    for(const [index,kind] of order.entries()){
      if(cycle%2===0){
        await select(panel,kind);await expect(editor(panel,kind)).toHaveValue(contents[kind]);
        await panel.getByRole('button',{name:`Save ${kind}`,exact:true}).click();
        await expect(panel).toContainText(`${labels[kind]} saved with citations.`);
        await expect(panel.getByRole('alert')).toHaveCount(0);
        await expect(panel.getByRole('button',{name:`Save ${kind}`,exact:true})).toBeDisabled();
      }else{
        await home(page);await recovery(page).click();const dialog=page.getByRole('dialog');
        await dialog.getByRole('button',{name:`Save ${kind}`,exact:true}).click();await expect(dialog.getByRole('alert')).toHaveCount(0);
        await expect(dialog.getByRole('button',{name:`Save ${kind}`,exact:true})).toHaveCount(0);
        await dialog.getByRole('button',{name:'Keep drafts and close'}).click();
      }
      const current=(await saved(page)).document;
      for(const savedKind of order.slice(0,index+1))assert.equal(current.artifacts[savedKind].content,contents[savedKind]);
      const drafts=await draftData(page);assert.equal(drafts.length,2-index);
      for(const draft of drafts){assert.equal(draft.content,contents[draft.kind]);assert.equal(draft.revision,current.revision);assert.equal(draft.baseContent,before.artifacts[draft.kind].content);}
      // Persist the reconciled siblings, quit the process, and save them after restart.
      if(index===0){await desktop.close();desktop=undefined;page=await launch();}
      else await home(page);
      panel=await open(page);
      await expect(panel).not.toContainText('Saved research changed');
    }
    await expect(recovery(page)).toHaveCount(0);
  }
  // Saving one local artifact must not bless an external sibling disk mutation,
  // including a writer that kept the same document revision.
  const original=(await saved(page)).document;
  for(const kind of ['draft','outline']){await select(panel,kind);await editor(panel,kind).fill(original.artifacts[kind].content+`\nBEFORE_EXTERNAL_${kind}`);}
  const diskPath=join(profile,'research',`${run.id}.json`),external=JSON.parse(await readFile(diskPath,'utf8'));
  external.artifacts.outline.content+='\nEXTERNAL_DISK_OUTLINE';await writeFile(diskPath,JSON.stringify(external));
  await select(panel,'draft');await panel.getByRole('button',{name:'Save draft',exact:true}).click();await expect(panel).toContainText('Draft saved with citations.');
  const [retained]=await draftData(page);assert.equal(retained.kind,'outline');assert.equal(retained.revision,original.revision);
  await home(page);await desktop.close();desktop=undefined;page=await launch();panel=await open(page);await select(panel,'outline');
  await expect(editor(panel,'outline')).toHaveValue(original.artifacts.outline.content+'\nBEFORE_EXTERNAL_outline');await expect(panel).toContainText('Saved research changed');
  await panel.getByRole('button',{name:'Save outline',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Research changed');
  assert.equal((await saved(page)).document.artifacts.outline.content,external.artifacts.outline.content);
  await home(page);await recovery(page).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Save outline',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Research changed');
  await dialog.getByRole('button',{name:'Keep drafts and close'}).click();panel=await open(page);await select(panel,'outline');await panel.getByRole('button',{name:'Discard edits and refresh'}).click();
  // A normal second writer increments revision: the failed local save must keep all drafts.
  const current=(await saved(page)).document;
  for(const kind of ['draft','comparison']){await select(panel,kind);await editor(panel,kind).fill(current.artifacts[kind].content+`\nLOCAL_CONFLICT_${kind}`);}
  await page.evaluate(request=>window.theseus.saveResearch(request),{runId:run.id,kind:'draft',revision:current.revision,content:current.artifacts.draft.content+'\nEXTERNAL_WRITER'});
  await select(panel,'draft');await panel.getByRole('button',{name:'Save draft',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Research changed');
  assert.equal((await draftData(page)).length,2);assert.ok((await draftData(page)).every(d=>d.revision===current.revision));
  assert.ok((await saved(page)).document.artifacts.draft.content.endsWith('EXTERNAL_WRITER'));
  assert.deepEqual(errors,[]);
  console.log('PASS issue56: all six Draft/Outline/Comparison save orders via panel/recovery, exact contents and base provenance, normal navigation and six process restarts, external same-revision disk mutation and second-writer conflict retained.');
}finally{if(desktop)await desktop.close();await rm(root,{recursive:true,force:true});}
