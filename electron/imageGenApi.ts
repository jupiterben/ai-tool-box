import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { BrowserWindow } from 'electron';
import type { GenImageResult } from '../src/types/image-gen-api.js';
import { generateImageViaWebview } from './imageGenService.js';
import { parseGenImageRequest } from './imageGenRequestParser.js';
import {
  formatApiAccessUrls,
  getApiBindHost,
  getApiPort,
  isLanBindHost,
} from './imageGenApiConfig.js';
import {
  debugWebviewEval,
  debugWebviewInfo,
  debugWebviewScreenshot,
  debugWebviewSnapshot,
} from './imageGenDebug.js';

let server: ReturnType<typeof createServer> | null = null;

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function getApiToken(): string | null {
  const token = process.env.AI_TOOLBOX_API_TOKEN?.trim();
  return token || null;
}

function ensureLanSecurity(host: string): void {
  if (!isLanBindHost(host)) {
    return;
  }

  if (getApiToken()) {
    console.log('[imageGenApi] 局域网模式已启用，鉴权 token 已配置');
    return;
  }

  console.warn(
    '[imageGenApi] 局域网模式已启用但未设置 AI_TOOLBOX_API_TOKEN，建议配置 token 后再暴露到局域网'
  );
}

function isAuthorized(req: IncomingMessage): boolean {
  const requiredToken = getApiToken();
  if (!requiredToken) {
    return true;
  }

  const headerToken = req.headers['x-api-token'];
  if (typeof headerToken === 'string' && headerToken === requiredToken) {
    return true;
  }

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth === `Bearer ${requiredToken}`) {
    return true;
  }

  return false;
}

async function handleGenImage(
  getMainWindow: () => BrowserWindow | null,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, error: '未授权' });
    return;
  }

  try {
    const request = await parseGenImageRequest(req);
    const result: GenImageResult = await generateImageViaWebview(getMainWindow(), request);
    sendJson(res, result.success ? 200 : 500, result);
  } catch (error) {
    sendJson(res, 400, {
      success: false,
      error: error instanceof Error ? error.message : '请求解析失败',
    });
  }
}

function parseQueryUrl(req: IncomingMessage): { pathname: string; query: URLSearchParams } {
  const raw = req.url || '/';
  const host = req.headers.host || 'localhost';
  const url = new URL(raw, `http://${host}`);
  return { pathname: url.pathname, query: url.searchParams };
}

function readBodyText(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const MAX = 2 * 1024 * 1024;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleDebug(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, error: '未授权' });
    return;
  }

  const { pathname, query } = parseQueryUrl(req);
  const toolId = query.get('toolId') || undefined;
  const webContentsId = Number(query.get('webContentsId'));

  if (!toolId) {
    sendJson(res, 400, { success: false, error: '缺少 toolId 参数' });
    return;
  }

  try {
    if (pathname === '/api/debug/webview' && req.method === 'GET') {
      const result = await debugWebviewInfo(toolId, Number.isFinite(webContentsId) ? webContentsId : undefined);
      sendJson(res, result.success ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/debug/snapshot' && req.method === 'GET') {
      const result = await debugWebviewSnapshot(toolId, Number.isFinite(webContentsId) ? webContentsId : undefined);
      sendJson(res, result.success ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/debug/screenshot' && req.method === 'GET') {
      const result = await debugWebviewScreenshot(toolId, Number.isFinite(webContentsId) ? webContentsId : undefined);
      sendJson(res, result.success ? 200 : 500, result);
      return;
    }

    if (pathname === '/api/debug/eval' && req.method === 'POST') {
      const body = await readBodyText(req);
      const result = await debugWebviewEval(
        toolId,
        body,
        Number.isFinite(webContentsId) ? webContentsId : undefined
      );
      sendJson(res, result.success ? 200 : 500, result);
      return;
    }

    sendJson(res, 404, { success: false, error: 'Not Found' });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      toolId,
      error: error instanceof Error ? error.message : '调试接口失败',
    });
  }
}

export function startImageGenApi(getMainWindow: () => BrowserWindow | null): void {
  if (server) {
    return;
  }

  const bindHost = getApiBindHost();
  const port = getApiPort();
  ensureLanSecurity(bindHost);

  server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Token',
      });
      res.end();
      return;
    }

    const { pathname } = parseQueryUrl(req);

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        success: true,
        service: 'ai-tool-box-image-gen',
        port,
        host: bindHost,
        lanEnabled: isLanBindHost(bindHost),
        accessUrls: formatApiAccessUrls(bindHost, port),
        features: ['prompt', 'referenceImage', 'multipart-upload', 'debug'],
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/gen_image') {
      await handleGenImage(getMainWindow, req, res);
      return;
    }

    if (pathname.startsWith('/api/debug/')) {
      await handleDebug(req, res);
      return;
    }

    sendJson(res, 404, { success: false, error: 'Not Found' });
  });

  server.listen(port, bindHost, () => {
    const urls = formatApiAccessUrls(bindHost, port);
    console.log(`[imageGenApi] API 已启动 (${bindHost}:${port})`);
    for (const url of urls) {
      console.log(`[imageGenApi]   → ${url}`);
    }
  });

  server.on('error', (error) => {
    console.error('[imageGenApi] 启动失败:', error);
  });
}

export function stopImageGenApi(): void {
  if (!server) {
    return;
  }

  server.close();
  server = null;
}
