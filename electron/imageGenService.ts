import type { BrowserWindow } from 'electron';
import { IMAGE_HANDLERS } from '../src/webview-handlers/sites/image.js';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import {
  IMAGE_GEN_API_DEFAULT_TOOL_ID,
  type ExtractedImage,
  type GenImageRequest,
  type GenImageResult,
} from '../src/types/image-gen-api.js';
import { getToolPartition } from '../src/utils/toolPartition.js';
import { sendWebviewInput } from './webviewInput.js';
import {
  getBaselineOriginSrcs,
  getImageOriginSrc,
  sanitizeImagesForApi,
  waitForNewWebviewImages,
} from './webviewExtractImages.js';
import { requestEnsureImageWebview } from './imageGenBridge.js';
import { normalizeReferenceImageInput } from './imageGenRequestParser.js';
import { generateBingImagesViaWebviewFetch } from './bingImageCreator.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';
import { resetImageWebviewForApi } from './webviewReset.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_IMAGE_COUNT = 8;

function normalizeImageCount(count?: number): number {
  if (count == null || !Number.isFinite(count)) {
    return 1;
  }
  return Math.min(Math.max(1, Math.floor(count)), MAX_IMAGE_COUNT);
}

function buildRoundPrompt(prompt: string, count: number, round: number): string {
  if (count <= 1 || round === 0) {
    return prompt;
  }
  return `${prompt} (variation ${round + 1} of ${count})`;
}

function isImageToolId(toolId: string): boolean {
  return toolId === 'bing-create' || toolId in IMAGE_HANDLERS;
}

async function generateViaWebviewDom(
  toolId: string,
  prompt: string,
  webContentsId: number | undefined,
  referenceImage: GenImageRequest['referenceImage'],
  timeoutMs: number,
  count = 1
): Promise<GenImageResult> {
  const targetCount = normalizeImageCount(count);
  const extractPayload = { toolId, webContentsId };
  const seenOrigins = new Set(await getBaselineOriginSrcs(extractPayload));
  const allImages: ExtractedImage[] = [];
  // Gemini 等站点一次只出 1 张，按 count 循环发送
  const perRoundTimeout = Math.max(Math.floor(timeoutMs / targetCount), 30_000);

  for (let round = 0; round < targetCount && allImages.length < targetCount; round += 1) {
    const roundPrompt = buildRoundPrompt(prompt, targetCount, round);
    const baselineOriginSrcs = Array.from(seenOrigins);

    const sendResult = await sendWebviewInput({
      toolId,
      partition: getToolPartition(toolId),
      content: roundPrompt,
      referenceImage: round === 0 ? referenceImage : null,
      webContentsId,
    });

    if (!sendResult.success) {
      if (allImages.length > 0) {
        break;
      }
      return {
        success: false,
        toolId,
        prompt,
        error: sendResult.error || '发送 prompt 失败',
      };
    }

    const waitResult = await waitForNewWebviewImages(
      extractPayload,
      baselineOriginSrcs,
      perRoundTimeout,
      2000,
      1
    );

    if (!waitResult.success) {
      if (allImages.length === 0) {
        return {
          success: false,
          toolId,
          prompt,
          error: waitResult.error || '未获取到生成图片',
        };
      }
      break;
    }

    for (const image of waitResult.images) {
      const origin = getImageOriginSrc(image);
      if (origin && seenOrigins.has(origin)) {
        continue;
      }
      if (origin) {
        seenOrigins.add(origin);
      }
      allImages.push(image);
      if (allImages.length >= targetCount) {
        break;
      }
    }
  }

  if (!allImages.length) {
    return {
      success: false,
      toolId,
      prompt,
      error: '未获取到生成图片',
    };
  }

  const images = sanitizeImagesForApi(allImages.slice(0, targetCount));

  return {
    success: true,
    toolId,
    prompt,
    images,
    via: 'webview-dom',
  };
}

async function generateBingViaInternalApi(
  prompt: string,
  webContentsId: number | undefined,
  timeoutMs: number,
  bing?: GenImageRequest['bing']
): Promise<GenImageResult> {
  const handler = getSiteHandler('bing-create');
  if (!handler) {
    return { success: false, error: '未找到 bing-create handler' };
  }

  const wc = findToolWebContents(
    getToolPartition('bing-create'),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: '未找到 Bing webview，无法读取登录态' };
  }

  const apiResult = await generateBingImagesViaWebviewFetch(wc, {
    prompt,
    timeoutMs,
    model: bing?.model,
    aspectRatio: bing?.aspectRatio,
    mdl: bing?.mdl,
    ar: bing?.ar,
  });

  if (!apiResult.success || !apiResult.images?.length) {
    return {
      success: false,
      toolId: 'bing-create',
      prompt,
      error: apiResult.error || 'Bing API 生图失败',
    };
  }

  return {
    success: true,
    toolId: 'bing-create',
    prompt,
    images: sanitizeImagesForApi(apiResult.images),
  };
}

function sliceImages(images: ExtractedImage[], count?: number): ExtractedImage[] {
  const limit = normalizeImageCount(count);
  return images.slice(0, limit);
}

export async function generateImageViaWebview(
  mainWindow: BrowserWindow | null,
  request: GenImageRequest
): Promise<GenImageResult> {
  let referenceImage: GenImageRequest['referenceImage'] = null;
  if (request.referenceImage) {
    try {
      referenceImage = normalizeReferenceImageInput(request.referenceImage);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '参考图无效',
      };
    }
  }

  const prompt = request.prompt?.trim() || (referenceImage ? '基于参考图生成' : '');

  if (!prompt && !referenceImage) {
    return { success: false, error: 'prompt 与 referenceImage 至少提供一个' };
  }

  const toolId = request.toolId?.trim() || IMAGE_GEN_API_DEFAULT_TOOL_ID;
  if (!isImageToolId(toolId)) {
    return { success: false, error: `不支持的生图工具: ${toolId}` };
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const count = normalizeImageCount(request.count);

  let webContentsId: number | undefined;
  try {
    const ensured = await requestEnsureImageWebview(mainWindow, toolId);
    webContentsId = ensured.webContentsId;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'webview 未就绪',
    };
  }

  const resetResult = await resetImageWebviewForApi(toolId, webContentsId);
  if (!resetResult.success) {
    return {
      success: false,
      toolId,
      prompt,
      error: resetResult.error || '重置生图页失败',
    };
  }

  // Bing：优先走内部 HTTP API（复用 webview cookie），失败再回退 DOM 模拟
  if (toolId === 'bing-create' && !referenceImage) {
    const apiResult = await generateBingViaInternalApi(prompt, webContentsId, timeoutMs, request.bing);
    if (apiResult.success) {
      console.log('[imageGenService] Bing via=web-api');
      return {
        ...apiResult,
        via: 'web-api',
        images: sliceImages(apiResult.images ?? [], count),
      };
    }
    console.warn('[imageGenService] Bing API 失败，回退 webview DOM:', apiResult.error);
    const domResult = await generateViaWebviewDom(
      toolId,
      prompt,
      webContentsId,
      referenceImage,
      timeoutMs,
      count
    );
    return { ...domResult, apiError: apiResult.error };
  }

  return generateViaWebviewDom(toolId, prompt, webContentsId, referenceImage, timeoutMs, count);
}
