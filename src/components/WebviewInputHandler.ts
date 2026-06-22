import { getToolPartition } from '../utils/toolPartition';
import {
  buildInjectCheckScriptForSite,
  getSiteHandler,
  HANDLER_VERSION,
  type WebviewInputHandlerResult,
} from '../webview-handlers';
import type { BaseSiteHandler } from '../webview-handlers/BaseSiteHandler';

export type { WebviewInputHandlerResult };

export interface WebviewInputHandlerConfig {
  toolId: string;
  webviewElement: HTMLElement & {
    executeJavaScript?: (code: string) => Promise<unknown>;
    getWebContents?: () => unknown;
  };
  inputContent: string;
  timeout?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExecuteJavaScript(webview: HTMLElement): ((code: string) => Promise<unknown>) | null {
  const w = webview as HTMLElement & {
    executeJavaScript?: (code: string) => Promise<unknown>;
    getWebContents?: () => { executeJavaScript?: (code: string) => Promise<unknown> };
    webContents?: { executeJavaScript?: (code: string) => Promise<unknown> };
  };

  if (typeof w.executeJavaScript === 'function') {
    return w.executeJavaScript.bind(w);
  }

  if (typeof w.getWebContents === 'function') {
    try {
      const wc = w.getWebContents();
      if (wc && typeof wc.executeJavaScript === 'function') {
        return wc.executeJavaScript.bind(wc);
      }
    } catch (error) {
      console.error('[WebviewInputHandler] 获取 webContents 失败:', error);
    }
  }

  if (w.webContents && typeof w.webContents.executeJavaScript === 'function') {
    return w.webContents.executeJavaScript.bind(w.webContents);
  }

  return null;
}

async function tryNativeWebviewSendViaIpc(
  handler: BaseSiteHandler,
  inputContent: string
): Promise<WebviewInputHandlerResult | null> {
  if (!window.electronAPI?.sendWebviewInput) {
    console.log(`[WebviewInputHandler] ${handler.toolId} IPC sendWebviewInput 不可用`);
    return null;
  }

  console.log(`[WebviewInputHandler] ${handler.toolId} 通过主进程 IPC 发送`);
  return window.electronAPI.sendWebviewInput({
    toolId: handler.toolId,
    partition: getToolPartition(handler.toolId),
    content: inputContent,
  });
}

async function injectSiteScript(
  handler: BaseSiteHandler,
  executeJavaScript: (code: string) => Promise<unknown>,
  timeout = 5000
): Promise<WebviewInputHandlerResult> {
  try {
    const injectCode = handler.buildInjectScript();
    const executePromise = executeJavaScript(injectCode);
    const timeoutPromise = new Promise<WebviewInputHandlerResult>((resolve) =>
      setTimeout(() => resolve({ success: false, error: '注入脚本超时' }), timeout)
    );
    const result = (await Promise.race([executePromise, timeoutPromise])) as WebviewInputHandlerResult;
    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }
    return { success: false, error: '注入脚本失败' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '注入脚本失败',
    };
  }
}

async function checkScriptInjected(
  toolId: string,
  executeJavaScript: (code: string) => Promise<unknown>
): Promise<boolean> {
  try {
    const result = await executeJavaScript(buildInjectCheckScriptForSite(toolId));
    return result === true;
  } catch {
    return false;
  }
}

async function waitForWebviewLoad(
  webview: HTMLElement & { isLoading?: boolean; addEventListener?: (e: string, fn: () => void) => void; removeEventListener?: (e: string, fn: () => void) => void },
  executeJavaScript: (code: string) => Promise<unknown>,
  timeout: number
): Promise<void> {
  if (webview.isLoading === false) {
    return;
  }

  try {
    const isReady = await executeJavaScript(
      `(function(){ return document.readyState === 'complete' || document.readyState === 'interactive'; })();`
    );
    if (isReady === true) {
      return;
    }
  } catch {
    // continue
  }

  await new Promise<void>((resolve, reject) => {
    const maxWait = Math.max(timeout, 10000);
    const onLoad = () => {
      clearTimeout(timer);
      webview.removeEventListener?.('did-finish-load', onLoad);
      resolve();
    };
    const timer = setTimeout(() => {
      webview.removeEventListener?.('did-finish-load', onLoad);
      executeJavaScript(
        `(function(){ return document.readyState === 'complete' || document.readyState === 'interactive'; })();`
      )
        .then((ready) => (ready ? resolve() : reject(new Error('Webview 加载超时'))))
        .catch(() => reject(new Error('Webview 加载超时')));
    }, maxWait);
    webview.addEventListener?.('did-finish-load', onLoad);
  });
}

async function callInjectedInput(
  inputContent: string,
  executeJavaScript: (code: string) => Promise<unknown>
): Promise<WebviewInputHandlerResult> {
  const contentJson = JSON.stringify(inputContent);
  const callCode = `
    (async function() {
      if (typeof window.__injectInput__ === 'function') {
        return await window.__injectInput__(${contentJson});
      }
      return { success: false, error: '输入处理函数未找到，请重新注入脚本' };
    })();
  `;

  const executePromise = executeJavaScript(callCode);
  const timeoutPromise = new Promise<WebviewInputHandlerResult>((resolve) =>
    setTimeout(() => resolve({ success: false, error: '操作超时' }), 5000)
  );
  const result = (await Promise.race([executePromise, timeoutPromise])) as WebviewInputHandlerResult;
  if (result && typeof result === 'object' && 'success' in result) {
    return result;
  }
  return { success: false, error: '未知错误' };
}

export async function handleWebviewInput(
  config: WebviewInputHandlerConfig
): Promise<WebviewInputHandlerResult> {
  const handler = getSiteHandler(config.toolId);
  if (!handler) {
    return { success: false, error: `未找到站点 handler: ${config.toolId}` };
  }

  const { webviewElement, inputContent, timeout = 5000 } = config;
  const executeJavaScript = getExecuteJavaScript(webviewElement);

  if (!executeJavaScript) {
    return { success: false, error: 'Webview 不支持 JavaScript 注入' };
  }

  try {
    console.log(`[WebviewInputHandler] 开始处理 ${config.toolId} 的输入传递 (v${HANDLER_VERSION})`);

    let isInjected = await checkScriptInjected(config.toolId, executeJavaScript);
    if (!isInjected) {
      try {
        await waitForWebviewLoad(webviewElement as never, executeJavaScript, timeout);
      } catch (error) {
        console.warn(`[WebviewInputHandler] ${config.toolId} 等待加载:`, error);
      }
      await sleep(500);
      isInjected = await checkScriptInjected(config.toolId, executeJavaScript);
    }

    // 1. 主进程 IPC 原生输入（优先）
    try {
      const ipcResult = await tryNativeWebviewSendViaIpc(handler, inputContent);
      if (ipcResult?.success) {
        console.log(`[WebviewInputHandler] ${config.toolId} IPC 原生输入发送成功`);
        return ipcResult;
      }
      if (ipcResult && !ipcResult.success) {
        console.warn(`[WebviewInputHandler] ${config.toolId} IPC 失败:`, ipcResult.error);
      }
    } catch (error) {
      console.warn(`[WebviewInputHandler] ${config.toolId} IPC 异常:`, error);
    }

    // 2. 回退：注入站点独立脚本
    if (!isInjected) {
      const injectResult = await injectSiteScript(handler, executeJavaScript, timeout);
      if (!injectResult.success) {
        return injectResult;
      }
    }

    const result = await callInjectedInput(inputContent, executeJavaScript);
    console.log(`[WebviewInputHandler] ${config.toolId} 注入脚本执行结果:`, result);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '执行失败',
    };
  }
}

export async function preInjectScript(
  webviewElement: HTMLElement & { executeJavaScript?: (code: string) => Promise<unknown> },
  toolId: string,
  timeout = 5000
): Promise<WebviewInputHandlerResult> {
  const handler = getSiteHandler(toolId);
  if (!handler) {
    return { success: false, error: `未找到站点 handler: ${toolId}` };
  }

  const executeJavaScript = getExecuteJavaScript(webviewElement);
  if (!executeJavaScript) {
    return { success: false, error: 'Webview 不支持 JavaScript 注入' };
  }

  try {
    await sleep(500);
    const isInjected = await checkScriptInjected(toolId, executeJavaScript);
    if (isInjected) {
      return { success: true };
    }
    return injectSiteScript(handler, executeJavaScript, timeout);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '预注入脚本失败',
    };
  }
}
