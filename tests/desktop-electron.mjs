// Isolated profile, no provider calls, no changes to OS login items.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'theseus-desktop-e2e-'));
await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(){
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:join(profile,'missing-codex')};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;
  desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();return page;
}
async function section(page,label){await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:label,exact:true}).click();}
try{
  let page=await launch();await section(page,'General');
  await expect(page.getByRole('switch',{name:'Launch at login',exact:true})).toBeDisabled();
  for(const patch of [{login:1},{menubar:'yes'},{deliver:'beep'},{crash:true}])await assert.rejects(()=>page.evaluate(p=>window.theseus.saveDesktopPreferences(p),patch));
  await assert.rejects(()=>page.evaluate(()=>window.theseus.openUpdateRelease()));
  await page.getByRole('switch',{name:'Show in menu bar',exact:true}).click();
  await expect(page.getByRole('switch',{name:'Show in menu bar',exact:true})).toHaveAttribute('aria-checked','true');
  await page.screenshot({path:'artifacts/verification/desktop-startup.png'});
  await page.evaluate(()=>window.theseus.windowControl('close'));
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1,'Tray close keeps the renderer alive');
  await desktop.evaluate(({app})=>app.emit('activate'));await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
  await section(page,'Notifications & focus');
  await page.getByRole('switch',{name:'A session finishes',exact:true}).click();
  await expect(page.getByRole('switch',{name:'A session finishes',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('radio',{name:'Banner + sound',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Banner + sound',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('switch',{name:'Deep work hours',exact:true}).click();
  await expect(page.getByRole('switch',{name:'Deep work hours',exact:true})).toHaveAttribute('aria-checked','true');
  await page.getByRole('radio',{name:'Nothing',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Nothing',exact:true})).toHaveAttribute('aria-checked','true');
  await page.screenshot({path:'artifacts/verification/desktop-notifications.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,700));
  await page.waitForFunction(()=>window.innerWidth<=1100);
  assert.equal(await page.locator('.page-w').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'artifacts/verification/desktop-notifications-1100.png'});
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  const saved=JSON.parse(await readFile(join(profile,'desktop-preferences.json'),'utf8'));
  assert.deepEqual(saved.preferences,{slots:1,overflow:'queue',login:false,menubar:true,nFail:true,nDone:true,deliver:'sound',deepOn:true,deep:'nothing'});
  // A real runner failure reaches the main-process Notification adapter; delivery is intercepted.
  await desktop.evaluate(({Notification,dialog},project)=>{
    Notification.isSupported=()=>true;
    Notification.prototype.show=function(){globalThis.lastNotification=this;};
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});
  },profile);
  await page.evaluate(()=>window.theseus.saveDesktopPreferences({deepOn:false}));
  const workspace=await page.evaluate(()=>window.theseus.selectWorkspace());
  await page.evaluate(workspace=>window.theseus.startAgentRun({workspaceId:workspace.id,task:'Fixture failure: the executable is deliberately missing.'}),workspace);
  await expect.poll(()=>desktop.evaluate(()=>globalThis.lastNotification?.title)).toBe('Theseus · Run failed');
  assert.equal(await desktop.evaluate(()=>globalThis.lastNotification.silent),false);
  await desktop.evaluate(()=>globalThis.lastNotification.emit('failed',{},'Permission denied fixture'));
  await page.getByRole('alert').filter({hasText:'Permission denied fixture'}).waitFor();
  await page.evaluate(()=>window.theseus.saveDesktopPreferences({deepOn:true}));
  await section(page,'Memory & privacy');await expect(page.getByRole('switch',{name:'Send crash reports',exact:true})).toHaveCount(0);
  await section(page,'About');
  await desktop.evaluate(()=>{globalThis.fetch=async()=>new Response(JSON.stringify({draft:false,prerelease:false,tag_name:'v9.0.0',html_url:'https://github.com/AlexSingh-cpu/theseum/releases/tag/v9.0.0'}));});
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();await page.getByRole('status').filter({hasText:'v9.0.0 is available'}).waitFor();
  await desktop.evaluate(({shell})=>{shell.openExternal=async url=>{globalThis.openedRelease=url;};});
  await page.getByRole('button',{name:'Download release…',exact:true}).click();
  await expect.poll(()=>desktop.evaluate(()=>globalThis.openedRelease)).toBe('https://github.com/AlexSingh-cpu/theseum/releases/tag/v9.0.0');
  await desktop.evaluate(()=>{globalThis.fetch=async()=>{throw new Error('Offline');};});
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();await page.getByRole('alert').filter({hasText:'Check your connection'}).waitFor();
  await page.screenshot({path:'artifacts/verification/desktop-updates.png'});
  await desktop.close();desktop=undefined;
  page=await launch();await section(page,'General');
  await expect(page.getByRole('switch',{name:'Show in menu bar',exact:true})).toHaveAttribute('aria-checked','true');
  await section(page,'Notifications & focus');await expect(page.getByRole('radio',{name:'Banner + sound',exact:true})).toHaveAttribute('aria-checked','true');await expect(page.getByRole('radio',{name:'Nothing',exact:true})).toHaveAttribute('aria-checked','true');
  await section(page,'General');await page.getByRole('switch',{name:'Show in menu bar',exact:true}).click();await expect(page.getByRole('switch',{name:'Show in menu bar',exact:true})).toHaveAttribute('aria-checked','false');
  assert.deepEqual(errors,[]);
  console.log('PASS desktop settings validated IPC, tray hide/restore, persisted preferences/restart, crash control removal, runner notification delivery/failure, release download handoff and offline errors; no provider calls or login changes');
}finally{await desktop?.close();await rm(profile,{recursive:true,force:true});}
