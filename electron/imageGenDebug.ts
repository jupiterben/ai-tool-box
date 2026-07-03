import { getSiteHandler } from '../src/webview-handlers/index.js';
import { getToolPartition } from '../src/utils/toolPartition.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

export interface DebugWebviewInfo {
  success: boolean;
  toolId?: string;
  url?: string;
  title?: string;
  readyState?: string;
  webContentsId?: number;
  type?: string;
  error?: string;
}

export interface DebugSnapshotResult {
  success: boolean;
  toolId?: string;
  url?: string;
  html?: string;
  length?: number;
  error?: string;
}

export interface DebugScreenshotResult {
  success: boolean;
  toolId?: string;
  url?: string;
  image?: {
    base64: string;
    mimeType: string;
    dataUrl: string;
    width: number;
    height: number;
  };
  error?: string;
}

export interface DebugEvalResult {
  success: boolean;
  toolId?: string;
  url?: string;
  result?: unknown;
  error?: string;
}

async function findWebContents(toolId: string, webContentsId?: number) {
  const handler = getSiteHandler(toolId);
  if (!handler) {
    return { wc: null, error: `未找到站点 handler: ${toolId}` };
  }

  const partition = getToolPartition(toolId);
  const wc = findToolWebContents(
    partition,
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { wc: null, error: '未找到 webview' };
  }

  return { wc, error: undefined };
}

export async function debugWebviewInfo(
  toolId: string,
  webContentsId?: number
): Promise<DebugWebviewInfo> {
  const { wc, error } = await findWebContents(toolId, webContentsId);
  if (!wc) {
    return { success: false, toolId, error };
  }

  try {
    return {
      success: true,
      toolId,
      url: wc.getURL(),
      title: wc.getTitle(),
      readyState: await wc.executeJavaScript('document.readyState'),
      webContentsId: wc.id,
      type: wc.getType(),
    };
  } catch (err) {
    return {
      success: false,
      toolId,
      error: err instanceof Error ? err.message : '获取 webview 信息失败',
    };
  }
}

export async function debugWebviewSnapshot(
  toolId: string,
  webContentsId?: number
): Promise<DebugSnapshotResult> {
  const { wc, error } = await findWebContents(toolId, webContentsId);
  if (!wc) {
    return { success: false, toolId, error };
  }

  try {
    const url = wc.getURL();
    const html = await wc.executeJavaScript(
      'document.documentElement?.outerHTML || document.body?.innerHTML || ""'
    );
    return {
      success: true,
      toolId,
      url,
      html: typeof html === 'string' ? html : String(html),
      length: typeof html === 'string' ? html.length : 0,
    };
  } catch (err) {
    return {
      success: false,
      toolId,
      error: err instanceof Error ? err.message : '获取网页快照失败',
    };
  }
}

export async function debugWebviewScreenshot(
  toolId: string,
  webContentsId?: number
): Promise<DebugScreenshotResult> {
  const { wc, error } = await findWebContents(toolId, webContentsId);
  if (!wc) {
    return { success: false, toolId, error };
  }

  try {
    const url = wc.getURL();
    const nativeImage = await wc.capturePage();
    const buffer = nativeImage.toPNG();
    const base64 = buffer.toString('base64');
    return {
      success: true,
      toolId,
      url,
      image: {
        base64,
        mimeType: 'image/png',
        dataUrl: `data:image/png;base64,${base64}`,
        width: nativeImage.getSize().width,
        height: nativeImage.getSize().height,
      },
    };
  } catch (err) {
    return {
      success: false,
      toolId,
      error: err instanceof Error ? err.message : '截图失败',
    };
  }
}

export async function debugWebviewEval(
  toolId: string,
  script: string,
  webContentsId?: number
): Promise<DebugEvalResult> {
  const { wc, error } = await findWebContents(toolId, webContentsId);
  if (!wc) {
    return { success: false, toolId, error };
  }

  try {
    const url = wc.getURL();
    const result = await wc.executeJavaScript(script);
    return { success: true, toolId, url, result };
  } catch (err) {
    return {
      success: false,
      toolId,
      error: err instanceof Error ? err.message : '执行脚本失败',
    };
  }
}
