import type { BrowserWindow } from 'electron';
import { IMAGE_HANDLERS } from '../src/webview-handlers/sites/image.js';
import { getSiteHandler } from '../src/webview-handlers/index.js';
import {
  IMAGE_GEN_API_DEFAULT_TOOL_ID,
  type GenImageRequest,
  type GenImageResult,
} from '../src/types/image-gen-api.js';
import { getToolPartition } from '../src/utils/toolPartition.js';
import { sendWebviewInput } from './webviewInput.js';
import {
  getBaselineOriginSrcs,
  sanitizeImagesForApi,
  waitForNewWebviewImages,
} from './webviewExtractImages.js';
import { requestEnsureImageWebview } from './imageGenBridge.js';
import { normalizeReferenceImageInput } from './imageGenRequestParser.js';
import { generateBingImagesViaWebviewFetch } from './bingImageCreator.js';
import { generateGeminiImagesViaWebviewFetch } from './geminiImageCreator.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';

const DEFAULT_TIMEOUT_MS = 120_000;

function isImageToolId(toolId: string): boolean {
  return toolId === 'bing-create' || toolId in IMAGE_HANDLERS;
}

async function generateViaWebviewDom(
  toolId: string,
  prompt: string,
  webContentsId: number | undefined,
  referenceImage: GenImageRequest['referenceImage'],
  timeoutMs: number
): Promise<GenImageResult> {
  const extractPayload = { toolId, webContentsId };
  const baselineOriginSrcs = await getBaselineOriginSrcs(extractPayload);

  const sendResult = await sendWebviewInput({
    toolId,
    partition: getToolPartition(toolId),
    content: prompt,
    referenceImage,
    webContentsId,
  });

  if (!sendResult.success) {
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
    timeoutMs
  );

  if (!waitResult.success) {
    return {
      success: false,
      toolId,
      prompt,
      error: waitResult.error || '未获取到生成图片',
    };
  }

  return {
    success: true,
    toolId,
    prompt,
    images: sanitizeImagesForApi(waitResult.images),
  };
}

async function generateGeminiViaInternalApi(
  prompt: string,
  webContentsId: number | undefined,
  timeoutMs: number
): Promise<GenImageResult> {
  const handler = getSiteHandler('gemini-image');
  if (!handler) {
    return { success: false, error: '未找到 gemini-image handler' };
  }

  const wc = findToolWebContents(
    getToolPartition('gemini-image'),
    webContentsId,
    getUrlHints(handler.config)
  );

  if (!wc) {
    return { success: false, error: '未找到 Gemini webview，无法读取登录态' };
  }

  const apiResult = await generateGeminiImagesViaWebviewFetch(wc, { prompt, timeoutMs });

  if (!apiResult.success || !apiResult.images?.length) {
    return {
      success: false,
      toolId: 'gemini-image',
      prompt,
      error: apiResult.error || 'Gemini API 生图失败',
    };
  }

  return {
    success: true,
    toolId: 'gemini-image',
    prompt,
    images: sanitizeImagesForApi(apiResult.images),
  };
}

async function generateBingViaInternalApi(
  prompt: string,
  webContentsId: number | undefined,
  timeoutMs: number
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

  const apiResult = await generateBingImagesViaWebviewFetch(wc, { prompt, timeoutMs });

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

  // Gemini / Bing：优先走内部 HTTP API（复用 webview cookie），失败再回退 DOM 模拟
  if (toolId === 'gemini-image' && !referenceImage) {
    const apiResult = await generateGeminiViaInternalApi(prompt, webContentsId, timeoutMs);
    if (apiResult.success) {
      return apiResult;
    }
    console.warn('[imageGenService] Gemini API 失败，回退 webview DOM:', apiResult.error);
  }

  if (toolId === 'bing-create' && !referenceImage) {
    const apiResult = await generateBingViaInternalApi(prompt, webContentsId, timeoutMs);
    if (apiResult.success) {
      return apiResult;
    }
    console.warn('[imageGenService] Bing API 失败，回退 webview DOM:', apiResult.error);
  }

  return generateViaWebviewDom(toolId, prompt, webContentsId, referenceImage, timeoutMs);
}
