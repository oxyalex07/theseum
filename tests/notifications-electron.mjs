// Exercises renderer delivery through real preload events; no provider or OS notifications.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const profile=await mkdtemp(join(tmpdir(),'theseus-notifications-'));
let desktop;
try{
  // Saved preferences must be applied before initial sample delivery.
  await writeFile(join(profile,'desktop-preferences.json'),JSON.stringify({version:1,preferences:{nFail:false}}));
  const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:join(profile,'missing-codex')};
  delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
  desktop=await _electron.launch({args:['.'],env});
  const page=await desktop.firstWindow(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const bell=page.getByRole('button',{name:/^Notifications(?: · \d+ unread)?$/});
  await expect(bell).toHaveAttribute('aria-label','Notifications · 3 unread');
  await bell.click();
  const panel=page.getByRole('dialog',{name:'Notifications',exact:true});
  const items=panel.locator('.notification-item');
  await expect(items).toHaveCount(3);
  await panel.getByRole('button',{name:'Mark all read'}).click();
  await expect(bell).toHaveAttribute('aria-label','Notifications');

  const save=async patch=>{
    await page.evaluate(p=>window.theseus.saveDesktopPreferences(p),patch);
    // Verify the settings subscriber has received the persisted state before sending an event.
    if(patch.nDone!==undefined)await expect(page.getByRole('switch',{name:'A session finishes',exact:true})).toHaveAttribute('aria-checked',String(patch.nDone));
    if(patch.nFail!==undefined)await expect(page.getByRole('switch',{name:'A run fails',exact:true})).toHaveAttribute('aria-checked',String(patch.nFail));
    if(patch.deepOn!==undefined)await expect(page.getByRole('switch',{name:'Deep work hours',exact:true})).toHaveAttribute('aria-checked',String(patch.deepOn));
  };
  let revision=0;
  const emit=async(id,status='completed')=>{
    const run={id,revision:++revision,status,workspaceId:'fixture',projectName:'Fixture',projectPath:profile,task:id,
      startedAt:'2026-10-23T17:00:00.000Z',endedAt:new Date(2026,9,23,18,revision).toISOString(),output:[],truncated:false};
    await desktop.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('theseus:run-update',value),run);
  };
  await panel.getByRole('button',{name:'Notification settings'}).click();
  await page.getByRole('heading',{name:'Notifications & focus',exact:true}).waitFor();
  await emit('suppressed-completion');
  await save({nDone:true,deliver:'badge'});
  await emit('delivered-completion');
  await expect(bell).toHaveAttribute('aria-label','Notifications · 1 unread');
  await bell.click();
  await expect(items).toHaveCount(4);
  await expect(items.filter({hasText:'delivered-completion'})).toHaveCount(1);
  await expect(items.filter({hasText:'suppressed-completion'})).toHaveCount(0);
  await panel.getByRole('button',{name:'Mark all read'}).click();
  await page.keyboard.press('Escape');

  await save({nDone:false,nFail:true});
  await emit('delivered-failure','failed');
  await expect(bell).toHaveAttribute('aria-label','Notifications · 1 unread');
  await page.clock.setFixedTime(new Date(2026,9,23,10));
  await save({deepOn:true,deep:'nothing'});
  await emit('deep-suppressed-failure','failed');
  await save({deep:'blockers',nDone:true});
  await emit('deep-suppressed-completion');
  await emit('deep-blocker','failed');
  await expect(bell).toHaveAttribute('aria-label','Notifications · 2 unread');
  await page.clock.setFixedTime(new Date(2026,9,23,12));
  await emit('after-deep-work');
  await expect(bell).toHaveAttribute('aria-label','Notifications · 3 unread');
  await bell.click();
  await expect(items).toHaveCount(7);
  await expect(items.filter({hasText:'deep-suppressed'})).toHaveCount(0);
  await expect(items.filter({hasText:'delivered-completion'})).not.toHaveClass(/unread/);
  await panel.getByRole('button',{name:'Mark all read'}).click();
  await expect(bell).toHaveAttribute('aria-label','Notifications');
  // A continued run completing again produces a fresh unread delivery.
  await emit('after-deep-work');
  await expect(bell).toHaveAttribute('aria-label','Notifications · 1 unread');
  await expect(items).toHaveCount(7);
  assert.deepEqual(errors,[]);
  console.log('PASS saved preferences, future delivery changes, unread counts/read state, badge style, deep-work suppression/no replay, continued-run results; no provider calls');
}finally{
  await desktop?.close();await rm(profile,{recursive:true,force:true});
}
