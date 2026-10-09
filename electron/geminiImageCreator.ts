import type { WebContents } from 'electron';
import type { ExtractedImage } from '../src/types/image-gen-api.js';
import { getActivePresetPartition } from './presetPartition.js';
import { sendWebviewInput, waitForWebviewSendReady } from './webviewInput.js';
import {
  getBaselineOriginSrcs,
  getImageOriginSrc,
  sanitizeImagesForApi,
  waitForNewWebviewImages,
} from './webviewExtractImages.js';

const GEMINI_TOOL_ID = 'gemini-image';
const CAPTURE_TIMEOUT_MS = 20_000;
const FETCH_TIMEOUT_FLOOR_MS = 30_000;
const GEMINI_GENERATE_URL_PART = '/StreamGenerate';

interface CapturedGeminiRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
}

interface CapturedGeminiTransaction extends CapturedGeminiRequest {
  requestId: string;
  status?: number;
  responseText?: string;
}

interface WebviewFetchResult {
  success?: boolean;
  status?: number;
  statusText?: string;
  finalUrl?: string;
  imageUrls?: string[];
  textSample?: string;
  error?: string;
}

export interface GeminiWebFetchOptions {
  prompt: string;
  count?: number;
  timeoutMs?: number;
  webContentsId?: number;
}

export interface GeminiWebFetchResult {
  success: boolean;
  images?: ExtractedImage[];
  error?: string;
  captured?: boolean;
  didSendPrompt?: boolean;
  replayed?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImageCount(count?: number): number {
  if (count == null || !Number.isFinite(count)) {
    return 1;
  }
  return Math.min(Math.max(1, Math.floor(count)), 8);
}

function buildRoundPrompt(prompt: string, count: number, round: number): string {
  if (count <= 1 || round === 0) {
    return prompt;
  }
  return `${prompt} (variation ${round + 1} of ${count})`;
}

function shouldCaptureRequest(url: string): boolean {
  return url.includes('gemini.google.com') && url.includes(GEMINI_GENERATE_URL_PART);
}

function normalizeEscapedResponse(text: string): string {
  return String(text || '')
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\\//g, '/');
}

function cleanImageUrl(url: string): string {
  return String(url || '')
    .replace(/[\\]+$/g, '')
    .replace(/[),;\]]+$/g, '')
    .replace(/&amp;/g, '&');
}

function extractImageUrlsFromGeminiText(text: string | undefined): string[] {
  const normalized = normalizeEscapedResponse(text || '');
  const urls: string[] = [];
  const seen = new Set<string>();
  const pattern = /https?:\/\/[^"'=<>\s\\]+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const url = cleanImageUrl(match[0]);
    if (
      !url.includes('googleusercontent.com') &&
      !url.includes('gg-dl') &&
      !url.includes('rc_gen_image')
    ) {
      continue;
    }
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

function summarizeGeminiResponse(text: string | undefined): string {
  return normalizeEscapedResponse(text || '').replace(/\s+/g, ' ').slice(0, 500);
}

function sanitizeCapturedHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const allowed = new Set([
    'accept',
    'content-type',
    'x-client-data',
    'x-goog-authuser',
    'x-goog-encode-response-if-executable',
    'x-same-domain',
  ]);
  const sanitized: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(headers ?? {})) {
    const name = rawName.toLowerCase();
    if (!allowed.has(name)) {
      continue;
    }
    if (typeof rawValue === 'string') {
      sanitized[rawName] = rawValue;
    }
  }

  if (!Object.keys(sanitized).some((name) => name.toLowerCase() === 'x-same-domain')) {
    sanitized['X-Same-Domain'] = '1';
  }

  return sanitized;
}

async function captureNextGeminiGenerateRequest(
  wc: WebContents,
  timeoutMs = CAPTURE_TIMEOUT_MS
): Promise<CapturedGeminiRequest> {
  if (wc.isDestroyed()) {
    throw new Error('Gemini webview is destroyed');
  }

  const debuggerApi = wc.debugger;
  let attachedHere = false;

  if (!debuggerApi.isAttached()) {
    debuggerApi.attach('1.3');
    attachedHere = true;
  }

  await debuggerApi.sendCommand('Network.enable');

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      debuggerApi.off('message', onMessage);
      if (attachedHere && debuggerApi.isAttached()) {
        try {
          debuggerApi.detach();
        } catch {
          // ignore detach failures
        }
      }
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Timed out while capturing Gemini StreamGenerate request')));
    }, timeoutMs);

    const onMessage = async (_event: unknown, method: string, params?: any) => {
      if (method !== 'Network.requestWillBeSent') {
        return;
      }

      const request = params?.request;
      const url = typeof request?.url === 'string' ? request.url : '';
      if (!shouldCaptureRequest(url)) {
        return;
      }

      try {
        let postData = typeof request.postData === 'string' ? request.postData : undefined;
        if (!postData && params?.requestId) {
          try {
            const body = (await debuggerApi.sendCommand('Network.getRequestPostData', {
              requestId: params.requestId,
            })) as { postData?: string };
            postData = body.postData;
          } catch {
            // Chromium may omit post data for some requests.
          }
        }

        finish(() =>
          resolve({
            url,
            method: typeof request.method === 'string' ? request.method : 'POST',
            headers: sanitizeCapturedHeaders(request.headers),
            postData,
          })
        );
      } catch (error) {
        finish(() => reject(error));
      }
    };

    debuggerApi.on('message', onMessage);
  });
}

async function captureGeminiGenerateTransaction<T>(
  wc: WebContents,
  trigger: () => Promise<T>,
  timeoutMs = CAPTURE_TIMEOUT_MS
): Promise<{ transaction: CapturedGeminiTransaction; triggerResult: T }> {
  if (wc.isDestroyed()) {
    throw new Error('Gemini webview is destroyed');
  }

  const debuggerApi = wc.debugger;
  let attachedHere = false;

  if (!debuggerApi.isAttached()) {
    debuggerApi.attach('1.3');
    attachedHere = true;
  }

  await debuggerApi.sendCommand('Network.enable');

  return new Promise((resolve, reject) => {
    let settled = false;
    let triggerResult: T | undefined;
    let targetRequestId = '';
    let captured: CapturedGeminiTransaction | null = null;

    const cleanup = () => {
      clearTimeout(timer);
      debuggerApi.off('message', onMessage);
      if (attachedHere && debuggerApi.isAttached()) {
        try {
          debuggerApi.detach();
        } catch {
          // ignore detach failures
        }
      }
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Timed out while capturing Gemini StreamGenerate response')));
    }, timeoutMs);

    const maybeResolve = () => {
      if (captured && triggerResult !== undefined) {
        finish(() => resolve({ transaction: captured as CapturedGeminiTransaction, triggerResult: triggerResult as T }));
      }
    };

    const onMessage = async (_event: unknown, method: string, params?: any) => {
      if (method === 'Network.requestWillBeSent') {
        const request = params?.request;
        const url = typeof request?.url === 'string' ? request.url : '';
        if (!shouldCaptureRequest(url) || targetRequestId) {
          return;
        }

        targetRequestId = String(params?.requestId || '');
        captured = {
          requestId: targetRequestId,
          url,
          method: typeof request.method === 'string' ? request.method : 'POST',
          headers: sanitizeCapturedHeaders(request.headers),
          postData: typeof request.postData === 'string' ? request.postData : undefined,
        };

        if (!captured.postData && targetRequestId) {
          try {
            const body = (await debuggerApi.sendCommand('Network.getRequestPostData', {
              requestId: targetRequestId,
            })) as { postData?: string };
            captured.postData = body.postData;
          } catch {
            // Chromium may omit post data for some requests.
          }
        }
        return;
      }

      if (method === 'Network.responseReceived' && params?.requestId === targetRequestId && captured) {
        const status = params?.response?.status;
        if (typeof status === 'number') {
          captured.status = status;
        }
        return;
      }

      if (method === 'Network.loadingFinished' && params?.requestId === targetRequestId && captured) {
        try {
          const body = (await debuggerApi.sendCommand('Network.getResponseBody', {
            requestId: targetRequestId,
          })) as { body?: string; base64Encoded?: boolean };
          captured.responseText = body.base64Encoded && body.body
            ? Buffer.from(body.body, 'base64').toString('utf8')
            : body.body || '';
        } catch {
          captured.responseText = '';
        }
        maybeResolve();
        return;
      }

      if (method === 'Network.loadingFailed' && params?.requestId === targetRequestId) {
        finish(() => reject(new Error(params?.errorText || 'Gemini StreamGenerate request failed')));
      }
    };

    debuggerApi.on('message', onMessage);

    trigger()
      .then((result) => {
        triggerResult = result;
        maybeResolve();
      })
      .catch((error) => {
        finish(() => reject(error));
      });
  });
}

function jsonEscaped(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function replaceAllLiteral(input: string, from: string, to: string): { value: string; count: number } {
  if (!from || from === to) {
    return { value: input, count: 0 };
  }
  const parts = input.split(from);
  if (parts.length <= 1) {
    return { value: input, count: 0 };
  }
  return { value: parts.join(to), count: parts.length - 1 };
}

function replacePromptInPostData(postData: string | undefined, fromPrompt: string, toPrompt: string): {
  postData?: string;
  replacements: number;
} {
  if (!postData || fromPrompt === toPrompt) {
    return { postData, replacements: 0 };
  }

  let next = postData;
  let replacements = 0;
  const candidates: Array<[string, string]> = [
    [encodeURIComponent(fromPrompt), encodeURIComponent(toPrompt)],
    [encodeURIComponent(jsonEscaped(fromPrompt)), encodeURIComponent(jsonEscaped(toPrompt))],
    [jsonEscaped(fromPrompt), jsonEscaped(toPrompt)],
    [fromPrompt, toPrompt],
  ];

  for (const [from, to] of candidates) {
    const replaced = replaceAllLiteral(next, from, to);
    next = replaced.value;
    replacements += replaced.count;
  }

  return { postData: next, replacements };
}

function buildGeminiFetchScript(
  captured: CapturedGeminiRequest,
  capturedPrompt: string,
  prompt: string,
  timeoutMs: number
): string {
  const replaced = replacePromptInPostData(captured.postData, capturedPrompt, prompt);
  const payload = JSON.stringify({
    url: captured.url,
    method: captured.method || 'POST',
    headers: captured.headers,
    postData: replaced.postData,
    replacements: replaced.replacements,
    promptChanged: capturedPrompt !== prompt,
    timeoutMs,
  });

  return `
    (async function() {
      var cfg = ${payload};

      function normalizeEscapes(text) {
        return String(text || '')
          .replace(/\\\\u003d/g, '=')
          .replace(/\\\\u0026/g, '&')
          .replace(/\\\\u003c/g, '<')
          .replace(/\\\\u003e/g, '>')
          .replace(/\\\\\\//g, '/');
      }

      function cleanUrl(url) {
        return String(url || '')
          .replace(/[\\\\]+$/g, '')
          .replace(/[),;\\]]+$/g, '')
          .replace(/&amp;/g, '&');
      }

      function extractImageUrls(text) {
        var normalized = normalizeEscapes(text);
        var urls = [];
        var seen = {};
        var pattern = /https?:\\/\\/[^"'<>\\s\\\\]+/g;
        var match;
        while ((match = pattern.exec(normalized)) !== null) {
          var url = cleanUrl(match[0]);
          if (
            url.indexOf('googleusercontent.com') < 0 &&
            url.indexOf('gg-dl') < 0 &&
            url.indexOf('rc_gen_image') < 0
          ) {
            continue;
          }
          if (!seen[url]) {
            seen[url] = true;
            urls.push(url);
          }
        }
        return urls;
      }

      if (cfg.promptChanged && cfg.replacements <= 0) {
        return { success: false, error: 'Captured Gemini request body did not contain the prompt text' };
      }

      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, cfg.timeoutMs);
      try {
        var response = await fetch(cfg.url, {
          method: cfg.method,
          credentials: 'include',
          headers: cfg.headers,
          body: cfg.postData,
          signal: controller.signal,
        });
        var text = await response.text();
        var imageUrls = extractImageUrls(text);
        return {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          finalUrl: response.url,
          imageUrls: imageUrls,
          textSample: text.slice(0, 2000),
          error: response.ok ? undefined : ('HTTP ' + response.status + ' ' + response.statusText),
        };
      } catch (error) {
        return { success: false, error: error && error.message ? error.message : 'Gemini page fetch failed' };
      } finally {
        clearTimeout(timer);
      }
    })();
  `;
}

async function downloadImage(wc: WebContents, url: string): Promise<ExtractedImage | null> {
  try {
    const response = await wc.session.fetch(url);
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
      width: 0,
      height: 0,
      dataUrl: `data:${mimeType};base64,${base64}`,
      originSrc: url,
    };
  } catch {
    return null;
  }
}

async function downloadFirstImage(wc: WebContents, urls: string[], seenOrigins: Set<string>): Promise<ExtractedImage | null> {
  for (const url of urls) {
    if (!url || seenOrigins.has(url)) {
      continue;
    }
    const image = await downloadImage(wc, url);
    if (image) {
      seenOrigins.add(url);
      return image;
    }
  }
  return null;
}

async function replayGeminiFetch(
  wc: WebContents,
  captured: CapturedGeminiRequest,
  capturedPrompt: string,
  prompt: string,
  timeoutMs: number,
  seenOrigins: Set<string>
): Promise<{ image?: ExtractedImage; error?: string }> {
  const script = buildGeminiFetchScript(captured, capturedPrompt, prompt, timeoutMs);
  const result = (await wc.executeJavaScript(script)) as WebviewFetchResult;

  if (!result?.success) {
    return {
      error: [
        result?.error || 'Gemini page fetch failed',
        result?.status ? `status=${result.status}` : '',
        result?.textSample ? `sample=${result.textSample.replace(/\s+/g, ' ').slice(0, 500)}` : '',
      ].filter(Boolean).join('; '),
    };
  }

  const image = await downloadFirstImage(wc, result.imageUrls ?? [], seenOrigins);
  if (!image) {
    const detail = result.imageUrls?.length
      ? 'Gemini page fetch returned image URLs, but download failed'
      : 'Gemini page fetch response did not include image URLs';
    return {
      error: [
        detail,
        result.status ? `status=${result.status}` : '',
        result.textSample ? `sample=${result.textSample.replace(/\s+/g, ' ').slice(0, 500)}` : '',
      ].filter(Boolean).join('; '),
    };
  }

  return { image };
}

async function generateGeminiImagesViaPageNativeFetch(
  wc: WebContents,
  options: GeminiWebFetchOptions
): Promise<GeminiWebFetchResult> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    return { success: false, error: 'prompt is required' };
  }
  if (wc.isDestroyed()) {
    return { success: false, error: 'Gemini webview is destroyed' };
  }

  const targetCount = normalizeImageCount(options.count);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const perRoundTimeoutMs = Math.max(Math.floor(timeoutMs / Math.max(1, targetCount)), FETCH_TIMEOUT_FLOOR_MS);
  const payload = {
    toolId: GEMINI_TOOL_ID,
    partition: getActivePresetPartition(),
    webContentsId: options.webContentsId,
  };

  const baseline = await getBaselineOriginSrcs(payload);
  const seenOrigins = new Set(baseline);
  const images: ExtractedImage[] = [];
  let didSendPrompt = false;
  let captured = 0;

  for (let round = 0; round < targetCount; round += 1) {
    const roundPrompt = buildRoundPrompt(prompt, targetCount, round);
    const roundBaseline = Array.from(seenOrigins);

    if (round > 0) {
      const ready = await waitForWebviewSendReady(payload, Math.min(90_000, perRoundTimeoutMs));
      if (!ready.success) {
        return {
          success: false,
          images: images.length ? sanitizeImagesForApi(images) : undefined,
          error: `Round ${round + 1}/${targetCount} send not ready: ${ready.error || 'unknown error'}`,
          captured: captured > 0,
          didSendPrompt,
          replayed: 0,
        };
      }
    }

    let transaction: CapturedGeminiTransaction | null = null;
    try {
      const result = await captureGeminiGenerateTransaction(
        wc,
        () => sendWebviewInput({
          ...payload,
          content: roundPrompt,
          referenceImage: null,
        }),
        Math.min(Math.max(perRoundTimeoutMs, CAPTURE_TIMEOUT_MS), 120_000)
      );

      const sendResult = result.triggerResult;
      if (!sendResult.success) {
        return {
          success: false,
          images: images.length ? sanitizeImagesForApi(images) : undefined,
          error: sendResult.error || `Round ${round + 1}/${targetCount} send failed`,
          captured: captured > 0,
          didSendPrompt,
          replayed: 0,
        };
      }

      didSendPrompt = true;
      transaction = result.transaction;
      captured += 1;
    } catch (error) {
      return {
        success: false,
        images: images.length ? sanitizeImagesForApi(images) : undefined,
        error: error instanceof Error ? error.message : `Round ${round + 1}/${targetCount} capture failed`,
        captured: captured > 0,
        didSendPrompt,
        replayed: 0,
      };
    }

    const imageFromResponse = transaction
      ? await downloadFirstImage(wc, extractImageUrlsFromGeminiText(transaction.responseText), seenOrigins)
      : null;

    if (imageFromResponse) {
      images.push(imageFromResponse);
      await sleep(500);
      continue;
    }

    const domImage = await waitForNewWebviewImages(payload, roundBaseline, perRoundTimeoutMs, 2000, 1);
    if (domImage.success && domImage.images[0]) {
      images.push(domImage.images[0]);
      const origin = getImageOriginSrc(domImage.images[0]);
      if (origin) {
        seenOrigins.add(origin);
      }
      await sleep(500);
      continue;
    }

    const responseSummary = summarizeGeminiResponse(transaction?.responseText);
    return {
      success: false,
      images: images.length ? sanitizeImagesForApi(images) : undefined,
      error: [
        `Round ${round + 1}/${targetCount} did not return a new image`,
        transaction?.status ? `status=${transaction.status}` : '',
        responseSummary ? `sample=${responseSummary}` : '',
        domImage.error ? `dom=${domImage.error}` : '',
      ].filter(Boolean).join('; '),
      captured: captured > 0,
      didSendPrompt,
      replayed: 0,
    };
  }

  return {
    success: images.length >= targetCount,
    images: sanitizeImagesForApi(images.slice(0, targetCount)),
    error: images.length >= targetCount ? undefined : `Only generated ${images.length}/${targetCount} images`,
    captured: captured > 0,
    didSendPrompt,
    replayed: 0,
  };
}

async function generateGeminiImagesViaReplayFetch(
  wc: WebContents,
  options: GeminiWebFetchOptions
): Promise<GeminiWebFetchResult> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    return { success: false, error: 'prompt is required' };
  }
  if (wc.isDestroyed()) {
    return { success: false, error: 'Gemini webview is destroyed' };
  }

  const targetCount = normalizeImageCount(options.count);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const perRoundTimeoutMs = Math.max(Math.floor(timeoutMs / Math.max(1, targetCount)), FETCH_TIMEOUT_FLOOR_MS);
  const payload = {
    toolId: GEMINI_TOOL_ID,
    partition: getActivePresetPartition(),
    webContentsId: options.webContentsId,
  };

  const baseline = await getBaselineOriginSrcs(payload);
  const seenOrigins = new Set(baseline);
  const images: ExtractedImage[] = [];
  let didSendPrompt = false;

  let captured: CapturedGeminiRequest;
  try {
    const capturePromise = captureNextGeminiGenerateRequest(wc);
    const firstPrompt = buildRoundPrompt(prompt, targetCount, 0);
    const sendResult = await sendWebviewInput({
      ...payload,
      content: firstPrompt,
      referenceImage: null,
    });

    if (!sendResult.success) {
      return { success: false, error: sendResult.error || 'Failed to send Gemini warmup prompt' };
    }
    didSendPrompt = true;

    captured = await capturePromise;

    const domImage = await waitForNewWebviewImages(payload, Array.from(seenOrigins), perRoundTimeoutMs, 2000, 1);
    if (domImage.success && domImage.images[0]) {
      images.push(domImage.images[0]);
      const origin = getImageOriginSrc(domImage.images[0]);
      if (origin) {
        seenOrigins.add(origin);
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture Gemini StreamGenerate request',
      captured: false,
      didSendPrompt,
    };
  }

  let replayed = 0;
  for (let round = images.length; round < targetCount; round += 1) {
    const roundPrompt = buildRoundPrompt(prompt, targetCount, round);
    try {
      const replay = await replayGeminiFetch(
        wc,
        captured,
        buildRoundPrompt(prompt, targetCount, 0),
        roundPrompt,
        perRoundTimeoutMs,
        seenOrigins
      );
      replayed += 1;
      if (!replay.image) {
        return {
          success: false,
          images: images.length ? sanitizeImagesForApi(images) : undefined,
          error: replay.error || `Gemini page fetch failed at round ${round + 1}`,
          captured: true,
          didSendPrompt,
          replayed,
        };
      }
      images.push(replay.image);
      await sleep(300);
    } catch (error) {
      return {
        success: false,
        images: images.length ? sanitizeImagesForApi(images) : undefined,
        error: error instanceof Error ? error.message : `Gemini page fetch failed at round ${round + 1}`,
        captured: true,
        didSendPrompt,
        replayed,
      };
    }
  }

  if (!images.length) {
    return {
      success: false,
      error: 'Gemini page fetch did not return images',
      captured: true,
      didSendPrompt,
      replayed,
    };
  }

  return {
    success: images.length >= targetCount,
    images: sanitizeImagesForApi(images.slice(0, targetCount)),
    error: images.length >= targetCount ? undefined : `Only generated ${images.length}/${targetCount} images`,
    captured: true,
    didSendPrompt,
    replayed,
  };
}

export async function generateGeminiImagesViaPageFetch(
  wc: WebContents,
  options: GeminiWebFetchOptions
): Promise<GeminiWebFetchResult> {
  if (process.env.AI_TOOLBOX_GEMINI_WEB_API_REPLAY === '1') {
    return generateGeminiImagesViaReplayFetch(wc, options);
  }
  return generateGeminiImagesViaPageNativeFetch(wc, options);
}
