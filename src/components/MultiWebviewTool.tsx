import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ConfigProvider, Splitter, theme } from 'antd';
import UnifiedInput from './UnifiedInput';
import ToolSelector from './ToolSelector';
import MultiWebviewGrid from './MultiWebviewGrid';
import ResponseSummaryPanel from './ResponseSummaryPanel';
import { handleWebviewConversation } from './WebviewConversationHandler';
import { useEnabledTools } from '../hooks/useToolSettings';
import { useWebviewInput } from '../hooks/useWebviewInput';
import { useResponseCollection } from '../hooks/useResponseCollection';
import { useProxyRevision } from '../hooks/useProxySettings';
import { useSelectedTools } from '../hooks/useSelectedTools';
import { useSummaryPanelSize } from '../hooks/useSummaryPanelSize';
import { useTheme } from '../hooks/useTheme';
import type { ToolCategory } from '../types/ai-tool';
import type { ReferenceImage } from '../types/reference-image';
import {
  SELECTED_IMAGE_TOOLS_STORAGE_KEY,
  SELECTED_TOOLS_STORAGE_KEY,
} from '../utils/settingsStorage';
import {
  registerImageGenEnsureHandler,
  unregisterImageGenEnsureHandler,
} from '../services/imageGenBridge';
import { getWebContentsIdMap } from '../utils/webviewContentsId';
import Icon from './ui/Icon';
import styles from './MultiWebviewTool.module.css';

interface MultiWebviewToolProps {
  category?: ToolCategory;
}

const MultiWebviewTool: React.FC<MultiWebviewToolProps> = ({ category = 'chat' }) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [referenceImageError, setReferenceImageError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isConversationAction, setIsConversationAction] = useState<boolean>(false);
  const { theme: appTheme } = useTheme();
  const { size: summaryPanelSize, updateSize: updateSummaryPanelSize } = useSummaryPanelSize();

  const isChatMode = category === 'chat';
  const selectedToolsStorageKey =
    category === 'image' ? SELECTED_IMAGE_TOOLS_STORAGE_KEY : SELECTED_TOOLS_STORAGE_KEY;

  const enabledTools = useEnabledTools(category);
  const allToolIds = useMemo(() => enabledTools.map((tool) => tool.id), [enabledTools]);
  const { selectedToolIds, setSelectedToolIds } = useSelectedTools(allToolIds, selectedToolsStorageKey);

  useEffect(() => {
    selectedToolIdsRef.current = selectedToolIds;
  }, [selectedToolIds]);

  const webviewElementsRef = useRef<Record<string, HTMLElement>>({});
  const selectedToolIdsRef = useRef<string[]>(selectedToolIds);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const lastReferenceImageRef = useRef<ReferenceImage | null>(null);

  const { deliveryStates, sendInput, retry, clearStates } = useWebviewInput(selectedToolIds);
  const proxyRevision = useProxyRevision();

  const {
    isCollecting,
    isSummarizing,
    isBusy: isCollectBusy,
    document: summaryDocument,
    panelOpen,
    error: collectError,
    summarizeWarning,
    collectAndSummarize,
    closePanel,
    clearDocument,
    setPanelOpen,
  } = useResponseCollection();

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      const hasReferenceImage = Boolean(referenceImage);
      if ((!trimmed && !hasReferenceImage) || isSending) {
        return;
      }

      setIsSending(true);
      clearStates();
      lastReferenceImageRef.current = referenceImage;

      try {
        await sendInput(trimmed, webviewElementsRef.current, referenceImage);
        if (trimmed) {
          setInputHistory((prev) => [trimmed, ...prev].slice(0, 50));
        }
        setInputValue('');
        setReferenceImage(null);
        setReferenceImageError(null);
      } catch (error) {
        console.error('发送输入失败:', error);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, sendInput, clearStates, referenceImage]
  );

  const handleSelectionChange = useCallback(
    (selectedIds: string[]) => {
      setSelectedToolIds(selectedIds);
      clearStates();
    },
    [clearStates]
  );

  const handleRetry = useCallback(
    async (toolId: string) => {
      const lastInput = inputHistory[0] || inputValue.trim();
      if (!lastInput && !lastReferenceImageRef.current) return;

      const webviewElement = webviewElementsRef.current[toolId];
      if (!webviewElement) return;

      await retry(toolId, lastInput, webviewElement, lastReferenceImageRef.current);
    },
    [retry, inputHistory, inputValue]
  );

  const handleWebviewRef = useCallback((toolId: string, element: HTMLElement | null) => {
    if (element) {
      webviewElementsRef.current[toolId] = element;
    } else {
      delete webviewElementsRef.current[toolId];
    }
  }, []);

  useEffect(() => {
    if (category !== 'image') {
      return;
    }

    registerImageGenEnsureHandler(async (toolId) => {
      const current = selectedToolIdsRef.current;
      if (!current.includes(toolId)) {
        setSelectedToolIds([...current, toolId]);
      }

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const ids = getWebContentsIdMap([toolId], webviewElementsRef.current);
        const webContentsId = ids[toolId];
        if (webContentsId) {
          return { success: true, webContentsId };
        }
      }

      return { success: false, error: `未找到 ${toolId} 的 webview` };
    });

    return () => {
      unregisterImageGenEnsureHandler();
    };
  }, [category, setSelectedToolIds]);

  const handleCollectResponses = useCallback(async () => {
    const question = inputHistory[0] || inputValue.trim();
    await collectAndSummarize(selectedToolIds, webviewElementsRef.current, question);
  }, [collectAndSummarize, selectedToolIds, inputHistory, inputValue]);

  const handleTogglePanel = useCallback(() => {
    if (panelOpen) {
      closePanel();
    } else {
      setPanelOpen(true);
      if (!summaryDocument) {
        void handleCollectResponses();
      }
    }
  }, [panelOpen, closePanel, setPanelOpen, summaryDocument, handleCollectResponses]);

  const handleSplitterResize = useCallback(
    (sizes: number[]) => {
      const nextSize = sizes[1];
      if (panelOpen && nextSize > 0) {
        updateSummaryPanelSize(nextSize);
      }
    },
    [panelOpen, updateSummaryPanelSize]
  );

  const handleSplitterCollapse = useCallback(
    (collapsed: boolean[]) => {
      if (collapsed[1]) {
        closePanel();
        return;
      }
      setPanelOpen(true);
    },
    [closePanel, setPanelOpen]
  );

  const handleConversationAction = useCallback(
    async (action: 'newChat' | 'recentChat') => {
      if (!selectedToolIds.length || isConversationAction) {
        return;
      }

      setIsConversationAction(true);
      try {
        await Promise.all(
          selectedToolIds.map(async (toolId) => {
            const webviewElement = webviewElementsRef.current[toolId];
            const tool = enabledTools.find((item) => item.id === toolId);
            if (!webviewElement || !tool) {
              return;
            }

            const result = await handleWebviewConversation(
              toolId,
              action,
              webviewElement,
              tool.url
            );
            if (!result.success) {
              console.warn(`[${tool.name}] ${action === 'newChat' ? '新建对话' : '最近对话'}失败:`, result.error);
            }
          })
        );
      } finally {
        setIsConversationAction(false);
      }
    },
    [selectedToolIds, enabledTools, isConversationAction]
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      {isChatMode ? (
      <Splitter
        className={styles.splitter}
        lazy
        onResize={handleSplitterResize}
        onResizeEnd={handleSplitterResize}
        onCollapse={handleSplitterCollapse}
      >
        <Splitter.Panel className={styles.workspacePanel} min="30%">
          <div className={styles.workspace} role="main" aria-label="多 Webview 工具">
            <div className={styles.main} role="region" aria-label="Webview 内容区域">
              <MultiWebviewGrid
                tools={enabledTools}
                selectedToolIds={selectedToolIds}
                deliveryStates={deliveryStates}
                proxyRevision={proxyRevision}
                onRetry={handleRetry}
                onWebviewRef={handleWebviewRef}
              />
            </div>
            <div className={styles.footer} role="region" aria-label="输入和工具选择">
              <div className={styles.footerToolbar}>
                <ToolSelector
                  tools={enabledTools}
                  selectedToolIds={selectedToolIds}
                  onSelectionChange={handleSelectionChange}
                />
                <button
                  type="button"
                  className={styles.collectToolbarButton}
                  onClick={() => handleConversationAction('recentChat')}
                  disabled={isConversationAction || selectedToolIds.length === 0}
                  title="在所有已选平台回到最近一次对话"
                >
                  <Icon name="History" size={16} />
                  {isConversationAction ? '切换中…' : '最近对话'}
                </button>
                <button
                  type="button"
                  className={styles.collectToolbarButton}
                  onClick={() => handleConversationAction('newChat')}
                  disabled={isConversationAction || selectedToolIds.length === 0}
                  title="在所有已选平台新建对话"
                >
                  <Icon name="MessageSquarePlus" size={16} />
                  新建对话
                </button>
                <button
                  type="button"
                  className={styles.collectToolbarButton}
                  onClick={handleCollectResponses}
                  disabled={isCollectBusy || selectedToolIds.length === 0}
                  title={
                    isSummarizing
                      ? '正在调用 LLM 生成智能汇总'
                      : isCollecting
                        ? '正在从各平台提取回复'
                        : '收集各平台 AI 回复并生成汇总文档'
                  }
                >
                  <Icon name="FileText" size={16} />
                  {isSummarizing ? 'LLM 汇总中…' : isCollecting ? '收集中…' : '收集回复'}
                </button>
                <button
                  type="button"
                  className={`${styles.panelToggleButton} ${panelOpen ? styles.panelToggleActive : ''}`}
                  onClick={handleTogglePanel}
                  title={panelOpen ? '隐藏汇总面板' : '显示汇总面板'}
                  aria-pressed={panelOpen}
                >
                  <Icon name="PanelRight" size={16} />
                  汇总
                </button>
              </div>
              <UnifiedInput
                value={inputValue}
                onChange={handleInputChange}
                onSend={handleSend}
                isSending={isSending}
              />
            </div>
          </div>
        </Splitter.Panel>

        <Splitter.Panel
          className={styles.summaryPanel}
          size={panelOpen ? summaryPanelSize : 0}
          min={280}
          max="70%"
          resizable={panelOpen}
          collapsible={{ start: true, showCollapsibleIcon: false }}
        >
          <ResponseSummaryPanel
            document={summaryDocument}
            isCollecting={isCollecting}
            isSummarizing={isSummarizing}
            isBusy={isCollectBusy}
            error={collectError}
            summarizeWarning={summarizeWarning}
            onClose={closePanel}
            onCollect={handleCollectResponses}
            onClear={clearDocument}
          />
        </Splitter.Panel>
      </Splitter>
      ) : (
        <div className={styles.workspace} role="main" aria-label="生图工具">
          <div className={styles.main} role="region" aria-label="Webview 内容区域">
            <MultiWebviewGrid
              tools={enabledTools}
              selectedToolIds={selectedToolIds}
              deliveryStates={deliveryStates}
              proxyRevision={proxyRevision}
              onRetry={handleRetry}
              onWebviewRef={handleWebviewRef}
            />
          </div>
          <div className={styles.footer} role="region" aria-label="输入和工具选择">
            <div className={styles.footerToolbar}>
              <ToolSelector
                tools={enabledTools}
                selectedToolIds={selectedToolIds}
                onSelectionChange={handleSelectionChange}
              />
            </div>
            <UnifiedInput
              value={inputValue}
              onChange={handleInputChange}
              onSend={handleSend}
              isSending={isSending}
              placeholder="输入生图提示词..."
              enableReferenceImage
              referenceImage={referenceImage}
              onReferenceImageChange={setReferenceImage}
              referenceImageError={referenceImageError}
              onReferenceImageError={setReferenceImageError}
            />
          </div>
        </div>
      )}
    </ConfigProvider>
  );
};

export default MultiWebviewTool;
