import { type WebContents } from 'electron';
import { getSiteHandler, HANDLER_VERSION } from '../src/webview-handlers/index.js';
import { buildInjectCheckScript } from '../src/webview-handlers/browserRuntime.js';
import type { BaseSiteHandler } from '../src/webview-handlers/BaseSiteHandler.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

export interface WebviewSendInputPayload {
  toolId: string;
  partition: string;
  content: string;
  webContentsId?: number;
}

export interface WebviewSendInputResult {
  success: boolean;
  error?: string;
}

export function findWebContentsByPartition(partition: string, urlHint?: string): WebContents | null {
  return findToolWebContents(partition, undefined, urlHint ? [urlHint] : []);
}

async function ensureInjected(
  wc: WebContents,
  handler: BaseSiteHandler
): Promise<WebviewSendInputResult | null> {
  try {
    const isInjected = await wc.executeJavaScript(buildInjectCheckScript(handler.toolId, HANDLER_VERSION));
    if (isInjected === true) {
      return null;
    }

    const injectResult = (await wc.executeJavaScript(handler.buildInjectScript())) as WebviewSendInputResult;
    if (injectResult && typeof injectResult === 'object' && injectResult.success === false) {
      return injectResult;
    }
    return null;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '脚本注入失败',
    };
  }
}

/** 通过页面内 JS 填词并提交，隐藏 tab 下的 webview 也能正常发送 */
async function sendWithHandler(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return injectError;
  }

  const contentJson = JSON.stringify(content);
  try {
    const result = (await wc.executeJavaScript(`
      (async function() {
        if (typeof window.__injectInput__ !== 'function') {
          return { success: false, error: '输入处理函数未找到' };
        }
        return await window.__injectInput__(${contentJson});
      })();
    `)) as WebviewSendInputResult;

    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }
    return { success: false, error: '未知错误' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'webview 输入发送失败',
    };
  }
}

export async function sendWebviewInput(
  payload: WebviewSendInputPayload
): Promise<WebviewSendInputResult> {
  const handler = getSiteHandler(payload.toolId);
  if (!handler) {
    return { success: false, error: `未找到站点 handler: ${payload.toolId}` };
  }

  const wc = findToolWebContents(
    payload.partition,
    payload.webContentsId,
    getUrlHints(handler.config)
  );
  if (!wc) {
    return { success: false, error: `未找到 webview: ${payload.toolId}` };
  }

  try {
    return await sendWithHandler(wc, handler, payload.content);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'webview 输入发送失败',
    };
  }
}
