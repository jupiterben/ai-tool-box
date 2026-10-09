import type { WebContents } from 'electron';
import { DEFAULT_IMAGE_TOOLS } from '../src/config/tools.js';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import type { BaseSiteHandler } from '../src/webview-handlers/BaseSiteHandler.js';
import { getActivePresetPartition } from './presetPartition.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

const IMAGE_RESET_URLS: Record<string, string> = Object.fromEntries(
  DEFAULT_IMAGE_TOOLS.map((tool) => [tool.id, tool.url])
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return url.split('?')[0].replace(/\/$/, '');
  }
}

/** 在 loadURL/reload 之前注册，等待下一次 did-finish-load */
function waitForNextNavigation(wc: WebContents, timeoutMs = 30_000): Promise<void> {
  if (wc.isDestroyed()) {
    return Promise.reject(new Error('webview 已销毁'));
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('页面加载超时'));
    }, timeoutMs);

    const onLoad = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      wc.removeListener('did-finish-load', onLoad);
    };

    wc.once('did-finish-load', onLoad);
  });
}

async function waitForInputReady(
  wc: WebContents,
  handler: BaseSiteHandler,
  timeoutMs = 30_000
): Promise<void> {
  const checkScript = `(function() {
    ${handler.buildBrowserRuntimeScript()}
    return !!__findInputElement();
  })()`;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (wc.isDestroyed()) {
      throw new Error('webview 已销毁');
    }

    try {
      const ready = await wc.executeJavaScript(checkScript);
      if (ready === true) {
        return;
      }
    } catch {
      // 页面可能仍在导航或脚本尚未可执行
    }

    await sleep(400);
  }

  throw new Error('输入框未就绪');
}

/** 每次 API 生图请求前，将 webview 重置到工具默认生图页（新对话/干净状态） */
export async function resetImageWebviewForApi(
  toolId: string,
  webContentsId: number | undefined,
  options?: { url?: string }
): Promise<{ success: boolean; error?: string }> {
  const handler = getSiteHandler(toolId);
  if (!handler) {
    return { success: false, error: `未找到 handler: ${toolId}` };
  }

  const wc = findToolWebContents(
    getActivePresetPartition(),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: '未找到 webview' };
  }

  const resetUrl =
    options?.url || handler.config.newChatAction?.url || IMAGE_RESET_URLS[toolId];
  if (!resetUrl) {
    return { success: true };
  }

  try {
    const loadPromise = waitForNextNavigation(wc);
    const samePage = normalizePageUrl(wc.getURL()) === normalizePageUrl(resetUrl);

    if (samePage) {
      wc.reload();
    } else {
      await wc.loadURL(resetUrl);
    }

    await loadPromise;
    // SPA 在 did-finish-load 后仍需 hydration
    await sleep(800);
    await waitForInputReady(wc, handler);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '重置页面失败',
    };
  }
}
