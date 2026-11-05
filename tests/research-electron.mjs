// Real Electron, runner, persistence and UI using a disposable local runtime.
// The deliberately synthetic answer is test input, never a verified live research claim.
// No providers, credentials, remote pages or account usage.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, chmod, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root=await realpath(await mkdtemp(join(tmpdir(),'theseus-research-electron-')));
const project=join(root,'project'),profile=join(root,'profile'),fake=join(root,'fixture-codex'),calls=join(root,'calls.jsonl');
const answer='# Fixture findings\n\nAlpha fixture latency is 40 ms [Alpha docs](https://alpha.example/docs).\n\nBeta fixture latency is 70 ms https://beta.example/report.\n\n| Runtime | Fixture latency | Source |\n| --- | --- | --- |\n| Alpha | 40 ms | https://alpha.example/docs |\n| Beta | 70 ms | https://beta.example/report |\n\n<img src=x onerror="window.researchInjected=true">\n\nExcluded links: https://user:password@private.example file:///etc/passwd javascript:alert(1)';
await mkdir(project);await mkdir('artifacts/verification',{recursive:true});
await writeFile(fake,`#!${process.execPath}
if(process.argv.includes('--version')){console.log('fixture 1.0');process.exit(0);}
if(process.argv.includes('login')){console.log('Logged in');process.exit(0);}
if(process.argv.includes('mcp')){console.log('[]');process.exit(0);}
if(process.argv.includes('app-server')){require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id!==undefined)console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{userAgent:'fixture'}:m.method==='account/read'?{account:null}:{}}));});}
else (async()=>{let prompt='';for await(const chunk of process.stdin)prompt+=chunk;require('node:fs').appendFileSync(${JSON.stringify(calls)},JSON.stringify({prompt,args:process.argv.slice(2)})+'\\n');await new Promise(resolve=>setTimeout(resolve,1000));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:${JSON.stringify(answer)}}}));console.log(JSON.stringify({type:'turn.completed'}));})();
`);await chmod(fake,0o700);
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:fake};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});
  const page=await desktop.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  await desktop.evaluate(({shell})=>{globalThis.researchOpenedUrls=[];shell.openExternal=async url=>{globalThis.researchOpenedUrls.push(url);};});
  return page;
}
async function openResearch(page){
  await page.getByRole('navigation',{name:'Run inspector',exact:true}).getByRole('button',{name:'Research',exact:true}).click();
  const panel=page.getByRole('region',{name:'Saved research workspace',exact:true});
  await expect(panel).toHaveAttribute('aria-busy','false');return panel;
}
async function destination(path){await desktop.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:!path,filePath:path});},path);}
async function confirm(response){await desktop.evaluate(({dialog},response)=>{dialog.showMessageBox=async(_owner,options)=>{globalThis.researchConfirmation=options;return {response,checkboxChecked:false};};},response);}
const research=(page,runId)=>page.evaluate(runId=>window.theseus.getResearch({runId}),runId);
const target=(runId,document,kind='draft')=>({runId,kind,revision:document.revision});

try{
  let page=await launch();
  await desktop.evaluate(({dialog},project)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});},project);
  await page.getByRole('button',{name:'Choose project folder',exact:true}).click();
  await page.getByRole('textbox',{name:'Start a task',exact:true}).fill('Collect fixture research results; ignore https://user-only.example');
  await page.getByRole('button',{name:'Start Codex',exact:true}).click();
  const runId=await page.locator('[data-run-id]').getAttribute('data-run-id');assert.ok(runId);
  await assert.rejects(()=>page.evaluate(runId=>window.theseus.generateResearch({runId,kind:'draft',revision:1}),runId),/finish/);
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status','completed');
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('tab',{name:'Artifacts',exact:true}).click();
  const creation=page.getByRole('region',{name:'Saved artifacts',exact:true});
  await creation.getByRole('button',{name:'Create from a run',exact:true}).click();
  await creation.getByRole('combobox',{name:'Create type',exact:true}).selectOption('outline');
  await creation.getByRole('button',{name:'Create outline',exact:true}).click();
  await expect(creation.locator('.panel-artifact-list>button')).toHaveCount(1);
  await creation.locator('.panel-artifact-list>button').click();
  await creation.getByRole('button',{name:'Edit in session',exact:true}).click();
  let panel=await openResearch(page),document=(await research(page,runId)).document;
  assert.deepEqual(document.sources.map(source=>source.url),['https://alpha.example/docs','https://beta.example/report']);
  const savedRun=(await page.evaluate(()=>window.theseus.getRunHistory())).runs.find(run=>run.id===runId);
  const entry=savedRun.output.find(entry=>entry.kind==='message');
  assert.equal(document.sources[0].evidence[0].sequence,entry.sequence);
  assert.equal(document.sources[0].evidence[0].sha256,createHash('sha256').update(entry.text).digest('hex'));
  assert.match(await panel.innerText(),/do not mean a page was fetched or verified/);
  await panel.locator('.research-sources > summary').click();
  await panel.getByRole('button',{name:'Open source S1',exact:true}).click();
  await expect.poll(()=>desktop.evaluate(()=>globalThis.researchOpenedUrls)).toEqual(['https://alpha.example/docs']);
  for(const url of ['javascript:alert(1)','file:///etc/passwd','https://user:password@example.com'])await assert.rejects(()=>page.evaluate(url=>window.theseus.openBrowserUrl(url),url));
  assert.equal((await desktop.evaluate(()=>globalThis.researchOpenedUrls)).length,1);

  const expected={draft:'Alpha fixture latency is 40 ms',outline:'- Fixture findings',comparison:'| Alpha | 40 ms |'};
  for(const kind of ['draft','outline','comparison']){
    await panel.getByRole('combobox',{name:'Research artifact',exact:true}).selectOption(kind);
    if(kind!=='outline')await panel.getByRole('button',{name:`Create ${kind} from results`,exact:true}).click();
    const name=kind[0].toUpperCase()+kind.slice(1),editor=panel.getByRole('textbox',{name:`${name} Markdown`,exact:true});
    await expect(editor).toContainText(expected[kind]);
    const initial=await editor.inputValue();assert.match(initial,/\[S1\]/);assert.match(initial,/\[S2\]/);
    await editor.fill(initial+`\n\nUser reviewed ${kind}.`);
    await panel.getByRole('button',{name:`Save ${kind}`,exact:true}).click();
    await expect(panel.getByRole('status')).toContainText(`${name} saved with citations.`);
    document=(await research(page,runId)).document;assert.equal(document.artifacts[kind].content,initial+`\n\nUser reviewed ${kind}.`);
  }
  assert.equal(await page.evaluate(()=>window.researchInjected),undefined);
  await panel.getByRole('combobox',{name:'Research artifact',exact:true}).selectOption('draft');
  const editor=panel.getByRole('textbox',{name:'Draft Markdown',exact:true}),savedDraft=await editor.inputValue();
  await editor.fill(savedDraft.replaceAll('[S1]',''));
  await panel.getByRole('button',{name:'Save draft',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Keep existing citation IDs');
  assert.equal((await research(page,runId)).document.artifacts.draft.content,savedDraft);
  await editor.fill(savedDraft+'\nUnknown citation [S99]');await panel.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(panel.getByRole('alert')).toContainText('Unknown citation');
  await panel.getByRole('button',{name:'Discard edits and refresh',exact:true}).click();await expect(editor).toHaveValue(savedDraft);
  const stale=target(runId,document);
  document=(await page.evaluate(request=>window.theseus.saveResearch(request),{...stale,content:savedDraft+'\nSaved through IPC.'})).document;
  await assert.rejects(()=>page.evaluate(request=>window.theseus.saveResearch(request),{...stale,content:savedDraft}),/changed/);
  await panel.getByRole('button',{name:'Refresh research',exact:true}).click();await expect(editor).toHaveValue(document.artifacts.draft.content);
  const request=target(runId,document);
  await assert.rejects(()=>page.evaluate(request=>window.theseus.publishResearch(request),{...request,path:join(root,'forged.md'),token:'forged',intent:'export-markdown'}),/expired/);
  await assert.rejects(()=>page.evaluate(()=>window.theseus.getResearch({runId:'../../outside'})),/Invalid/);
  assert.match(await desktop.evaluate(async({BrowserWindow},{preload,request})=>{
    const owner=BrowserWindow.getAllWindows()[0],untrusted=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,sandbox:true,nodeIntegration:false}});
    try{await untrusted.loadURL(owner.webContents.getURL());return await untrusted.webContents.executeJavaScript(`(async()=>{try{await window.theseus.getResearch(${JSON.stringify(request)});return 'unexpected success';}catch(error){return String(error);}})()`);}finally{untrusted.destroy();}
  },{preload:join(process.cwd(),'dist-electron','preload.cjs'),request}),/Untrusted IPC sender/);

  await panel.locator('.research-publishing > summary').click();
  await expect(panel.getByText(/Remote publishing is unavailable/)).toBeVisible();
  await destination(null);await panel.getByRole('button',{name:'Choose Markdown destination…',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Export saved draft…',exact:true})).toHaveCount(0);
  const publication=join(root,'publication.md');await destination(publication);await confirm(0);
  await panel.getByRole('button',{name:'Choose Markdown destination…',exact:true}).click();
  await expect(panel.getByText(`Destination: ${publication}`,{exact:true})).toBeVisible();await assert.rejects(()=>readFile(publication));
  await panel.getByRole('button',{name:'Export saved draft…',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Export cancelled');await assert.rejects(()=>readFile(publication));
  const confirmation=await desktop.evaluate(()=>globalThis.researchConfirmation);assert.ok(confirmation.detail.includes(publication));assert.equal(confirmation.defaultId,0);assert.equal(confirmation.cancelId,0);
  await confirm(1);await panel.getByRole('button',{name:'Choose Markdown destination…',exact:true}).click();
  await panel.getByRole('button',{name:'Export saved draft…',exact:true}).click();await expect(panel.getByRole('status')).toContainText(`Exported Markdown to ${publication}`);
  const published=await readFile(publication,'utf8');assert.ok(published.includes(document.artifacts.draft.content));assert.match(published,/\[S1\]: <https:\/\/alpha.example\/docs>/);assert.match(published,/SHA-256/);assert.match(published,/not been independently verified/);
  await panel.getByRole('button',{name:'Choose Markdown destination…',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('already exists');assert.equal(await readFile(publication,'utf8'),published);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await expect.poll(()=>page.evaluate(()=>window.innerWidth)).toBe(1100);
  assert.equal(await panel.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
  await page.screenshot({path:'artifacts/verification/research-workspace-1100.png'});

  // The Home artifact shelf lists actual saved work and exports/opens the correct kind.
  await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('tab',{name:'Artifacts',exact:true}).click();
  const shelf=page.getByRole('region',{name:'Saved artifacts',exact:true});
  await expect(shelf.locator('.panel-artifact-list>button')).toHaveCount(3);
  await shelf.getByRole('textbox',{name:'Search artifacts',exact:true}).fill('no matching artifact');
  await expect(shelf).toContainText('No artifacts match');
  await shelf.getByRole('textbox',{name:'Search artifacts',exact:true}).fill('');
  await shelf.getByLabel('Artifact type',{exact:true}).selectOption('comparison');
  await expect(shelf.locator('.panel-artifact-list>button')).toHaveCount(1);
  await shelf.locator('.panel-artifact-list>button').click();
  await expect(shelf.locator('.panel-artifact-preview')).toContainText('40 ms');
  await shelf.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(shelf.locator('.panel-artifact-preview')).toContainText('40 ms');
  assert.equal(await page.evaluate(()=>window.researchInjected),undefined);
  await page.screenshot({path:'artifacts/verification/home-artifacts-1100.png'});
  const shelfExport=join(root,'shelf-comparison.md');await destination(shelfExport);await confirm(1);
  await shelf.getByRole('button',{name:'Export Markdown…',exact:true}).click();
  await shelf.getByRole('button',{name:'Export saved comparison…',exact:true}).click();
  await expect(shelf.getByRole('status')).toContainText('Exported to');
  assert.ok((await readFile(shelfExport,'utf8')).includes(document.artifacts.comparison.content));
  await shelf.getByRole('button',{name:'Edit in session',exact:true}).click();
  panel=await openResearch(page);
  await expect(panel.getByRole('combobox',{name:'Research artifact',exact:true})).toHaveValue('comparison');
  await expect(panel.getByRole('textbox',{name:'Comparison Markdown',exact:true})).toHaveValue(document.artifacts.comparison.content);

  // Renderer reload and a full process restart each read main-owned saved artifacts.
  await page.reload();await page.getByRole('textbox',{name:'Start a task',exact:true}).waitFor();
  assert.deepEqual((await research(page,runId)).document,document);
  await desktop.close();desktop=undefined;page=await launch();
  assert.deepEqual((await research(page,runId)).document,document);
  await page.getByRole('button',{name:'Run history',exact:true}).click();
  await page.locator(`[data-history-id="${runId}"] .history-open`).click();
  panel=await openResearch(page);await expect(panel.getByRole('textbox',{name:'Draft Markdown',exact:true})).toHaveValue(document.artifacts.draft.content);
  for(const kind of ['outline','comparison']){
    await panel.getByRole('combobox',{name:'Research artifact',exact:true}).selectOption(kind);
    await expect(panel.getByRole('textbox',{name:`${kind[0].toUpperCase()+kind.slice(1)} Markdown`,exact:true})).toHaveValue(document.artifacts[kind].content);
  }
  const demoUrl=new URL(page.url());demoUrl.search='?s=r1&tab=sources&static=1';await page.goto(demoUrl.href);
  await expect(page.locator('.demo-session-note')).toContainText('Demo · simulated');
  await expect(page.getByText(/Demo sources · sample content/).first()).toBeVisible();
  assert.equal(await page.getByRole('region',{name:'Saved research workspace',exact:true}).count(),0);
  await page.evaluate(runId=>window.theseus.deleteRunHistory({ids:[runId]}),runId);
  await assert.rejects(()=>readFile(join(profile,'research',`${runId}.json`)));
  await assert.rejects(()=>research(page,runId),/no longer exists/);
  assert.deepEqual(await readdir(join(profile,'research')),[],'Atomic writes leave no temporary files.');
  const invocations=(await readFile(calls,'utf8')).trim().split('\n').map(line=>JSON.parse(line));assert.equal(invocations.length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS research actual fixture-run capture/hash provenance, validated source opening, all artifact creation/edit/citation persistence, stale edits/forged destination/untrusted sender rejection, native destination/cancel/explicit intent/export/no-overwrite, reload/restart UI, demo separation, deletion and atomic cleanup, 1100px layout; local fixture only, no providers.');
}finally{await desktop?.close();await rm(root,{recursive:true,force:true});}
