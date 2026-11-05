// Test-only entry point: install guards before loading the production Electron app.
const electron = require('electron');
const { app, BrowserWindow } = electron;
if (process.platform === 'darwin') app.setActivationPolicy('prohibited');
app.focus = () => {};
if (app.dock) app.dock.show = () => Promise.resolve();
for (const method of ['show', 'showInactive', 'focus', 'restore']) {
  BrowserWindow.prototype[method] = () => {};
}
// This suite never requests native UI. Fail before a notification/modal can appear.
electron.Notification.prototype.show = () => { throw new Error('Native notification requested by hidden fixture'); };
for (const method of ['showOpenDialog', 'showOpenDialogSync', 'showSaveDialog', 'showSaveDialogSync', 'showMessageBox', 'showMessageBoxSync', 'showErrorBox']) {
  electron.dialog[method] = () => { throw new Error(`Native dialog ${method} requested by hidden fixture`); };
}
const HiddenWindow = new Proxy(BrowserWindow, {
  construct(Target, [options]) {
    const window = new Target({ ...options, show: false, focusable: false,
      webPreferences: { ...options.webPreferences, offscreen: true, backgroundThrottling: false },
    });
    window.on('show', () => { throw new Error('Hidden fixture window became visible'); });
    window.on('focus', () => { throw new Error('Hidden fixture window took native focus'); });
    return window;
  },
});
// Bundled main uses CommonJS imports. Keep the guards entirely outside product code.
const Module = require('node:module');
const load = Module._load;
Module._load = function(id, ...args) {
  return id === 'electron' ? { ...electron, BrowserWindow: HiddenWindow } : load.call(this, id, ...args);
};
require('../../dist-electron/main.cjs');
