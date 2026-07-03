import { ipcMain, type BrowserWindow } from 'electron';
import type { EnsureImageWebviewResult } from '../src/types/image-gen-api.js';

interface PendingEnsure {
  resolve: (value: { webContentsId?: number }) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingEnsures = new Map<string, PendingEnsure>();

export function registerImageGenBridgeHandlers(): void {
  ipcMain.on('image-gen:ensure-webview-result', (_event, result: EnsureImageWebviewResult) => {
    const pending = pendingEnsures.get(result.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pendingEnsures.delete(result.requestId);

    if (result.success) {
      pending.resolve({ webContentsId: result.webContentsId });
      return;
    }

    pending.reject(new Error(result.error || 'webview 未就绪'));
  });
}

export function requestEnsureImageWebview(
  mainWindow: BrowserWindow | null,
  toolId: string,
  timeoutMs = 60_000
): Promise<{ webContentsId?: number }> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return Promise.reject(new Error('主窗口不可用'));
  }

  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingEnsures.delete(requestId);
      reject(new Error('等待 webview 超时，请确认生图页已加载'));
    }, timeoutMs);

    pendingEnsures.set(requestId, { resolve, reject, timer });
    mainWindow.webContents.send('image-gen:ensure-webview', { requestId, toolId });
  });
}

export function clearImageGenBridge(): void {
  for (const pending of pendingEnsures.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error('应用正在关闭'));
  }
  pendingEnsures.clear();
}
