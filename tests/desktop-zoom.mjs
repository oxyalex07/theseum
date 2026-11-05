// Real Electron zoom, isolated local data, deliberately missing Codex; no provider tasks.
import { _electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const profile = await mkdtemp(join(tmpdir(), 'theseus-zoom-'));
const output = 'artifacts/verification/desktop-zoom';
await mkdir(output, { recursive: true });
let desktop;
const errors = [], results = [];

async function reachable(locator) {
  await expect(locator).toBeVisible();
  const measure = () => locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    return {
      withinViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      uncovered: element.contains(document.elementFromPoint(x, y)),
      rect: rect.toJSON(), viewport: [innerWidth, innerHeight],
      ancestors: Array.from((function*(){for(let parent=element.parentElement;parent;parent=parent.parentElement)yield parent;})()).map(parent=>({class:parent.className,rect:parent.getBoundingClientRect().toJSON(),scroll:[parent.scrollTop,parent.scrollHeight,parent.clientHeight],overflow:getComputedStyle(parent).overflow})),
    };
  });
  try { await expect.poll(async () => {
    const geometry = await measure();
    return { withinViewport: geometry.withinViewport, uncovered: geometry.uncovered };
  }).toEqual({ withinViewport: true, uncovered: true });
  } catch(error) { console.error(JSON.stringify(await measure(), null, 2)); throw error; }
}

async function tabTo(page, locator, limit = 150) {
  for (let i = 0; i < limit; i++) {
    if (await locator.evaluate(element => element === document.activeElement)) {
      await reachable(locator);
      return;
    }
    await page.keyboard.press('Tab');
  }
  assert.fail(`Keyboard could not reach ${await locator.getAttribute('aria-label') ?? await locator.textContent()}`);
}

async function panel(page, label) {
  const button = page.getByRole('navigation', { name: 'Workspace panels', exact: true }).getByRole('button', { name: label, exact: true });
  if (await button.isVisible()) {
    await tabTo(page, button);
    await page.keyboard.press('Enter');
  }
}

async function screenshot(name) {
  // Capture the actual zoomed Electron surface, including native device scaling.
  const png = await desktop.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window.isVisible() || window.isFocused()) throw new Error('Fixture must stay hidden and inactive');
    const image = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    return image.toPNG().toString('base64');
  });
  await writeFile(join(output, name), Buffer.from(png, 'base64'));
}

try {
  const env = { ...process.env, THESEUS_USER_DATA_DIR: profile, THESEUS_CODEX_PATH: join(profile, 'missing-codex'), THESEUS_SAMPLE_PREVIEW: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.THESEUS_DEV_URL;
  desktop = await _electron.launch({ args: ['tests/fixtures/hidden-desktop.cjs'], env });
  const page = await desktop.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('.home-w').waitFor();
  const initialUrl = new URL(page.url());
  initialUrl.searchParams.set('static', '1');
  await desktop.evaluate(({ app, BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    // Exercise the production activation handler too: the bootstrap guards its show/focus calls.
    app.emit('activate');
    if (!window.webContents.isOffscreen()) throw new Error('Expected offscreen rendering');
    if (window.isVisible() || window.isFocused()) throw new Error('Expected hidden, inactive fixture');
  });

  for (const [width, height] of [[1440, 900], [1100, 700]]) {
    for (const zoom of [1.25, 1.5, 2]) {
      const label = `${width}x${height}-${zoom * 100}`;
      console.log(`Checking ${label}`);
      await desktop.evaluate(({ BrowserWindow }, { width, height, zoom }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setSize(width, height);
        window.webContents.setZoomFactor(zoom);
      }, { width, height, zoom });
      await page.goto(initialUrl.href);
      await desktop.evaluate(({ BrowserWindow }, zoom) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(zoom), zoom);
      console.log('Native viewport', await page.evaluate(() => [innerWidth, innerHeight]));
      await page.waitForFunction(expected => Math.abs(innerWidth - expected) <= 1, width / zoom, { polling: 100 });
      const dimensions = await page.evaluate(() => ({
        viewport: [innerWidth, innerHeight],
        app: [document.querySelector('.app').clientWidth, document.querySelector('.app').clientHeight],
        root: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      }));
      assert.ok(dimensions.app.every((size, index) => Math.abs(size - dimensions.viewport[index]) <= 1), JSON.stringify(dimensions));
      assert.ok(dimensions.root[0] <= dimensions.viewport[0] + 1, JSON.stringify(dimensions));
      assert.ok(dimensions.root[1] <= dimensions.viewport[1] + 1, JSON.stringify(dimensions));
      // Home's live configuration is long; Tab must scroll to the composer and native folder action.
      const draft = page.getByRole('textbox', { name: 'Start a task', exact: true });
      await tabTo(page, page.getByRole('button', { name: 'Choose project folder', exact: true }));
      await tabTo(page, draft);
      await draft.fill('Zoom regression task');
      const liveStart = page.getByRole('button', { name: 'Start Codex', exact: true });
      await liveStart.scrollIntoViewIfNeeded();
      await reachable(liveStart);
      await expect(liveStart).toBeDisabled(); // no selected project and no runtime, deliberately.
      const demo = page.getByRole('radio', { name: 'Demo crew', exact: true });
      await tabTo(page, demo);
      await page.keyboard.press('Space');
      await tabTo(page, draft);
      await tabTo(page, page.getByRole('button', { name: 'Start', exact: true }));
      await screenshot(`${label}-home.png`);
      await page.keyboard.press('Enter');
      await page.getByText(/Starting a simulated plan. No agent is running/).waitFor();
      const composer = page.getByRole('textbox', { name: 'Message Theseus', exact: true });
      await tabTo(page, composer);
      await composer.fill('Keyboard zoom reply');
      const send = page.getByRole('button', { name: 'Send', exact: true });
      await tabTo(page, send);
      await page.keyboard.press('Enter');
      await page.getByText('Keyboard zoom reply', { exact: true }).waitFor();
      await panel(page, 'Inspector');
      await page.getByRole('navigation', { name: 'Session inspector', exact: true }).waitFor();
      await tabTo(page, page.getByRole('navigation', { name: 'Session inspector', exact: true }).getByRole('button', { name: 'Terminal', exact: true }));
      await page.keyboard.press('Enter');
      await page.getByRole('region', { name: 'Interactive project terminal', exact: true }).waitFor();
      await screenshot(`${label}-inspector.png`);
      const hideInspector = page.getByRole('button', { name: 'Hide panel', exact: true });
      await tabTo(page, hideInspector);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('navigation', { name: 'Workspace panels', exact: true }).getByRole('button', { name: 'Workspace', exact: true })).toBeFocused();
      const restoreInspector = page.getByRole('button', { name: 'Show inspector', exact: true });
      await tabTo(page, restoreInspector);
      await page.keyboard.press('Enter');
      await expect(restoreInspector).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Interactive project terminal', exact: true })).toBeVisible();
      const inspectorButton = page.getByRole('navigation', { name: 'Workspace panels', exact: true }).getByRole('button', { name: 'Inspector', exact: true });
      await expect(inspectorButton).toBeFocused();
      await expect(inspectorButton).toHaveAttribute('aria-expanded', 'true');
      await reachable(inspectorButton);
      const inspectorRestore = await page.evaluate(() => ({
        app: document.querySelector('.app').className,
        inspectorVisible: !!document.querySelector('#workspace-inspector')?.getClientRects().length,
        focus: document.activeElement?.outerHTML.slice(0, 200),
      }));
      console.log('Inspector restore', inspectorRestore);
      await screenshot(`${label}-inspector-restored.png`);
      await panel(page, 'Sessions');
      await tabTo(page, page.getByRole('textbox', { name: 'Search sessions', exact: true }));
      await panel(page, 'Workspace');
      for (const view of ['Split', 'Grid', 'Focus']) {
        await tabTo(page, page.getByRole('button', { name: /^Current view:/ }));
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => page.getByRole('menuitem').first().evaluate(element => element === document.activeElement)).toBe(true);
        await tabTo(page, page.getByRole('menuitem', { name: view, exact: true }));
        await page.keyboard.press('Enter');
        if (view === 'Split') {
          await expect(page.locator('.stage.split .cv')).toHaveCount(2);
          await tabTo(page, page.locator('.stage.split .cv').last().getByRole('button', { name: 'Send', exact: true }));
        } else if (view === 'Grid') {
          await tabTo(page, page.getByRole('button', { name: 'Start another session', exact: true }));
          await screenshot(`${label}-grid.png`);
        }
      }
      await page.keyboard.press('Control+k');
      const palette = page.getByRole('dialog');
      await palette.waitFor();
      await page.getByRole('textbox', { name: 'Command palette search', exact: true }).fill('Zoom task');
      await tabTo(page, palette.getByRole('button', { name: 'Review demo task', exact: true }));
      await page.keyboard.press('Escape');
      await expect(palette).toHaveCount(0);
      const settings = page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('button', { name: 'Settings', exact: true });
      await tabTo(page, settings);
      await page.keyboard.press('Enter');
      await panel(page, 'Settings sections');
      const memory = page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('button', { name: 'Memory & privacy', exact: true });
      await tabTo(page, memory);
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: 'Memory & privacy', exact: true }).waitFor();
      const clear = page.getByRole('button', { name: 'Clear memory…', exact: true });
      await tabTo(page, clear);
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await tabTo(page, dialog.getByRole('button', { name: 'Cancel', exact: true }));
      await screenshot(`${label}-confirmation.png`);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => clear.evaluate(element => element === document.activeElement)).toBe(true);
      const agents = page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('button', { name: 'Agents', exact: true });
      await tabTo(page, agents);
      await page.keyboard.press('Enter');
      await tabTo(page, page.getByRole('button', { name: 'Create agent', exact: true }));
      await page.keyboard.press('Enter');
      await dialog.waitFor();
      await page.locator('#agent-name').fill('Zoom fixture');
      await tabTo(page, dialog.getByRole('button', { name: 'Create agent', exact: true }));
      await screenshot(`${label}-agent-dialog.png`);
      // Exercise actual local save; no live task or provider check is started.
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await page.getByText('Zoom fixture', { exact: true }).first().waitFor();
      // Main's persistent draft recovery must survive the compact-shell merge.
      // Seed only disposable renderer storage; no saved run or provider is needed.
      const recoveredText = `Recovered at ${label}\n${'Unsaved research text. '.repeat(200)}`;
      await page.evaluate(content => localStorage.setItem('theseus.research-drafts.v1', JSON.stringify({
        version: 1, drafts: [{ runId: '12345678-1234-1234-1234-123456789abc', kind: 'draft', revision: 1,
          projectPath: '/zoom-fixture', baseContent: 'Original', content, updatedAt: new Date().toISOString() }],
      })), recoveredText);
      await page.goto(initialUrl.href);
      await desktop.evaluate(({ BrowserWindow }, zoom) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(zoom), zoom);
      await page.waitForFunction(expected => Math.abs(innerWidth - expected) <= 1, width / zoom);
      const recovery = page.getByRole('region', { name: 'Recoverable Research drafts', exact: true }).getByRole('button');
      await expect(recovery).toContainText('(1)');
      // It remains mounted when switching from Home to another page.
      await tabTo(page, agents);
      await page.keyboard.press('Enter');
      await tabTo(page, recovery);
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('pre')).toHaveText(recoveredText);
      await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
      await tabTo(page, dialog.getByRole('button', { name: 'Keep drafts and close', exact: true }));
      await screenshot(`${label}-research-recovery.png`);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(recovery).toBeFocused();
      await reachable(recovery);
      await page.keyboard.press('Enter');
      await tabTo(page, dialog.getByRole('button', { name: 'Discard draft edits', exact: true }));
      await page.keyboard.press('Enter');
      await expect(dialog).toContainText('No unsaved Research drafts.');
      await tabTo(page, dialog.getByRole('button', { name: 'Keep drafts and close', exact: true }));
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(recovery).toHaveCount(0);
      results.push({ label, zoom, ...dimensions, inspectorRestore, researchRecovery: true, hidden: true });
      console.log(`PASS ${label}: viewport, Home, keyboard submit, session reply, panels, inspector restore/focus, settings, dialogs, research recovery; hidden`);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log('PASS all six native zoom cases; no provider calls');
} finally {
  await desktop?.close();
  await rm(profile, { recursive: true, force: true });
}
