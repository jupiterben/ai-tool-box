import { useState, useCallback, useRef, useMemo } from 'react';
import UnifiedInput from './UnifiedInput';
import ToolSelector from './ToolSelector';
import MultiWebviewGrid from './MultiWebviewGrid';
import ResponseSummaryPanel from './ResponseSummaryPanel';
import { DEFAULT_TOOLS } from '../config/tools';
import { useWebviewInput } from '../hooks/useWebviewInput';
import { useResponseCollection } from '../hooks/useResponseCollection';
import { useProxyRevision } from '../hooks/useProxySettings';
import Icon from './ui/Icon';
import styles from './MultiWebviewTool.module.css';

const MultiWebviewTool: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const defaultSelectedIds = useMemo(() => DEFAULT_TOOLS.map((tool) => tool.id), []);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(defaultSelectedIds);

  const webviewElementsRef = useRef<Record<string, HTMLElement>>({});
  const [inputHistory, setInputHistory] = useState<string[]>([]);

  const { deliveryStates, sendInput, retry, clearStates } = useWebviewInput(selectedToolIds);
  const proxyRevision = useProxyRevision();

  const {
    isCollecting,
    isSummarizing,
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
      if (!content.trim() || isSending) {
        return;
      }

      setIsSending(true);
      clearStates();

      try {
        await sendInput(content, webviewElementsRef.current);
        setInputHistory((prev) => [content, ...prev].slice(0, 50));
        setInputValue('');
      } catch (error) {
        console.error('发送输入失败:', error);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, sendInput, clearStates]
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
      const lastInput = inputHistory[0];
      if (!lastInput) return;

      const webviewElement = webviewElementsRef.current[toolId];
      if (!webviewElement) return;

      await retry(toolId, lastInput, webviewElement);
    },
    [retry, inputHistory]
  );

  const handleWebviewRef = useCallback((toolId: string, element: HTMLElement | null) => {
    if (element) {
      webviewElementsRef.current[toolId] = element;
    } else {
      delete webviewElementsRef.current[toolId];
    }
  }, []);

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

  return (
    <div className={styles.container} role="main" aria-label="多 Webview 工具">
      <div className={styles.workspace}>
        <div className={styles.main} role="region" aria-label="Webview 内容区域">
          <MultiWebviewGrid
            tools={DEFAULT_TOOLS}
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
              tools={DEFAULT_TOOLS}
              selectedToolIds={selectedToolIds}
              onSelectionChange={handleSelectionChange}
            />
            <button
              type="button"
              className={styles.collectToolbarButton}
              onClick={handleCollectResponses}
              disabled={isCollecting || selectedToolIds.length === 0}
              title="收集各平台 AI 回复并生成汇总文档"
            >
              <Icon name="FileText" size={16} />
              {isCollecting ? '收集中…' : '收集回复'}
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

      <ResponseSummaryPanel
        open={panelOpen}
        document={summaryDocument}
        isCollecting={isCollecting}
        isSummarizing={isSummarizing}
        error={collectError}
        summarizeWarning={summarizeWarning}
        onClose={closePanel}
        onCollect={handleCollectResponses}
        onClear={clearDocument}
      />
    </div>
  );
};

export default MultiWebviewTool;
