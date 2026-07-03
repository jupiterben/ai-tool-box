import type { Session, WebContents } from 'electron';
import type { ExtractedImage } from '../src/types/image-gen-api.js';

const GEMINI_ORIGIN = 'https://gemini.google.com';
const STREAM_GENERATE_URL =
  `${GEMINI_ORIGIN}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;
const BATCH_EXEC_URL = `${GEMINI_ORIGIN}/_/BardChatUi/data/batchexecute`;
const INIT_URL = `${GEMINI_ORIGIN}/images`;
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_METADATA = ['', '', '', null, null, null, null, null, null, ''];
const RPC_GET_FULL_SIZE_IMAGE = 'c8o8Fe';

export interface GeminiGenerateOptions {
  prompt: string;
  timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const response = await fetchWithTimeout(
      session,
      url,
      {
        method: 'GET',
        headers: { Referer: `${GEMINI_ORIGIN}/` },
      },
      REQUEST_TIMEOUT_MS
    );
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
  for (const url of urls.slice(0, 4)) {
    const image = await downloadImage(session, url);
    if (image) {
      images.push(image);
    }
  }
  return images;
}

/** 在 webview 页面上下文执行 StreamGenerate，复用登录 cookie */
function buildWebviewFetchScript(prompt: string, timeoutMs: number): string {
  const config = JSON.stringify({
    prompt,
    timeoutMs,
    origin: GEMINI_ORIGIN,
    streamUrl: STREAM_GENERATE_URL,
    batchUrl: BATCH_EXEC_URL,
    initUrl: INIT_URL,
    defaultMetadata: DEFAULT_METADATA,
    rpcFullSize: RPC_GET_FULL_SIZE_IMAGE,
  });

  return `
    (async function() {
      var cfg = ${config};

      function getNestedValue(data, path, fallback) {
        var current = data;
        for (var i = 0; i < path.length; i++) {
          var key = path[i];
          if (typeof key === 'number') {
            if (!Array.isArray(current) || key < -current.length || key >= current.length) {
              return fallback;
            }
            current = current[key];
          } else if (typeof key === 'string') {
            if (!current || typeof current !== 'object' || !(key in current)) {
              return fallback;
            }
            current = current[key];
          } else {
            return fallback;
          }
        }
        return current == null ? fallback : current;
      }

      function utf16Units(str) {
        var units = 0;
        for (var i = 0; i < str.length; i++) {
          units += str.charCodeAt(i) > 0xffff ? 2 : 1;
        }
        return units;
      }

      function charCountForUtf16Units(str, startIdx, targetUnits) {
        var count = 0;
        var units = 0;
        while (units < targetUnits && startIdx + count < str.length) {
          var code = str.charCodeAt(startIdx + count);
          var u = code > 0xffff ? 2 : 1;
          if (units + u > targetUnits) break;
          units += u;
          count += 1;
        }
        return count;
      }

      function parseResponseByFrame(content) {
        var parsed = [];
        var consumed = 0;
        var total = content.length;

        while (consumed < total) {
          while (consumed < total && /\\s/.test(content.charAt(consumed))) {
            consumed += 1;
          }
          if (consumed >= total) break;

          var match = content.slice(consumed).match(/^(\\d+)\\n/);
          if (!match) break;

          var length = parseInt(match[1], 10);
          var startContent = consumed + match[0].length;
          var charCount = charCountForUtf16Units(content, startContent, length);
          if (charCount === 0 && length > 0) break;

          var endPos = startContent + charCount;
          var chunk = content.slice(startContent, endPos).trim();
          consumed = endPos;

          if (!chunk) continue;
          try {
            var parsedChunk = JSON.parse(chunk);
            if (Array.isArray(parsedChunk)) {
              parsed = parsed.concat(parsedChunk);
            } else {
              parsed.push(parsedChunk);
            }
          } catch (e) {}
        }

        return { parsed: parsed, remainder: content.slice(consumed) };
      }

      function extractTokens(html) {
        function pick(pattern) {
          var m = html.match(pattern);
          return m && m[1] ? m[1] : '';
        }
        return {
          accessToken: pick(/"SNlM0e":"(.*?)"/),
          buildLabel: pick(/"cfb2h":"(.*?)"/),
          sessionId: pick(/"FdrFJe":"(.*?)"/),
          language: pick(/"TuX5cc":"(.*?)"/) || 'en',
        };
      }

      function normalizePrompt(text) {
        var lower = text.toLowerCase();
        if (
          lower.indexOf('generate') >= 0 ||
          lower.indexOf('create') >= 0 ||
          lower.indexOf('draw') >= 0 ||
          text.indexOf('生成') >= 0 ||
          text.indexOf('画') >= 0 ||
          text.indexOf('创建') >= 0
        ) {
          return text;
        }
        return 'Generate an image: ' + text;
      }

      function uuidUpper() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        }).toUpperCase();
      }

      function extractGeneratedImages(candidate) {
        var urls = [];
        var seen = {};
        var plain = getNestedValue(candidate, [12, 7, 0], []);
        var img2img = getNestedValue(candidate, [12, 0, '8', 0], []);
        var all = (Array.isArray(plain) ? plain : []).concat(Array.isArray(img2img) ? img2img : []);

        for (var i = 0; i < all.length; i++) {
          var item = all[i];
          var url = getNestedValue(item, [0, 3, 3], '');
          if (!url || seen[url]) continue;
          seen[url] = true;
          urls.push({
            url: url,
            alt: getNestedValue(item, [0, 3, 2], ''),
            imageId: getNestedValue(item, [1, 0], ''),
          });
        }
        return urls;
      }

      function upgradeImageUrl(url) {
        if (!url) return url;
        if (url.indexOf('=s2048-rj') >= 0) return url;
        if (url.indexOf('=s1024-rj') >= 0) return url.replace('=s1024-rj', '=s2048-rj');
        if (url.indexOf('googleusercontent.com') >= 0) return url + '=s2048-rj';
        return url;
      }

      async function initTokens() {
        var html = document.documentElement ? document.documentElement.innerHTML : '';
        var tokens = extractTokens(html);
        if (tokens.accessToken) return tokens;

        var resp = await fetch(cfg.initUrl, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'text/html' },
        });
        if (!resp.ok) {
          throw new Error('Gemini 初始化失败: HTTP ' + resp.status);
        }
        html = await resp.text();
        tokens = extractTokens(html);
        if (!tokens.accessToken) {
          throw new Error('未获取 SNlM0e token，请确认已在 webview 登录 Gemini');
        }
        return tokens;
      }

      async function getFullSizeUrl(tokens, reqid, cid, rid, rcid, imageId) {
        if (!imageId || !cid || !rid || !rcid) return null;

        var payload = [
          [
            [null, null, null, [null, null, null, null, null, '']],
            [imageId, 0],
            null,
            [19, ''],
            null, null, null, null, null,
            '',
          ],
          [rid, rcid, cid, null, ''],
          1, 0, 1,
        ];

        var params = new URLSearchParams({
          rpcids: cfg.rpcFullSize,
          hl: tokens.language || 'en',
          _reqid: String(reqid),
          rt: 'c',
          'source-path': '/images',
        });
        if (tokens.buildLabel) params.set('bl', tokens.buildLabel);
        if (tokens.sessionId) params.set('f.sid', tokens.sessionId);

        var body = new URLSearchParams({
          at: tokens.accessToken,
          'f.req': JSON.stringify([[ [cfg.rpcFullSize, JSON.stringify(payload), null, 'generic'] ]]),
        });

        var resp = await fetch(cfg.batchUrl + '?' + params.toString(), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            Origin: cfg.origin,
            Referer: cfg.origin + '/images',
            'X-Same-Domain': '1',
            'x-goog-ext-525001261-jspb': '[1,null,null,null,null,null,null,null,[4]]',
            'x-goog-ext-73010989-jspb': '[0]',
          },
          body: body.toString(),
        });

        if (!resp.ok) return null;
        var text = await resp.text();
        if (text.indexOf(")]}'") === 0) text = text.slice(4).trim();
        var frames = parseResponseByFrame(text).parsed;
        for (var fi = 0; fi < frames.length; fi++) {
          var inner = getNestedValue(frames[fi], [2], '');
          if (!inner) continue;
          try {
            var parsed = JSON.parse(inner);
            var fullUrl = getNestedValue(parsed, [0], '');
            if (fullUrl) return fullUrl;
          } catch (e) {}
        }
        return null;
      }

      async function resolveDownloadUrl(tokens, reqid, cid, rid, rcid, imageInfo) {
        var fullRpcUrl = await getFullSizeUrl(tokens, reqid, cid, rid, rcid, imageInfo.imageId);
        if (fullRpcUrl) {
          try {
            var redirectResp = await fetch(fullRpcUrl + '=d-I?alr=yes', {
              credentials: 'include',
              headers: { Referer: cfg.origin + '/' },
            });
            if (redirectResp.ok) {
              var nextUrl = (await redirectResp.text()).trim();
              if (nextUrl && nextUrl.indexOf('http') === 0) {
                return nextUrl;
              }
            }
          } catch (e) {}
        }
        return upgradeImageUrl(imageInfo.url);
      }

      function processStreamParts(parts, state) {
        for (var pi = 0; pi < parts.length; pi++) {
          var part = parts[pi];
          var errorCode = getNestedValue(part, [5, 2, 0, 1, 0], null);
          if (errorCode) {
            if (errorCode === 1037) {
              throw new Error('Gemini 额度已用尽 (1037)');
            }
            throw new Error('Gemini API 错误: ' + errorCode);
          }

          var innerJsonStr = getNestedValue(part, [2], '');
          if (!innerJsonStr) continue;

          var partJson;
          try {
            partJson = JSON.parse(innerJsonStr);
          } catch (e) {
            continue;
          }

          var mData = getNestedValue(partJson, [1], null);
          if (mData) {
            if (getNestedValue(mData, [0], '')) state.cid = getNestedValue(mData, [0], '');
            if (getNestedValue(mData, [1], '')) state.rid = getNestedValue(mData, [1], '');
          }

          if (typeof getNestedValue(partJson, [25], null) === 'string') {
            state.isFinalChunk = true;
          }

          var candidates = getNestedValue(partJson, [4], []);
          if (!Array.isArray(candidates)) continue;

          for (var ci = 0; ci < candidates.length; ci++) {
            var candidate = candidates[ci];
            var rcid = getNestedValue(candidate, [0], '');
            if (rcid) state.rcid = rcid;

            var indicator = getNestedValue(candidate, [8, 0], null);
            if (indicator === 2) state.isCompleted = true;

            var found = extractGeneratedImages(candidate);
            for (var fi = 0; fi < found.length; fi++) {
              if (!state.images.some(function(x) { return x.url === found[fi].url; })) {
                state.images.push(found[fi]);
              }
            }
          }
        }
      }

      try {
        var tokens = await initTokens();
        var prompt = normalizePrompt(cfg.prompt);
        var reqid = Math.floor(Math.random() * 90000) + 10000;

        var messageContent = [prompt, 0, null, null, null, null, null, 0];
        var innerReqList = new Array(69);
        for (var i = 0; i < innerReqList.length; i++) innerReqList[i] = null;
        innerReqList[0] = messageContent;
        innerReqList[1] = [tokens.language || 'en'];
        innerReqList[2] = cfg.defaultMetadata;
        innerReqList[6] = [1];
        innerReqList[7] = 1;
        innerReqList[10] = 1;
        innerReqList[11] = 0;
        innerReqList[17] = [[0]];
        innerReqList[18] = 0;
        innerReqList[27] = 1;
        innerReqList[30] = [4];
        innerReqList[41] = [1];
        innerReqList[53] = 0;
        innerReqList[55] = [[1]];
        innerReqList[61] = [];
        innerReqList[68] = 2;
        var uuidVal = uuidUpper();
        innerReqList[59] = uuidVal;

        var params = new URLSearchParams({
          hl: tokens.language || 'en',
          _reqid: String(reqid),
          rt: 'c',
        });
        if (tokens.buildLabel) params.set('bl', tokens.buildLabel);
        if (tokens.sessionId) params.set('f.sid', tokens.sessionId);

        var body = new URLSearchParams({
          at: tokens.accessToken,
          'f.req': JSON.stringify([null, JSON.stringify(innerReqList)]),
        });

        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, cfg.timeoutMs);

        var response = await fetch(cfg.streamUrl + '?' + params.toString(), {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            Origin: cfg.origin,
            Referer: cfg.origin + '/images',
            'X-Same-Domain': '1',
            'x-goog-ext-525005358-jspb': JSON.stringify([uuidVal, 1]),
          },
          body: body.toString(),
        }).finally(function() { clearTimeout(timer); });

        if (!response.ok) {
          return { success: false, error: 'StreamGenerate 失败: HTTP ' + response.status };
        }

        var rawText = await response.text();
        if (rawText.indexOf(")]}'") === 0) rawText = rawText.slice(4).trim();

        var state = {
          cid: '',
          rid: '',
          rcid: '',
          images: [],
          isCompleted: false,
          isFinalChunk: false,
        };

        var frameResult = parseResponseByFrame(rawText);
        processStreamParts(frameResult.parsed, state);

        if (!state.images.length) {
          return { success: false, error: 'Gemini 响应中未找到生成图片' };
        }

        var downloadUrls = [];
        for (var di = 0; di < state.images.length; di++) {
          var resolved = await resolveDownloadUrl(
            tokens,
            reqid + 100000,
            state.cid,
            state.rid,
            state.rcid,
            state.images[di]
          );
          if (resolved) downloadUrls.push(resolved);
        }

        if (!downloadUrls.length) {
          return { success: false, error: 'Gemini 图片 URL 解析失败' };
        }

        return {
          success: true,
          imageUrls: downloadUrls,
          __debug: {
            prompt: prompt,
            cid: state.cid,
            rid: state.rid,
            imageCount: downloadUrls.length,
            isCompleted: state.isCompleted,
          },
        };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          return { success: false, error: '生图超时，Gemini 未返回结果' };
        }
        return {
          success: false,
          error: error && error.message ? error.message : 'Gemini fetch 失败',
        };
      }
    })();
  `;
}

interface WebviewFetchResult {
  success?: boolean;
  imageUrls?: string[];
  error?: string;
}

/** 在 webview 内直接 fetch Gemini StreamGenerate，主进程负责下载图片 */
export async function generateGeminiImagesViaWebviewFetch(
  wc: WebContents,
  options: GeminiGenerateOptions
): Promise<{ success: boolean; images?: ExtractedImage[]; error?: string }> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    return { success: false, error: 'prompt 不能为空' };
  }

  const timeoutMs = options.timeoutMs ?? 120_000;

  try {
    const script = buildWebviewFetchScript(prompt, timeoutMs);
    const result = (await wc.executeJavaScript(script)) as WebviewFetchResult & {
      __debug?: { prompt?: string; cid?: string; rid?: string; imageCount?: number; isCompleted?: boolean };
    };

    console.log(
      '[geminiImageCreator] prompt=',
      JSON.stringify(result?.__debug?.prompt ?? prompt),
      'cid=',
      result?.__debug?.cid,
      'imageCount=',
      result?.__debug?.imageCount,
      'completed=',
      result?.__debug?.isCompleted
    );

    if (!result?.success || !result.imageUrls?.length) {
      return { success: false, error: result?.error || 'Gemini API 未返回图片' };
    }

    const images = await downloadImages(wc.session, result.imageUrls);
    if (!images.length) {
      return { success: false, error: '图片下载失败' };
    }

    return { success: true, images };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gemini webview fetch 失败',
    };
  }
}
