import { getSiteHandler, type WebviewInputHandlerResult } from '../webview-handlers';

type ExecuteJavaScript = (code: string) => Promise<unknown>;

type WebviewElement = HTMLElement & {
  executeJavaScript?: ExecuteJavaScript;
  getWebContents?: () => { executeJavaScript?: ExecuteJavaScript };
  webContents?: { executeJavaScript?: ExecuteJavaScript };
  reload?: () => void;
  src?: string;
};

function getExecuteJavaScript(webview: HTMLElement): ExecuteJavaScript | null {
  const w = webview as WebviewElement;

  if (typeof w.executeJavaScript === 'function') {
    return w.executeJavaScript.bind(w);
  }

  if (typeof w.getWebContents === 'function') {
    try {
      const wc = w.getWebContents();
      if (wc && typeof wc.executeJavaScript === 'function') {
        return wc.executeJavaScript.bind(wc);
      }
    } catch {
      // ignore
    }
  }

  if (w.webContents && typeof w.webContents.executeJavaScript === 'function') {
    return w.webContents.executeJavaScript.bind(w.webContents);
  }

  return null;
}

function navigateWebviewToUrl(webview: WebviewElement, url: string): WebviewInputHandlerResult {
  if (typeof webview.reload === 'function' && webview.src === url) {
    webview.reload();
    return { success: true };
  }

  webview.src = url;
  return { success: true };
}

export async function handleWebviewConversation(
  toolId: string,
  action: 'newChat' | 'recentChat',
  webviewElement: HTMLElement,
  fallbackUrl?: string
): Promise<WebviewInputHandlerResult> {
  const handler = getSiteHandler(toolId);
  if (!handler) {
    return { success: false, error: `未找到站点 handler: ${toolId}` };
  }

  const actionConfig =
    action === 'newChat' ? handler.config.newChatAction : handler.config.recentChatAction;

  if (action === 'newChat' && !actionConfig && fallbackUrl) {
    return navigateWebviewToUrl(webviewElement as WebviewElement, fallbackUrl);
  }

  if (!actionConfig) {
    return {
      success: false,
      error: action === 'newChat' ? '该站点未配置新建对话' : '该站点未配置最近对话',
    };
  }

  if (action === 'newChat' && actionConfig.url && !actionConfig.selectors && !actionConfig.textIncludes) {
    return navigateWebviewToUrl(webviewElement as WebviewElement, actionConfig.url);
  }

  const executeJavaScript = getExecuteJavaScript(webviewElement);
  if (!executeJavaScript) {
    if (action === 'newChat' && (actionConfig.url || fallbackUrl)) {
      return navigateWebviewToUrl(
        webviewElement as WebviewElement,
        actionConfig.url || fallbackUrl!
      );
    }
    return { success: false, error: 'Webview 不支持 JavaScript 注入' };
  }

  try {
    const script = handler.buildConversationActionScript(action);
    const result = (await executeJavaScript(script)) as WebviewInputHandlerResult;
    if (result && typeof result === 'object' && 'success' in result) {
      return result;
    }
    return { success: false, error: '对话操作失败' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '对话操作失败',
    };
  }
}
