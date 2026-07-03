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

    const url = req.url || '/';

    if (req.method === 'GET' && url === '/api/health') {
      sendJson(res, 200, {
        success: true,
        service: 'ai-tool-box-image-gen',
        port,
        host: bindHost,
        lanEnabled: isLanBindHost(bindHost),
        accessUrls: formatApiAccessUrls(bindHost, port),
        features: ['prompt', 'referenceImage', 'multipart-upload'],
      });
      return;
    }

    if (req.method === 'POST' && url === '/api/gen_image') {
      await handleGenImage(getMainWindow, req, res);
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
