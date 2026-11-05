// Disposable Electron profile. All request actions are demo-only; no provider calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'theseus-keyboard-'));
await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
async function launch(){
 const env={...process.env,THESEUS_USER_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
 desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('.app').waitFor();return page;
}
async function nav(page,name){await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name,exact:true}).click();}
async function keyboard(page){await nav(page,'Settings');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Keyboard',exact:true}).click();}
const row=(page,label)=>page.locator('.srow').filter({has:page.getByText(label,{exact:true})});
const blur=page=>page.evaluate(()=>document.activeElement?.blur());
const title=page=>page.locator('.tab.on .tab-title');
async function rebind(page,label,key,display){await page.getByRole('button',{name:`Rebind ${label}`,exact:true}).click();await page.keyboard.press(key);await expect(row(page,label).locator('kbd')).toHaveText(display);}
async function session(page){const url=new URL(page.url());url.search='?s=c1&static=1';await page.goto(url.href);await expect(page.locator('.thread[data-session="c1"]')).toBeVisible();await blur(page);}
const bindings=[
 ['Ask Theseus or run a command','Control+Shift+p','⌘⇧P'],['New session','Control+Shift+n','⌘⇧N'],['Go to Home','Control+Shift+h','⌘⇧H'],
 ['Focus layout','Control+Shift+1','⌘⇧1'],['Split layout','Control+Shift+2','⌘⇧2'],['Grid layout','Control+Shift+3','⌘⇧3'],
 ['Approve the waiting request','Control+Shift+Enter','⌘⇧↵'],['Next session','x','X'],['Previous session','y','Y'],
 ['Approve selected request','u','U'],['Deny selected request','v','V'],['Search settings','f','F'],
];
try{
 let page=await launch();await expect(page.locator('.kbar kbd')).toHaveText('⌘K');await session(page);await expect(page.locator('.appr button kbd')).toHaveText('⌘↵');await nav(page,'Settings');await page.getByRole('radiogroup',{name:'Density',exact:true}).getByRole('radio',{name:'Compact',exact:true}).click();await keyboard(page);
 // Capture runs before application shortcuts, including from sidebar focus; duplicates use primary-modifier aliases.
 await page.getByRole('button',{name:'Rebind Next session',exact:true}).click();await page.keyboard.press('Control+k');
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(row(page,'Next session').locator('kbd')).toHaveText('Press keys…');await expect(page.getByRole('status')).toContainText('already assigned');
 await page.keyboard.press('Escape');await expect(row(page,'Next session').locator('kbd')).toHaveText('J');
 await page.getByRole('button',{name:'Rebind Next session',exact:true}).click();await page.locator('#settings-search').focus();
 await page.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'z',bubbles:true,isComposing:true})));
 await expect(row(page,'Next session').locator('kbd')).toHaveText('Press keys…');await page.keyboard.press('Escape');await blur(page);
 for(const [label,key,display] of bindings)await rebind(page,label,key,display);
 await expect(page.locator('.kbar kbd')).toHaveText('⌘⇧P');await nav(page,'Settings');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'General',exact:true}).click();await expect(row(page,'Session layout')).toContainText('⌘⇧1 / ⌘⇧2 / ⌘⇧3');await keyboard(page);
 await page.keyboard.press('/');await expect(page.locator('#settings-search')).not.toBeFocused();
 await page.keyboard.press('Shift+f');await expect(page.locator('#settings-search')).not.toBeFocused();
 await page.keyboard.press('f');await expect(page.locator('#settings-search')).toBeFocused();await page.locator('#settings-search').fill('Previous session');await expect(row(page,'Previous session')).toBeVisible();await expect(row(page,'Next session')).toHaveCount(0);
 await page.locator('#settings-search').fill('');await rebind(page,'Search settings','Control+f','⌘F');
 await page.keyboard.press('f');await expect(page.locator('#settings-search')).not.toBeFocused();await page.keyboard.press('Control+f');await expect(page.locator('#settings-search')).toBeFocused();
 await blur(page);await rebind(page,'Search settings','f','F');
 await page.reload();await keyboard(page);for(const [label,,display] of bindings)await expect(row(page,label).locator('kbd')).toHaveText(display);
 await desktop.close();desktop=undefined;page=await launch();await keyboard(page);for(const [label,,display] of bindings)await expect(row(page,label).locator('kbd')).toHaveText(display);await expect(page.locator('.app')).toHaveClass(/density-compact/);
 await page.screenshot({path:'artifacts/verification/keyboard-persisted.png'});
 await session(page);await expect(page.locator('.appr button kbd')).toHaveText('⌘⇧↵');await page.keyboard.press('Control+k');await expect(page.getByRole('dialog')).toHaveCount(0);const original=await title(page).textContent();await page.keyboard.press('j');await page.keyboard.press('k');await expect(title(page)).toHaveText(original);
 await page.keyboard.press('x');await expect(title(page)).not.toHaveText(original);await page.keyboard.press('y');await expect(title(page)).toHaveText(original);
 // Old approval bindings, IME and repeated presses must not approve.
 await page.keyboard.press('a');await page.keyboard.press('d');await page.keyboard.press('Control+Enter');
 await page.evaluate(()=>{for(const extra of [{isComposing:true},{repeat:true},{keyCode:229}])document.dispatchEvent(new KeyboardEvent('keydown',{key:'u',bubbles:true,...extra}));});
 await expect(page.getByRole('button',{name:/^Approve ⌘/})).toBeVisible();
 const composer=page.getByRole('textbox',{name:/^Message /}).first();await composer.fill('xyuv');await composer.focus();await page.keyboard.press('u');await page.keyboard.press('x');await expect(title(page)).toHaveText(original);await expect(page.getByRole('button',{name:/^Approve ⌘/})).toBeVisible();
 await page.keyboard.press('Control+Shift+p');await expect(page.getByRole('dialog',{name:'Ask Theseus',exact:true})).toBeVisible();await page.keyboard.press('Control+Shift+h');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Control+Shift+p');await expect(page.getByRole('dialog')).toHaveCount(0);
 await blur(page);await page.keyboard.press('Control+Shift+p');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 // Other dialogs must not open the palette or act on the selected request.
 await page.getByRole('button',{name:/^Notifications/}).click();await expect(page.getByRole('dialog',{name:'Notifications',exact:true})).toBeVisible();await page.keyboard.press('Control+Shift+p');await page.keyboard.press('u');await expect(page.getByRole('dialog',{name:'Ask Theseus',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/^Approve ⌘/})).toBeVisible();await page.keyboard.press('Escape');
 await page.evaluate(()=>{const editor=document.createElement('div');editor.setAttribute('contenteditable','');editor.id='keyboard-editor';document.body.append(editor);editor.focus();});await page.keyboard.press('u');await expect(page.getByRole('button',{name:/^Approve ⌘/})).toBeVisible();await page.evaluate(()=>document.querySelector('#keyboard-editor').remove());
 await blur(page);await page.keyboard.press('u');await expect(page.getByText('Approved in demo mode. No command was executed.',{exact:true})).toBeVisible();
 await session(page);await page.keyboard.press('v');await expect(page.getByText('No. Find another way.',{exact:true})).toBeVisible();
 await session(page);await page.keyboard.press('Control+Shift+Enter');await expect(page.getByText('Approved in demo mode. No command was executed.',{exact:true})).toBeVisible();
 await session(page);await page.keyboard.press('Control+3');await expect(page.locator('.stage')).not.toHaveClass(/grid/);await page.keyboard.press('Control+2');await expect(page.locator('.stage')).not.toHaveClass(/split/);await page.keyboard.press('Control+Shift+2');await expect(page.locator('.stage')).toHaveClass(/split/);await page.keyboard.press('Control+1');await expect(page.locator('.stage')).toHaveClass(/split/);await page.keyboard.press('Control+Shift+3');await expect(page.locator('.gridv')).toBeVisible();await page.keyboard.press('Control+Shift+1');await expect(page.locator('.stage')).not.toHaveClass(/split|grid/);
 await page.keyboard.press('Control+0');await expect(page.locator('.stage')).toBeVisible();await page.keyboard.press('Control+Shift+h');await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toBeVisible();
 await nav(page,'Settings');await page.keyboard.press('Control+n');await expect(page.getByRole('heading',{name:'General',exact:true})).toBeVisible();await page.keyboard.press('Control+Shift+n');await expect(page.getByRole('textbox',{name:'Start a task',exact:true})).toBeFocused();
 // Command works too on macOS; Control used above verifies the portable alias.
 await page.keyboard.press('Meta+Shift+p');await expect(page.getByRole('dialog',{name:'Ask Theseus',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await keyboard(page);await row(page,'Reset shortcuts').getByRole('button',{name:'Reset',exact:true}).click();await desktop.close();desktop=undefined;page=await launch();await keyboard(page);await expect(page.locator('.kbar kbd')).toHaveText('⌘K');await expect(row(page,'Next session').locator('kbd')).toHaveText('J');await expect(row(page,'Search settings').locator('kbd')).toHaveText('/');await page.keyboard.press('/');await expect(page.locator('#settings-search')).toBeFocused();await expect(page.locator('.app')).toHaveClass(/density-compact/);
 assert.deepEqual(errors,[]);console.log('PASS every configured action, paired directions, old bindings removed, case/modifiers, Ctrl/Cmd aliases/conflicts, capture/cancel, dialogs/palette toggle, typing/contenteditable/IME/repeat, settings search, reload/full restart/reset and General preference coexistence; no provider calls');
}finally{await desktop?.close();await rm(profile,{recursive:true,force:true});}
