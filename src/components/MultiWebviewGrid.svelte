<script lang="ts">
  import { untrack } from 'svelte';
  import type { AITool } from '../types/ai-tool';
  import type { InputDeliveryState } from '../types/input-delivery';
  import { getSiteHandler } from '../webview-handlers';
  import { preInjectScript } from './WebviewInputHandler';
  import ElectronWebView, {
    type ElectronWebViewElement,
  } from './ElectronWebView.svelte';
  import { getToolPartitionFromSettings } from '../utils/toolPartition';
  import { getSessionSettingsSnapshot } from '../hooks/useSessionSettings.svelte';
  import { isToolIncognito } from '../types/session-settings';
  import {
    getFaviconFallbackUrl,
    getLoadableFaviconUrl,
  } from '../utils/favicon';
  import Icon from './ui/Icon.svelte';
  import styles from './MultiWebviewGrid.module.css';

  let {
    tools,
    selectedToolIds,
    deliveryStates,
    proxyRevision = 0,
    sessionRevision = 0,
    onRetry,
    onWebviewRef,
  }: {
    tools: AITool[];
    selectedToolIds: string[];
    deliveryStates: Record<string, InputDeliveryState>;
    proxyRevision?: number;
    sessionRevision?: number;
    onRetry?: (id: string) => void;
    onWebviewRef?: (id: string, element: HTMLElement | null) => void;
  } = $props();
  const webviews: Record<string, ElectronWebViewElement> = {};
  const ready: Record<string, boolean> = {};
  const cleanups: Record<string, () => void> = {};
  let activeTabId = $state('');
  let favicons = $state.raw<Record<string, string>>({});
  let canGoBack = $state(false);
  let canGoForward = $state(false);
  let isClearingData = $state(false);
  const selectedTools = $derived(
    tools.filter((tool) => selectedToolIds.includes(tool.id)),
  );
  const activeTool = $derived(
    selectedTools.find((tool) => tool.id === activeTabId) ?? selectedTools[0],
  );
  const session = $derived.by(() => {
    void sessionRevision;
    return getSessionSettingsSnapshot();
  });

  $effect(() => {
    if (!selectedTools.some((tool) => tool.id === activeTabId))
      activeTabId = selectedTools[0]?.id ?? '';
  });
  $effect(() => {
    const id = activeTabId;
    untrack(() => syncNavState(id));
  });

  function syncNavState(id: string) {
    if (id !== activeTabId) return;
    const view = webviews[id];
    try {
      canGoBack = !!(ready[id] && view?.canGoBack?.());
      canGoForward = !!(ready[id] && view?.canGoForward?.());
    } catch {
      canGoBack = canGoForward = false;
    }
  }

  function attach(
    tool: AITool,
    incognito: boolean,
    view: ElectronWebViewElement,
  ) {
    cleanups[tool.id]?.();
    delete cleanups[tool.id];
    webviews[tool.id] = view;
    ready[tool.id] = false;
    onWebviewRef?.(tool.id, view);
    let disposed = false;
    const onReady = () => {
      ready[tool.id] = true;
      syncNavState(tool.id);
    };
    const onNavigate = () => syncNavState(tool.id);
    const onLoad = async () => {
      syncNavState(tool.id);
      if (getSiteHandler(tool.id)) {
        try {
          await preInjectScript(view, tool.id, 5000);
        } catch (error) {
          console.error(`[${tool.name}] 预注入脚本失败:`, error);
        }
      }
      if (disposed) return;
      try {
        await window.electronAPI?.applyToolGeolocation(tool.id);
      } catch (error) {
        console.warn(`[${tool.name}] 应用 GPS 设置失败:`, error);
      }
    };
    const onFavicon = (event: Event) => {
      const url = (event as Event & { favicons?: string[] }).favicons?.[0];
      const loadable = url ? getLoadableFaviconUrl(url) : '';
      if (loadable) favicons = { ...favicons, [tool.id]: loadable };
    };
    const listeners: [string, EventListener][] = [
      ['dom-ready', onReady],
      ['did-finish-load', onLoad],
      ['did-navigate', onNavigate],
      ['did-navigate-in-page', onNavigate],
      ['page-favicon-updated', onFavicon],
    ];
    for (const [name, listener] of listeners)
      view.addEventListener(name, listener);
    cleanups[tool.id] = () => {
      if (disposed) return;
      disposed = true;
      for (const [name, listener] of listeners)
        view.removeEventListener(name, listener);
      if (webviews[tool.id] === view) {
        delete webviews[tool.id];
        delete ready[tool.id];
        onWebviewRef?.(tool.id, null);
      }
      if (incognito)
        void window.electronAPI?.clearIncognitoPartition?.(tool.id);
    };
    return cleanups[tool.id];
  }

  function navigate(direction: 'goBack' | 'goForward') {
    if (!activeTool || !ready[activeTool.id]) return;
    try {
      webviews[activeTool.id]?.[direction]?.();
      syncNavState(activeTool.id);
    } catch {
      /* The guest may have navigated away while handling the click. */
    }
  }
  function refresh() {
    if (!activeTool) return;
    const view = webviews[activeTool.id];
    if (view?.reload) view.reload();
    else if (view) view.src = activeTool.url;
  }
  async function clearCache() {
    const tool = activeTool;
    if (
      !tool ||
      !window.confirm(
        `确定清理「${tool.name}」的所有缓存数据吗？\n\n将清除 Cookie、本地存储与网络缓存，可能需要重新登录。`,
      )
    )
      return;
    if (!window.electronAPI?.clearToolWebviewData) {
      window.alert('当前环境不支持清理缓存');
      return;
    }
    isClearingData = true;
    try {
      const result = await window.electronAPI.clearToolWebviewData(tool.id);
      if (!result.success) {
        window.alert(result.error ?? '清理缓存失败');
        return;
      }
      if (webviews[tool.id]) webviews[tool.id].src = tool.url;
      syncNavState(tool.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '清理缓存失败');
    } finally {
      isClearingData = false;
    }
  }
  function moveTab(event: KeyboardEvent, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % selectedTools.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + selectedTools.length) % selectedTools.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? selectedTools.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    activeTabId = selectedTools[next].id;
    document.getElementById(`tab-${activeTabId}`)?.focus();
  }
</script>

{#if !selectedTools.length}
  <div class={styles.emptyState}><p>请至少选择一个 AI 工具</p></div>
{:else}
  <div class={styles.tabsRoot}>
    <div class={styles.tabBar} role="tablist" aria-label="AI 工具标签页">
      {#each selectedTools as tool, index (tool.id)}
        {@const status = deliveryStates[tool.id]?.status}
        {@const incognito = isToolIncognito(session, tool.id)}
        {@const favicon =
          favicons[tool.id] || tool.icon || getFaviconFallbackUrl(tool.url)}
        <button
          type="button"
          role="tab"
          id={`tab-${tool.id}`}
          aria-selected={tool.id === activeTabId}
          aria-controls={`panel-${tool.id}`}
          tabindex={tool.id === activeTabId ? 0 : -1}
          class={`${styles.tab} ${tool.id === activeTabId ? styles.tabActive : ''} ${incognito ? styles.tabIncognito : ''}`}
          onclick={() => (activeTabId = tool.id)}
          onkeydown={(event) => moveTab(event, index)}
        >
          {#if incognito}<span
              class={styles.tabIncognitoBadge}
              title="无痕模式"
            >
              <Icon name="EyeOff" size={12} />
            </span>{/if}
          {#if favicon}<img
              src={favicon}
              alt=""
              class={styles.tabIcon}
              aria-hidden="true"
            />{/if}
          <span class={styles.tabLabel}>{tool.name}</span>
          {#if status && status !== 'pending'}
            <span
              class={styles.tabStatus}
              aria-label={status === 'sending'
                ? '发送中'
                : status === 'success'
                  ? '发送成功'
                  : '发送失败'}
            >
              <Icon
                name={status === 'sending'
                  ? 'LoaderCircle'
                  : status === 'success'
                    ? 'Check'
                    : 'X'}
                size={14}
              />
            </span>
          {/if}
        </button>
      {/each}
      {#if activeTool}
        <div class={styles.tabBarActions}>
          {#if deliveryStates[activeTool.id]?.status === 'error' && onRetry}
            <button
              type="button"
              class={styles.retryButton}
              onclick={() => onRetry?.(activeTool.id)}
              aria-label={`重试 ${activeTool.name}`}
            >
              重试
            </button>
          {/if}
          <button
            class={styles.toolbarButton}
            onclick={() => navigate('goBack')}
            disabled={!canGoBack}
            aria-label={`后退 ${activeTool.name}`}
            title="后退"
          >
            <Icon name="ArrowLeft" size={16} />
          </button>
          <button
            class={styles.toolbarButton}
            onclick={() => navigate('goForward')}
            disabled={!canGoForward}
            aria-label={`前进 ${activeTool.name}`}
            title="前进"
          >
            <Icon name="ArrowRight" size={16} />
          </button>
          <button
            class={styles.toolbarButton}
            onclick={refresh}
            aria-label={`刷新 ${activeTool.name}`}
            title="刷新当前页面"
          >
            <Icon name="RefreshCw" size={16} />
          </button>
          <button
            class={`${styles.toolbarButton} ${styles.toolbarButtonDanger}`}
            onclick={clearCache}
            disabled={isClearingData}
            aria-label={`清理 ${activeTool.name} 缓存`}
            title="清理所有缓存数据"
          >
            <Icon name="Eraser" size={16} />
          </button>
        </div>
      {/if}
    </div>
    {#if activeTool && isToolIncognito(session, activeTool.id)}
      <div class={styles.incognitoBanner} role="status">
        <Icon name="EyeOff" size={14} />
        <span>
          您已进入无痕模式。Cookie、缓存与登录态不会写入磁盘，切换或关闭后将清除。
        </span>
      </div>
    {/if}
    <div class={styles.tabPanels}>
      {#each selectedTools as tool (tool.id)}
        {@const partition = getToolPartitionFromSettings(tool.id, session)}
        {@const incognito = isToolIncognito(session, tool.id)}
        <div
          id={`panel-${tool.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tool.id}`}
          class={`${styles.tabPane} ${tool.id === activeTabId ? styles.tabPaneActive : styles.tabPaneHidden}`}
          aria-hidden={tool.id !== activeTabId}
          inert={tool.id !== activeTabId}
        >
          <div
            class={styles.webviewContainer}
            aria-label={`${tool.name} 内容区域`}
          >
            {#key `${tool.id}-${proxyRevision}-${partition}`}
              <ElectronWebView
                src={tool.url}
                {partition}
                toolId={tool.id}
                label={`${tool.name} Webview`}
                {incognito}
                onElement={(element) => attach(tool, incognito, element)}
              />
            {/key}
          </div>
          {#if tool.id === activeTabId && deliveryStates[tool.id]?.status === 'error' && deliveryStates[tool.id].errorMessage}
            <div class={styles.errorMessage} role="alert">
              {deliveryStates[tool.id].errorMessage}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
