import { type WebContents } from 'electron';
import { getSiteHandler, HANDLER_VERSION } from '../src/webview-handlers/index.js';
import { buildInjectCheckScript } from '../src/webview-handlers/browserRuntime.js';
import type { BaseSiteHandler } from '../src/webview-handlers/BaseSiteHandler.js';
import type { WebviewInputPayload } from '../src/types/reference-image.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

export interface WebviewSendInputPayload {
  toolId: string;
  partition: string;
  content: string;
  referenceImage?: WebviewInputPayload['referenceImage'];
  webContentsId?: number;
}

export interface WebviewSendInputResult {
  success: boolean;
  error?: string;
  fillMethod?: string;
  sendMethod?: string;
  btnReady?: boolean;
  inputTag?: string;
  remaining?: string;
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
  btnDisabled?: boolean | null;
}

interface VerifySentResult {
  sent?: boolean;
  remaining?: string;
}

/** React 受控站点：insertText 产生 trusted 事件，再原生点击/Enter */
async function sendReactNativeInput(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string,
  options: {
    prepareFn: string;
    getSendCoordsFn: string;
    verifySentFn: string;
    label: string;
    syncFn?: string;
    insertDelayMs?: number;
  }
): Promise<WebviewSendInputResult> {
  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return injectError;
  }

  try {
    const prep = (await wc.executeJavaScript(`${options.prepareFn}()`)) as {
      success?: boolean;
      error?: string;
      inputTag?: string;
    };
    if (!prep?.success) {
      return { success: false, error: prep?.error || `聚焦 ${options.label} 输入框失败` };
    }

    await clearFocusedInput(wc);
    await sleep(150);
    wc.insertText(content);
    await sleep(options.insertDelayMs ?? 400);

    let fillMethod = 'native-insertText';
    if (options.syncFn) {
      const sync = (await wc.executeJavaScript(
        `${options.syncFn}(${JSON.stringify(content)})`
      )) as { success?: boolean; remaining?: string; reactMethod?: string };
      if (sync?.reactMethod) {
        fillMethod = sync.reactMethod;
      }
      if (sync?.success === false) {
        return {
          success: false,
          error: `${options.label} 同步输入失败（剩余: ${sync?.remaining ?? '未知'}）`,
          fillMethod,
          inputTag: prep.inputTag,
          remaining: sync?.remaining,
        };
      }
      await sleep(200);
    }

    let sendInfo: NativeSendCoords = { ready: false };
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      sendInfo = (await wc.executeJavaScript(`${options.getSendCoordsFn}()`)) as NativeSendCoords;
      if (sendInfo?.ready) {
        break;
      }
      await sleep(200);
    }

    const sendMethod =
      sendInfo?.ready && sendInfo.x != null && sendInfo.y != null
        ? 'native-click'
        : 'native-enter';

    if (sendInfo?.ready && sendInfo.x != null && sendInfo.y != null) {
      await clickAt(wc, sendInfo.x, sendInfo.y);
    } else {
      await pressEnter(wc);
    }

    await sleep(800);
    const contentJson = JSON.stringify(content);
    const verify = (await wc.executeJavaScript(
      `${options.verifySentFn}(${contentJson})`
    )) as VerifySentResult & { hasPrefix?: boolean };

    if (verify?.sent) {
      return {
        success: true,
        fillMethod,
        sendMethod,
        btnReady: !!sendInfo?.ready,
        inputTag: prep.inputTag,
        remaining: verify.remaining,
      };
    }

    return {
      success: false,
      error: verify?.hasPrefix
        ? `${options.label} 原生发送失败（仍含引用前缀: ${verify?.remaining ?? '未知'}）`
        : `${options.label} 原生发送失败（剩余: ${verify?.remaining ?? '未知'}）`,
      fillMethod,
      sendMethod,
      btnReady: !!sendInfo?.ready,
      inputTag: prep.inputTag,
      remaining: verify?.remaining,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `${options.label} 原生发送失败`,
    };
  }
}

async function sendQianwenNative(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  return sendReactNativeInput(wc, handler, content, {
    prepareFn: 'window.__qianwenFocusInput__',
    getSendCoordsFn: 'window.__qianwenGetSendCoords__',
    verifySentFn: 'window.__qianwenVerifySent__',
    label: '千问',
  });
}

async function sendGrokNative(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  return sendReactNativeInput(wc, handler, content, {
    prepareFn: 'window.__grokPrepareInput__',
    syncFn: 'window.__grokSyncInput__',
    getSendCoordsFn: 'window.__grokGetSendCoords__',
    verifySentFn: 'window.__grokVerifySent__',
    label: 'Grok',
  });
}

/** 火山 Ark：React 受控输入，原生 insertText + Enter */
async function sendVolcengineNative(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return injectError;
  }

  try {
    const prep = (await wc.executeJavaScript(`window.__volcengineFocusInput__()`)) as {
      success?: boolean;
      error?: string;
      tag?: string;
    };
    if (!prep?.success) {
      return { success: false, error: prep?.error || '聚焦火山输入框失败' };
    }

    await clearFocusedInput(wc);
    await sleep(150);
    wc.insertText(content);
    await sleep(400);
    await pressEnter(wc);
    await sleep(800);

    const verify = (await wc.executeJavaScript(
      `window.__volcengineGetInputRemaining__()`
    )) as { success?: boolean; remaining?: string };
    const remaining = (verify?.remaining ?? '').trim();
    const sent = remaining === '' || (remaining !== content.trim() && remaining.indexOf(content.trim()) < 0);

    if (sent) {
      return {
        success: true,
        fillMethod: 'native-insertText',
        sendMethod: 'native-enter',
        inputTag: prep.tag,
        remaining,
      };
    }

    return {
      success: false,
      error: `火山未发送（剩余: ${remaining || '未知'}）`,
      fillMethod: 'native-insertText',
      sendMethod: 'native-enter',
      inputTag: prep.tag,
      remaining,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '火山原生发送失败',
    };
  }
}

async function sendWithInjectScript(
  wc: WebContents,
  handler: BaseSiteHandler,
  payload: WebviewInputPayload
): Promise<WebviewSendInputResult> {
  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return injectError;
  }

  const payloadJson = JSON.stringify(payload);
  try {
    const result = (await wc.executeJavaScript(`
      (async function() {
        if (typeof window.__injectInput__ !== 'function') {
          return { success: false, error: '输入处理函数未找到' };
        }
        return await window.__injectInput__(${payloadJson});
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
      const nativeResult = await sendQianwenNative(wc, handler, payload.content);
      if (nativeResult.success) {
        return nativeResult;
      }
      console.warn('[webviewInput] qianwen 原生失败，回退注入:', nativeResult.error);
    }

    if (payload.toolId === 'grok') {
      const nativeResult = await sendGrokNative(wc, handler, payload.content);
      if (nativeResult.success) {
        return nativeResult;
      }
      console.warn('[webviewInput] grok 原生失败，回退注入:', nativeResult.error);
    }

    if (payload.toolId === 'volcengine') {
      const nativeResult = await sendVolcengineNative(wc, handler, payload.content);
      if (nativeResult.success) {
        return nativeResult;
      }
      console.warn('[webviewInput] volcengine 原生失败，回退注入:', nativeResult.error);
    }

    return await sendWithInjectScript(wc, handler, {
      content: payload.content,
      referenceImage: payload.referenceImage ?? null,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'webview 输入发送失败',
    };
  }
}
