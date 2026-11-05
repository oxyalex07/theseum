// Verify the installed executable, Chromium, and node-pty inside real Electron.
// This is source-runtime evidence; it does not inspect a packaged application.
import { _electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const installedVersion = require('electron/package.json').version;
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const root = await mkdtemp(join(tmpdir(), 'theseus-electron-runtime-'));
const fixture = join(root, 'main.cjs');
await writeFile(fixture, `const {app}=require('electron');
globalThis.runtimePty=require(${JSON.stringify(require.resolve('node-pty'))});
app.on('window-all-closed',()=>{});app.whenReady().then(()=>{});\n`);
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><title>Runtime probe</title><h1>Local Chromium probe</h1>');
});
let desktop;
try {
  // No provider access, visible window, application data, or fixed port.
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ args: [fixture, `--user-data-dir=${join(root, 'profile')}`], env });
  const versions = await desktop.evaluate(() => ({ ...process.versions }));
  assert.equal(manifest.devDependencies.electron, installedVersion, 'Keep the audited runtime pinned');
  assert.equal(versions.electron, installedVersion, 'Executable must match the installed package');
  const stable44 = /^44\.(\d+)\.(\d+)$/.exec(versions.electron);
  assert.ok(stable44 && (Number(stable44[1]) > 9 ||
    (Number(stable44[1]) === 9 && Number(stable44[2]) >= 1)),
    `GHSA-jr5w-w6x2-84p9 requires patched Electron 44.x; got ${versions.electron}`);

  const browser = await desktop.evaluate(async ({ BrowserWindow, net }, url) => {
    const window = new BrowserWindow({ show: false, webPreferences: {
      sandbox: true, contextIsolation: true, nodeIntegration: false,
    } });
    try {
      await window.loadURL(url);
      const page = await window.webContents.executeJavaScript(
        '({title:document.title,text:document.querySelector("h1").textContent,node:typeof require})');
      const response = await net.fetch(url);
      return { page, status: response.status, body: await response.text(), visible: window.isVisible() };
    } finally { window.destroy(); }
  }, origin);
  assert.deepEqual(browser.page, { title: 'Runtime probe', text: 'Local Chromium probe', node: 'undefined' });
  assert.equal(browser.visible, false);
  assert.equal(browser.status, 200);
  assert.ok(browser.body.includes('Local Chromium probe'));

  const native = await desktop.evaluate(async () => {
    const pty = globalThis.runtimePty;
    return new Promise((resolve, reject) => {
      const win = process.platform === 'win32';
      const child = pty.spawn(win ? 'cmd.exe' : '/bin/sh',
        win ? ['/d', '/c', 'echo THESEUS_NATIVE_PTY_OK'] : ['-c', 'printf THESEUS_NATIVE_PTY_OK'],
        { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd(), env: process.env });
      let output = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('Native PTY timed out')); }, 10000);
      child.onData(data => { output += data; });
      child.onExit(result => { clearTimeout(timer); resolve({ ...result, output }); });
    });
  });
  assert.equal(native.exitCode, 0);
  assert.ok(native.output.includes('THESEUS_NATIVE_PTY_OK'));
  console.log('PASS installed Electron runtime, hidden Chromium page/network isolation, native PTY:',
    JSON.stringify({ versions, native }));
} finally {
  await desktop?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}
