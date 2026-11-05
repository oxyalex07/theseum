import { _electron } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const directory=await mkdtemp(join(tmpdir(),'orbit-resources-'));await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});
  await page.getByRole('button',{name:'Open your profile'}).waitFor();
  await desktop.evaluate(({shell})=>{globalThis.openedUrls=[];shell.openExternal=async url=>{globalThis.openedUrls.push(url);};});
  return page;
}
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();assert.equal(await page.locator('.side,.insp').count(),0);}
try{
  let page=await launch();await nav(page,'Library');await page.getByRole('heading',{name:'Your library starts here'}).waitFor();
  await page.getByRole('button',{name:'Show sample data'}).click();assert.equal(await page.locator('[data-library-id]').count(),49);
  await page.getByRole('textbox',{name:'Search library'}).fill('PostgreSQL');assert.equal(await page.locator('[data-library-id]').count(),3);
  await page.locator('[data-library-id="sample-memory-12"]').click();await page.getByRole('complementary',{name:'Library item details'}).getByText(/Fictional sample/).waitFor();
  await page.getByRole('textbox',{name:'Search library'}).fill('');await page.locator('.resource-filters').getByRole('button',{name:/Agents/}).click();assert.equal(await page.locator('[data-library-id]').count(),12);
  await page.screenshot({path:'artifacts/verification/library-page.png'});
  await page.getByRole('button',{name:'Show saved data'}).click();assert.equal((await page.evaluate(()=>window.theseus.getMemoryGraph())).records.length,0);
  await nav(page,'Browser');await page.getByRole('heading',{name:'Your corner of the web'}).waitFor();
  await page.getByRole('textbox',{name:'Web address or search'}).fill('javascript:alert(1)');await page.getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal((await desktop.evaluate(()=>globalThis.openedUrls)).length,0);
  await assert.rejects(()=>page.evaluate(()=>window.theseus.openBrowserUrl('file:///etc/passwd')));
  await assert.rejects(()=>page.evaluate(()=>window.theseus.openBrowserUrl('https://user:password@example.com')));
  await page.getByRole('textbox',{name:'Web address or search'}).fill('orbit agent design');await page.getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('status').filter({hasText:'Sent to your default browser.'}).waitFor();assert.deepEqual(await desktop.evaluate(()=>globalThis.openedUrls),['https://duckduckgo.com/?q=orbit%20agent%20design']);
  await page.getByRole('button',{name:'Add link',exact:true}).click();await page.getByRole('textbox',{name:'Link name',exact:true}).fill('Project docs');await page.getByRole('textbox',{name:'Bookmark web address'}).fill('https://example.com/docs');await page.getByRole('button',{name:'Save link',exact:true}).click();
  await page.getByRole('button',{name:'Project docs https://example.com/docs',exact:true}).click();assert.equal((await desktop.evaluate(()=>globalThis.openedUrls)).at(-1),'https://example.com/docs');
  await page.getByRole('button',{name:'Open',exact:true}).waitFor();
  await page.screenshot({path:'artifacts/verification/browser-page.png'});
  await desktop.close();desktop=undefined;page=await launch();await nav(page,'Browser');await page.getByRole('button',{name:'Project docs https://example.com/docs',exact:true}).waitFor();await page.getByRole('button',{name:'Remove Project docs',exact:true}).click();await page.getByRole('heading',{name:'Your corner of the web'}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS Library navigation, saved empty state, sample isolation, search/filter/details; Browser search/open IPC, unsafe URL rejection, bookmarks save/restart/delete, no renderer errors');
}finally{await desktop?.close();await rm(directory,{recursive:true,force:true});}
