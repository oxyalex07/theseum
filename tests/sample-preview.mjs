// Visual fixture isolation and interactions, in the actual Electron app. No agent task launched.
import { _electron } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const directory=await mkdtemp(join(tmpdir(),'orbit-samples-'));
await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(sample=false){
  const env={...process.env,THESEUS_USER_DATA_DIR:directory};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  if(sample)env.THESEUS_SAMPLE_PREVIEW='1';
  desktop=await _electron.launch({args:['.'],env});
  const page=await desktop.firstWindow();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();return page;
}
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();}
async function emptyStores(page){
  assert.equal((await page.evaluate(()=>window.theseus.listAgentProfiles())).profiles.length,0);
  assert.equal((await page.evaluate(()=>window.theseus.getMemoryGraph())).records.length,0);
}
try{
  let page=await launch(true);
  assert.equal(await page.getByRole('tab',{name:'Overview',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByText('Demo · simulated activity and results.',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Sample sessions',exact:true}).selectOption('r1');
  await page.getByRole('button',{name:'Review sample sources',exact:true}).click();
  await page.getByRole('navigation',{name:'Session inspector',exact:true}).getByRole('button',{name:'Sources',exact:true}).waitFor();
  await page.locator('.ibody .srcs').waitFor();
  await nav(page,'Home');
  await page.getByRole('combobox',{name:'Sample sessions',exact:true}).waitFor();
  await page.screenshot({path:'artifacts/verification/home-overview-samples.png'});
  await page.getByRole('tab',{name:'Crew',exact:true}).click();
  assert.equal(await page.locator('.insp .am').count(),12);
  await page.getByRole('tab',{name:'Memory',exact:true}).click();
  assert.equal(await page.locator('.home-memory-list details').count(),37);
  await page.locator('.home-memory-list summary').first().click();
  await page.screenshot({path:'artifacts/verification/sample-home-memory.png'});
  await nav(page,'Agents');
  assert.equal(await page.locator('[data-agent-id^="sample-agent-"]').count(),12);
  assert.equal(await page.getByRole('button',{name:'Use agent',exact:true}).count(),0);
  await page.screenshot({path:'artifacts/verification/sample-agents.png'});
  await nav(page,'Memory');
  await page.locator('.react-flow__node').first().waitFor();
  assert.equal(await page.locator('.react-flow__node').count(),19);
  assert.equal(await page.locator('.react-flow__edge').count(),18);
  await page.locator('[data-memory-result="sample-link-0"]').click();
  await page.getByRole('complementary',{name:'Memory details'}).getByText('Fictional sample · display preview only',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Edit memory',exact:true}).isDisabled(),true);
  await page.screenshot({path:'artifacts/verification/sample-memory.png'});
  await page.getByRole('textbox',{name:'Search memories'}).fill('PostgreSQL');
  assert.equal(await page.locator('[data-memory-result]').count(),3);
  await page.getByRole('textbox',{name:'Search memories'}).fill('');
  await page.getByRole('combobox',{name:'Memory filter',exact:true}).selectOption('project');
  await page.getByRole('combobox',{name:'Memory project filter'}).selectOption('/sample-projects/atlas');
  assert.equal(await page.locator('[data-memory-result]').count(),8);
  await page.locator('.react-flow__node').first().waitFor();
  const target=page.locator('.react-flow__node').first();const rect=await target.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+60,rect.y+rect.height/2+40,{steps:10});await page.mouse.up();
  await page.getByRole('button',{name:'Zoom In',exact:false}).click();
  await emptyStores(page);
  await desktop.close();desktop=undefined;page=await launch();
  await nav(page,'Agents');assert.equal(await page.locator('[data-agent-id^="sample-agent-"]').count(),12);
  await page.getByRole('button',{name:'Show saved data',exact:true}).click();
  await page.getByRole('heading',{name:'Create your first coding agent'}).waitFor();
  await nav(page,'Memory');await page.getByRole('heading',{name:'Your memory graph starts here'}).waitFor();
  await emptyStores(page);
  assert.deepEqual(errors,[]);
  console.log('PASS sample agents, Home tabs, graph, relationship sources, search, project filtering, drag, zoom, restart preference, saved-data toggle, no repository changes or renderer errors');
}finally{await desktop?.close();await rm(directory,{recursive:true,force:true});}
