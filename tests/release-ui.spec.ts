import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.goto('/');
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '切换到 对话', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('mobile.png') });
});

test('tool selection updates tabs and persists after reload', async ({ page }) => {
  const selected = page.getByRole('checkbox', { name: '选择 DeepSeek', exact: true });
  await expect(selected).toBeChecked();
  await selected.uncheck();
  await expect(page.getByRole('tab', { name: 'DeepSeek', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(selected).not.toBeChecked();
  await selected.check();
  await expect(page.getByRole('tab', { name: 'DeepSeek', exact: true })).toBeVisible();
});

test('website settings update the kept-alive chat page', async ({ page }) => {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '对话网站', exact: true }).click();
  await page.getByRole('checkbox', { name: 'DeepSeek 已启用', exact: true }).uncheck();
  await page.getByRole('button', { name: '切换到 对话', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '选择 DeepSeek', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('checkbox', { name: 'DeepSeek 已关闭', exact: true }).check();
  await page.getByRole('button', { name: '切换到 对话', exact: true }).click();
  await page.getByRole('checkbox', { name: '选择 DeepSeek', exact: true }).check();
  await expect(page.getByRole('tab', { name: 'DeepSeek', exact: true })).toBeVisible();
});

test('reference images and drafts survive navigation and can be removed', async ({ page }) => {
  await page.getByRole('button', { name: '切换到 生图', exact: true }).click();
  await page.locator('#page-image-webview input[type=file]').setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFQAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.getByRole('img', { name: '参考图', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: '输入内容', exact: true }).fill('保留生图草稿');
  await page.getByRole('button', { name: '切换到 API', exact: true }).click();
  await page.getByRole('button', { name: '切换到 生图', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '输入内容', exact: true })).toHaveValue('保留生图草稿');
  await expect(page.getByRole('img', { name: '参考图', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '移除参考图', exact: true }).click();
  await expect(page.getByRole('img', { name: '参考图', exact: true })).toHaveCount(0);
});

test('IME composition does not submit the prompt', async ({ page }) => {
  const input = page.getByRole('textbox', { name: '输入内容', exact: true });
  await input.fill('输入法候选词');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(input).toHaveValue('输入法候选词');
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
});

test('summary splitter supports keyboard and pointer resizing and persists width', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '汇总', exact: true }).click();
  const separator = page.getByRole('separator', { name: '调整汇总面板宽度' });
  await expect(separator).toBeVisible();
  const before = Number(await separator.getAttribute('aria-valuenow'));
  await separator.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', String(before + 20));
  const box = (await separator.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.down();
  await expect(page.locator('[data-resizing=true]')).toHaveCount(1);
  await page.mouse.move(box.x - 60, box.y + 80);
  await page.mouse.up();
  await expect(page.locator('[data-resizing=true]')).toHaveCount(0);
  const resized = Number(await separator.getAttribute('aria-valuenow'));
  expect(resized).toBeGreaterThan(before + 60);
  await page.screenshot({ path: testInfo.outputPath('summary-panel.png') });
  await page.getByRole('button', { name: '关闭汇总面板' }).click();
  await expect(separator).toHaveCount(0);
  await page.getByRole('button', { name: '汇总', exact: true }).click();
  await expect(separator).toHaveAttribute('aria-valuenow', String(resized));
  await page.reload();
  await expect(separator).toHaveAttribute('aria-valuenow', String(resized));
});

test('proxy settings keep auto-saving after the first successful save', async ({ page }) => {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '网络代理', exact: true }).click();
  await page.getByRole('button', { name: '添加代理', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('Local Proxy');
  await page.getByRole('textbox', { name: '主机', exact: true }).fill('127.0.0.1');
  await page.getByRole('textbox', { name: '端口', exact: true }).fill('7890');
  await expect(page.getByText('已自动保存', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '端口', exact: true }).fill('7891');
  await expect(page.getByText('已自动保存', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '网络代理', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '端口', exact: true })).toHaveValue('7891');
});

test('LLM saves settle without looping on server-returned settings', async ({ page }) => {
  await page.addInitScript(() => {
    let saved = { version: '1.0.0', enabled: false, provider: 'custom', baseUrl: 'http://localhost/v1',
      model: 'test-model', temperature: 0.3, maxTokens: 1024, hasApiKey: false };
    Object.assign(window, { llmSaveCount: 0 });
    window.desktopAPI = {
      getLlmSettings: async () => ({ success: true, settings: { ...saved } }),
      saveLlmSettings: async (input: Partial<typeof saved>) => {
        Object.assign(window, { llmSaveCount: (window as unknown as { llmSaveCount: number }).llmSaveCount + 1 });
        saved = { ...saved, ...input };
        return { success: true, settings: { ...saved } };
      },
    } as unknown as typeof window.desktopAPI;
  });
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'LLM 汇总', exact: true }).click();
  await page.getByRole('textbox', { name: '模型', exact: true }).fill('updated-model');
  await expect.poll(() => page.evaluate(() => (window as unknown as { llmSaveCount: number }).llmSaveCount)).toBe(1);
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => (window as unknown as { llmSaveCount: number }).llmSaveCount)).toBe(1);
  await page.getByRole('textbox', { name: '模型', exact: true }).fill('second-model');
  await expect.poll(() => page.evaluate(() => (window as unknown as { llmSaveCount: number }).llmSaveCount)).toBe(2);
});

test('collected Markdown renders GFM and removes executable HTML', async ({ page }) => {
  await page.addInitScript(() => {
    window.desktopAPI = {
      extractWebviewResponses: async () => ({
        responses: [{ toolId: 'deepseek', success: true,
          content: '# Safe response\n\n| Platform | Result |\n| --- | --- |\n| DeepSeek | Done |\n\n'
            + '<img src="x" onerror="window.markdownExecuted=true">'
            + '<script>window.markdownExecuted=true</script>\n\n[unsafe](javascript:alert(1))' }],
      }),
      getLlmSettings: async () => ({ success: true, settings: { enabled: false } }),
    } as unknown as typeof window.desktopAPI;
  });
  await page.reload();
  await page.getByRole('button', { name: '收集回复', exact: true }).click();
  const panel = page.getByRole('complementary', { name: '回复汇总面板' });
  await expect(panel.getByRole('heading', { name: 'Safe response' })).toBeVisible();
  await expect(panel.getByRole('cell', { name: 'Done', exact: true })).toBeVisible();
  await expect(panel.locator('script, [onerror], a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { markdownExecuted?: boolean }).markdownExecuted)).toBeUndefined();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: '下载汇总文档' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
});

test('update status changes render and dismiss without remounting the app', async ({ page }) => {
  await page.addInitScript(() => {
    window.desktopAPI = {
      onUpdateStatus: (callback: unknown) => {
        Object.assign(window, { emitUpdate: callback });
        return () => {};
      },
    } as unknown as typeof window.desktopAPI;
  });
  await page.reload();
  await expect(page.getByRole('textbox', { name: '输入内容', exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as {
    emitUpdate: (status: { state: string; version: string }) => void;
  }).emitUpdate({ state: 'downloaded', version: '9.9.9' }));
  await expect(page.getByText('新版本 v9.9.9 已就绪', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '稍后', exact: true }).click();
  await expect(page.getByText('新版本 v9.9.9 已就绪', { exact: true })).toHaveCount(0);
});
