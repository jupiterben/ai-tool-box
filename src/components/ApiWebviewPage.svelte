<script lang="ts">
  import { untrack } from 'svelte';

  import TauriWebView from './TauriWebView.svelte';
  import type { TauriWebViewElement } from '../types/ui.ts';
  import { preInjectScript } from './WebviewInputHandler';
  import {
    ACTIVATE_IMAGE_TOOL_EVENT,
    registerImageGenEnsureHandler,
    unregisterImageGenEnsureHandler,
  } from '../services/imageGenBridge';
  import { findToolById } from '../config/tools';
  import {
    getFaviconFallbackUrl,
    getLoadableFaviconUrl,
  } from '../utils/favicon';
  import { getPresetPartition } from '../utils/toolPartition';
  import { createPresetId } from '../state/presetContext.svelte';
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
  type WebviewElement = TauriWebViewElement & {
    getWebContentsId?: () => number;
  };
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function getWorkerLabel(worker: ApiWorkerView, tool?: AITool): string {
    return `${worker.threadId}${tool ? ` / ${tool.name}` : ''}`;
  }

  const presetId = createPresetId();
  let workers: ApiWorkerView[] = $state.raw([]);
  function setWorkers(
    next: typeof workers | ((previous: typeof workers) => typeof workers),
  ) {
    workers = typeof next === 'function' ? untrack(() => next(workers)) : next;
  }
  let activeThreadId = $state.raw('');
  function setActiveThreadId(
    next:
      | typeof activeThreadId
      | ((previous: typeof activeThreadId) => typeof activeThreadId),
  ) {
    activeThreadId =
      typeof next === 'function' ? untrack(() => next(activeThreadId)) : next;
  }
  let favicons: Record<string, string> = $state.raw({});
  function setFavicons(
    next: typeof favicons | ((previous: typeof favicons) => typeof favicons),
  ) {
    favicons =
      typeof next === 'function' ? untrack(() => next(favicons)) : next;
  }
  const workersRef: { current: Record<string, ApiWorkerView> } = {
    current: {},
  };
  const webviewRefs: { current: Record<string, WebviewElement> } = {
    current: {},
  };
  const listenerCleanups: { current: Record<string, () => void> } = {
    current: {},
  };
  $effect(() => {
    void workers;
    return untrack(() => {
      workersRef.current = Object.fromEntries(
        workers.map((worker) => [worker.threadId, worker]),
      );
    });
  });
  const ensureWorkerSlot = (toolId: string, threadId: string) => {
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
              webContentsId:
                worker.toolId === toolId ? worker.webContentsId : undefined,
            }
          : worker,
      );
    });
    setActiveThreadId(threadId);
    return true;
  };
  const readWebContentsId = (threadId: string): number | undefined => {
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
  };
  $effect(() => {
    void ensureWorkerSlot;
    void readWebContentsId;
    return untrack(() => {
      registerImageGenEnsureHandler(
        async (toolId, threadId = 'api-worker-1') => {
          if (!ensureWorkerSlot(toolId, threadId)) {
            return {
              success: false,
              error: `Unsupported image tool: ${toolId}`,
            };
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
        },
        'api',
      );

      return () => {
        unregisterImageGenEnsureHandler('api');
      };
    });
  });
  $effect(() => {
    return untrack(() => {
      const onActivateTool = (event: Event) => {
        const threadId = (event as CustomEvent<{ toolId: string }>).detail
          ?.toolId;
        if (threadId && workersRef.current[threadId]) {
          setActiveThreadId(threadId);
        }
      };

      window.addEventListener(ACTIVATE_IMAGE_TOOL_EVENT, onActivateTool);
      return () =>
        window.removeEventListener(ACTIVATE_IMAGE_TOOL_EVENT, onActivateTool);
    });
  });
  const handleWebviewRef = (
    worker: ApiWorkerView,
    element: TauriWebViewElement | null,
  ) => {
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
            : item,
        ),
      );
    };

    const onLoad = async () => {
      const handler = getSiteHandler(toolId);
      if (handler) {
        try {
          await preInjectScript(
            webview as HTMLElement & {
              executeJavaScript?: (code: string) => Promise<unknown>;
            },
            toolId,
            5000,
          );
        } catch (error) {
          setWorkers((prev) =>
            prev.map((item) =>
              item.threadId === threadId
                ? {
                    ...item,
                    status: 'error',
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Pre-inject failed',
                  }
                : item,
            ),
          );
        }
      }

      try {
        await window.desktopAPI?.applyToolGeolocation(toolId);
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
  };
  let resolvedWorkers = $derived.by(() =>
    workers
      .map((worker) => ({ worker, tool: findToolById(worker.toolId) }))
      .filter(
        (item): item is { worker: ApiWorkerView; tool: AITool } => !!item.tool,
      ),
  );
  let activeId = $derived(
    activeThreadId || resolvedWorkers[0]?.worker.threadId || '',
  );
</script>

<div class={styles.root} role="main" aria-label="API webview workers">
  <div class={styles.header}>
    <h2 class={styles.title}>API Workers</h2>
    <span class={styles.meta}>
      {#if resolvedWorkers.length}{`${resolvedWorkers.length} webview(s)`}{:else}Waiting
        for API requests{/if}
    </span>
    <div class={styles.tabs} role="tablist" aria-label="API worker tabs">
      {#each resolvedWorkers as { worker, tool } (worker.threadId)}
        {@const isActive = worker.threadId === activeId}
        {@const faviconUrl =
          favicons[worker.threadId] ||
          tool.icon ||
          getFaviconFallbackUrl(tool.url)}
        <button
          type="button"
          role="tab"
          aria-selected={isActive}
          class={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
          onclick={() => setActiveThreadId(worker.threadId)}
          title={worker.error || getWorkerLabel(worker, tool)}
        >
          {#if faviconUrl}<img
              src={faviconUrl}
              alt=""
              class={styles.tabIcon}
              aria-hidden="true"
            />{/if} <span>{getWorkerLabel(worker, tool)}</span>
          <span>{worker.status}</span>
        </button>
      {/each}
    </div>
  </div>
  <div class={styles.stage}>
    {#if !resolvedWorkers.length}<div class={styles.empty}>
        API requests will create worker webviews here.
      </div>{/if}
    {#each resolvedWorkers as { worker, tool } (worker.threadId)}
      {@const isActive = worker.threadId === activeId}
      <div
        class={`${styles.pane} ${isActive ? styles.paneActive : styles.paneHidden}`}
        aria-hidden={!isActive}
      >
        <div class={styles.webviewWrap}>
          {#key `${worker.threadId}-${worker.toolId}`}<TauriWebView
              ref={(el) => handleWebviewRef(worker, el)}
              partition={getPresetPartition(presetId)}
              data-tool-id={worker.toolId}
              data-thread-id={worker.threadId}
              src={tool.url}
              style="width: 100%; height: 100%; display: inline-flex"
              webpreferences="allowRunningInsecureContent=true, javascript=yes"
              aria-label={`${getWorkerLabel(worker, tool)} Webview`}
            ></TauriWebView>{/key}
        </div>
      </div>
    {/each}
  </div>
</div>
