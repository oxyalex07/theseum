// Production Electron, disposable profile, deliberately unavailable runtime: no provider calls.
import { _electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'theseus-session-actions-'));
await mkdir('artifacts/verification',{recursive:true});
let desktop;const errors=[];
try {
 const env={...process.env,THESEUS_USER_DATA_DIR:profile,THESEUS_CODEX_PATH:'/usr/bin/false'};
 delete env.ELECTRON_RUN_AS_NODE;delete env.THESEUS_DEV_URL;delete env.THESEUS_SAMPLE_PREVIEW;
 desktop=await _electron.launch({args:['.'],env});const page=await desktop.firstWindow();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.locator('.app').waitFor();
 const go=async(id,view='focus')=>{const url=new URL(page.url());url.search=`?s=${id}&view=${view}&static=1`;await page.goto(url.href);await expect(page.locator(`.thread[data-session="${id}"]`)).toBeVisible();};
 const sidebarSession=title=>page.locator('.side .ss').filter({has:page.locator('.ss-title').getByText(title,{exact:true})});
 const editor=()=>page.getByRole('dialog',{name:'Review demo command',exact:true});
 const forkDialog=()=>page.getByRole('dialog',{name:'Fork demo conversation',exact:true});
 await go('c1');await expect(page.locator('.demo-session-note')).toContainText('Demo · simulated');
 await page.getByRole('button',{name:'Edit',exact:true}).click();await expect(editor()).toContainText('Saving does not approve or execute');
 await editor().getByRole('textbox',{name:'Pending command'}).fill('');await expect(editor().getByRole('button',{name:'Save demo command'})).toBeDisabled();
 await editor().getByRole('textbox',{name:'Pending command'}).fill('pnpm test\nwhoami');await expect(editor().getByRole('alert')).toContainText('single line');
 await editor().getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.appr .code')).toContainText('pnpm add recharts@2.12.7');
 await page.getByRole('button',{name:'Edit',exact:true}).click();await editor().getByRole('textbox',{name:'Pending command'}).fill('pnpm test --filter reviewed-command');
 await page.keyboard.press('Control+Enter');await expect(editor()).toBeVisible();await editor().getByRole('button',{name:'Save demo command'}).click();
 await expect(page.locator('.appr .code')).toContainText('pnpm test --filter reviewed-command');await expect(page.locator('.appr .aff')).toBeEmpty();
 await expect(sidebarSession('Streak chart on habit screen').locator('.ss-prev').first()).toContainText('pnpm test --filter reviewed-command');
 await page.getByRole('button',{name:/^Notifications(?: · \d+ unread)?$/}).click();
 await expect(page.getByRole('dialog',{name:'Notifications',exact:true}).locator('.notification-item').filter({hasText:'Streak chart on habit screen'}).locator('.notification-detail')).toHaveText('pnpm test --filter reviewed-command');
 await page.getByRole('button',{name:'Close notifications'}).click();
 await page.getByRole('textbox',{name:/^Message /}).fill('unsent source draft');
 await page.getByRole('button',{name:'Fork',exact:true}).click();await expect(forkDialog()).toContainText('habit-tracker-app');await expect(forkDialog()).toContainText('unsent draft is excluded');
 await page.screenshot({path:'artifacts/verification/session-fork-dialog.png'});
 await forkDialog().getByRole('button',{name:'Create demo fork'}).click();
 const forkId=await page.locator('.thread').getAttribute('data-session');assert.notEqual(forkId,'c1');
 await expect(page.locator('.demo-session-note')).toContainText('Forked from');await expect(page.getByRole('textbox',{name:/^Message /})).toBeEmpty();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await editor().getByRole('textbox',{name:'Pending command'}).fill('pnpm lint');await editor().getByRole('button',{name:'Save demo command'}).click();
 // Keyboard menu navigation, focus return, clipboard, context action and source navigation.
 const more=page.getByRole('button',{name:'More',exact:true});await more.focus();await page.keyboard.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'Fork demo conversation…'})).toBeFocused();
 await page.keyboard.press('Escape');await expect(more).toBeFocused();await expect(page.getByRole('menu')).toHaveCount(0);
 await more.click();await page.keyboard.press('a');await expect(page.locator('.appr')).toBeVisible();await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');
 await more.click();await page.getByRole('menuitem',{name:'Fork demo conversation…'}).click();await expect(forkDialog()).toBeVisible();await forkDialog().getByRole('button',{name:'Cancel',exact:true}).click();
 await more.click();await page.getByRole('menuitem',{name:'View demo transcript…'}).click();const transcript=page.getByRole('dialog',{name:'Demo transcript',exact:true});const text=transcript.getByRole('textbox',{name:'Transcript',exact:true});await expect(text).toHaveValue(/pnpm lint/);await expect(text).toHaveValue(/Fork source:/);await text.focus();await page.keyboard.press('Meta+a');await page.keyboard.press('Meta+c');const copied=await desktop.evaluate(({clipboard})=>clipboard.readText());assert.match(copied,/pnpm lint/);await transcript.getByRole('button',{name:'Close',exact:true}).click();
 await more.click();await page.getByRole('menuitem',{name:'Show context panel'}).click();await expect(page.locator('.insp')).toBeVisible();
 await more.click();await page.getByRole('menuitem',{name:'Hide context panel'}).click();await expect(page.locator('.insp')).toHaveCount(0);
 await more.click();await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'Open source session'})).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('.thread')).toHaveAttribute('data-session','c1');await expect(page.locator('.appr .code')).toContainText('pnpm test --filter reviewed-command');await expect(page.getByRole('textbox',{name:/^Message /})).toHaveValue('unsent source draft');
 // Home must label the same edited command its adjacent Approve button resolves.
 await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
 const approvalRow=page.locator('.nrow').filter({hasText:'pnpm test --filter reviewed-command'});
 await expect(approvalRow.locator('code')).toHaveText('pnpm test --filter reviewed-command');
 await expect(approvalRow).not.toContainText('recharts');await approvalRow.getByRole('button',{name:'Approve',exact:true}).click();
 await sidebarSession('Streak chart on habit screen').click();
 await expect(page.locator('.appr')).toHaveCount(0);await expect(page.getByText('Approved in demo mode. No command was executed.',{exact:true})).toBeVisible();
 await expect(sidebarSession('Streak chart on habit screen').locator('.ss-prev').first()).toContainText('pnpm test --filter reviewed-command');
 // A displayed commit references sample data; exclude conversation entries after that error.
 await go('c3');const composer=page.getByRole('textbox',{name:/^Message /});await composer.fill('AFTER_ERROR_CONTEXT');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText(/Demo reply from .*AFTER_ERROR_CONTEXT/)).toBeVisible();
 await page.getByRole('button',{name:'Fork from a41c9e2…'}).click();await expect(forkDialog()).toContainText('through this displayed error');await expect(forkDialog()).toContainText('does not reconstruct historical files');await forkDialog().getByRole('button',{name:'Create demo fork'}).click();
 await expect(page.locator('.demo-session-note')).toContainText('commit reference a41c9e2 (no checkout)');await expect(page.locator('.thread')).not.toContainText('AFTER_ERROR_CONTEXT');
 await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('Demo retry requested. No build, checkout, or reset was performed.',{exact:true})).toBeVisible();
 // Pending scheduled replies stay out of the thread until Resume; grid retains paused sessions.
 await go('r1');const thread=page.locator('.thread');await page.getByRole('textbox',{name:/^Message /}).fill('PAUSE_BUFFER');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('button',{name:'Pause demo'}).click();
 await expect(page.locator('.cv-h .pill')).toContainText('Paused');await expect(page.getByRole('textbox',{name:/^Message /})).toBeDisabled();await page.waitForTimeout(1100);await expect(thread).not.toContainText('Demo reply from');
 await page.screenshot({path:'artifacts/verification/session-paused.png'});
 await page.getByRole('button',{name:'Resume demo'}).click();await expect(thread).toContainText('Demo reply from');await expect(page.getByRole('textbox',{name:/^Message /})).toBeEnabled();
 await page.getByRole('button',{name:'Pause demo'}).click();await page.keyboard.press('Control+3');await expect(page.locator('.tile').filter({hasText:'Compare agent orchestration frameworks'})).toBeVisible();await page.keyboard.press('Control+1');await page.getByRole('button',{name:'Resume demo'}).click();
 // Pause remains discoverable after closing the tab, through search and Home activity.
 const researchTitle='Compare agent orchestration frameworks';
 await page.getByRole('button',{name:'Pause demo'}).click();await page.getByRole('button',{name:`Close ${researchTitle}`,exact:true}).click();
 await expect(page.locator('div.home')).toBeVisible();
 const pausedTile=page.locator('.home .tile').filter({hasText:researchTitle});await expect(pausedTile.locator('.pill')).toContainText('Paused');
 await page.getByRole('textbox',{name:'Search sessions',exact:true}).fill('orchestration frameworks');
 const researchRow=sidebarSession(researchTitle);await expect(researchRow).toBeVisible();await expect(researchRow.locator('[title="Paused"]')).toHaveCount(1);
 await researchRow.click();await expect(page.getByRole('button',{name:'Resume demo'})).toBeVisible();
 await page.getByRole('textbox',{name:'Search sessions',exact:true}).fill('');
 await page.getByRole('button',{name:`Close ${researchTitle}`,exact:true}).click();await pausedTile.getByRole('button',{name:researchTitle,exact:true}).click();
 await page.getByRole('button',{name:'Resume demo'}).click();await expect(page.locator('.cv-h .pill')).toContainText('Thinking');
 // Deterministic Stop all: real Send handlers/timers from every demo state.
 await go('c1');const clockTime=new Date('2026-10-28T18:00:00Z');await page.clock.install({time:clockTime});await page.clock.pauseAt(new Date(clockTime.getTime()+1000));
 const stoppedSessions=[
   ['c1','Streak chart on habit screen','Needs approval'],['r2','Draft: Weekly AI notes #12','Needs your pick'],
   ['c3','Fix parser null check','Failed'],['c2','Review PR #47 · reminders','Ready for you'],
   ['r3','Cathode supplier risk map','Done'],['r4','Blog: why I built Theseus','Queued'],
   ['r1',researchTitle,'Thinking'],['c5','Timezone tests for reminders','Working'],
 ];
 for(const [id,title] of stoppedSessions){
   await sidebarSession(title).click();
   await expect(page.locator('.thread')).toHaveAttribute('data-session',id);
   await page.getByRole('textbox',{name:/^Message /}).fill(`STOP_ALL_${id}`);await page.getByRole('button',{name:'Send',exact:true}).click();
 }
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Approvals & safety',exact:true}).click();
 await page.getByRole('button',{name:'Stop all execution',exact:true}).click();await expect(page.getByText('All local execution stopped.',{exact:true})).toBeVisible();
 await page.clock.runFor(1100);
 await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
 for(const [id,title,status] of stoppedSessions){
   await sidebarSession(title).click();
   await expect(page.locator('.thread')).not.toContainText('Demo reply from');
   if(id==='r1'||id==='c5'){
     await expect(page.locator('.cv-h .pill')).toContainText('Paused');await page.getByRole('button',{name:'Resume demo'}).click();
     await expect(page.locator('.cv-h .pill')).toContainText(status);await expect(page.locator('.thread').getByText(new RegExp(`Demo reply from .*STOP_ALL_${id}`))).toHaveCount(1);
   }else{
     await expect(page.locator('.cv-h .pill')).toContainText(status);await expect(page.getByRole('button',{name:'Resume demo'})).toHaveCount(0);
   }
 }
 // A cancelled waiting reply stays cancelled even after its approval is resolved.
 await sidebarSession('Streak chart on habit screen').click();await page.locator('.appr').getByRole('button',{name:/^Approve/}).click();
 await page.clock.runFor(1100);await expect(page.locator('.thread')).not.toContainText('Demo reply from');
 await page.getByRole('textbox',{name:/^Message /}).fill('EXPLICIT_AFTER_STOP');await page.getByRole('button',{name:'Send',exact:true}).click();await page.clock.runFor(1100);
 await expect(page.locator('.thread').getByText(/Demo reply from .*EXPLICIT_AFTER_STOP/)).toHaveCount(1);
 await page.clock.resume();
 // Secondary pane actions must fork their own displayed source, not the selected primary session.
 await go('c1','split');const secondary=page.locator('.cv').nth(1);const sourceId=await secondary.locator('.thread').getAttribute('data-session');await secondary.getByRole('button',{name:'Fork',exact:true}).click();await forkDialog().getByRole('button',{name:'Create demo fork'}).click();
 await expect(page.locator('.demo-session-note')).toContainText('Forked from');await page.locator('.demo-session-note').getByRole('button',{name:'Open source session'}).click();await expect(page.locator('.thread')).toHaveAttribute('data-session',sourceId);
 await page.setViewportSize({width:1100,height:700});await page.getByRole('button',{name:'More',exact:true}).click();await page.screenshot({path:'artifacts/verification/session-more-1100.png'});await page.keyboard.press('Escape');
 const state=await page.evaluate(()=>window.theseus.getExecutionState());assert.equal(state.runs.length,0);assert.equal(state.workspace,null);assert.deepEqual(errors,[]);
 console.log('PASS demo fork source/project/commit boundary and independence; edit validation/cancel/save/approval shortcut isolation; More keyboard/clipboard/context/source actions; edited approval Home/sidebar/notification consistency; paused reply buffering/resume/grid/sidebar/search/Home after tab close; deterministic Stop all cancellation in waiting/question/error/review/done/queued and thinking/running buffer/resume; secondary source; 1100×700; no live runs, workspace changes or provider calls');
} finally {await desktop?.close();await rm(profile,{recursive:true,force:true});}
