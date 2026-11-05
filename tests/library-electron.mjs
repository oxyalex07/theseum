// Disposable projects/profile and a local fixture runtime. No provider calls or account usage.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, chmod, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-library-e2e-'))),project=join(root,'project with spaces'),other=join(root,'other'),profile=join(root,'profile');
await mkdir(project);await mkdir(other);await mkdir(join(project,'docs'));await mkdir('artifacts/verification',{recursive:true});
await writeFile(join(project,'README.md'),'Project introduction\nLIBRARY_PRIVATE_SENTINEL on the second line\n<img src=x onerror="window.libraryInjected=true">');
await writeFile(join(project,'docs','notes.ts'),'export const phrase = "content needle";');
await writeFile(join(project,'unsupported.bin'),'BINARY_PRIVATE_SENTINEL');await writeFile(join(project,'large.txt'),'x'.repeat(256*1024+1));
await writeFile(join(project,'.env'),'HIDDEN_PRIVATE_SENTINEL');await writeFile(join(root,'outside.txt'),'OUTSIDE_PRIVATE_SENTINEL');await symlink(join(root,'outside.txt'),join(project,'link.txt'));
const fake=join(root,'fixture-codex');await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
if(process.argv.includes('app-server')){require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id!==undefined)console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{userAgent:'fixture'}:m.method==='account/read'?{account:null}:{}}));});}
else (async()=>{let prompt='';for await(const chunk of process.stdin)prompt+=chunk;require('node:fs').writeFileSync(${JSON.stringify(join(root,'prompt.txt'))},prompt);console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Fixture completed without reading project files.'}}));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.getByRole('button',{name:'Open your profile'}).waitFor();await nav(page,'Library');return page;}
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();}
async function picker(paths,canceled=false){await desktop.evaluate(({dialog},{paths,canceled})=>{dialog.showOpenDialog=async(_window,options)=>{globalThis.libraryPickerOptions=options;return {canceled,filePaths:paths};};},{paths,canceled});}
async function choose(page,path){await picker([path]);const change=page.getByRole('button',{name:'Change project',exact:true});if(await change.count())await change.click();else await page.getByRole('button',{name:'Choose project folder',exact:true}).click();await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();}
async function workspace(page){return (await page.evaluate(()=>window.theseus.getExecutionState())).workspace;}
async function state(page){return page.evaluate(async()=>window.theseus.getLibrary({workspaceId:(await window.theseus.getExecutionState()).workspace.id}));}
const row=(page,path)=>page.locator('[data-project-file]').filter({hasText:path});
async function refresh(page){await page.getByRole('button',{name:'Refresh index',exact:true}).click();await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();}
try{
  let page=await launch();await choose(page,project);let firstWorkspace=await workspace(page);
  assert.equal((await state(page)).sources.length,0);await expect(page.getByText('No project files imported',{exact:true})).toBeVisible();
  await picker([],true);await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();assert.equal((await state(page)).sources.length,0);
  // A retained file choice cannot become an implicit folder import. Exercise
  // the production UI/IPC, persisted metadata, other project and full restart.
  const selected=join(project,'selected.md');await writeFile(selected,'İİİİİİİ\nneedle\nfooter');
  await picker([selected]);await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(row(page,'selected.md')).toBeVisible();
  const selectedId=(await state(page)).files[0].id;
  await page.getByRole('textbox',{name:'Search library'}).fill('NEEDLE');await expect(row(page,'selected.md')).toContainText('Line 2: needle');
  await page.getByRole('textbox',{name:'Search library'}).fill('');await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();
  await rm(selected);await mkdir(selected);await writeFile(join(selected,'unselected.txt'),'UNSELECTED_DESCENDANT_SENTINEL');
  await refresh(page);await expect(row(page,'selected.md')).toContainText('Unsupported');assert.equal(await page.locator('[data-project-file="selected.md/unselected.txt"]').count(),0);
  await row(page,'selected.md').click();await expect(page.getByRole('complementary',{name:'Project file inspection'})).toContainText('no longer a regular file');assert.equal(await page.getByLabel('Indexed file content',{exact:true}).count(),0);
  await page.screenshot({path:'artifacts/verification/library-file-kind-unavailable.png'});
  await page.getByRole('textbox',{name:'Search library'}).fill('UNSELECTED_DESCENDANT_SENTINEL');await expect(page.locator('[data-project-file]')).toHaveCount(0);
  const descendantId=createHash('sha256').update('selected.md/unselected.txt').digest('hex');
  await assert.rejects(()=>page.evaluate(({workspaceId,fileId})=>window.theseus.inspectLibraryFile({workspaceId,fileId}),{workspaceId:firstWorkspace.id,fileId:descendantId}),/no longer imported/);
  await page.getByRole('textbox',{name:'Search library'}).fill('');await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();
  await writeFile(join(other,'keep.md'),'OTHER_PROJECT_SENTINEL');await choose(page,other);await picker([join(other,'keep.md')]);await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(row(page,'keep.md')).toBeVisible();
  const isolatedWorkspace=await workspace(page);await assert.rejects(()=>page.evaluate(({workspaceId,fileId})=>window.theseus.inspectLibraryFile({workspaceId,fileId}),{workspaceId:isolatedWorkspace.id,fileId:selectedId}),/no longer imported/);
  const persisted=JSON.parse(await readFile(join(profile,'library','selections.json'),'utf8'));assert.deepEqual(persisted.projects.find(value=>value.path===project).known,['selected.md']);assert.equal(persisted.projects.find(value=>value.path===project).sources[0].kind,'file');
  await desktop.close();desktop=undefined;page=await launch();await choose(page,project);await expect(row(page,'selected.md')).toContainText('Unsupported');assert.equal((await state(page)).warning,undefined);
  await row(page,'selected.md').click();assert.equal(await page.getByLabel('Indexed file content',{exact:true}).count(),0);
  await page.getByRole('textbox',{name:'Search library'}).fill('UNSELECTED_DESCENDANT_SENTINEL');await expect(page.locator('[data-project-file]')).toHaveCount(0);
  await page.getByRole('textbox',{name:'Search library'}).fill('');await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();
  await choose(page,other);await expect(row(page,'keep.md')).toContainText('Indexed');await row(page,'keep.md').click();await expect(page.getByLabel('Indexed file content',{exact:true})).toHaveText('OTHER_PROJECT_SENTINEL');
  await page.getByRole('button',{name:'Clear project index',exact:true}).click();await page.getByRole('button',{name:'Remove all project imports',exact:true}).click();await expect(page.getByText('No project files imported',{exact:true})).toBeVisible();
  await choose(page,project);await rm(selected,{recursive:true});await writeFile(selected,'RESTORED_SELECTED_FILE_SENTINEL');await refresh(page);await expect(row(page,'selected.md')).toContainText('Indexed');
  await row(page,'selected.md').click();await expect(page.getByLabel('Indexed file content',{exact:true})).toHaveText('RESTORED_SELECTED_FILE_SENTINEL');await page.screenshot({path:'artifacts/verification/library-file-kind-restored.png'});
  await page.getByText('Manage imports (1)',{exact:true}).click();await page.getByRole('button',{name:'Remove import selected.md',exact:true}).click();await expect(page.getByText('No project files imported',{exact:true})).toBeVisible();
  firstWorkspace=await workspace(page);
  await picker([join(project,'README.md'),join(project,'unsupported.bin'),join(project,'large.txt'),join(project,'.env')]);await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(row(page,'README.md')).toBeVisible();
  const options=await desktop.evaluate(()=>globalThis.libraryPickerOptions);assert.deepEqual(options.properties,['openFile','multiSelections']);assert.equal(options.defaultPath,project);
  await expect(row(page,'unsupported.bin')).toContainText('Unsupported');await expect(row(page,'large.txt')).toContainText('Too large');await expect(row(page,'.env')).toContainText('Unsupported');
  await row(page,'README.md').click();await expect(page.getByLabel('Indexed file content',{exact:true})).toContainText('<img src=x');assert.equal(await page.evaluate(()=>window.libraryInjected),undefined);assert.equal(await page.locator('.project-file-preview img').count(),0);
  await page.getByRole('textbox',{name:'Search library'}).fill('library_private_sentinel');await expect(page.locator('[data-project-file]')).toHaveCount(1);await expect(row(page,'README.md')).toContainText('Line 2');
  await page.getByRole('textbox',{name:'Search library'}).fill('');await expect(page.getByRole('button',{name:'Import folder',exact:true})).toBeEnabled();
  await picker([join(project,'docs')]);await page.getByRole('button',{name:'Import folder',exact:true}).click();await expect(row(page,'docs/notes.ts')).toBeVisible();assert.deepEqual((await desktop.evaluate(()=>globalThis.libraryPickerOptions)).properties,['openDirectory']);
  await page.getByRole('textbox',{name:'Search library'}).fill('CONTENT NEEDLE');await expect(row(page,'docs/notes.ts')).toBeVisible();await expect(page.locator('[data-project-file]')).toHaveCount(1);
  await page.getByRole('textbox',{name:'Search library'}).fill('');await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();
  await writeFile(join(project,'docs','notes.ts'),'export const changed = "fresh content";');await writeFile(join(project,'docs','new.md'),'Newly discovered');await refresh(page);await expect(row(page,'docs/new.md')).toBeVisible();await row(page,'docs/notes.ts').click();await expect(page.getByLabel('Indexed file content',{exact:true})).toContainText('fresh content');
  await rm(join(project,'docs','new.md'));await refresh(page);await expect(row(page,'docs/new.md')).toContainText('Removed');await row(page,'docs/new.md').click();await expect(page.getByRole('complementary',{name:'Project file inspection'})).toContainText('removed or moved');assert.equal(await page.getByLabel('Indexed file content',{exact:true}).count(),0);
  await chmod(join(project,'docs','notes.ts'),0);try{await refresh(page);await expect(row(page,'docs/notes.ts')).toContainText('Inaccessible');}finally{await chmod(join(project,'docs','notes.ts'),0o600);}
  for(const path of [join(root,'outside.txt'),join(project,'link.txt')]){await picker([path]);await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:/symlinks|inside the selected project/})).toBeVisible();}
  assert.equal((await state(page)).sources.length,5);assert.equal((await state(page)).files.some(file=>file.path==='link.txt'),false);
  await assert.rejects(()=>page.evaluate(()=>window.theseus.getLibrary({workspaceId:'00000000-0000-0000-0000-000000000000'})));
  await assert.rejects(()=>page.evaluate(workspaceId=>window.theseus.importLibrary({workspaceId,kind:'files',paths:['/etc/passwd']}),firstWorkspace.id));
  await assert.rejects(()=>page.evaluate(workspaceId=>window.theseus.inspectLibraryFile({workspaceId,fileId:'../../etc/passwd'}),firstWorkspace.id));
  // A second, untrusted document with the same preload cannot invoke any Library handler.
  assert.match(await desktop.evaluate(async({BrowserWindow},{workspaceId,preload})=>{
    const owner=BrowserWindow.getAllWindows()[0],untrusted=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,sandbox:true,nodeIntegration:false}});
    try {
      await untrusted.loadURL(owner.webContents.getURL());
      return await untrusted.webContents.executeJavaScript(`(async()=>{try{await window.theseus.getLibrary({workspaceId:${JSON.stringify(workspaceId)}});return 'Unexpected successful IPC';}catch(error){return String(error);}})()`);
    }finally{untrusted.destroy();}
  },{workspaceId:firstWorkspace.id,preload:join(process.cwd(),'dist-electron','preload.cjs')}),/Untrusted IPC sender/);
  await refresh(page);await row(page,'README.md').click();await expect(page.getByLabel('Indexed file content',{exact:true})).toBeVisible();await page.screenshot({path:'artifacts/verification/library-index.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);assert.equal(await page.locator('.project-library').evaluate(element=>element.scrollWidth<=element.clientWidth),true);await page.screenshot({path:'artifacts/verification/library-index-small.png'});
  // A real local execution adapter receives only the task; importing never appends Library contents.
  const run=await page.evaluate(workspaceId=>window.theseus.startAgentRun({workspaceId,task:'Only this explicit task.'}),firstWorkspace.id);await expect.poll(async()=>(await page.evaluate(()=>window.theseus.getExecutionState())).runs.find(value=>value.id===run.id)?.status).toBe('completed');
  const prompt=await readFile(join(root,'prompt.txt'),'utf8');assert.ok(prompt.includes('Only this explicit task.'));assert.ok(!prompt.includes('LIBRARY_PRIVATE_SENTINEL'));assert.ok(!prompt.includes('fresh content'));assert.ok(!(await readFile(join(profile,'library','selections.json'),'utf8')).includes('LIBRARY_PRIVATE_SENTINEL'));
  const saved=await state(page),source=saved.sources.find(value=>value.path==='README.md');await choose(page,other);const otherWorkspace=await workspace(page);assert.equal((await state(page)).files.length,0);await assert.rejects(()=>page.evaluate(({workspaceId,sourceId})=>window.theseus.removeLibrarySource({workspaceId,sourceId}),{workspaceId:otherWorkspace.id,sourceId:source.id}));
  await choose(page,project);await expect(row(page,'README.md')).toBeVisible();await page.getByText('Manage imports (5)',{exact:true}).click();await page.getByRole('button',{name:'Remove import README.md',exact:true}).click();await expect(row(page,'README.md')).toHaveCount(0);assert.ok((await state(page)).files.some(file=>file.path==='docs/notes.ts'));assert.ok(await readFile(join(project,'README.md'),'utf8'));
  await desktop.close();desktop=undefined;page=await launch();await choose(page,project);await expect(row(page,'docs/notes.ts')).toBeVisible();assert.equal((await state(page)).sources.length,4);assert.equal((await state(page)).files.some(file=>file.path==='README.md'),false);await expect(row(page,'docs/new.md')).toContainText('Removed');
  await page.getByRole('button',{name:'Show sample data',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Import files',exact:true}).count(),0);await expect(page.getByText('Project file imports are available in saved data mode.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Show saved data',exact:true}).click();await expect(row(page,'docs/notes.ts')).toBeVisible();
  await page.getByRole('button',{name:'Clear project index',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await state(page)).sources.length,4);await page.getByRole('button',{name:'Clear project index',exact:true}).click();await page.getByRole('button',{name:'Remove all project imports',exact:true}).click();await expect(page.getByText('No project files imported',{exact:true})).toBeVisible();assert.equal((await state(page)).sources.length,0);assert.ok(await readFile(join(project,'docs','notes.ts'),'utf8'));
  await page.reload();await page.getByRole('button',{name:'Open your profile'}).waitFor();await nav(page,'Library');await expect(page.getByText('No project files imported',{exact:true})).toBeVisible();
  if(process.platform!=='win32') {
    await desktop.close();desktop=undefined;const manifest=join(profile,'library','selections.json');await rm(manifest);assert.equal(spawnSync('mkfifo',[manifest]).status,0);const fifo=await lstat(manifest);
    page=await launch();await choose(page,project);await expect(page.getByRole('alert').filter({hasText:'Library selection storage could not be read'})).toBeVisible();assert.equal((await state(page)).files.length,0);
    await picker([join(project,'README.md')]);await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Library selection storage could not be read'}).first()).toBeVisible();await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();
    await choose(page,other);assert.match((await state(page)).warning,/storage could not be read/);await expect(page.getByRole('alert').filter({hasText:'Library selection storage could not be read'}).first()).toBeVisible();await expect(page.getByText('Reading project imports…',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Import files',exact:true})).toBeEnabled();assert.equal((await lstat(manifest)).ino,fifo.ino);assert.equal((await lstat(manifest)).isFIFO(),true);await page.screenshot({path:'artifacts/verification/library-fifo-storage-warning.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS Library native file/folder selection/cancellation, Unicode expansion line/excerpt offsets, retained file kind with blocked descendants and preserved metadata across restart/project isolation/restoration, FIFO storage warning with responsive queue and preserved artifact, UTF-8 indexing and search/inspection, changed/new/removed/inaccessible/unsupported/oversized files, out-of-project and symlink rejection, hostile IPC/sender validation, scoped removal/clear, restart and sample isolation, no automatic agent context, 1100px layout; local fixture only');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
