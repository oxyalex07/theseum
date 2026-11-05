// Production renderer + real Electron IPC with disposable data and a local runtime.
// No provider tasks, automatic routines, fixed ports, or user profiles are used.
import { chromium, _electron as electron, expect } from '@playwright/test';
import { preview } from 'vite';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const output = 'artifacts/verification/text-contrast';
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'theseus-text-contrast-')));
const evidence = { axeVersion: axe.version, scans: [], measurements: [], errors: [] };
const failures = [];
let server, browser, desktop;
await mkdir(output, { recursive: true });

function monitor(page) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => evidence.errors.push(error.message));
}

async function scan(page, name, context = null) {
  // DevTools evaluation keeps the app's production CSP intact.
  await page.evaluate(axe.source);
  const result = await page.evaluate(async context => {
    const result = await window.axe.run(context ?? document, { runOnly: ['color-contrast'] });
    return { violations: result.violations, incomplete: result.incomplete, passes: result.passes.length };
  }, context);
  evidence.scans.push({ name, ...result });
  if (result.violations.length) failures.push(`${name}: ${result.violations.flatMap(v => v.nodes.map(n => n.target.join(' '))).join(', ')}`);
  if (context && (result.incomplete.length || !result.passes)) failures.push(`${name}: target contrast was not conclusively evaluated by axe`);
}

async function measure(locator, name, state) {
  await expect(locator).toBeVisible();
  const measurement = await locator.evaluate(element => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = color => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
    };
    const over = (fg, bg) => [...fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])), 1];
    const chain = [];
    for (let node = element; node; node = node.parentElement) chain.unshift(node);
    let background = [255, 255, 255, 1];
    for (const node of chain) {
      const style = getComputedStyle(node);
      // Refuse unsupported paint instead of silently reporting a false pass.
      assertPaint(style);
      background = over(rgba(style.backgroundColor), background);
    }
    function assertPaint(style) {
      if (Number(style.opacity) !== 1 || style.backgroundImage !== 'none' || style.filter !== 'none' || style.mixBlendMode !== 'normal') {
        throw new Error('Contrast measurement requires opaque elements without gradients, filters, or blending');
      }
    }
    const style = getComputedStyle(element);
    const foreground = over(rgba(style.color), background);
    const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(foreground), b = luminance(background);
    return { text: element.textContent.trim(), foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), fontSize: style.fontSize };
  });
  evidence.measurements.push({ name, state, ...measurement });
  if (measurement.ratio < 4.5) failures.push(`${name} ${state}: ${measurement.ratio.toFixed(3)}:1`);
}

async function states(page, locator, name, text = locator) {
  assert.equal(await locator.isEnabled(), true, `${name} must be enabled for state coverage`);
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
  for (const state of ['normal', 'hover', 'focus', 'hover-focus']) {
    await page.mouse.move(1430, 890);
    await page.evaluate(() => document.activeElement?.blur());
    if (state.includes('focus')) {
      await page.keyboard.press('Tab');
      await locator.focus();
      assert.equal(await locator.evaluate(el => el.matches(':focus-visible')), true, `${name}: keyboard focus`);
      const indicator = await locator.evaluate(el => {
        const s = getComputedStyle(el);
        return s.boxShadow !== 'none' || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
      });
      assert.equal(indicator, true, `${name}: visible focus indicator`);
    }
    if (state.includes('hover')) await locator.hover();
    // Let the existing tooltip/hover transition finish before axe or screenshots.
    await page.waitForTimeout(180);
    await measure(text, name, state);
    await scan(page, `${name} ${state}`, { include: [await locator.evaluate(el => {
      el.setAttribute('data-contrast-target', '');
      return '[data-contrast-target]';
    })] });
    await locator.evaluate(el => el.removeAttribute('data-contrast-target'));
  }
  await page.mouse.move(1430, 890);
  await page.evaluate(() => document.activeElement?.blur());
}

const navigate = (page, name) => page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('button', { name, exact: true }).click();
async function shared(page, label) {
  await states(page, page.locator('.split-btn > button').first(), `${label} New`);
  await states(page, page.locator('.kbar'), `${label} command/search`);
  await states(page, page.locator('.ss.home'), `${label} Home summary`, page.locator('.ss.home small'));
}
async function capture(page, name) {
  await page.mouse.move(1430, 890);
  await page.waitForTimeout(180);
  await scan(page, name);
  await page.screenshot({ path: `${output}/${name}.png` });
}

try {
  server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  monitor(page);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?static=1&samples=1`);
  await expect(page.locator('.ss.home small')).toContainText('working');
  assert.ok(await page.locator('.slist .ss:not(.home)').count(), 'populated sample sessions');
  await shared(page, 'browser');
  await capture(page, 'browser-home');
  await page.locator('.kbar').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, 'browser-command-dialog');
  await page.keyboard.press('Escape');
  await navigate(page, 'Agents');
  await expect(page.locator('.crewc').first()).toBeVisible();
  await states(page, page.getByRole('button', { name: 'Create agent', exact: true }), 'browser Create agent');
  await capture(page, 'browser-agents');

  const fixture = join(temporary, 'runtime.cjs');
  await writeFile(fixture, `#!${process.execPath}\nif(process.argv.includes('--version'))console.log('contrast-fixture 1.0');\nelse if(process.argv.includes('login'))console.log('Logged in');\nelse if(process.argv.includes('mcp'))console.log('[]');\nelse if(process.argv.includes('app-server'))require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id!==undefined)console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{userAgent:'contrast-fixture'}:m.method==='model/list'?{data:[]}:m.method==='account/read'?{account:null}:{}}));});\nelse process.exit(1);\n`, { mode: 0o700 });
  const bootstrap = join(temporary, 'hidden-app.cjs');
  await writeFile(bootstrap, `const {BrowserWindow,app}=require('electron');\nBrowserWindow.prototype.show=function(){};\napp.dock?.hide();\nrequire(${JSON.stringify(resolve('dist-electron/main.cjs'))});\n`);
  const env = { ...process.env, THESEUS_USER_DATA_DIR: join(temporary, 'profile'), THESEUS_CODEX_PATH: fixture, THESEUS_SAMPLE_PREVIEW: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.THESEUS_DEV_URL;
  desktop = await electron.launch({ args: [bootstrap], env });
  const window = await desktop.firstWindow();
  monitor(window);
  await window.getByRole('button', { name: 'Open your profile' }).waitFor();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900));
  const project = join(temporary, 'project');
  await mkdir(project);
  await desktop.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, project);
  await window.evaluate(async () => {
    const agent = await window.theseus.saveAgentProfile({ name: 'Contrast reviewer', icon: 'shield', color: 'violet', description: 'Saved profile for rendered contrast checks', runtime: 'codex', model: null, reasoningEffort: null, instructions: 'Read only fixture', memory: 'none', sandbox: 'read-only', timeoutSeconds: 60, folderChoice: null });
    const folder = await window.theseus.selectAgentFolder();
    await window.theseus.saveRoutine({ name: 'Contrast review', task: 'Review fixture project', trigger: { kind: 'interval', minutes: 60 }, enabled: false, profileId: agent.id, profileUpdatedAt: agent.updatedAt, useWorktree: false, folderChoice: folder.id, executionConsent: false });
  });
  await window.reload();
  await window.getByRole('button', { name: 'Open your profile' }).waitFor();
  await shared(window, 'desktop');
  await capture(window, 'desktop-home');
  await navigate(window, 'Agents');
  const savedToggle = window.getByRole('button', { name: 'Show saved data', exact: true });
  if (await savedToggle.count()) await savedToggle.click();
  await expect(window.locator('.crewc').filter({ hasText: 'Contrast reviewer' })).toBeVisible();
  await states(window, window.getByRole('button', { name: 'Create agent', exact: true }), 'desktop Create agent');
  await states(window, window.getByRole('button', { name: 'Use agent', exact: true }), 'desktop Use agent');
  await capture(window, 'desktop-agents');
  await window.getByRole('button', { name: 'Create agent', exact: true }).click();
  await expect(window.getByRole('dialog')).toBeVisible();
  await states(window, window.getByRole('dialog').getByRole('button', { name: 'Create agent', exact: true }), 'agent dialog primary');
  await capture(window, 'desktop-agent-dialog');
  await window.getByRole('button', { name: 'Cancel', exact: true }).click();
  await navigate(window, 'Routines');
  await expect(window.locator('[data-routine-id]')).toContainText('Contrast review');
  await states(window, window.getByRole('button', { name: 'New routine', exact: true }), 'desktop New routine');
  await capture(window, 'desktop-routines');
  await window.getByRole('button', { name: 'Edit Contrast review', exact: true }).click();
  await expect(window.getByRole('dialog')).toBeVisible();
  await states(window, window.getByRole('button', { name: 'Save routine changes', exact: true }), 'routine dialog primary');
  await capture(window, 'desktop-routine-dialog');
  await window.getByRole('button', { name: 'Cancel', exact: true }).click();
  await window.getByRole('switch', { name: 'Enable Contrast review', exact: true }).click();
  await states(window, window.getByRole('button', { name: 'Allow and enable routine', exact: true }), 'routine consent primary');
  await capture(window, 'desktop-routine-consent');
  await window.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await window.evaluate(() => window.theseus.getRoutines())).executions.length, 0);
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(failures, [], 'Rendered small text must reach 4.5:1 in every measured state; see contrast.json');
  console.log(`PASS ${evidence.measurements.length} rendered text/state measurements and ${evidence.scans.length} axe contrast scans; no provider tasks or routine executions`);
} finally {
  await writeFile(`${output}/contrast.json`, JSON.stringify({ ...evidence, failures }, null, 2));
  await desktop?.close();
  await browser?.close();
  await new Promise(resolve => server ? server.httpServer.close(resolve) : resolve());
  await rm(temporary, { recursive: true, force: true });
}
