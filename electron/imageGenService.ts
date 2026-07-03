import type { BrowserWindow } from 'electron';
import { IMAGE_HANDLERS } from '../src/webview-handlers/sites/image.js';
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

const DEFAULT_TIMEOUT_MS = 120_000;

function isImageToolId(toolId: string): boolean {
  return toolId === 'bing-create' || toolId in IMAGE_HANDLERS;
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
