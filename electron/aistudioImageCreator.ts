import type { WebContents } from 'electron';
import type { ExtractedImage } from '../src/types/image-gen-api.js';
import {
  AISTUDIO_TOOL_ID,
  extractImagesFromAiStudioText,
  shouldCaptureAiStudioRequest,
  summarizeAiStudioResponse,
  type AiStudioParsedImage,
} from './aistudioImageParse.js';
import { getActivePresetPartition } from './presetPartition.js';
import { sendWebviewInput, waitForWebviewSendReady } from './webviewInput.js';
import {
  getBaselineOriginSrcs,
  getImageOriginSrc,
  sanitizeImagesForApi,
  waitForNewWebviewImages,
} from './webviewExtractImages.js';

export {
  AISTUDIO_DEFAULT_MODEL,
  AISTUDIO_IMAGE_BASE_URL,
  AISTUDIO_TOOL_ID,
  buildAiStudioImageUrl,
  extractImagesFromAiStudioText,
  shouldCaptureAiStudioRequest,
} from './aistudioImageParse.js';

const CAPTURE_TIMEOUT_MS = 20_000;
const FETCH_TIMEOUT_FLOOR_MS = 30_000;

interface CapturedAiStudioTransaction {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  status?: number;
  responseText?: string;
}

export interface AiStudioWebFetchOptions {
  prompt: string;
  count?: number;
  timeoutMs?: number;
  webContentsId?: number;
  model?: string;
}

export interface AiStudioWebFetchResult {
  success: boolean;
  images?: ExtractedImage[];
  error?: string;
  captured?: boolean;
  didSendPrompt?: boolean;
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

function sanitizeCapturedHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const allowed = new Set([
    'accept',
    'content-type',
    'x-client-data',
    'x-goog-authuser',
    'x-goog-api-key',
    'x-goog-encode-response-if-executable',
    'x-same-domain',
    'authorization',
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

  return sanitized;
}

async function captureAiStudioGenerateTransaction<T>(
  wc: WebContents,
  trigger: () => Promise<T>,
  timeoutMs = CAPTURE_TIMEOUT_MS
): Promise<{ transaction: CapturedAiStudioTransaction; triggerResult: T }> {
  if (wc.isDestroyed()) {
    throw new Error('AI Studio webview is destroyed');
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
    let captured: CapturedAiStudioTransaction | null = null;

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
      finish(() => reject(new Error('Timed out while capturing AI Studio image response')));
    }, timeoutMs);

    const maybeResolve = () => {
      if (captured?.responseText !== undefined && triggerResult !== undefined) {
        finish(() =>
          resolve({
            transaction: captured as CapturedAiStudioTransaction,
            triggerResult: triggerResult as T,
          })
        );
      }
    };

    const onMessage = async (_event: unknown, method: string, params?: any) => {
      if (method === 'Network.requestWillBeSent') {
        const request = params?.request;
        const url = typeof request?.url === 'string' ? request.url : '';
        if (!shouldCaptureAiStudioRequest(url) || targetRequestId) {
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
          captured.responseText =
            body.base64Encoded && body.body
              ? Buffer.from(body.body, 'base64').toString('utf8')
              : body.body || '';
        } catch {
          captured.responseText = '';
        }
        maybeResolve();
        return;
      }

      if (method === 'Network.loadingFailed' && params?.requestId === targetRequestId) {
        finish(() => reject(new Error(params?.errorText || 'AI Studio image request failed')));
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

function imageFromInline(parsed: AiStudioParsedImage): ExtractedImage | null {
  if (!parsed.base64) {
    return null;
  }
  const mimeType = parsed.mimeType || 'image/png';
  return {
    base64: parsed.base64,
    mimeType,
    width: 0,
    height: 0,
    dataUrl: `data:${mimeType};base64,${parsed.base64}`,
    originSrc: `inline:${parsed.base64.slice(0, 48)}`,
  };
}

async function materializeFirstImage(
  wc: WebContents,
  parsedImages: AiStudioParsedImage[],
  seenOrigins: Set<string>
): Promise<ExtractedImage | null> {
  for (const parsed of parsedImages) {
    if (parsed.base64) {
      const image = imageFromInline(parsed);
      if (image?.originSrc && !seenOrigins.has(image.originSrc)) {
        seenOrigins.add(image.originSrc);
        return image;
      }
      continue;
    }

    if (!parsed.url || seenOrigins.has(parsed.url)) {
      continue;
    }
    const image = await downloadImage(wc, parsed.url);
    if (image) {
      seenOrigins.add(parsed.url);
      return image;
    }
  }
  return null;
}

export async function generateAiStudioImagesViaPageFetch(
  wc: WebContents,
  options: AiStudioWebFetchOptions
): Promise<AiStudioWebFetchResult> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    return { success: false, error: 'prompt is required' };
  }
  if (wc.isDestroyed()) {
    return { success: false, error: 'AI Studio webview is destroyed' };
  }

  const targetCount = normalizeImageCount(options.count);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const perRoundTimeoutMs = Math.max(Math.floor(timeoutMs / Math.max(1, targetCount)), FETCH_TIMEOUT_FLOOR_MS);
  const payload = {
    toolId: AISTUDIO_TOOL_ID,
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
        };
      }
    }

    let transaction: CapturedAiStudioTransaction | null = null;
    try {
      const result = await captureAiStudioGenerateTransaction(
        wc,
        () =>
          sendWebviewInput({
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
      };
    }

    const imageFromResponse = transaction
      ? await materializeFirstImage(
          wc,
          extractImagesFromAiStudioText(transaction.responseText),
          seenOrigins
        )
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

    const responseSummary = summarizeAiStudioResponse(transaction?.responseText);
    return {
      success: false,
      images: images.length ? sanitizeImagesForApi(images) : undefined,
      error: [
        `Round ${round + 1}/${targetCount} did not return a new image`,
        transaction?.status ? `status=${transaction.status}` : '',
        transaction?.url ? `url=${transaction.url}` : '',
        responseSummary ? `sample=${responseSummary}` : '',
        domImage.error ? `dom=${domImage.error}` : '',
      ]
        .filter(Boolean)
        .join('; '),
      captured: captured > 0,
      didSendPrompt,
    };
  }

  return {
    success: images.length >= targetCount,
    images: sanitizeImagesForApi(images.slice(0, targetCount)),
    error: images.length >= targetCount ? undefined : `Only generated ${images.length}/${targetCount} images`,
    captured: captured > 0,
    didSendPrompt,
  };
}
