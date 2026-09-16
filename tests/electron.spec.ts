import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

for (const mode of ['development', 'production']) {
test(`real Electron webviews preserve sessions, send input and sanitize summaries (${mode})`, async () => {
  test.setTimeout(60_000);
  const rendererURL = mode === 'production' ? pathToFileURL(resolve('dist/index.html')).href : 'http://127.0.0.1:5173/';
  const app = await electron.launch({
    args: [resolve('tests/fixtures/electron-main.cjs')],
    env: {
      ...process.env,
      TEST_RENDERER_URL: rendererURL,
      TEST_USER_DATA: mkdtempSync(resolve(tmpdir(), 'ai-tool-box-smoke-')),
    },
  });
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForURL(rendererURL);
    await expect(
      page.getByRole('heading', { name: 'AI Tool Box' }),
    ).toBeVisible();
    const guest = page.locator('webview[data-tool-id=deepseek]');
    await expect(guest).toHaveAttribute('partition', 'temp-tool-deepseek');
    await expect
      .poll(() =>
        guest.evaluate((element: any) => {
          try {
            return element.getWebContentsId();
          } catch {
            return 0;
          }
        }),
      )
      .toBeGreaterThan(0);
    const guestId = await guest.evaluate((element: any) =>
      element.getWebContentsId(),
    );
    await expect
      .poll(() =>
        guest.evaluate(async (element: any) => {
          try {
            return await element.executeJavaScript('document.readyState');
          } catch {
            return '';
          }
        }),
      )
      .toBe('complete');
    await page
      .getByRole('textbox', { name: '输入内容' })
      .fill('Local smoke test');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect
      .poll(() =>
        guest.evaluate(async (element: any) =>
          element.executeJavaScript('window.lastSubmitted'),
        ),
      )
      .toBe('Local smoke test');
    await page.getByRole('button', { name: '切换到 网站管理' }).click();
    await expect(guest).toHaveCSS('display', 'none');
    await page.getByRole('button', { name: '切换到 对话' }).click();
    await expect(guest).toHaveCSS('display', 'inline-flex');
    expect(
      await guest.evaluate((element: any) => element.getWebContentsId()),
    ).toBe(guestId);
    await page.getByRole('tab', { name: /^千问/ }).click();
    await expect(guest).not.toBeVisible();
    await page.getByRole('tab', { name: /^DeepSeek/ }).click();
    await expect(guest).toBeVisible();
    await page.getByRole('button', { name: '收集回复', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Test response' }).first(),
    ).toBeVisible();
    const summary = page.getByRole('complementary', { name: '回复汇总面板' });
    await expect(summary.locator('table').first()).toBeVisible();
    expect(await summary.locator('script, [onerror]').count()).toBe(0);
    expect(
      await page.evaluate(() => (window as any).unsafeMarkup),
    ).toBeUndefined();
    await page.getByRole('button', { name: '切换到 网站管理' }).click();
    await page
      .getByRole('checkbox', { name: 'DeepSeek 无痕模式', exact: true })
      .uncheck();
    await expect(guest).toHaveAttribute('partition', 'persist:tool-deepseek');
    await expect
      .poll(() =>
        guest.evaluate(async (element: any) => {
          try {
            return await element.executeJavaScript('document.readyState');
          } catch {
            return '';
          }
        }),
      )
      .toBe('complete');
    expect(
      await guest.evaluate((element: any) => element.getWebContentsId()),
    ).not.toBe(guestId);
    const calls = await app.evaluate(() => (globalThis as any).testCalls);
    expect(
      calls.some((call: any) => call.channel === 'session:prepare-tool-mode'),
    ).toBe(true);
    expect(
      calls.some((call: any) => call.channel === 'session:save-settings'),
    ).toBe(true);
    expect(
      calls.some((call: any) => call.channel === 'session:clear-incognito'),
    ).toBe(true);
    const electronVersion = await app.evaluate(() => process.versions.electron);
    // 44.4.1 also emits this on plain element.remove(), without Svelte.
    const knownDetachError = `Invalid guestInstanceId: ${guestId}`;
    if (electronVersion === '44.4.1' && errors.includes(knownDetachError)) {
      test.info().annotations.push({
        type: 'known-runtime-issue',
        description:
          'Electron 44.4.1 emits an already-destroyed guest diagnostic on native Webview removal.',
      });
    }
    expect(
      errors.filter(
        (error) => electronVersion !== '44.4.1' || error !== knownDetachError,
      ),
    ).toEqual([]);
  } finally {
    await app.close();
  }
});
}
