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

export interface WebviewSendReadyPayload {
  toolId: string;
  partition: string;
  webContentsId?: number;
}

/** 等待输入框可用且发送按钮就绪（上一轮生图完成后才能发下一条） */
export async function waitForWebviewSendReady(
  payload: WebviewSendReadyPayload,
  timeoutMs = 90_000
): Promise<{ success: boolean; error?: string }> {
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

  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return { success: false, error: injectError.error || '脚本注入失败' };
  }

  const checkScript = `(function() {
    ${handler.buildBrowserRuntimeScript()}
    var input = __findInputElement();
    if (!input) return { ready: false, reason: 'no-input' };
    if (input.disabled || input.readOnly) return { ready: false, reason: 'input-disabled' };
    if (input.getAttribute('aria-disabled') === 'true') return { ready: false, reason: 'input-aria-disabled' };
    var btn = __findSendButton(input);
    if (btn) {
      // 找到了发送按钮：必须可用才算就绪（上一轮可能还在生成中）
      if (__isSendReady(btn)) return { ready: true };
      return { ready: false, reason: 'send-disabled' };
    }
    // 没找到发送按钮：可能是输入为空所以按钮隐藏，视为可输入状态
    return { ready: true };
  })()`;

  const deadline = Date.now() + timeoutMs;
  let lastReason = 'unknown';

  while (Date.now() < deadline) {
    if (wc.isDestroyed()) {
      return { success: false, error: 'webview 已销毁' };
    }

    try {
      const status = (await wc.executeJavaScript(checkScript)) as { ready?: boolean; reason?: string };
      if (status?.ready) {
        return { success: true };
      }
      lastReason = status?.reason || lastReason;
    } catch {
      // 页面可能仍在更新
    }

    await sleep(500);
  }

  return { success: false, error: `等待发送就绪超时 (${lastReason})` };
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
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
  await sleep(50);
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
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

/** Gemini rich-textarea (Quill editor)：用 execCommand insertText 让 Quill 更新 model，
 *  等待发送按钮出现（输入文字后才渲染）并用原生鼠标点击，避免第二轮 DOM click 被页面吞掉。 */
async function sendGeminiNative(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  const injectError = await ensureInjected(wc, handler);
  if (injectError) {
    return injectError;
  }

  const contentJson = JSON.stringify(content);
  const fillScript = `(async function(){
    ${handler.buildBrowserRuntimeScript()}
    try {
      var input = __findInputElement();
      if (!input) return { success: false, error: '未找到 Gemini 输入框' };
      var isTextControl = input.tagName === 'TEXTAREA' || input.tagName === 'INPUT';
      function getInputText() {
        return (isTextControl ? input.value : (input.innerText || input.textContent || '')).replace(/\\s+/g, ' ').trim();
      }

      input.focus();
      if (isTextControl) {
        var proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
        if (nativeSetter) nativeSetter.call(input, '');
        else input.value = '';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      } else {
        var sel = window.getSelection();
        if (sel) {
          var r = document.createRange();
          r.selectNodeContents(input);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        document.execCommand('delete', false, null);
      }
      await new Promise(function(r){ setTimeout(r, 100); });

      input.focus();
      if (isTextControl) {
        var proto2 = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        var nativeSetter2 = Object.getOwnPropertyDescriptor(proto2, 'value') && Object.getOwnPropertyDescriptor(proto2, 'value').set;
        if (nativeSetter2) nativeSetter2.call(input, ${contentJson});
        else input.value = ${contentJson};
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${contentJson} }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        var inserted = document.execCommand('insertText', false, ${contentJson});
        if (!inserted || getInputText() !== ${contentJson}) {
        input.textContent = ${contentJson};
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${contentJson} }));
        }
      }
      await new Promise(function(r){ setTimeout(r, 400); });

      // 等待发送按钮出现并可用
      var sendButton = null;
      for (var attempt = 0; attempt < 100; attempt++) {
        sendButton = __findSendButton(input);
        if (sendButton && __isSendReady(sendButton)) break;
        await new Promise(function(r){ setTimeout(r, 100); });
      }

      if (!sendButton || !__isSendReady(sendButton)) {
        return { success: false, error: 'Gemini 发送按钮未就绪', inputText: getInputText() };
      }

      var rect = sendButton.getBoundingClientRect();
      return {
        success: true,
        fillMethod: 'execCommand-insertText',
        btnReady: true,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    } catch (e) {
      return { success: false, error: e.message || 'Gemini 发送异常' };
    }
  })()`;

  try {
    const fillResult = (await wc.executeJavaScript(fillScript)) as WebviewSendInputResult & {
      x?: number;
      y?: number;
    };
    if (!fillResult.success) {
      return fillResult;
    }

    const canNativeClick = fillResult.x != null && fillResult.y != null;
    if (canNativeClick) {
      await clickAt(wc, fillResult.x!, fillResult.y!);
    } else {
      await pressEnter(wc);
    }
    await sleep(900);

    const verifyScript = `(function(){
      ${handler.buildBrowserRuntimeScript()}
      function normalizeText(value) {
        return String(value || '').replace(/\\s+/g, ' ').trim();
      }
      var input = __findInputElement();
      var remaining = input
        ? ((input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')
          ? input.value
          : (input.innerText || input.textContent || ''))
        : '';
      remaining = normalizeText(remaining);
      var normalizedContent = normalizeText(${contentJson});
      var bodyText = normalizeText(document.body ? document.body.innerText : '');
      var inputCleared = remaining === '' || remaining.indexOf(normalizedContent) < 0;
      var promptVisible = bodyText.indexOf(normalizedContent) >= 0;
      return { sent: inputCleared && promptVisible, remaining: remaining, promptVisible: promptVisible };
    })()`;
    const verify = (await wc.executeJavaScript(verifyScript)) as VerifySentResult;
    if (verify?.sent) {
      return {
        success: true,
        fillMethod: fillResult.fillMethod,
        sendMethod: canNativeClick ? 'native-click' : 'native-enter',
        btnReady: true,
        remaining: verify.remaining,
      };
    }

    // Fallback：部分 Gemini 页面在按钮坐标变化时会错过点击，再补一次 Enter。
    await pressEnter(wc);
    await sleep(900);
    const retryVerify = (await wc.executeJavaScript(verifyScript)) as VerifySentResult;
    const retrySent = !!retryVerify?.sent;
    return {
      success: retrySent,
      fillMethod: fillResult.fillMethod,
      sendMethod: canNativeClick ? 'native-click+enter' : 'native-enter',
      btnReady: true,
      remaining: retryVerify?.remaining,
      error: retrySent ? undefined : `Gemini 未发送（剩余: ${retryVerify?.remaining ?? '未知'}）`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gemini 原生发送失败',
    };
  }
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

async function sendJimengNative(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  const contentJson = JSON.stringify(content);
  const script = `(async function(){
    ${handler.buildBrowserRuntimeScript()}
    try {
      var input = __findInputElement();
      if (!input) return { success: false, error: '未找到即梦输入框' };

      function getText() {
        return (input.innerText || input.textContent || input.value || '').replace(/\\s+/g, ' ').trim();
      }

      function isVisible(el) {
        if (!el || el.closest('[aria-hidden="true"]')) return false;
        var rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (style && (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none')) return false;
        return true;
      }

      function isEnabledButton(btn) {
        if (!btn || !isVisible(btn)) return false;
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
        if (btn.classList && btn.classList.contains('lv-btn-disabled')) return false;
        return true;
      }

      function findSubmitButton() {
        var selectors = [
          'button[class*="submit-button"]',
          '.submit-button',
          'button.lv-btn-primary'
        ];
        var candidates = [];
        for (var s = 0; s < selectors.length; s++) {
          try {
            var nodes = document.querySelectorAll(selectors[s]);
            for (var i = 0; i < nodes.length; i++) {
              if (isEnabledButton(nodes[i])) candidates.push(nodes[i]);
            }
          } catch (e) {}
        }
        if (!candidates.length) return null;

        var inputRect = input.getBoundingClientRect();
        candidates.sort(function(a, b) {
          var ar = a.getBoundingClientRect();
          var br = b.getBoundingClientRect();
          var ad = Math.abs((ar.left + ar.width / 2) - (inputRect.right - 18))
            + Math.abs((ar.top + ar.height / 2) - (inputRect.bottom + 18));
          var bd = Math.abs((br.left + br.width / 2) - (inputRect.right - 18))
            + Math.abs((br.top + br.height / 2) - (inputRect.bottom + 18));
          return ad - bd;
        });
        return candidates[0];
      }

      input.focus();
      if (input.isContentEditable) {
        var selection = window.getSelection();
        if (selection) {
          var range = document.createRange();
          range.selectNodeContents(input);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        input.innerHTML = '';
        await new Promise(function(r){ setTimeout(r, 100); });
        input.focus();
        var inserted = document.execCommand('insertText', false, ${contentJson});
        if (!inserted || getText() !== ${contentJson}) {
          input.innerHTML = '<p>' + ${contentJson}.replace(/[&<>]/g, function(ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch];
          }) + '</p>';
        }
      } else {
        input.value = '';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        input.value = ${contentJson};
      }

      input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: ${contentJson} }));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ${contentJson} }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

      var btn = null;
      for (var attempt = 0; attempt < 50; attempt++) {
        btn = findSubmitButton();
        if (btn) break;
        await new Promise(function(r){ setTimeout(r, 100); });
      }

      if (!btn) {
        return { success: false, error: '即梦发送按钮未就绪', remaining: getText() };
      }

      var rect = btn.getBoundingClientRect();
      return {
        success: true,
        fillMethod: 'jimeng-prosemirror',
        btnReady: true,
        inputTag: input.tagName,
        remaining: getText(),
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
    } catch (e) {
      return { success: false, error: e.message || '即梦发送异常' };
    }
  })()`;

  try {
    const fillResult = (await wc.executeJavaScript(script)) as WebviewSendInputResult & {
      x?: number;
      y?: number;
    };
    if (!fillResult.success) {
      return fillResult;
    }

    if (fillResult.x != null && fillResult.y != null) {
      await clickAt(wc, fillResult.x, fillResult.y);
      await sleep(1200);
      return {
        success: true,
        fillMethod: fillResult.fillMethod,
        sendMethod: 'native-click',
        btnReady: true,
        inputTag: fillResult.inputTag,
        remaining: fillResult.remaining,
      };
    }

    await pressEnter(wc);
    await sleep(1200);
    return {
      success: true,
      fillMethod: fillResult.fillMethod,
      sendMethod: 'native-enter',
      btnReady: fillResult.btnReady,
      inputTag: fillResult.inputTag,
      remaining: fillResult.remaining,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '即梦原生发送失败',
    };
  }
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
    if (payload.toolId === 'gemini-image' || payload.toolId === 'gemini') {
      const nativeResult = await sendGeminiNative(wc, handler, payload.content);
      if (nativeResult.success) {
        return nativeResult;
      }
      console.warn('[webviewInput] gemini 原生失败，回退注入:', nativeResult.error);
    }

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

    if (payload.toolId === 'jimeng') {
      const nativeResult = await sendJimengNative(wc, handler, payload.content);
      if (nativeResult.success) {
        return nativeResult;
      }
      console.warn('[webviewInput] jimeng 原生失败，回退注入:', nativeResult.error);
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
