import type { WebContents } from 'electron';
import { DEFAULT_IMAGE_TOOLS } from '../src/config/tools.js';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import { getToolPartition } from '../src/utils/toolPartition.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

const IMAGE_RESET_URLS: Record<string, string> = Object.fromEntries(
  DEFAULT_IMAGE_TOOLS.map((tool) => [tool.id, tool.url])
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWebContentsLoad(wc: WebContents, timeoutMs = 30_000): Promise<void> {
  if (wc.isDestroyed()) {
    throw new Error('webview 已销毁');
  }

  if (!wc.isLoading()) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      wc.removeListener('did-finish-load', onLoad);
      reject(new Error('页面加载超时'));
    }, timeoutMs);

    const onLoad = () => {
      clearTimeout(timer);
      resolve();
    };

    wc.once('did-finish-load', onLoad);
  });
}

/** 每次 API 生图请求前，将 webview 重置到工具默认生图页（新对话/干净状态） */
export async function resetImageWebviewForApi(
  toolId: string,
  webContentsId: number | undefined
): Promise<{ success: boolean; error?: string }> {
  const handler = getSiteHandler(toolId);
  if (!handler) {
    return { success: false, error: `未找到 handler: ${toolId}` };
  }

  const wc = findToolWebContents(
    getToolPartition(toolId),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: '未找到 webview' };
  }

  const resetUrl = handler.config.newChatAction?.url || IMAGE_RESET_URLS[toolId];
  if (!resetUrl) {
    return { success: true };
  }

  try {
    await wc.loadURL(resetUrl);
    await waitForWebContentsLoad(wc);
    await sleep(1000);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '重置页面失败',
    };
  }
}
