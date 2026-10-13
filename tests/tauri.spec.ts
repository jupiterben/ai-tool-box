import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', (route) => route.abort());
  await page.goto('/');
});

test('browser preview does not expose a native bridge or embed remote frames', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'DeepSeek', exact: true })).toBeVisible();
  expect(await page.evaluate(() => typeof window.desktopAPI)).toBe('undefined');
  await expect(page.locator('webview, iframe')).toHaveCount(0);
  await expect(page.getByText('网站内容仅在 Tauri 桌面应用中可用').first()).toBeVisible();
});

test('native guest adapter synchronizes visibility, routing and disposal', async ({ page }) => {
  const result = await page.evaluate(async () => {
    // Vite serves these modules only during tests; no production test bridge is installed.
    const { mockIPC, mockWindows, clearMocks } = await import('/node_modules/@tauri-apps/api/mocks.js');
    const { mountGuest, findGuest } = await import('/src/desktop/webview.ts');
    const calls: { command: string; args: any }[] = [];
    mockWindows('main');
    mockIPC((command, args) => { calls.push({ command, args }); return null; },
      { shouldMockEvents: true });
    const parent = document.createElement('div');
    const host = document.createElement('div');
    parent.style.cssText = 'position:fixed;left:100px;top:100px;width:400px;height:300px';
    host.style.cssText = 'width:100%;height:100%';
    parent.append(host);
    document.body.append(parent);
    let cleaned = false;
    let id = 0;
    const errors: string[] = [];
    const dispose = mountGuest(host, {
      src: 'https://example.invalid', toolId: 'test', partition: 'persist:test', incognito: false,
    }, (element) => {
      id = element.getWebContentsId();
      return () => { cleaned = true; };
    }, (error) => errors.push(error));
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await wait(150);
    const created = calls.find((call) => call.command === 'create_guest');
    const matches = findGuest('test', id)?.id === id && !findGuest('other', id);
    parent.inert = true;
    await wait(150);
    const hidden = calls.some((call) => call.command === 'update_guest_bounds' && !call.args.bounds.visible);
    parent.inert = false;
    await wait(150);
    dispose();
    await wait(30);
    const removed = !findGuest('test', id);
    parent.remove();
    clearMocks();
    return {
      created: !!created, visible: created?.args.bounds.visible, hidden,
      closed: calls.some((call) => call.command === 'close_guest'),
      matches, cleaned, removed, errors,
    };
  });
  expect(result).toEqual({
    created: true, visible: true, hidden: true, closed: true,
    matches: true, cleaned: true, removed: true, errors: [],
  });
});

test('disposing while native creation is pending closes the late guest', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { mockIPC, mockWindows, clearMocks } = await import('/node_modules/@tauri-apps/api/mocks.js');
    const { mountGuest, findGuest } = await import('/src/desktop/webview.ts');
    const calls: string[] = [];
    let complete: (() => void) | undefined;
    mockWindows('main');
    mockIPC((command) => {
      calls.push(command);
      if (command === 'create_guest') return new Promise<void>((resolve) => { complete = resolve; });
      return null;
    }, { shouldMockEvents: true });
    const host = document.createElement('div');
    host.style.cssText = 'width:100px;height:100px';
    document.body.append(host);
    const dispose = mountGuest(host, {
      src: 'https://example.invalid', toolId: 'pending', partition: 'temp-test', incognito: true,
    }, () => () => {}, () => {});
    await new Promise((resolve) => setTimeout(resolve, 50));
    dispose();
    complete?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    host.remove();
    clearMocks();
    return { closed: calls.includes('close_guest'), removed: !findGuest('pending') };
  });
  expect(result).toEqual({ closed: true, removed: true });
});
