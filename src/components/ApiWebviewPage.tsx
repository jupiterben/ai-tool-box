import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ElectronWebView, type ElectronWebViewElement } from './ElectronWebView';
import { preInjectScript } from './WebviewInputHandler';
import {
  ACTIVATE_IMAGE_TOOL_EVENT,
  registerImageGenEnsureHandler,
  unregisterImageGenEnsureHandler,
} from '../services/imageGenBridge';
import { findToolById } from '../config/tools';
import { getFaviconFallbackUrl, getLoadableFaviconUrl } from '../utils/favicon';
import { getToolPartition } from '../utils/toolPartition';
import { getSiteHandler } from '../webview-handlers';
import type { AITool } from '../types/ai-tool';
import styles from './ApiWebviewPage.module.css';

type PageFaviconUpdatedEvent = Event & { favicons?: string[] };

interface ApiWorkerView {
  threadId: string;
  toolId: string;
  status: 'loading' | 'ready' | 'error';
  webContentsId?: number;
  error?: string;
}

type WebviewElement = ElectronWebViewElement & {
  getWebContentsId?: () => number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWorkerLabel(worker: ApiWorkerView, tool?: AITool): string {
  return `${worker.threadId}${tool ? ` / ${tool.name}` : ''}`;
}

const ApiWebviewPage: React.FC = () => {
  const [workers, setWorkers] = useState<ApiWorkerView[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [favicons, setFavicons] = useState<Record<string, string>>({});
  const workersRef = useRef<Record<string, ApiWorkerView>>({});
  const webviewRefs = useRef<Record<string, WebviewElement>>({});
  const listenerCleanups = useRef<Record<string, () => void>>({});

  useEffect(() => {
    workersRef.current = Object.fromEntries(workers.map((worker) => [worker.threadId, worker]));
  }, [workers]);

  const ensureWorkerSlot = useCallback((toolId: string, threadId: string) => {
    const tool = findToolById(toolId);
    if (!tool || tool.category !== 'image') {
      return false;
    }

    setWorkers((prev) => {
      const existing = prev.find((worker) => worker.threadId === threadId);
      if (!existing) {
        return [...prev, { threadId, toolId, status: 'loading' }];
      }

      return prev.map((worker) =>
        worker.threadId === threadId
          ? {
              ...worker,
              toolId,
              status: worker.toolId === toolId ? worker.status : 'loading',
              error: undefined,
              webContentsId: worker.toolId === toolId ? worker.webContentsId : undefined,
            }
          : worker
      );
    });
    setActiveThreadId(threadId);
    return true;
  }, []);

  const readWebContentsId = useCallback((threadId: string): number | undefined => {
    const webview = webviewRefs.current[threadId];
    if (typeof webview?.getWebContentsId !== 'function') {
      return undefined;
    }

    try {
      const id = webview.getWebContentsId();
      return typeof id === 'number' && id > 0 ? id : undefined;
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    registerImageGenEnsureHandler(async (toolId, threadId = 'api-worker-1') => {
      if (!ensureWorkerSlot(toolId, threadId)) {
        return { success: false, error: `Unsupported image tool: ${toolId}` };
      }

      for (let attempt = 0; attempt < 80; attempt += 1) {
        await sleep(500);
        const worker = workersRef.current[threadId];
        if (!worker || worker.toolId !== toolId) {
          continue;
        }

        const webContentsId = readWebContentsId(threadId);
        if (webContentsId) {
          return { success: true, webContentsId };
        }
      }

      return { success: false, error: `Webview not ready for ${threadId}` };
    }, 'api');

    return () => {
      unregisterImageGenEnsureHandler('api');
    };
  }, [ensureWorkerSlot, readWebContentsId]);

  useEffect(() => {
    const onActivateTool = (event: Event) => {
      const threadId = (event as CustomEvent<{ toolId: string }>).detail?.toolId;
      if (threadId && workersRef.current[threadId]) {
        setActiveThreadId(threadId);
      }
    };

    window.addEventListener(ACTIVATE_IMAGE_TOOL_EVENT, onActivateTool);
    return () => window.removeEventListener(ACTIVATE_IMAGE_TOOL_EVENT, onActivateTool);
  }, []);

  const handleWebviewRef = useCallback(
    (worker: ApiWorkerView, element: ElectronWebViewElement | null) => {
      const { threadId, toolId } = worker;
      listenerCleanups.current[threadId]?.();
      delete listenerCleanups.current[threadId];

      if (!element) {
        delete webviewRefs.current[threadId];
        return;
      }

      const webview = element as WebviewElement;
      webviewRefs.current[threadId] = webview;

      const markReady = () => {
        const webContentsId = readWebContentsId(threadId);
        setWorkers((prev) =>
          prev.map((item) =>
            item.threadId === threadId
              ? { ...item, status: 'ready', webContentsId, error: undefined }
              : item
          )
        );
      };

      const onLoad = async () => {
        const handler = getSiteHandler(toolId);
        if (handler) {
          try {
            await preInjectScript(
              webview as HTMLElement & { executeJavaScript?: (code: string) => Promise<unknown> },
              toolId,
              5000
            );
          } catch (error) {
            setWorkers((prev) =>
              prev.map((item) =>
                item.threadId === threadId
                  ? {
                      ...item,
                      status: 'error',
                      error: error instanceof Error ? error.message : 'Pre-inject failed',
                    }
                  : item
              )
            );
          }
        }

        try {
          await window.electronAPI?.applyToolGeolocation(toolId);
        } catch {
          // GPS settings are best-effort for API workers.
        }

        markReady();
      };

      const onFaviconUpdated = (event: Event) => {
        const faviconUrl = (event as PageFaviconUpdatedEvent).favicons?.[0];
        const loadableUrl = faviconUrl ? getLoadableFaviconUrl(faviconUrl) : '';
        if (loadableUrl) {
          setFavicons((prev) => ({ ...prev, [threadId]: loadableUrl }));
        }
      };

      webview.addEventListener?.('dom-ready', markReady);
      webview.addEventListener?.('did-finish-load', onLoad);
      webview.addEventListener?.('page-favicon-updated', onFaviconUpdated);
      listenerCleanups.current[threadId] = () => {
        webview.removeEventListener?.('dom-ready', markReady);
        webview.removeEventListener?.('did-finish-load', onLoad);
        webview.removeEventListener?.('page-favicon-updated', onFaviconUpdated);
      };
    },
    [readWebContentsId]
  );

  const resolvedWorkers = useMemo(
    () =>
      workers
        .map((worker) => ({ worker, tool: findToolById(worker.toolId) }))
        .filter((item): item is { worker: ApiWorkerView; tool: AITool } => !!item.tool),
    [workers]
  );

  const activeId = activeThreadId || resolvedWorkers[0]?.worker.threadId || '';

  return (
    <div className={styles.root} role="main" aria-label="API webview workers">
      <div className={styles.header}>
        <h2 className={styles.title}>API Workers</h2>
        <span className={styles.meta}>
          {resolvedWorkers.length ? `${resolvedWorkers.length} webview(s)` : 'Waiting for API requests'}
        </span>
        <div className={styles.tabs} role="tablist" aria-label="API worker tabs">
          {resolvedWorkers.map(({ worker, tool }) => {
            const isActive = worker.threadId === activeId;
            const faviconUrl = favicons[worker.threadId] || tool.icon || getFaviconFallbackUrl(tool.url);
            return (
              <button
                key={worker.threadId}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={() => setActiveThreadId(worker.threadId)}
                title={worker.error || getWorkerLabel(worker, tool)}
              >
                {faviconUrl && <img src={faviconUrl} alt="" className={styles.tabIcon} aria-hidden="true" />}
                <span>{getWorkerLabel(worker, tool)}</span>
                <span>{worker.status}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.stage}>
        {!resolvedWorkers.length && (
          <div className={styles.empty}>API requests will create worker webviews here.</div>
        )}
        {resolvedWorkers.map(({ worker, tool }) => {
          const isActive = worker.threadId === activeId;
          return (
            <div
              key={worker.threadId}
              className={`${styles.pane} ${isActive ? styles.paneActive : styles.paneHidden}`}
              aria-hidden={!isActive}
            >
              <div className={styles.webviewWrap}>
                <ElectronWebView
                  key={`${worker.threadId}-${worker.toolId}`}
                  ref={(el) => handleWebviewRef(worker, el)}
                  partition={getToolPartition(worker.toolId)}
                  data-tool-id={worker.toolId}
                  data-thread-id={worker.threadId}
                  src={tool.url}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'inline-flex',
                  }}
                  webpreferences="allowRunningInsecureContent=true, javascript=yes"
                  aria-label={`${getWorkerLabel(worker, tool)} Webview`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApiWebviewPage;
