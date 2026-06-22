import { useCallback, useState } from 'react';
import { DEFAULT_TOOLS } from '../config/tools';
import {
  buildSummaryDocument,
  type ResponseSummaryDocument,
  type ToolResponseItem,
} from '../utils/responseSummaryDocument';

function getToolName(toolId: string): string {
  return DEFAULT_TOOLS.find((t) => t.id === toolId)?.name ?? toolId;
}

async function extractViaRenderer(
  toolIds: string[],
  webviewElements: Record<string, HTMLElement>
): Promise<ToolResponseItem[]> {
  const { getSiteHandler } = await import('../webview-handlers');

  return Promise.all(
    toolIds.map(async (toolId) => {
      const handler = getSiteHandler(toolId);
      const element = webviewElements[toolId] as HTMLElement & {
        executeJavaScript?: (code: string) => Promise<unknown>;
      };

      if (!handler || !element?.executeJavaScript) {
        return {
          toolId,
          toolName: getToolName(toolId),
          content: '',
          success: false,
          error: 'Webview 不可用',
        };
      }

      try {
        const result = (await element.executeJavaScript(handler.buildExtractResponsesScript())) as {
          success?: boolean;
          content?: string;
          userQuestion?: string;
          error?: string;
        };
        return {
          toolId,
          toolName: getToolName(toolId),
          content: result?.content || '',
          userQuestion: result?.userQuestion,
          success: !!result?.success && !!result?.content,
          error: result?.error,
        };
      } catch (error) {
        return {
          toolId,
          toolName: getToolName(toolId),
          content: '',
          success: false,
          error: error instanceof Error ? error.message : '提取失败',
        };
      }
    })
  );
}

export function useResponseCollection() {
  const [isCollecting, setIsCollecting] = useState(false);
  const [document, setDocument] = useState<ResponseSummaryDocument | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectAndSummarize = useCallback(
    async (toolIds: string[], webviewElements: Record<string, HTMLElement>, question: string) => {
      if (!toolIds.length) {
        setError('请至少选择一个 AI 工具');
        return;
      }

      setIsCollecting(true);
      setError(null);

      try {
        let items: ToolResponseItem[] = [];

        if (window.electronAPI?.extractWebviewResponses) {
          const result = await window.electronAPI.extractWebviewResponses({ toolIds });
          items = result.responses.map((r) => ({
            toolId: r.toolId,
            toolName: getToolName(r.toolId),
            content: r.content,
            userQuestion: r.userQuestion,
            success: r.success,
            error: r.error,
          }));
          if (!result.success && result.error) {
            setError(result.error);
          }
        } else {
          items = await extractViaRenderer(toolIds, webviewElements);
        }

        const resolvedQuestion =
          question.trim() ||
          items.find((i) => i.userQuestion)?.userQuestion ||
          '';

        const doc = buildSummaryDocument(resolvedQuestion, items);
        setDocument(doc);
        setPanelOpen(true);

        if (!items.some((i) => i.success)) {
          setError('未能从任何平台提取到回复，请等待 AI 回答完成后再试');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '收集回复失败');
      } finally {
        setIsCollecting(false);
      }
    },
    []
  );

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const clearDocument = useCallback(() => {
    setDocument(null);
    setError(null);
  }, []);

  return {
    isCollecting,
    document,
    panelOpen,
    error,
    collectAndSummarize,
    closePanel,
    openPanel,
    clearDocument,
    setPanelOpen,
  };
}
