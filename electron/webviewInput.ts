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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function clickAt(wc: WebContents, x: number, y: number): Promise<void> {
  wc.sendInputEvent({ type: 'mouseMove', x, y, movementX: 0, movementY: 0 });
  await sleep(50);
  wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  await sleep(50);
  wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
}

async function pressEnter(wc: WebContents): Promise<void> {
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter', key: 'Enter' });
  await sleep(50);
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter', key: 'Enter' });
}

async function clearFocusedInput(wc: WebContents): Promise<void> {
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
  await sleep(30);
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
}

interface NativeSendCoords {
  success?: boolean;
  ready?: boolean;
  x?: number;
  y?: number;
  error?: string;
}

interface VerifySentResult {
  sent?: boolean;
  remaining?: string;
}

/** 千问：insertText 触发 React trusted 输入，再原生点击发送 */
async function sendQianwenWithNativeEvents(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return injectError;
  }

  try {
    const prep = (await wc.executeJavaScript(
      `typeof window.__qianwenFocusInput__ === 'function' ? window.__qianwenFocusInput__() : { success: false, error: '辅助函数未就绪' }`
    )) as { success?: boolean; error?: string };
    if (!prep?.success) {
      return { success: false, error: prep?.error || '聚焦千问输入框失败' };
    }

    await clearFocusedInput(wc);
    await sleep(100);
    wc.insertText(content);

    let sendInfo: NativeSendCoords = { ready: false };
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      sendInfo = (await wc.executeJavaScript(`window.__qianwenGetSendCoords__()`)) as NativeSendCoords;
      if (sendInfo?.ready) {
        break;
      }
      await sleep(150);
    }

    if (sendInfo?.ready && sendInfo.x != null && sendInfo.y != null) {
      await clickAt(wc, sendInfo.x, sendInfo.y);
    } else {
      await pressEnter(wc);
    }

    await sleep(600);
    const contentJson = JSON.stringify(content);
    const verify = (await wc.executeJavaScript(
      `window.__qianwenVerifySent__(${contentJson})`
    )) as VerifySentResult;

    if (verify?.sent) {
      return { success: true };
    }

    return {
      success: false,
      error: `千问消息未发出（输入框仍有内容: ${verify?.remaining ?? '未知'}）`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '千问原生发送失败',
    };
  }
}

/** 通过页面内 JS 填词并提交 */
async function sendWithInjectScript(
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
    if (payload.toolId === 'qianwen') {
      const nativeResult = await sendQianwenWithNativeEvents(wc, handler, payload.content);
      if (nativeResult.success) {
        return nativeResult;
      }
      console.warn('[webviewInput] qianwen 原生发送失败，回退注入脚本:', nativeResult.error);
    }

    return await sendWithInjectScript(wc, handler, payload.content);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'webview 输入发送失败',
    };
  }
}
