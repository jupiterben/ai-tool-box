import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { BrowserWindow } from 'electron';
import {
  IMAGE_GEN_API_DEFAULT_TOOL_ID,
  type GenImageResult,
  type GenImageRequest,
} from '../src/types/image-gen-api.js';
import type { ImageGenApiStatus } from '../src/types/image-gen-api-settings.js';
import { generateImageViaWebview, type ImageGenProgressEvent } from './imageGenService.js';
import { parseGenImageRequest } from './imageGenRequestParser.js';
import {
  formatApiAccessUrls,
  getApiBindHost,
  getApiPort,
  getApiDefaultWorkerCount,
  isLanBindHost,
} from './imageGenApiConfig.js';
import { getApiWorkerStatus, runWithApiWorker } from './imageGenApiWorkers.js';
import {
  debugFetchPage,
  debugWebviewEval,
  debugWebviewInfo,
  debugWebviewScreenshot,
  debugWebviewSnapshot,
  type DebugFetchPageOptions,
} from './imageGenDebug.js';

let server: ReturnType<typeof createServer> | null = null;
let activeHost = '';
let configuredPort = 0;
let activePort: number | undefined;
let lastError: string | undefined;

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

function getRequestToolId(request: GenImageRequest): string {
  return request.toolId?.trim() || IMAGE_GEN_API_DEFAULT_TOOL_ID;
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
    const toolId = getRequestToolId(request);
    const result: GenImageResult = await runWithApiWorker(toolId, (threadId) =>
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
    workerStatus: getApiWorkerStatus(getRequestToolId(request)),
  });

  try {
    const toolId = getRequestToolId(request);
    const result: GenImageResult = await runWithApiWorker(toolId, (threadId) => {
      send('assigned', { type: 'assigned', threadId, toolId, request });
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

function getQueryNumber(query: URLSearchParams, name: string): number | undefined {
  const raw = query.get(name);
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function parseDebugFetchRequest(req: IncomingMessage): Promise<DebugFetchPageOptions> {
  const { query } = parseQueryUrl(req);

  if (req.method === 'GET') {
    return {
      url: query.get('url') || '',
      method: query.get('method') || undefined,
      timeoutMs: getQueryNumber(query, 'timeoutMs'),
      maxBytes: getQueryNumber(query, 'maxBytes'),
    };
  }

  const body = await readBodyText(req);
  if (!body.trim()) {
    return { url: '' };
  }

  const parsed = JSON.parse(body) as Partial<DebugFetchPageOptions>;
  return {
    url: typeof parsed.url === 'string' ? parsed.url : '',
    method: typeof parsed.method === 'string' ? parsed.method : undefined,
    headers:
      parsed.headers && typeof parsed.headers === 'object' && !Array.isArray(parsed.headers)
        ? Object.fromEntries(
            Object.entries(parsed.headers).map(([key, value]) => [key, String(value)])
          )
        : undefined,
    body: typeof parsed.body === 'string' ? parsed.body : undefined,
    timeoutMs: typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : undefined,
    maxBytes: typeof parsed.maxBytes === 'number' ? parsed.maxBytes : undefined,
  };
}

async function handleDebug(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, error: 'Unauthorized' });
    return;
  }

  const { pathname, query } = parseQueryUrl(req);
  const toolId = query.get('toolId') || undefined;
  const webContentsId = Number(query.get('webContentsId'));

  if (pathname === '/api/debug/fetch_page' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      const result = await debugFetchPage(await parseDebugFetchRequest(req));
      sendJson(res, result.success ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, {
        success: false,
        error: error instanceof Error ? error.message : 'Fetch page request parse failed',
      });
    }
    return;
  }

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

function listen(serverToListen: ReturnType<typeof createServer>, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      serverToListen.off('error', onError);
      serverToListen.off('listening', onListening);
    };

    serverToListen.once('error', onError);
    serverToListen.once('listening', onListening);
    serverToListen.listen(port, host);
  });
}

async function listenWithPortFallback(
  serverToListen: ReturnType<typeof createServer>,
  startPort: number,
  host: string,
  maxAttempts = 20
): Promise<number> {
  let port = startPort;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await listen(serverToListen, port, host);
      return port;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE' && code !== 'EACCES') {
        throw error;
      }
      port += 1;
      if (port >= 65536) {
        port = 1024;
      }
    }
  }

  throw new Error(`No available API port found from ${startPort}`);
}

export async function startImageGenApi(
  getMainWindow: () => BrowserWindow | null,
  options: { port?: number } = {}
): Promise<ImageGenApiStatus> {
  if (server) {
    return getImageGenApiStatus(true);
  }

  const bindHost = getApiBindHost();
  const port = options.port ?? getApiPort();
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
        port: activePort ?? port,
        configuredPort: port,
        host: bindHost,
        lanEnabled: isLanBindHost(bindHost),
        defaultWorkerCountPerTool: getApiDefaultWorkerCount(),
        workerStatus: getApiWorkerStatus(),
        accessUrls: formatApiAccessUrls(bindHost, port),
        features: [
          'prompt',
          'referenceImage',
          'multipart-upload',
          'stream',
          'debug',
          'debug-fetch-page',
          'parallel-workers',
          'per-tool-workers',
          'gemini-page-fetch-experimental',
        ],
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

  server.on('error', (error) => {
    console.error('[imageGenApi] Failed to start:', error);
  });

  configuredPort = port;
  activeHost = bindHost;
  activePort = undefined;
  lastError = undefined;

  try {
    const actualPort = await listenWithPortFallback(server, port, bindHost);
    activePort = actualPort;
    const urls = formatApiAccessUrls(bindHost, actualPort);
    console.log(`[imageGenApi] API started (${bindHost}:${actualPort})`);
    if (actualPort !== port) {
      console.log(`[imageGenApi] requested port ${port} was unavailable; using ${actualPort}`);
    }
    for (const url of urls) {
      console.log(`[imageGenApi]   -> ${url}`);
    }
    return getImageGenApiStatus(true);
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'API failed to start';
    try {
      server.close();
    } catch {
      // server may not have started listening
    }
    server = null;
    activePort = undefined;
    throw error;
  }
}

export function stopImageGenApi(): Promise<void> {
  if (!server) {
    activePort = undefined;
    return Promise.resolve();
  }

  const closingServer = server;
  server = null;
  activePort = undefined;
  return new Promise((resolve) => {
    closingServer.close(() => resolve());
  });
}

export function getImageGenApiStatus(enabled = true): ImageGenApiStatus {
  const host = activeHost || getApiBindHost();
  const port = configuredPort || getApiPort();
  return {
    enabled,
    running: Boolean(server && activePort),
    host,
    configuredPort: port,
    actualPort: activePort,
    accessUrls: activePort ? formatApiAccessUrls(host, activePort) : [],
    error: lastError,
  };
}
