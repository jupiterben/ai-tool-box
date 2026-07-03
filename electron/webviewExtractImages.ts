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

  try {
    const script = handler.buildConvertImagesScript(originSrcs);
    const result = (await wc.executeJavaScript(script)) as {
      success?: boolean;
      images?: ExtractedImage[];
      error?: string;
    };

    const images = (result?.images ?? []).filter((img) => img.base64);
    return {
      success: images.length > 0,
      images,
      error: images.length ? undefined : result?.error || '图片 base64 转换失败',
    };
  } catch (err) {
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
  pollIntervalMs = 2000
): Promise<ExtractWebviewImagesResult> {
  const baseline = new Set(baselineOriginSrcs);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const detected = await detectImageOrigins(payload);
    const freshOrigins = detected.origins
      .map((item) => item.originSrc)
      .filter((originSrc) => originSrc && !baseline.has(originSrc));

    if (freshOrigins.length > 0) {
      const converted = await convertImageOrigins(payload, freshOrigins);
      if (converted.success) {
        return converted;
      }
    }

    await sleep(pollIntervalMs);
  }

  return { success: false, images: [], error: '生图超时，未检测到新图片' };
}

export { getImageOriginSrc };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
