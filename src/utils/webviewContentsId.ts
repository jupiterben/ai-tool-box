/** 从 Electron webview 元素获取 guest webContentsId，供主进程 IPC 定位 */
export function getWebContentsIdMap(
  toolIds: string[],
  webviewElements: Record<string, HTMLElement>
): Record<string, number> {
  const map: Record<string, number> = {};

  for (const toolId of toolIds) {
    const el = webviewElements[toolId] as HTMLElement & {
      getWebContentsId?: () => number;
    };
    if (typeof el?.getWebContentsId !== 'function') {
      continue;
    }
    try {
      const id = el.getWebContentsId();
      if (typeof id === 'number' && id > 0) {
        map[toolId] = id;
      }
    } catch {
      // ignore
    }
  }

  return map;
}

function isWebviewNotFoundError(error?: string): boolean {
  return !!error && (error.includes('未找到 webview') || error.includes('Webview 不可用'));
}

export { isWebviewNotFoundError };
