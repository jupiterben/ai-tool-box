import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // No tests contact third-party AI sites or transmit prompts to real services.
  await page.route('https://**', (route) => route.abort());
  await page.goto('/');
  await expect(
    page.getByRole('tab', { name: 'DeepSeek', exact: true }),
  ).toBeVisible();
});

test('navigation preserves drafts and theme survives reload', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('textbox', { name: '输入内容' }).fill('保留这份草稿');
  await page.getByRole('button', { name: '切换到 生图' }).click();
  await expect(page.getByRole('button', { name: '上传参考图' })).toBeVisible();
  await page.getByRole('button', { name: '切换到 对话' }).click();
  await expect(page.getByRole('textbox', { name: '输入内容' })).toHaveValue(
    '保留这份草稿',
  );
  await page.getByRole('button', { name: '切换到暗色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
  await expect(
    page.getByRole('tab', { name: 'DeepSeek', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png') });
});

test('tool selection persists and website enablement updates the workspace', async ({
  page,
}) => {
  await page
    .getByRole('checkbox', { name: '选择 千问', exact: true })
    .uncheck();
  await expect(
    page.getByRole('tab', { name: '千问', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: '选择 千问', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: '切换到 网站管理' }).click();
  await page
    .getByRole('checkbox', { name: 'DeepSeek 已启用', exact: true })
    .uncheck();
  await page.getByRole('button', { name: '切换到 对话' }).click();
  await expect(
    page.getByRole('checkbox', { name: '选择 DeepSeek', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
});

test('the last enabled website cannot be disabled', async ({ page }) => {
  await page.getByRole('button', { name: '切换到 网站管理' }).click();
  const enabled = page.getByRole('checkbox', { name: / 已启用$/ });
  await expect(enabled.first()).toBeVisible();
  while ((await enabled.count()) > 1) await enabled.last().uncheck();
  await expect(enabled).toBeDisabled();
});

test('proxy profiles are shared between settings pages and auto-saved', async ({
  page,
}) => {
  await page.getByRole('button', { name: '切换到 网站管理' }).click();
  await page.getByRole('button', { name: '切换到 网络与定位' }).click();
  await page.getByRole('button', { name: '添加代理', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('本地测试代理');
  await page.getByLabel('主机', { exact: true }).fill('127.0.0.1');
  await page.getByLabel('端口', { exact: true }).fill('7890');
  await expect(
    page
      .locator('#page-environment-settings')
      .getByText('已自动保存', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '切换到 网站管理' }).click();
  const row = page.getByRole('row').filter({ hasText: 'DeepSeek' });
  await row.getByRole('button', { name: '使用代理', exact: true }).click();
  await expect(
    row.getByRole('combobox', { name: 'DeepSeek 选择代理' }),
  ).toContainText('本地测试代理');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((key) =>
          key.startsWith('ai-tool-box-proxy-settings'),
        );
        return key
          ? JSON.parse(localStorage.getItem(key)!).tools.deepseek.mode
          : null;
      }),
    )
    .toBe('profile');
  await page.reload();
  await page.getByRole('button', { name: '切换到 网站管理' }).click();
  await expect(
    page.getByRole('combobox', { name: 'DeepSeek 选择代理' }),
  ).toContainText('本地测试代理');
});

test('LLM settings validate and persist without storing API keys', async ({
  page,
}) => {
  await page.getByRole('button', { name: '切换到 LLM 设置' }).click();
  await page.getByRole('button', { name: '自定义', exact: true }).click();
  await page.getByRole('button', { name: '立即保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('API Base URL');
  await page
    .getByLabel('API Base URL', { exact: true })
    .fill('https://example.invalid/v1/chat/completions');
  await page.getByLabel('模型', { exact: true }).fill('test-model');
  await page
    .getByLabel('API Key', { exact: true })
    .fill('test-key-not-a-secret');
  await page.getByRole('button', { name: '立即保存', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((key) =>
          key.startsWith('ai-tool-box-llm-settings'),
        );
        return key ? localStorage.getItem(key) : null;
      }),
    )
    .toContain('test-model');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'test-key-not-a-secret',
  );
  await page.reload();
  await page.getByRole('button', { name: '切换到 LLM 设置' }).click();
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue(
    'test-model',
  );
});

test('reference images can be attached, removed and rejected', async ({
  page,
}) => {
  await page.getByRole('button', { name: '切换到 生图' }).click();
  const input = page.locator('#page-image-webview input[type=file]');
  await input.setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(
    page.getByRole('img', { name: '参考图', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '发送', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '移除参考图' }).click();
  await expect(
    page.getByRole('button', { name: '发送', exact: true }),
  ).toBeDisabled();
  await input.setInputFiles({
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid'),
  });
  await expect(page.getByRole('alert')).toContainText('请选择图片文件');
});

test('summary failures are visible and panel width persists', async ({
  page,
}) => {
  await page.getByRole('button', { name: '汇总', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '未能从任何平台提取到回复',
  );
  const handle = page.getByRole('separator', { name: '调整汇总面板宽度' });
  await expect(handle).toHaveAttribute('aria-valuenow', '380');
  await handle.focus();
  await handle.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '400');
  await page.reload();
  await expect(handle).toHaveAttribute('aria-valuenow', '400');
  await page.getByRole('button', { name: '关闭汇总面板' }).click();
  await expect(handle).toHaveCount(0);
});

test('small-screen navigation and input fit the viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '展开侧边栏' }).click();
  await page.getByRole('button', { name: '切换到 生图' }).click();
  await page.getByRole('button', { name: '折叠侧边栏' }).click();
  await expect(page.locator('aside').first()).toHaveCSS('width', '60px');
  const input = page.getByRole('textbox', { name: '输入内容' });
  await expect(input).toBeVisible();
  const rect = await input.boundingBox();
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('mobile.png') });
});
