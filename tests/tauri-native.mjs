import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(resolve(root, '.cache'), { recursive: true });
await mkdir(resolve(root, '.cache/th/id'), { recursive: true });
await writeFile(resolve(root, '.cache/th/id/OIG.fixture.png'), Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFQAAAABJRU5ErkJggg==', 'base64'));
await writeFile(resolve(root, '.cache/aisandbox.generateimages.json'), JSON.stringify({
  bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFQAAAABJRU5ErkJggg==',
}));
const profile = await mkdtemp(resolve(root, '.cache/release-tauri-test-'));
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
const cdpPort = await freePort(), secondPort = await freePort(), apiPort = await freePort();
let summaryAuthorization = '';
const llm = createHttpServer((req, res) => {
  summaryAuthorization = String(req.headers.authorization);
  req.resume();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content: '# Local summary' } }] }));
});
await new Promise(resolve => llm.listen(0, '127.0.0.1', resolve));
const llmUrl = `http://127.0.0.1:${llm.address().port}/v1/chat/completions`;
const app = spawn(resolve(root, 'src-tauri/target/debug/ai-tool-box.exe'), [], {
  windowsHide: true, cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env,
    AI_TOOLBOX_TEST_DATA_DIR: profile, AI_TOOLBOX_NATIVE_TEST: '1',
    AI_TOOLBOX_API_HOST: '127.0.0.1', AI_TOOLBOX_API_PORT: String(apiPort),
    AI_TOOLBOX_API_TOKEN: 'local-integration-token',
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '',
    AI_TOOLBOX_TEST_CDP_PORT: String(cdpPort), AI_TOOLBOX_TEST_SECOND_CDP_PORT: String(secondPort),
  },
});
let logs = '';
app.stderr.on('data', chunk => { logs += chunk; });
app.stdout.on('data', chunk => { logs += chunk; });
let browser, secondBrowser;
try {
  await expect.poll(async () => {
    if (app.exitCode !== null) throw new Error(logs);
    return fetch(`http://127.0.0.1:${cdpPort}/json/version`).then(r => r.ok).catch(() => false);
  }, { timeout: 90000 }).toBe(true);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  let main;
  await expect.poll(() => {
    main = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/native.html'));
    return !!main;
  }, { timeout: 30000 }).toBe(true);
  await main.waitForFunction(() => window.testReady, { timeout: 30000 });
  main.on('console', message => { if (message.type() === 'error') console.error('Main UI:', message.text()); });
  main.on('pageerror', error => console.error('Main UI:', error));
  const result = await main.evaluate(async () => {
    const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
    const api = window.desktopAPI;
    const view = await window.makeGuest();
    window.fixtureView = view;
    const id = view.getWebContentsId();
    const value = await view.executeJavaScript('Promise.resolve({answer:42})');
    const denied = await view.executeJavaScript(`(async () => {
      try { await window.__TAURI_INTERNALS__.invoke('backend_call', {channel:'preset:list',payload:null}); return false; }
      catch { return true; }
    })()`);
    const sent = await api.sendWebviewInput({ toolId: 'deepseek', partition: 'persist:preset-default', content: 'hello local fixture', webContentsId: id });
    const submitted = await view.executeJavaScript('window.lastSubmitted');
    const nativeSend = await api.sendWebviewInput({
      toolId: 'volcengine', partition: 'persist:preset-default',
      content: 'native trusted input', webContentsId: id,
    });
    const trustedEvents = await view.executeJavaScript('window.nativeEvents');
    const created = await api.createPreset('Native Integration Preset');
    if (!created.success) throw new Error(created.error);
    const opened = await api.openPreset(created.preset.id);
    const renamed = await api.renamePreset(created.preset.id, 'Renamed');
    await view.executeJavaScript("localStorage.setItem('isolation', 'default-only')");
    const settings = await api.getImageGenApiSettings();
    const saved = await api.saveToolSettings({ version: '1.0.0', disabledToolIds: ['claude'] });
    const reloaded = await api.getToolSettings();
    const update = await api.checkForUpdates().then(v => v, e => ({ error: String(e) }));
    return { value, denied, sent, submitted, nativeSend, trustedEvents, created, opened, renamed, settings, saved, reloaded, id, update };
  });
  console.log(JSON.stringify(result, null, 2));
  expect(result.value).toEqual({ answer: 42 });
  expect(result.denied).toBe(true);
  expect(result.sent.success).toBe(true);
  expect(result.submitted).toBe('hello local fixture');
  expect(result.nativeSend.success).toBe(true);
  expect(result.trustedEvents.some(event => event.key === 'Enter' && event.trusted)).toBe(true);
  expect(result.opened.success).toBe(true);
  expect(result.renamed.preset.name).toBe('Renamed');
  expect(result.reloaded.settings.disabledToolIds).toContain('claude');
  expect(result.settings.status.running).toBe(true);
  const services = await main.evaluate(async (url) => {
    const api = window.desktopAPI;
    const configured = await api.saveLlmSettings({
      enabled: true, provider: 'custom', baseUrl: url, model: 'local-fixture',
      apiKey: 'integration-only-key', temperature: 0.3, maxTokens: 1024,
    });
    const summary = await api.summarizeResponses({ question: 'local question', responses: [{ toolName: 'Fixture', content: 'local answer' }] });
    const removed = await api.saveLlmSettings({
      enabled: false, provider: 'custom', baseUrl: url, model: 'local-fixture',
      apiKey: '', temperature: 0.3, maxTokens: 1024,
    });
    const gps = await api.saveGeolocationSettings({
      version: '1.0.0',
      profiles: { local: { id: 'local', name: 'Local GPS', latitude: 30, longitude: 120, accuracy: 10 } },
      tools: {}, session: { mode: 'profile', profileId: 'local' },
    });
    const coords = await window.fixtureView.executeJavaScript(
      'new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve(p.coords.latitude), e => reject(e.message), {timeout:5000}))');
    const agent = await api.saveAgentCliConfig('codex', {
      enabled: false, model: 'test-model', apiKey: '', baseUrl: '',
      defaultArgs: '', permissionMode: 'default',
    });
    return { configured, summary, removed, gps, coords, agent };
  }, llmUrl);
  expect(services.configured.settings.hasApiKey).toBe(true);
  expect(services.summary.markdown).toBe('# Local summary');
  expect(services.removed.settings.hasApiKey).toBe(false);
  expect(services.gps.success).toBe(true);
  expect(services.coords).toBe(30);
  expect(services.agent.success).toBe(true);
  expect(summaryAuthorization).toBe('Bearer integration-only-key');
  expect(await readFile(resolve(profile, 'llm-settings.json'), 'utf8')).not.toContain('integration-only-key');
  const presetId = result.created.preset.id;
  secondBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${secondPort}`);
  let second;
  await expect.poll(() => {
    second = secondBrowser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/native.html'));
    return !!second;
  }, { timeout: 30000 }).toBe(true);
  await second.waitForFunction(() => window.testReady);
  second.on('pageerror', error => console.error('Second UI:', error));
  const isolated = await second.evaluate(async (foreignId) => {
    const view = await window.makeGuest();
    const value = await view.executeJavaScript("localStorage.getItem('isolation')");
    const foreign = await window.desktopAPI.sendWebviewInput({
      toolId: 'deepseek', partition: 'persist:preset-default', content: 'must not send', webContentsId: foreignId,
    }).then(() => false, () => true);
    return { value, foreign, preset: window.desktopAPI.getPresetId() };
  }, result.id);
  expect(isolated.value).toBeNull();
  expect(isolated.foreign).toBe(true);
  expect(isolated.preset).toBe(presetId);
  const base = `http://127.0.0.1:${apiPort}`;
  const headers = { 'X-Api-Token': 'local-integration-token' };
  const health = await fetch(`${base}/api/health`).then(r => r.json());
  expect(health.features).toContain('parallel-workers');
  expect((await fetch(`${base}/api/debug/webview?toolId=deepseek`)).status).toBe(401);
  const screenshot = await fetch(`${base}/api/debug/screenshot?toolId=deepseek&webContentsId=${result.id}`, { headers }).then(r => r.json());
  expect(screenshot.success, JSON.stringify(screenshot)).toBe(true);
  const generated = await Promise.all([1, 2].map(index => fetch(`${base}/api/gen_image`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId: 'bing-create', prompt: `local fixture ${index}`, timeoutMs: 15000 }),
  }).then(r => r.json())));
  for (const image of generated) {
    if (!image.success) {
      console.log('Main ensures', await main.evaluate(() => window.ensureRequests));
      console.log('Second ensures', await second.evaluate(() => window.ensureRequests));
    }
    console.log('Generated fixture:', JSON.stringify(image));
    expect(image.success, JSON.stringify(image)).toBe(true);
    expect(image.images.length).toBeGreaterThan(0);
  }
  const stream = await fetch(`${base}/api/gen_image/stream`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId: 'bing-create', prompt: 'local stream fixture', timeoutMs: 15000 }),
  }).then(r => r.text());
  expect(stream).toContain('event: assigned');
  expect(stream).toContain('event: image');
  expect(stream).toContain('"success":true');
  const captured = await fetch(`${base}/api/gen_image`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId: 'aistudio-image', prompt: 'network capture fixture', timeoutMs: 15000 }),
  }).then(r => r.json());
  expect(captured.success, JSON.stringify(captured)).toBe(true);
  expect(captured.via).toBe('web-api');
  const cleanup = await main.evaluate(async (presetId) => {
    const forbidden = await window.desktopAPI.deletePreset('default');
    const deleted = await window.desktopAPI.deletePreset(presetId);
    const clear = await window.desktopAPI.clearToolWebviewData();
    return { forbidden, deleted, clear, presets: await window.desktopAPI.listPresets() };
  }, presetId);
  expect(cleanup.forbidden.success).toBe(false);
  expect(cleanup.deleted.success).toBe(true);
  expect(cleanup.clear.success).toBe(true);
  expect(cleanup.presets.presets).toHaveLength(1);
  const registry = JSON.parse(await readFile(resolve(profile, 'preset-registry.json'), 'utf8'));
  expect(registry.presets).toHaveLength(1);
  await main.goto('http://127.0.0.1:5173/');
  await expect(main.getByRole('button', { name: '切换到 生视频', exact: true })).toBeVisible();
  await main.getByRole('button', { name: '切换到 生视频', exact: true }).click();
  await main.getByRole('button', { name: '切换到 API', exact: true }).click();
  await expect(main.getByRole('main', { name: 'API webview workers' })).toBeVisible();
  const realUiApi = await fetch(`${base}/api/gen_image`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId: 'bing-create', prompt: 'real React worker test', timeoutMs: 15000 }),
  }).then(r => r.json());
  expect(realUiApi.success, JSON.stringify(realUiApi)).toBe(true);
  await expect(main.getByRole('tab', { name: /bing-create-worker/ }).first()).toBeVisible();
  await main.screenshot({ path: resolve(profile, 'native-react-api.png') });
  console.log('Native integration passed: Node service, HTTP API, guest input, screenshots, preset lifecycle, isolation, settings, update configuration, cache.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await secondBrowser?.close().catch(() => {});
  if (app.exitCode === null) { const exit = once(app, 'exit'); app.kill(); await exit; }
  await expect.poll(async () => fetch(`http://127.0.0.1:${apiPort}/api/health`).then(() => false, () => true),
    { timeout: 15000 }).toBe(true);
  llm.closeAllConnections();
  await new Promise(resolve => llm.close(resolve));
}
