import { memo, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { AITool } from '../types/ai-tool';
import { InputDeliveryState } from '../types/input-delivery';
import { getSiteHandler } from '../webview-handlers';
import { preInjectScript } from './WebviewInputHandler';
import { ElectronWebView, type ElectronWebViewElement } from './ElectronWebView';
import { getToolPartition } from '../utils/toolPartition';
import { getFaviconFallbackUrl, getLoadableFaviconUrl } from '../utils/favicon';
import { ACTIVATE_IMAGE_TOOL_EVENT } from '../services/imageGenBridge';
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
  const webviewReadyRef = useRef<Record<string, boolean>>({});
  const listenerCleanups = useRef<Record<string, () => void>>({});
  const activeTabIdRef = useRef('');
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [favicons, setFavicons] = useState<Record<string, string>>({});
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  const syncNavState = useCallback((toolId: string) => {
    const webview = webviewRefs.current[toolId];
    if (!webview || !webviewReadyRef.current[toolId]) {
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }
    try {
      setCanGoBack(Boolean(webview.canGoBack?.()));
      setCanGoForward(Boolean(webview.canGoForward?.()));
    } catch {
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, []);

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

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
    if (activeTabId) {
      syncNavState(activeTabId);
    }
  }, [activeTabId, syncNavState]);

  useEffect(() => {
    const onActivateTool = (event: Event) => {
      const toolId = (event as CustomEvent<{ toolId: string }>).detail?.toolId;
      if (!toolId) {
        return;
      }
      setActiveTabId(toolId);
    };

    window.addEventListener(ACTIVATE_IMAGE_TOOL_EVENT, onActivateTool);
    return () => window.removeEventListener(ACTIVATE_IMAGE_TOOL_EVENT, onActivateTool);
  }, []);

  const handleWebviewRef = useCallback((toolId: string, toolName: string, element: HTMLElement | null) => {
    listenerCleanups.current[toolId]?.();
    delete listenerCleanups.current[toolId];

    if (element) {
      const webview = element as WebviewElement;
      webviewRefs.current[toolId] = webview;
      webviewReadyRef.current[toolId] = false;
      onWebviewRef?.(toolId, element);

      const onDomReady = () => {
        webviewReadyRef.current[toolId] = true;
        if (toolId === activeTabIdRef.current) {
          syncNavState(toolId);
        }
      };

      const onLoad = async () => {
        syncNavState(toolId);

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

        try {
          await window.electronAPI?.applyToolGeolocation(toolId);
        } catch (error) {
          console.warn(`[MultiWebviewGrid] ${toolName} 应用 GPS 设置失败:`, error);
        }
      };

      const onFaviconUpdated = (event: Event) => {
        const faviconUrl = (event as PageFaviconUpdatedEvent).favicons?.[0];
        const loadableUrl = faviconUrl ? getLoadableFaviconUrl(faviconUrl) : '';
        if (loadableUrl) {
          setFavicons((prev) => ({ ...prev, [toolId]: loadableUrl }));
        }
      };

      const onNavigate = () => {
        if (toolId === activeTabIdRef.current) {
          syncNavState(toolId);
        }
      };

      webview.addEventListener?.('dom-ready', onDomReady);
      webview.addEventListener?.('did-finish-load', onLoad);
      webview.addEventListener?.('did-navigate', onNavigate);
      webview.addEventListener?.('did-navigate-in-page', onNavigate);
      webview.addEventListener?.('page-favicon-updated', onFaviconUpdated);
      listenerCleanups.current[toolId] = () => {
        webview.removeEventListener?.('dom-ready', onDomReady);
        webview.removeEventListener?.('did-finish-load', onLoad);
        webview.removeEventListener?.('did-navigate', onNavigate);
        webview.removeEventListener?.('did-navigate-in-page', onNavigate);
        webview.removeEventListener?.('page-favicon-updated', onFaviconUpdated);
      };
    } else {
      delete webviewRefs.current[toolId];
      delete webviewReadyRef.current[toolId];
      onWebviewRef?.(toolId, null);
    }
  }, [onWebviewRef, syncNavState]);

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

  const handleGoBack = useCallback((toolId: string) => {
    const webview = webviewRefs.current[toolId];
    if (!webview || !webviewReadyRef.current[toolId]) {
      return;
    }
    try {
      webview.goBack?.();
      syncNavState(toolId);
    } catch {
      // webview 尚未就绪
    }
  }, [syncNavState]);

  const handleGoForward = useCallback((toolId: string) => {
    const webview = webviewRefs.current[toolId];
    if (!webview || !webviewReadyRef.current[toolId]) {
      return;
    }
    try {
      webview.goForward?.();
      syncNavState(toolId);
    } catch {
      // webview 尚未就绪
    }
  }, [syncNavState]);

  const handleClearCache = useCallback(
    async (toolId: string, toolName: string, url: string) => {
      const confirmed = window.confirm(
        `确定清理「${toolName}」的所有缓存数据吗？\n\n将清除 Cookie、本地存储与网络缓存，可能需要重新登录。`
      );
      if (!confirmed) {
        return;
      }

      if (!window.electronAPI?.clearToolWebviewData) {
        window.alert('当前环境不支持清理缓存');
        return;
      }

      setIsClearingData(true);
      try {
        const result = await window.electronAPI.clearToolWebviewData(toolId);
        if (!result.success) {
          window.alert(result.error ?? '清理缓存失败');
          return;
        }

        const webview = webviewRefs.current[toolId];
        if (webview) {
          webview.src = url;
        }
        syncNavState(toolId);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : '清理缓存失败');
      } finally {
        setIsClearingData(false);
      }
    },
    [syncNavState]
  );

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
              className={styles.toolbarButton}
              onClick={() => handleGoBack(activeTool.id)}
              disabled={!canGoBack}
              aria-label={`后退 ${activeTool.name}`}
              title="后退"
            >
              <Icon name="ArrowLeft" size={16} />
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => handleGoForward(activeTool.id)}
              disabled={!canGoForward}
              aria-label={`前进 ${activeTool.name}`}
              title="前进"
            >
              <Icon name="ArrowRight" size={16} />
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => handleRefresh(activeTool.id, activeTool.url)}
              aria-label={`刷新 ${activeTool.name}`}
              title="刷新当前页面"
            >
              <Icon name="RefreshCw" size={16} />
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarButtonDanger}`}
              onClick={() => handleClearCache(activeTool.id, activeTool.name, activeTool.url)}
              disabled={isClearingData}
              aria-label={`清理 ${activeTool.name} 缓存`}
              title="清理所有缓存数据"
            >
              <Icon name="Eraser" size={16} />
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
