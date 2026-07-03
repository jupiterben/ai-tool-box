import type { WebContents } from 'electron';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import type { ExtractedImage } from '../src/types/image-gen-api.js';
import { getToolPartition } from '../src/utils/toolPartition.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

export interface ExtractWebviewImagesPayload {
  toolId: string;
  webContentsId?: number;
}

export interface ExtractWebviewImagesResult {
  success: boolean;
  images: ExtractedImage[];
  error?: string;
}

interface DetectedImageOrigin {
  originSrc: string;
  width: number;
  height: number;
  alt?: string;
}

function getImageOriginSrc(image: ExtractedImage): string {
  return image.originSrc || image.dataUrl || '';
}

export function sanitizeImagesForApi(images: ExtractedImage[]): ExtractedImage[] {
  return images.map(({ originSrc: _originSrc, ...rest }) => rest);
}

async function findWebContents(payload: ExtractWebviewImagesPayload) {
  const handler = getSiteHandler(payload.toolId);
  if (!handler) {
    return { handler: null, wc: null, error: `未找到站点 handler: ${payload.toolId}` };
  }

  const partition = getToolPartition(payload.toolId);
  const wc = findToolWebContents(
    partition,
    payload.webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { handler, wc: null, error: '未找到 webview' };
  }

  return { handler, wc, error: undefined };
}

async function detectImageOrigins(
  payload: ExtractWebviewImagesPayload
): Promise<{ origins: DetectedImageOrigin[]; error?: string }> {
  const { handler, wc, error } = await findWebContents(payload);
  if (!handler || !wc) {
    return { origins: [], error };
  }

  try {
    const script = handler.buildDetectImageOriginsScript();
    const result = (await wc.executeJavaScript(script)) as DetectedImageOrigin[];
    return { origins: Array.isArray(result) ? result : [] };
  } catch (err) {
    return {
      origins: [],
      error: err instanceof Error ? err.message : '检测图片失败',
    };
  }
}

async function fetchImageViaSession(
  wc: WebContents,
  originSrc: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await wc.session.fetch(originSrc);
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

    return {
      base64: buffer.toString('base64'),
      mimeType,
    };
  } catch {
    return null;
  }
}

async function convertOriginsViaSession(
  wc: WebContents,
  items: DetectedImageOrigin[]
): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];

  for (const item of items) {
    const fetched = await fetchImageViaSession(wc, item.originSrc);
    if (!fetched) {
      continue;
    }

    images.push({
      base64: fetched.base64,
      mimeType: fetched.mimeType,
      width: item.width,
      height: item.height,
      alt: item.alt,
      dataUrl: `data:${fetched.mimeType};base64,${fetched.base64}`,
      originSrc: item.originSrc,
    });
  }

  return images;
}

async function convertImageOrigins(
  payload: ExtractWebviewImagesPayload,
  originSrcs: string[]
): Promise<ExtractWebviewImagesResult> {
  if (!originSrcs.length) {
    return { success: false, images: [], error: '没有可转换的图片' };
  }

  const { handler, wc, error } = await findWebContents(payload);
  if (!handler || !wc) {
    return { success: false, images: [], error };
  }

  const originSet = new Set(originSrcs);

  try {
    const script = handler.buildConvertImagesScript(originSrcs);
    const result = (await wc.executeJavaScript(script)) as {
      success?: boolean;
      images?: ExtractedImage[];
      error?: string;
    };

    const images = (result?.images ?? []).filter((img) => img.base64);
    if (images.length > 0) {
      return { success: true, images };
    }

    const detected = await detectImageOrigins(payload);
    const targets = detected.origins.filter((item) => originSet.has(item.originSrc));
    const sessionImages = await convertOriginsViaSession(wc, targets);

    return {
      success: sessionImages.length > 0,
      images: sessionImages,
      error: sessionImages.length ? undefined : result?.error || '图片 base64 转换失败',
    };
  } catch (err) {
    const detected = await detectImageOrigins(payload);
    const targets = detected.origins.filter((item) => originSet.has(item.originSrc));
    const sessionImages = await convertOriginsViaSession(wc, targets);

    if (sessionImages.length > 0) {
      return { success: true, images: sessionImages };
    }

    return {
      success: false,
      images: [],
      error: err instanceof Error ? err.message : '图片 base64 转换失败',
    };
  }
}

export async function getBaselineOriginSrcs(
  payload: ExtractWebviewImagesPayload
): Promise<string[]> {
  const detected = await detectImageOrigins(payload);
  return detected.origins.map((item) => item.originSrc).filter(Boolean);
}

export async function extractWebviewImages(
  payload: ExtractWebviewImagesPayload
): Promise<ExtractWebviewImagesResult> {
  const detected = await detectImageOrigins(payload);
  if (detected.error && !detected.origins.length) {
    return { success: false, images: [], error: detected.error };
  }

  return convertImageOrigins(
    payload,
    detected.origins.map((item) => item.originSrc)
  );
}

export async function waitForNewWebviewImages(
  payload: ExtractWebviewImagesPayload,
  baselineOriginSrcs: string[],
  timeoutMs: number,
  pollIntervalMs = 2000,
  targetCount = 1
): Promise<ExtractWebviewImagesResult> {
  const baseline = new Set(baselineOriginSrcs);
  const collectedOrigins: string[] = [];
  const collectedSet = new Set<string>();
  const deadline = Date.now() + timeoutMs;
  const goal = Math.max(1, targetCount);

  while (Date.now() < deadline) {
    const detected = await detectImageOrigins(payload);
    for (const item of detected.origins) {
      const originSrc = item.originSrc;
      if (!originSrc || baseline.has(originSrc) || collectedSet.has(originSrc)) {
        continue;
      }
      collectedSet.add(originSrc);
      collectedOrigins.push(originSrc);
    }

    if (collectedOrigins.length >= goal) {
      const converted = await convertImageOrigins(payload, collectedOrigins.slice(0, goal));
      if (converted.success) {
        return converted;
      }
    } else if (collectedOrigins.length > 0 && goal === 1) {
      const converted = await convertImageOrigins(payload, collectedOrigins);
      if (converted.success) {
        return converted;
      }
    }

    await sleep(pollIntervalMs);
  }

  if (collectedOrigins.length > 0) {
    const converted = await convertImageOrigins(payload, collectedOrigins);
    if (converted.success) {
      return converted;
    }
  }

  return { success: false, images: [], error: '生图超时，未检测到新图片' };
}

export { getImageOriginSrc };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
