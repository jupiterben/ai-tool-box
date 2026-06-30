import { useCallback, useEffect, useState } from 'react';
import { findToolById } from '../config/tools';
import {
  buildSummaryDocument,
  type ResponseSummaryDocument,
  type ToolResponseItem,
} from '../utils/responseSummaryDocument';
import { getWebContentsIdMap, isWebviewNotFoundError } from '../utils/webviewContentsId';
import { SUMMARY_PANEL_OPEN_STORAGE_KEY } from '../utils/settingsStorage';

function readStoredPanelOpen(): boolean {
  try {
    const saved = localStorage.getItem(SUMMARY_PANEL_OPEN_STORAGE_KEY);
    if (saved === null) return false;
    return saved === 'true';
  } catch {
    return false;
  }
}

function getToolName(toolId: string): string {
  return findToolById(toolId)?.name ?? toolId;
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

async function summarizeWithLlm(
  question: string,
  items: ToolResponseItem[]
): Promise<{ markdown?: string; error?: string; skipped?: boolean }> {
  if (!window.electronAPI?.summarizeResponses) {
    return { skipped: true };
  }

  const settingsResult = await window.electronAPI.getLlmSettings?.();
  if (!settingsResult?.success || !settingsResult.settings?.enabled) {
    return { skipped: true };
  }

  const successful = items.filter((i) => i.success && i.content);
  if (!successful.length) {
    return {};
  }

  const result = await window.electronAPI.summarizeResponses({
    question,
    responses: successful.map((item) => ({
      toolName: item.toolName,
      content: item.content,
    })),
  });

  if (result.success && result.markdown) {
    return { markdown: result.markdown };
  }

  return { error: result.error };
}

export function useResponseCollection() {
  const [isCollecting, setIsCollecting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [document, setDocument] = useState<ResponseSummaryDocument | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => readStoredPanelOpen());
  const [error, setError] = useState<string | null>(null);
  const [summarizeWarning, setSummarizeWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SUMMARY_PANEL_OPEN_STORAGE_KEY, String(panelOpen));
    } catch {
      // ignore storage errors
    }
  }, [panelOpen]);

  const collectAndSummarize = useCallback(
    async (toolIds: string[], webviewElements: Record<string, HTMLElement>, question: string) => {
      if (!toolIds.length) {
        setError('请至少选择一个 AI 工具');
        return;
      }

      setIsCollecting(true);
      setIsSummarizing(false);
      setError(null);
      setSummarizeWarning(null);

      try {
        let items: ToolResponseItem[] = [];
        const webContentsIds = getWebContentsIdMap(toolIds, webviewElements);

        if (window.electronAPI?.extractWebviewResponses) {
          const result = await window.electronAPI.extractWebviewResponses({
            toolIds,
            webContentsIds,
          });
          items = result.responses.map((r) => ({
            toolId: r.toolId,
            toolName: getToolName(r.toolId),
            content: r.content,
            userQuestion: r.userQuestion,
            success: r.success,
            error: r.error,
          }));

          const failedIds = items
            .filter((item) => !item.success && isWebviewNotFoundError(item.error))
            .map((item) => item.toolId);

          if (failedIds.length) {
            const fallbackItems = await extractViaRenderer(failedIds, webviewElements);
            items = items.map((item) => {
              const fallback = fallbackItems.find((f) => f.toolId === item.toolId);
              if (fallback && (fallback.success || !isWebviewNotFoundError(item.error))) {
                return fallback;
              }
              return item;
            });
          }

          if (!items.some((i) => i.success) && result.error) {
            setError(result.error);
          }
        } else {
          items = await extractViaRenderer(toolIds, webviewElements);
        }

        const resolvedQuestion =
          question.trim() ||
          items.find((i) => i.userQuestion)?.userQuestion ||
          '';

        if (!items.some((i) => i.success)) {
          const doc = buildSummaryDocument(resolvedQuestion, items);
          setDocument(doc);
          setPanelOpen(true);
          setError('未能从任何平台提取到回复，请等待 AI 回答完成后再试');
          return;
        }

        setIsCollecting(false);
        setIsSummarizing(true);

        const { markdown: llmMarkdown, error: llmError } = await summarizeWithLlm(
          resolvedQuestion,
          items
        );

        if (llmError) {
          setSummarizeWarning(`${llmError}，已使用本地汇总`);
        }

        const doc = buildSummaryDocument(resolvedQuestion, items, llmMarkdown);
        setDocument(doc);
        setPanelOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : '收集回复失败');
      } finally {
        setIsCollecting(false);
        setIsSummarizing(false);
      }
    },
    []
  );

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const clearDocument = useCallback(() => {
    setDocument(null);
    setError(null);
    setSummarizeWarning(null);
  }, []);

  const isBusy = isCollecting || isSummarizing;

  return {
    isCollecting,
    isSummarizing,
    isBusy,
    document,
    panelOpen,
    error,
    summarizeWarning,
    collectAndSummarize,
    closePanel,
    openPanel,
    clearDocument,
    setPanelOpen,
  };
}
