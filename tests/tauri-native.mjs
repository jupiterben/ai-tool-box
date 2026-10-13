// Real Windows WebView2 integration. Uses only local fixture pages and isolated profiles.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

if (process.platform !== 'win32') throw new Error('Native CDP tests currently require Windows WebView2');
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(resolve(root, '.cache'), { recursive: true });
const profile = await mkdtemp(resolve(root, '.cache/tauri-native-'));
const portServer = createServer();
portServer.listen(0, '127.0.0.1');
await once(portServer, 'listening');
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const child = spawn(resolve(root, 'src-tauri/target/debug/ai-tool-box.exe'), [], {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
    AI_TOOL_BOX_NATIVE_TEST: '1',
    AI_TOOL_BOX_TEST_DATA_DIR: profile,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (chunk) => { log += chunk; });
child.stderr.on('data', (chunk) => { log += chunk; });
let browser;
try {
  await expect.poll(async () => {
    if (child.exitCode !== null) throw new Error(`Native app exited: ${log}`);
    return fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.ok).catch(() => false);
  }, { timeout: 60_000 }).toBe(true);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  let page;
  await expect.poll(() => {
    page = browser.contexts().flatMap((context) => context.pages())
      .find((candidate) => candidate.url().includes('tauri-main.html'));
    return !!page;
  }, { timeout: 30_000 }).toBe(true);
  await page.waitForFunction(() => window.testReady, { timeout: 30_000 });
  const result = await page.evaluate(async () => {
    const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
    const { mountGuest } = await import('/src/desktop/webview.ts');
    const host = document.getElementById('guest-anchor');
    const errors = [];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let element;
    async function create(incognito = false) {
      let ready;
      const loaded = new Promise((resolve) => { ready = resolve; });
      const dispose = mountGuest(host, {
        src: `${location.origin}/tests/fixtures/guest.html`, toolId: 'deepseek',
        partition: incognito ? 'temp-test-private' : 'persist:test-native',
        incognito,
      }, (view) => {
        element = view;
        view.addEventListener('did-finish-load', ready, { once: true });
        return () => view.removeEventListener('did-finish-load', ready);
      }, (error) => errors.push(error));
      await Promise.race([loaded, wait(20_000).then(() => { throw new Error(`Guest load timeout: ${errors}`); })]);
      return dispose;
    }
    let dispose = await create();
    const asyncValue = await element.executeJavaScript('new Promise(resolve => setTimeout(() => resolve({answer: 42}), 50))');
    const nativeDenied = await element.executeJavaScript(`(async () => {
      try {
        await window.__TAURI_INTERNALS__.invoke('desktop_request', {action:'proxy:get', payload:null});
        return false;
      } catch { return true; }
    })()`);
    const { handleWebviewInput } = await import('/src/components/WebviewInputHandler.ts');
    const sent = await handleWebviewInput({
      toolId: 'deepseek', webviewElement: element, inputContent: 'native local test', timeout: 10_000,
    });
    const submitted = await element.executeJavaScript('window.lastSubmitted');
    await element.executeJavaScript("localStorage.setItem('native-test', 'persisted')");
    dispose();
    await wait(500);
    dispose = await create();
    const persisted = await element.executeJavaScript("localStorage.getItem('native-test')");
    await window.desktopAPI.saveGeolocationSettings({
      version: '1.0.0',
      profiles: { test: { id: 'test', name: 'Test', latitude: 30, longitude: 120, accuracy: 10 } },
      tools: { deepseek: { toolId: 'deepseek', mode: 'profile', profileId: 'test' } },
    });
    const geo = await element.executeJavaScript('new Promise(resolve => navigator.geolocation.getCurrentPosition(p => resolve(p.coords.latitude)))');
    const proxy = await window.desktopAPI.getProxySettings();
    const invalidProxy = await window.desktopAPI.saveProxySettings({
      ...proxy.settings, profiles: { p: { protocol: 'http', host: 'localhost', port: '99999' } },
      tools: { deepseek: { toolId: 'deepseek', mode: 'profile', profileId: 'p' } },
    });
    await window.desktopAPI.clearToolWebviewData('deepseek');
    const reloaded = new Promise((resolve) => element.addEventListener('did-finish-load', resolve, { once: true }));
    element.reload();
    await reloaded;
    const cleared = await element.executeJavaScript("localStorage.getItem('native-test')");
    dispose();
    await wait(500);
    dispose = await create(true);
    const privateStartsEmpty = await element.executeJavaScript("localStorage.getItem('native-test')");
    await element.executeJavaScript("localStorage.setItem('native-test', 'private')");
    dispose();
    await wait(500);
    dispose = await create(true);
    const privateCleared = await element.executeJavaScript("localStorage.getItem('native-test')");
    dispose();
    const badUrl = await invoke('create_guest', {
      label: `guest-${crypto.randomUUID()}`, src: 'file:///C:/Windows/win.ini',
      toolId: 'test', partition: 'persist:test', incognito: false,
      bounds: { x: 0, y: 0, width: 100, height: 100, visible: false },
    }).then(() => false, () => true);
    return { asyncValue, nativeDenied, sent, submitted, persisted, geo,
      invalidProxyRejected: !invalidProxy.success, cleared, privateStartsEmpty, privateCleared, badUrl, errors };
  });
  console.log(JSON.stringify(result, null, 2));
  expect(result.asyncValue).toEqual({ answer: 42 });
  expect(result.nativeDenied).toBe(true);
  expect(result.sent.success, JSON.stringify(result.sent)).toBe(true);
  expect(result.submitted).toBe('native local test');
  expect(result.persisted).toBe('persisted');
  expect(result.geo).toBe(30);
  expect(result.invalidProxyRejected).toBe(true);
  expect(result.cleared).toBeNull();
  expect(result.privateStartsEmpty).toBeNull();
  expect(result.privateCleared).toBeNull();
  expect(result.badUrl).toBe(true);
  expect(result.errors).toEqual([]);
  await page.screenshot({ path: resolve(profile, 'native-shell.png') });
  console.log('Native WebView2: async evaluation, input, permissions, persistence, incognito, cache, geolocation and validation passed.');
  console.log(`Isolated test profile: ${profile}`);
} catch (error) {
  console.error(log);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
