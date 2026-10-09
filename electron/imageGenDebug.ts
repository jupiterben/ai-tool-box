import { getSiteHandler } from '../src/webview-handlers/index.js';
import { getActivePresetPartition } from './presetPartition.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

const DEFAULT_DEBUG_FETCH_TIMEOUT_MS = 15_000;
const MAX_DEBUG_FETCH_TIMEOUT_MS = 60_000;
const DEFAULT_DEBUG_FETCH_MAX_BYTES = 1024 * 1024;
const MAX_DEBUG_FETCH_MAX_BYTES = 5 * 1024 * 1024;

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

export interface DebugFetchPageOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface DebugFetchPageResult {
  success: boolean;
  url?: string;
  finalUrl?: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  redirected?: boolean;
  headers?: Record<string, string>;
  contentType?: string;
  content?: string;
  contentLength?: number;
  truncated?: boolean;
  maxBytes?: number;
  error?: string;
}

function normalizeFetchMethod(method: string | undefined): string {
  const normalized = (method || 'GET').trim().toUpperCase();
  if (!normalized) {
    return 'GET';
  }

  if (normalized === 'CONNECT' || normalized === 'TRACE') {
    throw new Error(`Unsupported HTTP method: ${normalized}`);
  }

  return normalized;
}

function normalizePositiveInteger(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(1, Math.floor(value as number)), max);
}

function parseDebugFetchUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Missing url');
  }

  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported');
  }

  return url;
}

function sanitizeFetchHeaders(input: Record<string, string> | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!input) {
    return headers;
  }

  const blocked = new Set([
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);

  for (const [name, value] of Object.entries(input)) {
    const headerName = name.trim();
    if (!headerName || blocked.has(headerName.toLowerCase())) {
      continue;
    }
    headers[headerName] = String(value);
  }

  return headers;
}

async function readResponseText(response: Response, maxBytes: number): Promise<{
  content: string;
  contentLength: number;
  truncated: boolean;
}> {
  if (!response.body) {
    const content = await response.text();
    return {
      content,
      contentLength: Buffer.byteLength(content, 'utf8'),
      truncated: false,
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    const remaining = maxBytes - total;
    if (value.byteLength > remaining) {
      if (remaining > 0) {
        chunks.push(value.slice(0, remaining));
        total += remaining;
      }
      truncated = true;
      await reader.cancel();
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return {
    content: buffer.toString('utf8'),
    contentLength: total,
    truncated,
  };
}

async function findWebContents(toolId: string, webContentsId?: number) {
  const handler = getSiteHandler(toolId);
  if (!handler) {
    return { wc: null, error: `未找到站点 handler: ${toolId}` };
  }

  const partition = getActivePresetPartition();
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

export async function debugFetchPage(options: DebugFetchPageOptions): Promise<DebugFetchPageResult> {
  try {
    const url = parseDebugFetchUrl(options.url);
    const method = normalizeFetchMethod(options.method);
    const timeoutMs = normalizePositiveInteger(
      options.timeoutMs,
      DEFAULT_DEBUG_FETCH_TIMEOUT_MS,
      MAX_DEBUG_FETCH_TIMEOUT_MS
    );
    const maxBytes = normalizePositiveInteger(
      options.maxBytes,
      DEFAULT_DEBUG_FETCH_MAX_BYTES,
      MAX_DEBUG_FETCH_MAX_BYTES
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: sanitizeFetchHeaders(options.headers),
        body: method === 'GET' || method === 'HEAD' ? undefined : options.body,
        redirect: 'follow',
        signal: controller.signal,
      });
      const headers = Object.fromEntries(response.headers.entries());
      const { content, contentLength, truncated } =
        method === 'HEAD'
          ? { content: '', contentLength: 0, truncated: false }
          : await readResponseText(response, maxBytes);

      return {
        success: true,
        url: url.toString(),
        finalUrl: response.url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        redirected: response.redirected,
        headers,
        contentType: response.headers.get('content-type') || undefined,
        content,
        contentLength,
        truncated,
        maxBytes,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      success: false,
      url: options.url,
      error: error instanceof Error ? error.message : 'Fetch page failed',
    };
  }
}
