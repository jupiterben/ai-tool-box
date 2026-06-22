import { webContents, type WebContents } from 'electron';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import type { BaseSiteHandler } from '../src/webview-handlers/BaseSiteHandler.js';

export interface WebviewSendInputPayload {
  toolId: string;
  partition: string;
  content: string;
}

export interface WebviewSendInputResult {
  success: boolean;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function findWebContentsByPartition(partition: string, urlHint?: string): WebContents | null {
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed()) continue;
    try {
      if (wc.session.partition === partition) {
        return wc;
      }
    } catch {
      // ignore
    }
  }

  if (urlHint) {
    for (const wc of webContents.getAllWebContents()) {
      if (wc.isDestroyed()) continue;
      try {
        if (wc.getURL().includes(urlHint)) {
          return wc;
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function sendMouseClick(wc: WebContents, x: number, y: number): void {
  wc.sendInputEvent({ type: 'mouseMove', x, y });
  wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
}

function sendEnter(wc: WebContents): void {
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
  wc.sendInputEvent({ type: 'char', keyCode: 'Enter' });
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
}

async function sendWithHandler(
  wc: WebContents,
  handler: BaseSiteHandler,
  content: string
): Promise<WebviewSendInputResult> {
  const runtime = handler.buildBrowserRuntimeScript();

  let focusResult: { success?: boolean; error?: string } | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    focusResult = (await wc.executeJavaScript(`${runtime}; __focusInput();`)) as {
      success?: boolean;
      error?: string;
    };
    if (focusResult?.success) break;
    await sleep(300);
  }

  if (!focusResult?.success) {
    return { success: false, error: focusResult?.error || '未找到输入框' };
  }

  wc.focus();
  wc.insertText(content);
  await sleep(600);

  const { sendMethod } = handler.config;

  if (sendMethod === 'enter' || sendMethod === 'submit') {
    sendEnter(wc);
    return { success: true };
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const posResult = (await wc.executeJavaScript(`${runtime}; __getSendButtonPosition();`)) as {
      ready?: boolean;
      x?: number;
      y?: number;
    };
    if (posResult?.ready && typeof posResult.x === 'number' && typeof posResult.y === 'number') {
      sendMouseClick(wc, posResult.x, posResult.y);
      return { success: true };
    }
    await sleep(100);
  }

  sendEnter(wc);
  return { success: true };
}

export async function sendWebviewInput(
  payload: WebviewSendInputPayload
): Promise<WebviewSendInputResult> {
  const handler = getSiteHandler(payload.toolId);
  if (!handler) {
    return { success: false, error: `未找到站点 handler: ${payload.toolId}` };
  }

  const wc = findWebContentsByPartition(payload.partition, handler.config.urlHint);
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
