import { getSiteHandler } from '../src/webview-handlers/index.js';
import { findToolWebContents, getUrlHints } from './webviewLocate.js';
import { resolveToolPartition } from './sessionSettingsManager.js';

export interface ExtractedToolResponse {
  toolId: string;
  success: boolean;
  content: string;
  userQuestion?: string;
  responseCount?: number;
  error?: string;
}

export interface ExtractWebviewResponsesPayload {
  toolIds: string[];
  /** 渲染进程 webview.getWebContentsId()，优先用于定位 guest webview */
  webContentsIds?: Record<string, number>;
}

export interface ExtractWebviewResponsesResult {
  success: boolean;
  responses: ExtractedToolResponse[];
  error?: string;
}

export async function extractWebviewResponses(
  payload: ExtractWebviewResponsesPayload
): Promise<ExtractWebviewResponsesResult> {
  const responses: ExtractedToolResponse[] = [];

  for (const toolId of payload.toolIds) {
    const handler = getSiteHandler(toolId);
    if (!handler) {
      responses.push({
        toolId,
        success: false,
        content: '',
        error: `未找到站点 handler: ${toolId}`,
      });
      continue;
    }

    const partition = resolveToolPartition(toolId);
    const webContentsId = payload.webContentsIds?.[toolId];
    const wc = findToolWebContents(partition, webContentsId, getUrlHints(handler.config));

    if (!wc) {
      responses.push({
        toolId,
        success: false,
        content: '',
        error: '未找到 webview',
      });
      continue;
    }

    try {
      const script = handler.buildExtractResponsesScript();
      const result = (await wc.executeJavaScript(script)) as {
        success?: boolean;
        content?: string;
        userQuestion?: string;
        responseCount?: number;
        error?: string;
      };

      responses.push({
        toolId,
        success: !!result?.success && !!result?.content,
        content: result?.content || '',
        userQuestion: result?.userQuestion,
        responseCount: result?.responseCount,
        error: result?.success ? undefined : result?.error || '未提取到回复',
      });
    } catch (error) {
      responses.push({
        toolId,
        success: false,
        content: '',
        error: error instanceof Error ? error.message : '提取失败',
      });
    }
  }

  const anySuccess = responses.some((r) => r.success);
  return {
    success: anySuccess,
    responses,
    error: anySuccess ? undefined : '所有站点均未提取到回复',
  };
}
