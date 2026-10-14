import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/');
});
test('release branch retains all six pages and setting categories', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const name of ['对话', '生图', '生视频', 'API', 'Agent CLI']) {
    const button = page.getByRole('button', { name: `切换到 ${name}`, exact: true });
    await expect(button).toBeVisible();
    await button.click();
  }
  await page.getByRole('button', { name: '设置', exact: true }).click();
  for (const name of ['Preset 工作区', 'LLM 汇总', 'API 服务', '对话网站', '生图网站', '生视频网站', '网络代理', 'GPS 定位']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await button.click();
  }
  expect(errors).toEqual([]);
  await expect(page.locator('webview, iframe')).toHaveCount(0);
});
test('chat drafts survive switching to video and API pages', async ({ page }) => {
  const textbox = page.getByRole('textbox', { name: '输入内容', exact: true });
  await expect(textbox).toBeVisible();
  await textbox.fill('release 分支草稿');
  await page.getByRole('button', { name: '切换到 生视频', exact: true }).click();
  await page.getByRole('button', { name: '切换到 API', exact: true }).click();
  await expect(page.getByRole('main', { name: 'API webview workers' })).toBeVisible();
  await page.getByRole('button', { name: '切换到 对话', exact: true }).click();
  await expect(textbox).toHaveValue('release 分支草稿');
});
test('desktop and narrow preview render without horizontal overflow', async ({ page }, testInfo) => {
  await expect(page.getByRole('button', { name: '切换到 生视频', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '输入内容', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });
  await page.setViewportSize({ width: 820, height: 800 });
  await page.getByRole('button', { name: '切换到 生视频', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '输入内容', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
  await page.screenshot({ path: testInfo.outputPath('narrow.png') });
});
