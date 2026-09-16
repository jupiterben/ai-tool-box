const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');

app.setPath('userData', process.env.TEST_USER_DATA);
app.on('session-created', (session) => {
  session.webRequest.onBeforeRequest((details, callback) => {
    callback({
      cancel:
        !details.url.startsWith('http://127.0.0.1:5173/') &&
        !details.url.startsWith('ws://127.0.0.1:5173/') &&
        !details.url.startsWith('file:') &&
        !details.url.startsWith('devtools:'),
    });
  });
});
const settings = {
  proxy: { version: '2.0.0', profiles: {}, tools: {} },
  geolocation: { version: '1.0.0', profiles: {}, tools: {} },
  session: {
    version: '1.0.0',
    tools: { deepseek: { toolId: 'deepseek', incognito: true } },
  },
  llm: {
    version: '1.0.0',
    enabled: false,
    provider: 'deepseek',
    model: 'test',
    hasApiKey: false,
    temperature: 0.3,
    maxTokens: 4096,
  },
};
const calls = [];
global.testCalls = calls;
for (const name of Object.keys(settings)) {
  ipcMain.handle(`${name}:get-settings`, () => ({
    success: true,
    settings: settings[name],
  }));
  ipcMain.handle(`${name}:save-settings`, (_event, value) => {
    calls.push({ channel: `${name}:save-settings`, value });
    settings[name] = { ...settings[name], ...value };
    return { success: true, settings: settings[name] };
  });
}
for (const channel of [
  'geolocation:apply-for-tool',
  'session:prepare-tool-mode',
  'session:clear-incognito',
  'webview:clear-tool-data',
  'webview:send-input',
]) {
  ipcMain.handle(channel, (_event, value) => {
    calls.push({ channel, value });
    return { success: true };
  });
}
ipcMain.handle('webview:extract-responses', (_event, payload) => ({
  success: true,
  responses: payload.toolIds.map((toolId) => ({
    toolId,
    success: true,
    content:
      '# Test response\n\n| Name | Result |\n| --- | --- |\n| Svelte | Passed |\n\n<img src=x onerror="window.unsafeMarkup=true"><script>window.unsafeMarkup=true</script>',
  })),
}));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: join(__dirname, 'electron-preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
    },
  });
  win.webContents.on('will-attach-webview', (_event, _preferences, params) => {
    params.src = 'http://127.0.0.1:5173/tests/fixtures/guest.html';
  });
  await win.loadURL(process.env.TEST_RENDERER_URL || 'http://127.0.0.1:5173');
});
app.on('window-all-closed', () => app.quit());
