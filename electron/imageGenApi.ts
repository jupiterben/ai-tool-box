import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { BrowserWindow } from 'electron';
import type { GenImageResult } from '../src/types/image-gen-api.js';
import { generateImageViaWebview, type ImageGenProgressEvent } from './imageGenService.js';
import { parseGenImageRequest } from './imageGenRequestParser.js';
import {
  formatApiAccessUrls,
  getApiBindHost,
  getApiPort,
  getApiWorkerCount,
  isLanBindHost,
} from './imageGenApiConfig.js';
import { getApiWorkerStatus, runWithApiWorker } from './imageGenApiWorkers.js';
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
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function writeSseEvent(res: ServerResponse, event: string, data: unknown): void {
  const payload = JSON.stringify(data);
  res.write(`event: ${event}\n`);
  for (const line of payload.split(/\r?\n/)) {
    res.write(`data: ${line}\n`);
  }
  res.write('\n');
}

function openSseResponse(res: ServerResponse): void {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
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
    console.log('[imageGenApi] LAN mode enabled with API token configured');
    return;
  }

  console.warn('[imageGenApi] LAN mode enabled without AI_TOOLBOX_API_TOKEN; configure a token before exposing this API');
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
    sendJson(res, 401, { success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const request = await parseGenImageRequest(req);
    const result: GenImageResult = await runWithApiWorker((threadId) =>
      generateImageViaWebview(getMainWindow(), request, { threadId })
    );
    sendJson(res, result.success ? 200 : 500, result);
  } catch (error) {
    sendJson(res, 400, {
      success: false,
      error: error instanceof Error ? error.message : 'Request parse failed',
    });
  }
}

async function handleGenImageStream(
  getMainWindow: () => BrowserWindow | null,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, error: 'Unauthorized' });
    return;
  }

  let request: Awaited<ReturnType<typeof parseGenImageRequest>>;
  try {
    request = await parseGenImageRequest(req);
  } catch (error) {
    sendJson(res, 400, {
      success: false,
      error: error instanceof Error ? error.message : 'Request parse failed',
    });
    return;
  }

  openSseResponse(res);

  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const send = (event: string, data: unknown) => {
    if (!closed && !res.destroyed) {
      writeSseEvent(res, event, data);
    }
  };

  const keepAlive = setInterval(() => {
    if (!closed && !res.destroyed) {
      res.write(': keepalive\n\n');
    }
  }, 15_000);

  send('accepted', {
    type: 'accepted',
    request,
    workerStatus: getApiWorkerStatus(),
  });

  try {
    const result: GenImageResult = await runWithApiWorker((threadId) => {
      send('assigned', { type: 'assigned', threadId, request });
      return generateImageViaWebview(getMainWindow(), request, {
        threadId,
        onProgress: (event: ImageGenProgressEvent) => send(event.type, { ...event, threadId }),
      });
    });

    if (!result.success) {
      send('error', {
        type: 'error',
        toolId: result.toolId,
        prompt: result.prompt,
        error: result.error || 'Image generation failed',
      });
    }

    send('done', { type: 'done', result });
  } catch (error) {
    send('error', {
      type: 'error',
      error: error instanceof Error ? error.message : 'Image generation failed',
    });
  } finally {
    clearInterval(keepAlive);
    if (!closed && !res.destroyed) {
      res.end();
    }
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
    const maxBytes = 2 * 1024 * 1024;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large'));
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
    sendJson(res, 401, { success: false, error: 'Unauthorized' });
    return;
  }

  const { pathname, query } = parseQueryUrl(req);
  const toolId = query.get('toolId') || undefined;
  const webContentsId = Number(query.get('webContentsId'));

  if (!toolId) {
    sendJson(res, 400, { success: false, error: 'Missing toolId' });
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
      error: error instanceof Error ? error.message : 'Debug API failed',
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
        workerCount: getApiWorkerCount(),
        workerStatus: getApiWorkerStatus(),
        accessUrls: formatApiAccessUrls(bindHost, port),
        features: ['prompt', 'referenceImage', 'multipart-upload', 'stream', 'debug', 'parallel-workers'],
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/gen_image/stream') {
      await handleGenImageStream(getMainWindow, req, res);
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
    console.log(`[imageGenApi] API started (${bindHost}:${port})`);
    for (const url of urls) {
      console.log(`[imageGenApi]   -> ${url}`);
    }
  });

  server.on('error', (error) => {
    console.error('[imageGenApi] Failed to start:', error);
  });
}

export function stopImageGenApi(): void {
  if (!server) {
    return;
  }

  server.close();
  server = null;
}
