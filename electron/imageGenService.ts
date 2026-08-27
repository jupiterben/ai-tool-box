import type { BrowserWindow } from 'electron';
import { IMAGE_HANDLERS } from '../src/webview-handlers/sites/image.js';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import {
  IMAGE_GEN_API_DEFAULT_TOOL_ID,
  type ExtractedImage,
  type GenImageRequest,
  type GenImageResult,
} from '../src/types/image-gen-api.js';
import { getActivePresetPartition } from './presetPartition.js';
import { sendWebviewInput, waitForWebviewSendReady } from './webviewInput.js';
import {
  getBaselineOriginSrcs,
  getImageOriginSrc,
  sanitizeImagesForApi,
  waitForNewWebviewImages,
} from './webviewExtractImages.js';
import { requestEnsureImageWebview } from './imageGenBridge.js';
import { normalizeReferenceImageInput } from './imageGenRequestParser.js';
import { generateBingImagesViaWebviewFetch, resolveBingApiParams } from './bingImageCreator.js';
import { generateGeminiImagesViaPageFetch } from './geminiImageCreator.js';
import { generateAiStudioImagesViaPageFetch } from './aistudioImageCreator.js';
import { buildAiStudioImageUrl } from './aistudioImageParse.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';
import { resetImageWebviewForApi } from './webviewReset.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_IMAGE_COUNT = 8;
const SEND_RETRY_COUNT = 3;
const SEND_READY_TIMEOUT_MS = 90_000;

export type ImageGenProgressEvent =
  | { type: 'start'; toolId: string; prompt: string; count: number; timeoutMs: number }
  | {
      type:
        | 'webview_ready'
        | 'reset_start'
        | 'reset_done'
        | 'round_start'
        | 'send_ready'
        | 'send_retry'
        | 'send_done'
        | 'wait_image'
        | 'image'
        | 'bing_api_start'
        | 'bing_api_done'
        | 'bing_api_fallback'
        | 'gemini_web_api_start'
        | 'gemini_web_api_done'
        | 'gemini_web_api_fallback'
        | 'aistudio_web_api_start'
        | 'aistudio_web_api_done'
        | 'aistudio_web_api_fallback';
      toolId: string;
      prompt?: string;
      round?: number;
      totalRounds?: number;
      attempt?: number;
      image?: ExtractedImage;
      webContentsId?: number;
      apiError?: string;
      via?: GenImageResult['via'];
      message?: string;
    };

export interface GenerateImageOptions {
  onProgress?: (event: ImageGenProgressEvent) => void;
  threadId?: string;
}

type GeminiPageFetchGenImageResult = GenImageResult & {
  didSendPrompt?: boolean;
};

type AiStudioPageFetchGenImageResult = GenImageResult & {
  didSendPrompt?: boolean;
};

function emitProgress(options: GenerateImageOptions | undefined, event: ImageGenProgressEvent): void {
  try {
    options?.onProgress?.(event);
  } catch (error) {
    console.warn('[imageGenService] progress callback failed:', error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

interface RoundContext {
  toolId: string;
  webContentsId: number | undefined;
  referenceImage: GenImageRequest['referenceImage'];
  perRoundTimeoutMs: number;
  roundIndex: number;
  totalRounds: number;
}

interface RoundResult {
  success: boolean;
  image?: ExtractedImage;
  error?: string;
}

/** 单轮：等待可发送 -> 发送一条 prompt -> 等待一张新图 */
async function generateImageRound(
  context: RoundContext,
  prompt: string,
  seenOrigins: Set<string>,
  options?: GenerateImageOptions
): Promise<RoundResult> {
  const { toolId, webContentsId, referenceImage, perRoundTimeoutMs, roundIndex, totalRounds } = context;
  const sendPayload = {
    toolId,
    partition: getActivePresetPartition(),
    content: prompt,
    referenceImage: roundIndex === 0 ? referenceImage : null,
    webContentsId,
  };
  emitProgress(options, {
    type: 'round_start',
    toolId,
    prompt,
    round: roundIndex + 1,
    totalRounds,
    message: `Round ${roundIndex + 1}/${totalRounds} started`,
  });

  console.log(`[imageGenService] 第 ${roundIndex + 1}/${totalRounds} 轮发送 prompt`);

  // 1. 等待输入框/发送按钮就绪（第一轮通常已就绪，后续等上一轮生图完成）
  if (roundIndex > 0) {
    const readyResult = await waitForWebviewSendReady(sendPayload, SEND_READY_TIMEOUT_MS);
    if (!readyResult.success) {
      console.warn(
        `[imageGenService] 第 ${roundIndex + 1}/${totalRounds} 轮等待发送就绪失败:`,
        readyResult.error
      );
      return { success: false, error: readyResult.error || '等待发送就绪失败' };
    }
  }

  // 2. 发送 prompt，带重试
  let lastSendError = '发送 prompt 失败';
  if (roundIndex > 0) {
    emitProgress(options, {
      type: 'send_ready',
      toolId,
      round: roundIndex + 1,
      totalRounds,
      message: 'Send input is ready',
    });
  }

  let sent = false;
  for (let attempt = 0; attempt < SEND_RETRY_COUNT && !sent; attempt += 1) {
    if (attempt > 0) {
      console.warn(
        `[imageGenService] 第 ${roundIndex + 1}/${totalRounds} 轮发送重试 ${attempt + 1}/${SEND_RETRY_COUNT}`
      );
      emitProgress(options, {
        type: 'send_retry',
        toolId,
        round: roundIndex + 1,
        totalRounds,
        attempt: attempt + 1,
        message: `Retrying send (${attempt + 1}/${SEND_RETRY_COUNT})`,
      });
      const readyResult = await waitForWebviewSendReady(sendPayload, 30_000);
      if (!readyResult.success) {
        lastSendError = readyResult.error || lastSendError;
        continue;
      }
    }

    const sendResult = await sendWebviewInput(sendPayload);
    if (sendResult.success) {
      sent = true;
    } else {
      lastSendError = sendResult.error || lastSendError;
    }
  }

  if (!sent) {
    console.warn(
      `[imageGenService] 第 ${roundIndex + 1}/${totalRounds} 轮发送失败:`,
      lastSendError
    );
    return { success: false, error: lastSendError };
  }

  // 3. 等待本轮产生一张新图
  const baselineOriginSrcs = Array.from(seenOrigins);
  emitProgress(options, {
    type: 'send_done',
    toolId,
    round: roundIndex + 1,
    totalRounds,
    message: 'Prompt sent',
  });

  emitProgress(options, {
    type: 'wait_image',
    toolId,
    round: roundIndex + 1,
    totalRounds,
    message: 'Waiting for generated image',
  });

  const waitResult = await waitForNewWebviewImages(
    { toolId, webContentsId },
    baselineOriginSrcs,
    perRoundTimeoutMs,
    2000,
    1
  );

  if (!waitResult.success || !waitResult.images.length) {
    console.warn(
      `[imageGenService] 第 ${roundIndex + 1}/${totalRounds} 轮等图失败:`,
      waitResult.error || '无图片'
    );
    return { success: false, error: waitResult.error || '未获取到生成图片' };
  }

  await sleep(800);

  const newImage = waitResult.images[0];
  const origin = getImageOriginSrc(newImage);
  if (origin && !seenOrigins.has(origin)) {
    seenOrigins.add(origin);
  }
  emitProgress(options, {
    type: 'image',
    toolId,
    round: roundIndex + 1,
    totalRounds,
    image: sanitizeImagesForApi([newImage])[0],
    message: 'Image generated',
  });

  return { success: true, image: newImage };
}

async function generateViaWebviewDom(
  toolId: string,
  prompt: string,
  webContentsId: number | undefined,
  referenceImage: GenImageRequest['referenceImage'],
  timeoutMs: number,
  count = 1,
  options?: GenerateImageOptions
): Promise<GenImageResult> {
  const targetCount = normalizeImageCount(count);
  const extractPayload = { toolId, webContentsId };
  const seenOrigins = new Set(await getBaselineOriginSrcs(extractPayload));
  const allImages: ExtractedImage[] = [];

  // Gemini 等站点一次只出 1 张，按 count 固定轮次发送
  const perRoundTimeout = Math.max(Math.floor(timeoutMs / targetCount), 30_000);
  const roundContext: RoundContext = {
    toolId,
    webContentsId,
    referenceImage,
    perRoundTimeoutMs: perRoundTimeout,
    roundIndex: 0,
    totalRounds: targetCount,
  };

  for (let round = 0; round < targetCount; round += 1) {
    roundContext.roundIndex = round;
    const roundPrompt = buildRoundPrompt(prompt, targetCount, round);

    const roundResult = await generateImageRound(roundContext, roundPrompt, seenOrigins, options);

    if (!roundResult.success || !roundResult.image) {
      return {
        success: false,
        toolId,
        prompt,
        images: allImages.length ? sanitizeImagesForApi(allImages) : undefined,
        via: 'webview-dom',
        error: `Round ${round + 1}/${targetCount} failed: ${roundResult.error || 'image generation failed'}`,
      };
      if (allImages.length > 0) {
        // 已有部分成果，中断并返回已收集的图
        break;
      }
      return {
        success: false,
        toolId,
        prompt,
        error: roundResult.error || '生图失败',
      };
    }

    allImages.push(roundResult.image);

    if (allImages.length >= targetCount) {
      break;
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
  bing?: GenImageRequest['bing'],
  options?: GenerateImageOptions
): Promise<GenImageResult> {
  const handler = getSiteHandler('bing-create');
  if (!handler) {
    return { success: false, error: '未找到 bing-create handler' };
  }

  const wc = findToolWebContents(
    getActivePresetPartition(),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: '未找到 Bing webview，无法读取登录态' };
  }

  emitProgress(options, {
    type: 'bing_api_start',
    toolId: 'bing-create',
    prompt,
    webContentsId,
    via: 'web-api',
    message: 'Calling Bing internal image API',
  });

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

  emitProgress(options, {
    type: 'bing_api_done',
    toolId: 'bing-create',
    prompt,
    via: 'web-api',
    message: 'Bing internal image API completed',
  });

  return {
    success: true,
    toolId: 'bing-create',
    prompt,
    images: sanitizeImagesForApi(apiResult.images),
  };
}

function shouldUseBingInternalApi(bing?: GenImageRequest['bing']): boolean {
  if (bing?.mode === 'dom' || bing?.preferWebApi === false) {
    return false;
  }
  return true;
}

function shouldUseGeminiPageFetch(gemini?: GenImageRequest['gemini']): boolean {
  if (gemini?.mode === 'dom' || gemini?.preferWebApi === false) {
    return false;
  }
  if (gemini?.mode === 'web-api' || gemini?.preferWebApi) {
    return true;
  }
  return process.env.AI_TOOLBOX_GEMINI_WEB_API !== '0';
}

function shouldUseAiStudioPageFetch(aistudio?: GenImageRequest['aistudio']): boolean {
  if (aistudio?.mode === 'dom' || aistudio?.preferWebApi === false) {
    return false;
  }
  if (aistudio?.mode === 'web-api' || aistudio?.preferWebApi) {
    return true;
  }
  return process.env.AI_TOOLBOX_AISTUDIO_WEB_API !== '0';
}

async function generateAiStudioViaPageFetch(
  prompt: string,
  webContentsId: number | undefined,
  timeoutMs: number,
  count: number,
  options?: GenerateImageOptions
): Promise<AiStudioPageFetchGenImageResult> {
  const handler = getSiteHandler('aistudio-image');
  if (!handler) {
    return { success: false, error: 'aistudio-image handler not found' };
  }

  const wc = findToolWebContents(
    getActivePresetPartition(),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: 'AI Studio webview not found' };
  }

  emitProgress(options, {
    type: 'aistudio_web_api_start',
    toolId: 'aistudio-image',
    prompt,
    webContentsId,
    via: 'web-api',
    message: 'Capturing AI Studio Imagen request and extracting images',
  });

  const apiResult = await generateAiStudioImagesViaPageFetch(wc, {
    prompt,
    timeoutMs,
    count,
    webContentsId,
  });

  if (!apiResult.success || !apiResult.images?.length) {
    return {
      success: false,
      toolId: 'aistudio-image',
      prompt,
      images: apiResult.images,
      via: 'web-api',
      error: apiResult.error || 'AI Studio page fetch failed',
      didSendPrompt: apiResult.didSendPrompt,
    };
  }

  emitProgress(options, {
    type: 'aistudio_web_api_done',
    toolId: 'aistudio-image',
    prompt,
    via: 'web-api',
    message: 'AI Studio page fetch completed',
  });

  return {
    success: true,
    toolId: 'aistudio-image',
    prompt,
    images: apiResult.images,
    via: 'web-api',
    didSendPrompt: apiResult.didSendPrompt,
  };
}

async function generateGeminiViaPageFetch(
  prompt: string,
  webContentsId: number | undefined,
  timeoutMs: number,
  count: number,
  options?: GenerateImageOptions
): Promise<GeminiPageFetchGenImageResult> {
  const handler = getSiteHandler('gemini-image');
  if (!handler) {
    return { success: false, error: 'gemini-image handler not found' };
  }

  const wc = findToolWebContents(
    getActivePresetPartition(),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: 'Gemini webview not found' };
  }

  emitProgress(options, {
    type: 'gemini_web_api_start',
    toolId: 'gemini-image',
    prompt,
    webContentsId,
    via: 'web-api',
    message: 'Capturing Gemini StreamGenerate and replaying with page fetch',
  });

  const apiResult = await generateGeminiImagesViaPageFetch(wc, {
    prompt,
    timeoutMs,
    count,
    webContentsId,
  });

  if (!apiResult.success || !apiResult.images?.length) {
    return {
      success: false,
      toolId: 'gemini-image',
      prompt,
      images: apiResult.images,
      via: 'web-api',
      error: apiResult.error || 'Gemini page fetch failed',
      didSendPrompt: apiResult.didSendPrompt,
    };
  }

  emitProgress(options, {
    type: 'gemini_web_api_done',
    toolId: 'gemini-image',
    prompt,
    via: 'web-api',
    message: 'Gemini page fetch completed',
  });

  return {
    success: true,
    toolId: 'gemini-image',
    prompt,
    images: apiResult.images,
    via: 'web-api',
    didSendPrompt: apiResult.didSendPrompt,
  };
}

function sliceImages(images: ExtractedImage[], count?: number): ExtractedImage[] {
  const limit = normalizeImageCount(count);
  return images.slice(0, limit);
}

export async function generateImageViaWebview(
  mainWindow: BrowserWindow | null,
  request: GenImageRequest,
  options: GenerateImageOptions = {}
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

  if (toolId === 'bing-create') {
    try {
      resolveBingApiParams(request.bing ?? {});
    } catch (error) {
      return {
        success: false,
        toolId,
        prompt,
        error: error instanceof Error ? error.message : 'Bing 参数无效',
      };
    }
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const count = normalizeImageCount(request.count);
  emitProgress(options, { type: 'start', toolId, prompt, count, timeoutMs });

  let webContentsId: number | undefined;
  try {
    const ensured = await requestEnsureImageWebview(mainWindow, toolId, options.threadId);
    webContentsId = ensured.webContentsId;
    emitProgress(options, {
      type: 'webview_ready',
      toolId,
      prompt,
      webContentsId,
      message: 'Webview is ready',
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'webview 未就绪',
    };
  }

  emitProgress(options, {
    type: 'reset_start',
    toolId,
    prompt,
    webContentsId,
    message: 'Resetting image webview',
  });
  const resetResult = await resetImageWebviewForApi(
    toolId,
    webContentsId,
    toolId === 'aistudio-image'
      ? { url: buildAiStudioImageUrl(request.aistudio?.model) }
      : undefined
  );
  if (!resetResult.success) {
    return {
      success: false,
      toolId,
      prompt,
      error: resetResult.error || '重置生图页失败',
    };
  }

  // Bing：优先走内部 HTTP API（复用 webview cookie），失败再回退 DOM 模拟
  emitProgress(options, {
    type: 'reset_done',
    toolId,
    prompt,
    webContentsId,
    message: 'Image webview reset',
  });

  if (toolId === 'bing-create' && !referenceImage && shouldUseBingInternalApi(request.bing)) {
    const apiResult = await generateBingViaInternalApi(prompt, webContentsId, timeoutMs, request.bing, options);
    if (apiResult.success) {
      console.log('[imageGenService] Bing via=web-api');
      const result: GenImageResult = {
        ...apiResult,
        via: 'web-api',
        images: sliceImages(apiResult.images ?? [], count),
      };
      for (const [index, image] of (result.images ?? []).entries()) {
        emitProgress(options, {
          type: 'image',
          toolId,
          round: index + 1,
          totalRounds: result.images?.length,
          image,
          via: 'web-api',
          message: 'Image generated',
        });
      }
      return result;
    }
    console.warn('[imageGenService] Bing API 失败，回退 webview DOM:', apiResult.error);
    emitProgress(options, {
      type: 'bing_api_fallback',
      toolId,
      prompt,
      apiError: apiResult.error,
      via: 'webview-dom',
      message: 'Bing internal API failed, falling back to webview DOM',
    });
    const domResult = await generateViaWebviewDom(
      toolId,
      prompt,
      webContentsId,
      referenceImage,
      timeoutMs,
      count,
      options
    );
    return { ...domResult, apiError: apiResult.error };
  }

  if (toolId === 'bing-create' && !referenceImage) {
    return generateViaWebviewDom(toolId, prompt, webContentsId, referenceImage, timeoutMs, count, options);
  }

  if (toolId === 'gemini-image' && !referenceImage && shouldUseGeminiPageFetch(request.gemini)) {
    const apiResult = await generateGeminiViaPageFetch(prompt, webContentsId, timeoutMs, count, options);
    if (apiResult.success) {
      for (const [index, image] of (apiResult.images ?? []).entries()) {
        emitProgress(options, {
          type: 'image',
          toolId,
          round: index + 1,
          totalRounds: apiResult.images?.length,
          image,
          via: 'web-api',
          message: 'Image generated',
        });
      }
      return apiResult;
    }

    if (apiResult.images?.length) {
      return apiResult;
    }

    if (apiResult.didSendPrompt) {
      return apiResult;
    }

    console.warn('[imageGenService] Gemini page fetch failed, falling back to webview DOM:', apiResult.error);
    emitProgress(options, {
      type: 'gemini_web_api_fallback',
      toolId,
      prompt,
      apiError: apiResult.error,
      via: 'webview-dom',
      message: 'Gemini page fetch failed, falling back to webview DOM',
    });
    const domResult = await generateViaWebviewDom(
      toolId,
      prompt,
      webContentsId,
      referenceImage,
      timeoutMs,
      count,
      options
    );
    return { ...domResult, apiError: apiResult.error };
  }

  if (toolId === 'aistudio-image' && !referenceImage && shouldUseAiStudioPageFetch(request.aistudio)) {
    const apiResult = await generateAiStudioViaPageFetch(prompt, webContentsId, timeoutMs, count, options);
    if (apiResult.success) {
      for (const [index, image] of (apiResult.images ?? []).entries()) {
        emitProgress(options, {
          type: 'image',
          toolId,
          round: index + 1,
          totalRounds: apiResult.images?.length,
          image,
          via: 'web-api',
          message: 'Image generated',
        });
      }
      return apiResult;
    }

    if (apiResult.images?.length) {
      return apiResult;
    }

    if (apiResult.didSendPrompt) {
      return apiResult;
    }

    console.warn('[imageGenService] AI Studio page fetch failed, falling back to webview DOM:', apiResult.error);
    emitProgress(options, {
      type: 'aistudio_web_api_fallback',
      toolId,
      prompt,
      apiError: apiResult.error,
      via: 'webview-dom',
      message: 'AI Studio page fetch failed, falling back to webview DOM',
    });
    const domResult = await generateViaWebviewDom(
      toolId,
      prompt,
      webContentsId,
      referenceImage,
      timeoutMs,
      count,
      options
    );
    return { ...domResult, apiError: apiResult.error };
  }

  return generateViaWebviewDom(toolId, prompt, webContentsId, referenceImage, timeoutMs, count, options);
}
