<script lang="ts">
  import UnifiedInput from './UnifiedInput.svelte';
  import ToolSelector from './ToolSelector.svelte';
  import MultiWebviewGrid from './MultiWebviewGrid.svelte';
  import ResponseSummaryPanel from './ResponseSummaryPanel.svelte';
  import { handleWebviewConversation } from './WebviewConversationHandler';
  import { useEnabledTools } from '../hooks/useToolSettings.svelte';
  import { useWebviewInput } from '../hooks/useWebviewInput.svelte';
  import { useResponseCollection } from '../hooks/useResponseCollection.svelte';
  import { useProxyRevision } from '../hooks/useProxySettings.svelte';
  import { useSessionRevision } from '../hooks/useSessionSettings.svelte';
  import { useSelectedTools } from '../hooks/useSelectedTools.svelte';
  import { useSummaryPanelSize } from '../hooks/useSummaryPanelSize.svelte';
  import type { ToolCategory } from '../types/ai-tool';
  import type { ReferenceImage } from '../types/reference-image';
  import {
    SELECTED_IMAGE_TOOLS_STORAGE_KEY,
    SELECTED_TOOLS_STORAGE_KEY,
  } from '../utils/settingsStorage';
  import Icon from './ui/Icon.svelte';
  import styles from './MultiWebviewTool.module.css';

  let { category = 'chat' }: { category?: ToolCategory } = $props();
  let inputValue = $state('');
  let referenceImage = $state.raw<ReferenceImage | null>(null);
  let referenceImageError = $state<string | null>(null);
  let isSending = $state(false);
  let isConversationAction = $state(false);
  let inputHistory = $state.raw<string[]>([]);
  let lastReferenceImage: ReferenceImage | null = null;
  const webviews: Record<string, HTMLElement> = {};
  const tools = useEnabledTools(() => category);
  const selection = useSelectedTools(
    () => tools.current.map((tool) => tool.id),
    () =>
      category === 'image'
        ? SELECTED_IMAGE_TOOLS_STORAGE_KEY
        : SELECTED_TOOLS_STORAGE_KEY,
  );
  const delivery = useWebviewInput(() => selection.selectedToolIds);
  const collection = useResponseCollection();
  const proxy = useProxyRevision();
  const session = useSessionRevision();
  const panelSize = useSummaryPanelSize();
  let splitter: HTMLDivElement;
  let dragging = $state(false);
  let containerWidth = $state(0);
  const width = $derived(
    Math.max(0, Math.min(panelSize.size, containerWidth * 0.7)),
  );

  async function send(content: string) {
    const trimmed = content.trim();
    if ((!trimmed && !referenceImage) || isSending) return;
    isSending = true;
    delivery.clearStates();
    lastReferenceImage = referenceImage;
    try {
      await delivery.sendInput(trimmed, webviews, referenceImage);
      if (trimmed) inputHistory = [trimmed, ...inputHistory].slice(0, 50);
      inputValue = '';
      referenceImage = null;
      referenceImageError = null;
    } catch (error) {
      console.error('发送输入失败:', error);
    } finally {
      isSending = false;
    }
  }
  function select(ids: string[]) {
    selection.setSelectedToolIds(ids);
    delivery.clearStates();
  }
  async function retry(id: string) {
    const input = inputHistory[0] || inputValue.trim();
    if ((!input && !lastReferenceImage) || !webviews[id]) return;
    await delivery.retry(id, input, webviews[id], lastReferenceImage);
  }
  function register(id: string, element: HTMLElement | null) {
    if (element) webviews[id] = element;
    else delete webviews[id];
  }
  async function collect() {
    if (collection.isBusy) return;
    await collection.collectAndSummarize(
      selection.selectedToolIds,
      webviews,
      inputHistory[0] || inputValue.trim(),
    );
  }
  function togglePanel() {
    collection.setPanelOpen(!collection.panelOpen);
    if (collection.panelOpen && !collection.document) void collect();
  }
  async function conversation(action: 'newChat' | 'recentChat') {
    if (!selection.selectedToolIds.length || isConversationAction) return;
    isConversationAction = true;
    try {
      await Promise.all(
        selection.selectedToolIds.map(async (id) => {
          const tool = tools.current.find((tool) => tool.id === id);
          if (!tool || !webviews[id]) return;
          const result = await handleWebviewConversation(
            id,
            action,
            webviews[id],
            tool.url,
          );
          if (!result.success)
            console.warn(`[${tool.name}] ${action}失败:`, result.error);
        }),
      );
    } finally {
      isConversationAction = false;
    }
  }
  function resize(event: PointerEvent) {
    if (dragging)
      panelSize.updateSize(
        splitter.getBoundingClientRect().right - event.clientX,
      );
  }
  function startResize(event: PointerEvent) {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function resizeWithKeyboard(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    panelSize.updateSize(width + (event.key === 'ArrowLeft' ? 20 : -20));
  }
</script>

<div
  bind:this={splitter}
  bind:clientWidth={containerWidth}
  class={styles.splitter}
  class:dragging
>
  <div class={styles.workspacePanel}>
    <div
      class={styles.workspace}
      aria-label={category === 'chat' ? '多 Webview 工具' : '生图工具'}
    >
      <div class={styles.main} role="region" aria-label="Webview 内容区域">
        <MultiWebviewGrid
          tools={tools.current}
          selectedToolIds={selection.selectedToolIds}
          deliveryStates={delivery.deliveryStates}
          proxyRevision={proxy.current}
          sessionRevision={session.current}
          onRetry={retry}
          onWebviewRef={register}
        />
      </div>
      <div class={styles.footer} role="region" aria-label="输入和工具选择">
        <div class={styles.footerToolbar}>
          <ToolSelector
            tools={tools.current}
            selectedToolIds={selection.selectedToolIds}
            onSelectionChange={select}
          />
          {#if category === 'chat'}
            <button
              class={styles.collectToolbarButton}
              onclick={() => conversation('recentChat')}
              disabled={isConversationAction ||
                !selection.selectedToolIds.length}
              title="在所有已选平台回到最近一次对话"
            >
              <Icon name="History" size={16} />{isConversationAction
                ? '切换中…'
                : '最近对话'}
            </button>
            <button
              class={styles.collectToolbarButton}
              onclick={() => conversation('newChat')}
              disabled={isConversationAction ||
                !selection.selectedToolIds.length}
              title="在所有已选平台新建对话"
            >
              <Icon name="MessageSquarePlus" size={16} />新建对话
            </button>
            <button
              class={styles.collectToolbarButton}
              onclick={collect}
              disabled={collection.isBusy || !selection.selectedToolIds.length}
              title="收集各平台 AI 回复并生成汇总文档"
            >
              <Icon name="FileText" size={16} />{collection.isSummarizing
                ? 'LLM 汇总中…'
                : collection.isCollecting
                  ? '收集中…'
                  : '收集回复'}
            </button>
            <button
              class={`${styles.panelToggleButton} ${collection.panelOpen ? styles.panelToggleActive : ''}`}
              onclick={togglePanel}
              title={collection.panelOpen ? '隐藏汇总面板' : '显示汇总面板'}
              aria-pressed={collection.panelOpen}
            >
              <Icon name="PanelRight" size={16} />汇总
            </button>
          {/if}
        </div>
        <UnifiedInput
          value={inputValue}
          onChange={(value) => (inputValue = value)}
          onSend={send}
          {isSending}
          placeholder={category === 'image'
            ? '输入生图提示词...'
            : '输入您的问题...'}
          enableReferenceImage={category === 'image'}
          {referenceImage}
          onReferenceImageChange={(image) => (referenceImage = image)}
          {referenceImageError}
          onReferenceImageError={(error) => (referenceImageError = error)}
        />
      </div>
    </div>
  </div>
  {#if category === 'chat' && collection.panelOpen}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (WAI-ARIA focusable window splitter) -->
    <div
      class={styles.resizeHandle}
      role="separator"
      tabindex="0"
      aria-label="调整汇总面板宽度"
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={Math.min(280, Math.floor(containerWidth * 0.7))}
      aria-valuemax={Math.floor(containerWidth * 0.7)}
      onpointerdown={startResize}
      onpointermove={resize}
      onpointerup={() => (dragging = false)}
      onpointercancel={() => (dragging = false)}
      onlostpointercapture={() => (dragging = false)}
      onkeydown={resizeWithKeyboard}
    ></div>
    <div class={styles.summaryPanel} style:width={`${width}px`}>
      <ResponseSummaryPanel
        document={collection.document}
        isCollecting={collection.isCollecting}
        isSummarizing={collection.isSummarizing}
        isBusy={collection.isBusy}
        error={collection.error}
        summarizeWarning={collection.summarizeWarning}
        onClose={collection.closePanel}
        onCollect={collect}
        onClear={collection.clearDocument}
      />
    </div>
  {/if}
</div>

<style>
  .dragging {
    user-select: none;
  }
  .dragging :global(webview) {
    pointer-events: none;
  }
</style>
