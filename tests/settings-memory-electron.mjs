// Settings statistics use durable memory, independently of demo and sample data.
// No agent tasks or provider calls are launched.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const directory=await mkdtemp(join(tmpdir(),'theseus-settings-memory-'));
await mkdir('artifacts/verification',{recursive:true});
let desktop;
const errors=[];
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();}
async function settings(page,section='Memory & privacy'){
  await nav(page,'Settings');
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:section,exact:true}).click();
}
function row(page,label){return page.locator('.srow').filter({has:page.getByText(label,{exact:true})});}
async function count(page,value){await expect(row(page,'Saved memories')).toContainText(`${value} current saved records on this device, including facts and relationships.`);}
async function graph(page){return page.evaluate(()=>window.theseus.getMemoryGraph());}

try{
  const env={...process.env,THESEUS_USER_DATA_DIR:directory};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});
  const page=await desktop.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  await settings(page);await count(page,0);
  await expect(row(page,'Demo memory preferences')).toContainText(/\d+ simulated preferences across \d+ groups/);
  await page.screenshot({path:'artifacts/verification/settings-memory-empty.png'});

  // Populate the real store with two current nodes, a relationship, and an old version.
  const records=await page.evaluate(async()=>{
    const save=request=>window.theseus.saveMemory({scope:{kind:'personal'},source:{kind:'manual'},...request});
    let state=await save({kind:'node',nodeType:'preference',label:'Response style',meaning:'Use brief summaries.'});
    const first=state.records.at(-1);
    state=await save({kind:'node',nodeType:'goal',label:'Review changes',meaning:'Review each change.'});
    const second=state.records.at(-1);
    await save({kind:'relationship',from:first.rootId,to:second.rootId,label:'supports',meaning:'Brief summaries support review.'});
    state=await save({id:first.id,kind:'node',nodeType:'preference',label:first.label,meaning:'Use concise summaries.'});
    return state.records;
  });
  assert.equal(records.length,4);assert.equal(records.filter(r=>r.status==='current').length,3);
  await page.reload();await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  await settings(page);await count(page,3);

  // Saving via the UI must update the settings count without restarting.
  await page.getByRole('button',{name:'Open Memory',exact:true}).click();
  await page.getByRole('button',{name:'Add memory',exact:true}).click();
  const editor=page.getByRole('dialog');
  await editor.getByLabel('Label',{exact:true}).fill('UI saved fact');
  await editor.getByLabel('Meaning',{exact:true}).fill('A fact created through the memory editor.');
  await editor.getByRole('button',{name:'Save memory',exact:true}).click();
  await editor.waitFor({state:'hidden'});
  await settings(page);await count(page,4);
  await page.screenshot({path:'artifacts/verification/settings-memory-populated.png'});

  await nav(page,'Memory');await page.getByRole('button',{name:'Show sample data',exact:true}).click();
  await expect(page.locator('.memory-heading')).toContainText('37 current memories');
  await settings(page);await count(page,4);
  const beforeClear=await graph(page);
  await page.getByRole('button',{name:'Clear memory…',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText(/\d+ demo preferences/);
  await page.getByRole('dialog').getByRole('button',{name:'Clear memory',exact:true}).click();
  await expect(row(page,'Demo memory preferences')).toContainText('0 simulated preferences');
  await count(page,4);assert.deepEqual(await graph(page),beforeClear);
  await page.screenshot({path:'artifacts/verification/settings-memory-samples.png'});

  // Deletion through the real editor also updates the count, while sample data stays separate.
  await nav(page,'Memory');await page.getByRole('button',{name:'Show saved data',exact:true}).click();
  const added=(await graph(page)).records.find(r=>r.label==='UI saved fact');
  await page.locator(`[data-memory-result="${added.id}"]`).click();
  await page.getByRole('button',{name:'Delete memory',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Delete permanently',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await settings(page);await count(page,3);
  await page.getByRole('textbox',{name:'Search settings',exact:true}).fill('Saved memories');
  await count(page,3);
  await page.getByRole('textbox',{name:'Search settings',exact:true}).fill('');
  await settings(page,'About');
  await expect(row(page,'Agent execution')).toContainText('Live tasks run through Codex in the Electron app and can make provider calls.');
  await expect(row(page,'Demo features')).toContainText('Demo tasks and sample previews are simulated and do not make provider calls.');
  await page.screenshot({path:'artifacts/verification/settings-about.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS empty, populated, superseded, sample-preview, demo-clear, save/delete updates, settings search, and About execution copy');
}finally{await desktop?.close();await rm(directory,{recursive:true,force:true});}
