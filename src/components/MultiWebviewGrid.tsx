import { memo, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { AITool } from '../types/ai-tool';
import { InputDeliveryState } from '../types/input-delivery';
import { getSiteHandler } from '../webview-handlers';
import { preInjectScript } from './WebviewInputHandler';
import { ElectronWebView, type ElectronWebViewElement } from './ElectronWebView';
import { getToolPartition } from '../utils/toolPartition';
import { getFaviconFallbackUrl } from '../utils/favicon';
import Icon from './ui/Icon';
import styles from './MultiWebviewGrid.module.css';

type PageFaviconUpdatedEvent = Event & { favicons?: string[] };

type WebviewElement = ElectronWebViewElement;

interface MultiWebviewGridProps {
  tools: AITool[];
  selectedToolIds: string[];
  deliveryStates: Record<string, InputDeliveryState>;
  proxyRevision?: number;
  onRetry?: (toolId: string) => void;
  onWebviewRef?: (toolId: string, element: HTMLElement | null) => void;
}

function renderTabStatus(status: InputDeliveryState['status'] | 'pending') {
  if (status === 'sending') {
    return (
      <span className={styles.tabStatus} aria-label="发送中">
        ⏳
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className={styles.tabStatus} aria-label="发送成功">
        ✓
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className={styles.tabStatus} aria-label="发送失败">
        ✗
      </span>
    );
  }
  return null;
}

const MultiWebviewGrid: React.FC<MultiWebviewGridProps> = memo(({
  tools,
  selectedToolIds,
  deliveryStates,
  proxyRevision = 0,
  onRetry,
  onWebviewRef,
}) => {
  const webviewRefs = useRef<Record<string, WebviewElement>>({});
  const listenerCleanups = useRef<Record<string, () => void>>({});
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [favicons, setFavicons] = useState<Record<string, string>>({});

  const selectedTools = useMemo(() => {
    return tools.filter((tool) => selectedToolIds.includes(tool.id));
  }, [tools, selectedToolIds]);

  const activeTool = useMemo(
    () => selectedTools.find((tool) => tool.id === activeTabId) ?? selectedTools[0],
    [selectedTools, activeTabId]
  );

  useEffect(() => {
    if (!selectedToolIds.length) {
      setActiveTabId('');
      return;
    }
    if (!activeTabId || !selectedToolIds.includes(activeTabId)) {
      setActiveTabId(selectedToolIds[0]);
    }
  }, [selectedToolIds, activeTabId]);

  const handleWebviewRef = useCallback((toolId: string, toolName: string, element: HTMLElement | null) => {
    listenerCleanups.current[toolId]?.();
    delete listenerCleanups.current[toolId];

    if (element) {
      const webview = element as WebviewElement;
      webviewRefs.current[toolId] = webview;
      onWebviewRef?.(toolId, element);

      const onLoad = async () => {
        const el = webviewRefs.current[toolId];
        if (el && getSiteHandler(toolId)) {
          try {
            await preInjectScript(
              el as HTMLElement & { executeJavaScript?: (code: string) => Promise<unknown> },
              toolId,
              5000
            );
          } catch (error) {
            console.error(`[MultiWebviewGrid] ${toolName} 预注入脚本失败:`, error);
          }
        }
      };

      const onFaviconUpdated = (event: Event) => {
        const faviconUrl = (event as PageFaviconUpdatedEvent).favicons?.[0];
        if (faviconUrl) {
          setFavicons((prev) => ({ ...prev, [toolId]: faviconUrl }));
        }
      };

      webview.addEventListener?.('did-finish-load', onLoad);
      webview.addEventListener?.('page-favicon-updated', onFaviconUpdated);
      listenerCleanups.current[toolId] = () => {
        webview.removeEventListener?.('did-finish-load', onLoad);
        webview.removeEventListener?.('page-favicon-updated', onFaviconUpdated);
      };
    } else {
      delete webviewRefs.current[toolId];
      onWebviewRef?.(toolId, null);
    }
  }, [onWebviewRef]);

  const handleRefresh = useCallback((toolId: string, url: string) => {
    const webview = webviewRefs.current[toolId];
    if (!webview) {
      return;
    }

    if (typeof webview.reload === 'function') {
      webview.reload();
      return;
    }

    webview.src = '';
    setTimeout(() => {
      webview.src = url;
    }, 100);
  }, []);

  if (!selectedTools.length) {
    return (
      <div className={styles.emptyState}>
        <p>请至少选择一个 AI 工具</p>
      </div>
    );
  }

  return (
    <div className={styles.tabsRoot}>
      <div className={styles.tabBar} role="tablist" aria-label="AI 工具标签页">
        {selectedTools.map((tool) => {
          const deliveryState = deliveryStates[tool.id];
          const status = deliveryState?.status || 'pending';
          const isActive = tool.id === activeTabId;
          const faviconUrl =
            favicons[tool.id] || tool.icon || getFaviconFallbackUrl(tool.url);

          return (
            <button
              key={tool.id}
              type="button"
              role="tab"
              id={`tab-${tool.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tool.id}`}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setActiveTabId(tool.id)}
            >
              {faviconUrl && (
                <img
                  src={faviconUrl}
                  alt=""
                  className={styles.tabIcon}
                  aria-hidden="true"
                />
              )}
              <span className={styles.tabLabel}>{tool.name}</span>
              {renderTabStatus(status)}
            </button>
          );
        })}

        {activeTool && (
          <div className={styles.tabBarActions}>
            {deliveryStates[activeTool.id]?.status === 'error' && onRetry && (
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => onRetry(activeTool.id)}
                aria-label={`重试 ${activeTool.name}`}
              >
                重试
              </button>
            )}
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => handleRefresh(activeTool.id, activeTool.url)}
              aria-label={`刷新 ${activeTool.name}`}
              title="刷新当前页面"
            >
              <Icon name="RefreshCw" size={16} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.tabPanels}>
        {selectedTools.map((tool) => {
          const deliveryState = deliveryStates[tool.id];
          const isActive = tool.id === activeTabId;

          return (
            <div
              key={tool.id}
              id={`panel-${tool.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tool.id}`}
              className={`${styles.tabPane} ${isActive ? styles.tabPaneActive : styles.tabPaneHidden}`}
              aria-hidden={!isActive}
            >
              <div className={styles.webviewContainer} aria-label={`${tool.name} 内容区域`}>
                <ElectronWebView
                  key={`${tool.id}-${proxyRevision}`}
                  ref={(el) => handleWebviewRef(tool.id, tool.name, el)}
                  partition={getToolPartition(tool.id)}
                  data-tool-id={tool.id}
                  src={tool.url}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'inline-flex',
                  }}
                  webpreferences="allowRunningInsecureContent=true, javascript=yes"
                  aria-label={`${tool.name} Webview`}
                />
              </div>
              {isActive && deliveryState?.status === 'error' && deliveryState.errorMessage && (
                <div className={styles.errorMessage} role="alert">
                  {deliveryState.errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

MultiWebviewGrid.displayName = 'MultiWebviewGrid';

export default MultiWebviewGrid;
