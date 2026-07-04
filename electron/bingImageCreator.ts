import type { Session, WebContents } from 'electron';
import type { ExtractedImage } from '../src/types/image-gen-api.js';

const BING_ORIGIN = 'https://www.bing.com';
const DEFAULT_MODEL = 'gpt4o';
const DEFAULT_ASPECT_RATIO = '1:1';
const POLL_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 30_000;

export const BING_MODELS = ['gpt4o', 'dalle', 'maiimage2'] as const;
export const BING_ASPECT_RATIOS = ['1:1', '7:4', '4:7', '3:2', '2:3'] as const;

export type BingModel = (typeof BING_MODELS)[number];
export type BingAspectRatio = (typeof BING_ASPECT_RATIOS)[number];

/** 各模型支持的纵横比（与 Bing 页面一致） */
export const BING_MODEL_ASPECT_RATIOS: Record<BingModel, readonly BingAspectRatio[]> = {
  gpt4o: ['1:1', '3:2', '2:3'],
  dalle: ['1:1', '7:4', '4:7'],
  maiimage2: ['1:1', '3:2', '2:3'],
};

const ASPECT_RATIO_TO_AR: Record<BingAspectRatio, number> = {
  '1:1': 1,
  '7:4': 2,
  '4:7': 3,
  '3:2': 4,
  '2:3': 5,
};

export interface BingGenerateOptions {
  prompt: string;
  timeoutMs?: number;
  model?: BingModel;
  aspectRatio?: BingAspectRatio;
  mdl?: number | string;
  ar?: number;
}

export function resolveBingApiParams(options: Pick<BingGenerateOptions, 'model' | 'aspectRatio' | 'mdl' | 'ar'>): {
  mdl: string | number;
  ar: number;
  model: BingModel;
  aspectRatio: BingAspectRatio;
} {
  const model = options.model ?? DEFAULT_MODEL;
  const aspectRatio = options.aspectRatio ?? DEFAULT_ASPECT_RATIO;

  if (!BING_MODELS.includes(model)) {
    throw new Error(`不支持的 Bing 模型: ${model}`);
  }
  if (!BING_ASPECT_RATIOS.includes(aspectRatio)) {
    throw new Error(`不支持的 Bing 纵横比: ${aspectRatio}`);
  }
  if (!BING_MODEL_ASPECT_RATIOS[model].includes(aspectRatio)) {
    throw new Error(`模型 ${model} 不支持纵横比 ${aspectRatio}，可选: ${BING_MODEL_ASPECT_RATIOS[model].join(', ')}`);
  }

  const ar = options.ar ?? ASPECT_RATIO_TO_AR[aspectRatio];
  const mdl = options.mdl ?? model;

  return { mdl, ar, model, aspectRatio };
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return `${BING_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** 将 Bing 缩略图 URL 升级为更大尺寸 */
function upgradeImageUrl(url: string): string {
  const absolute = toAbsoluteUrl(url);
  try {
    const u = new URL(absolute);
    if (u.hostname.includes('th.bing.com') && u.pathname.includes('/th/id/')) {
      if (u.searchParams.has('w') || u.searchParams.has('h')) {
        u.searchParams.set('w', '1024');
        u.searchParams.set('h', '1024');
        u.searchParams.delete('c');
        u.searchParams.delete('r');
        u.searchParams.delete('o');
        return u.toString();
      }
    }
  } catch {
    // URL 解析失败，返回原 URL
  }
  return absolute;
}

async function fetchWithTimeout(
  session: Session,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await session.fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(session: Session, url: string): Promise<ExtractedImage | null> {
  try {
    const response = await fetchWithTimeout(session, url, { method: 'GET' }, REQUEST_TIMEOUT_MS);
    if (!response.ok) {
      return null;
    }

    const mimeType = (response.headers.get('content-type') || 'image/png').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return null;
    }

    const base64 = buffer.toString('base64');
    return {
      base64,
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
      width: 0,
      height: 0,
    };
  } catch {
    return null;
  }
}

async function downloadImages(session: Session, urls: string[]): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  for (const rawUrl of urls.slice(0, 4)) {
    const image = await downloadImage(session, upgradeImageUrl(rawUrl));
    if (image) {
      images.push(image);
    }
  }
  return images;
}

/** 在 webview 页面上下文执行 fetch，与前端调用方式一致 */
function buildWebviewFetchScript(
  prompt: string,
  timeoutMs: number,
  mdl: string | number,
  ar: number
): string {
  // 在主进程（Node，UTF-8 安全）里先 encodeURIComponent，只把纯 ASCII 传入 webview 脚本，
  // 避免 executeJavaScript 注入中文字符时被替换成 '?' 导致 Bing 收到乱码。
  const encodedPrompt = encodeURIComponent(prompt);
  const payload = JSON.stringify({ encodedPrompt, timeoutMs, mdl, ar, origin: BING_ORIGIN });

  return `
    (async function() {
      var cfg = ${payload};
      var encodedPrompt = cfg.encodedPrompt;

      function extractRequestId(redirectUrl) {
        var queryMatch = redirectUrl.match(/[?&]id=([^&]+)/);
        if (queryMatch && queryMatch[1]) return queryMatch[1];
        var pathMatch = redirectUrl.match(/\\/(\\d+-[a-f0-9]{16,})(?:[/?]|$)/i);
        if (pathMatch && pathMatch[1]) return pathMatch[1];
        throw new Error('无法解析 request id: ' + redirectUrl);
      }

      function extractImageUrls(html) {
        // 先解码 HTML 实体（&amp; -> &），避免 URL 里的 & 被编码成 &amp;
        var decoded = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        var urls = [];
        var seen = {};
        var match;
        var pattern = /src="([^"]+)"/g;
        while ((match = pattern.exec(decoded)) !== null) {
          var src = match[1];
          if (!src || src.indexOf('data:') === 0) continue;
          if (src.indexOf('/th/id/') >= 0 || src.indexOf('th.bing.com') >= 0) {
            if (!seen[src]) {
              seen[src] = true;
              urls.push(src);
            }
          }
        }
        var generated = urls.filter(function(u) {
          return u.indexOf('/th/id/OIG') >= 0 || u.indexOf('pid=ImgGn') >= 0;
        });
        return generated.length ? generated : urls;
      }

      function sleep(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
      }

      try {
        var createUrl = cfg.origin + '/images/create?q=' + encodedPrompt + '&rt=4&mdl=' + cfg.mdl + '&ar=' + cfg.ar + '&FORM=GENCRE';
        var createResp = await fetch(createUrl, {
          method: 'POST',
          redirect: 'follow',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: cfg.origin + '/images/create',
          },
          body: 'q=' + encodedPrompt + '&qs=ds',
        });

        var finalUrl = createResp.url || '';
        if (!finalUrl || finalUrl === createUrl) {
          return { success: false, error: 'Bing 未重定向，请确认已在 webview 登录 (status=' + createResp.status + ')' };
        }

        var requestId = '';
        try { requestId = extractRequestId(finalUrl); } catch (e) {}

        var createHtml = '';
        try { createHtml = await createResp.text(); } catch (e) {}

        var deadline = Date.now() + cfg.timeoutMs;
        var html = '';

        // 只有当最终 URL 就是 async/results 结果页时，createHtml 才是本次结果；
        // 否则 createHtml 只是生成页（可能含历史图/占位图），必须轮询 async/results。
        var isAsyncResultPage = finalUrl.indexOf('/async/results/') >= 0;
        if (isAsyncResultPage && createHtml && extractImageUrls(createHtml).length) {
          html = createHtml;
        }

        if (!html && requestId) {
          var pollingUrl = cfg.origin + '/images/create/async/results/' + requestId + '?q=' + encodedPrompt + '&mdl=' + cfg.mdl + '&ar=' + cfg.ar;
          while (!html && Date.now() < deadline) {
            var pollResp = await fetch(pollingUrl, { credentials: 'include' });
            if (!pollResp.ok) {
              return { success: false, error: 'Bing 轮询失败: HTTP ' + pollResp.status };
            }
            var text = await pollResp.text();
            if (!text || !text.trim()) {
              await sleep(${POLL_INTERVAL_MS});
              continue;
            }
            if (text.trim().charAt(0) === '{') {
              try {
                var json = JSON.parse(text);
                if (json.errorMessage) {
                  return { success: false, error: 'Bing 错误: ' + json.errorMessage };
                }
              } catch (e) {}
              await sleep(${POLL_INTERVAL_MS});
              continue;
            }
            html = text;
            break;
          }
        }

        // 仅当无法解析 requestId 且无法轮询时，才退回 createHtml 作为最后手段
        if (!html && createHtml) {
          html = createHtml;
        }

        if (!html) {
          return { success: false, error: '生图超时，Bing 未返回结果' };
        }

        var imageUrls = extractImageUrls(html);
        if (!imageUrls.length) {
          return { success: false, error: 'Bing 响应中未找到图片 URL' };
        }

        return { success: true, imageUrls: imageUrls, __debug: { encodedPrompt: encodedPrompt, finalUrl: finalUrl, imageUrls: imageUrls } };
      } catch (error) {
        return { success: false, error: error && error.message ? error.message : 'Bing fetch 失败' };
      }
    })();
  `;
}

interface WebviewFetchResult {
  success?: boolean;
  imageUrls?: string[];
  error?: string;
}

/** 在 webview 内直接 fetch Bing 内部 API，主进程负责下载图片 */
export async function generateBingImagesViaWebviewFetch(
  wc: WebContents,
  options: BingGenerateOptions
): Promise<{ success: boolean; images?: ExtractedImage[]; error?: string }> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    return { success: false, error: 'prompt 不能为空' };
  }

  const timeoutMs = options.timeoutMs ?? 120_000;

  let mdl: string | number;
  let ar: number;
  try {
    ({ mdl, ar } = resolveBingApiParams(options));
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bing 参数无效',
    };
  }

  try {
    const script = buildWebviewFetchScript(prompt, timeoutMs, mdl, ar);
    const result = (await wc.executeJavaScript(script)) as WebviewFetchResult & { __debug?: { encodedPrompt?: string; finalUrl?: string; imageUrls?: string[] } };

    console.log('[bingImageCreator] prompt=', JSON.stringify(prompt), 'encoded=', result?.__debug?.encodedPrompt, 'finalUrl=', result?.__debug?.finalUrl, 'imageUrls=', JSON.stringify(result?.__debug?.imageUrls));

    if (!result?.success || !result.imageUrls?.length) {
      return { success: false, error: result?.error || 'Bing API 未返回图片' };
    }

    const images = await downloadImages(wc.session, result.imageUrls);
    if (!images.length) {
      return { success: false, error: '图片下载失败' };
    }

    return { success: true, images };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bing webview fetch 失败',
    };
  }
}
