<script lang="ts">
  import { untrack } from 'svelte';

  import ResizableWorkspace from './ResizableWorkspace.svelte';
  import UnifiedInput from './UnifiedInput.svelte';
  import ToolSelector from './ToolSelector.svelte';
  import MultiWebviewGrid from './MultiWebviewGrid.svelte';
  import ResponseSummaryPanel from './ResponseSummaryPanel.svelte';
  import { handleWebviewConversation } from './WebviewConversationHandler';
  import { createEnabledTools } from '../state/toolSettings.svelte';
  import { createWebviewInput } from '../state/webviewInput.svelte';
  import { createResponseCollection } from '../state/responseCollection.svelte';
  import { createProxyRevision } from '../state/proxySettings.svelte';
  import { createSelectedTools } from '../state/selectedTools.svelte';
  import { createSummaryPanelSize } from '../state/summaryPanelSize.svelte';
  import type { ToolCategory } from '../types/ai-tool';
  import type { ReferenceImage } from '../types/reference-image';
  import {
    SELECTED_IMAGE_TOOLS_STORAGE_KEY,
    SELECTED_VIDEO_TOOLS_STORAGE_KEY,
    SELECTED_TOOLS_STORAGE_KEY,
    presetStorageKey,
  } from '../utils/settingsStorage';
  import { createPresetId } from '../state/presetContext.svelte';
  import { TOOL_CATEGORY_LABELS } from '../config/tools';
  import {
    registerImageGenEnsureHandler,
    unregisterImageGenEnsureHandler,
    activateImageToolTab,
  } from '../services/imageGenBridge';
  import { getWebContentsIdMap } from '../utils/webviewContentsId';
  import Icon from './ui/Icon.svelte';
  import styles from './MultiWebviewTool.module.css';
  interface MultiWebviewToolProps {
    category?: ToolCategory;
  }
  let { category = 'chat' }: MultiWebviewToolProps = $props();
  let inputValue: string = $state.raw('');
  function setInputValue(
    next:
      typeof inputValue | ((previous: typeof inputValue) => typeof inputValue),
  ) {
    inputValue =
      typeof next === 'function' ? untrack(() => next(inputValue)) : next;
  }
  let referenceImage: ReferenceImage | null = $state.raw(null);
  function setReferenceImage(
    next:
      | typeof referenceImage
      | ((previous: typeof referenceImage) => typeof referenceImage),
  ) {
    referenceImage =
      typeof next === 'function' ? untrack(() => next(referenceImage)) : next;
  }
  let referenceImageError: string | null = $state.raw(null);
  function setReferenceImageError(
    next:
      | typeof referenceImageError
      | ((previous: typeof referenceImageError) => typeof referenceImageError),
  ) {
    referenceImageError =
      typeof next === 'function'
        ? untrack(() => next(referenceImageError))
        : next;
  }
  let isSending: boolean = $state.raw(false);
  function setIsSending(
    next: typeof isSending | ((previous: typeof isSending) => typeof isSending),
  ) {
    isSending =
      typeof next === 'function' ? untrack(() => next(isSending)) : next;
  }
  let isConversationAction: boolean = $state.raw(false);
  function setIsConversationAction(
    next:
      | typeof isConversationAction
      | ((
          previous: typeof isConversationAction,
        ) => typeof isConversationAction),
  ) {
    isConversationAction =
      typeof next === 'function'
        ? untrack(() => next(isConversationAction))
        : next;
  }
  const summarySize = createSummaryPanelSize();
  let summaryPanelSize = $derived(summarySize.size);
  let updateSummaryPanelSize = $derived(summarySize.updateSize);
  const presetId = createPresetId();
  let isChatMode = $derived(category === 'chat');
  let supportsReferenceImage = $derived(
    category === 'image' || category === 'video',
  );
  let selectedToolsStorageKey = $derived(
    presetStorageKey(
      category === 'image'
        ? SELECTED_IMAGE_TOOLS_STORAGE_KEY
        : category === 'video'
          ? SELECTED_VIDEO_TOOLS_STORAGE_KEY
          : SELECTED_TOOLS_STORAGE_KEY,
      presetId,
    ),
  );
  let toolLabel = $derived(TOOL_CATEGORY_LABELS[category]);
  const toolState = createEnabledTools(() => category);
  let enabledTools = $derived(toolState.tools);
  let allToolIds = $derived.by(() => enabledTools.map((tool) => tool.id));
  const selection = createSelectedTools(
    () => allToolIds,
    () => selectedToolsStorageKey,
  );
  let selectedToolIds = $derived(selection.selectedToolIds);
  let setSelectedToolIds = $derived(selection.setSelectedToolIds);
  const webviewElementsRef: { current: Record<string, HTMLElement> } = {
    current: {},
  };
  let inputHistory: string[] = $state.raw([]);
  function setInputHistory(
    next:
      | typeof inputHistory
      | ((previous: typeof inputHistory) => typeof inputHistory),
  ) {
    inputHistory =
      typeof next === 'function' ? untrack(() => next(inputHistory)) : next;
  }
  const lastReferenceImageRef: { current: ReferenceImage | null | null } = {
    current: null,
  };
  const inputDelivery = createWebviewInput(() => selectedToolIds);
  let deliveryStates = $derived(inputDelivery.deliveryStates);
  let sendInput = $derived(inputDelivery.sendInput);
  let retry = $derived(inputDelivery.retry);
  let clearStates = $derived(inputDelivery.clearStates);
  const proxyState = createProxyRevision();
  let proxyRevision = $derived(proxyState.revision);
  const collection = createResponseCollection();
  let isCollecting = $derived(collection.isCollecting);
  let isSummarizing = $derived(collection.isSummarizing);
  let isCollectBusy = $derived(collection.isBusy);
  let summaryDocument = $derived(collection.document);
  let panelOpen = $derived(collection.panelOpen);
  let collectError = $derived(collection.error);
  let summarizeWarning = $derived(collection.summarizeWarning);
  let collectAndSummarize = $derived(collection.collectAndSummarize);
  let closePanel = $derived(collection.closePanel);
  let clearDocument = $derived(collection.clearDocument);
  let setPanelOpen = $derived(collection.setPanelOpen);
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };
  const handleSend = async (content: string) => {
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
  };
  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedToolIds(selectedIds);
    clearStates();
  };
  const handleRetry = async (toolId: string) => {
    const lastInput = inputHistory[0] || inputValue.trim();
    if (!lastInput && !lastReferenceImageRef.current) return;

    const webviewElement = webviewElementsRef.current[toolId];
    if (!webviewElement) return;

    await retry(
      toolId,
      lastInput,
      webviewElement,
      lastReferenceImageRef.current,
    );
  };
  const handleWebviewRef = (toolId: string, element: HTMLElement | null) => {
    if (element) {
      webviewElementsRef.current[toolId] = element;
    } else {
      delete webviewElementsRef.current[toolId];
    }
  };
  $effect(() => {
    void category;
    void setSelectedToolIds;
    return untrack(() => {
      if (category !== 'image') {
        return;
      }

      registerImageGenEnsureHandler(async (toolId) => {
        const current = selectedToolIds;
        if (!current.includes(toolId)) {
          setSelectedToolIds([...current, toolId]);
        }

        for (let attempt = 0; attempt < 60; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));

          if (!selectedToolIds.includes(toolId)) {
            continue;
          }

          activateImageToolTab(toolId);

          const ids = getWebContentsIdMap([toolId], webviewElementsRef.current);
          const webContentsId = ids[toolId];
          if (webContentsId) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return { success: true, webContentsId };
          }
        }

        return { success: false, error: `未找到 ${toolId} 的 webview` };
      });

      return () => {
        unregisterImageGenEnsureHandler();
      };
    });
  });
  const handleCollectResponses = async () => {
    const question = inputHistory[0] || inputValue.trim();
    await collectAndSummarize(
      selectedToolIds,
      webviewElementsRef.current,
      question,
    );
  };
  const handleTogglePanel = () => {
    if (panelOpen) {
      closePanel();
    } else {
      setPanelOpen(true);
      if (!summaryDocument) {
        void handleCollectResponses();
      }
    }
  };
  const handleConversationAction = async (action: 'newChat' | 'recentChat') => {
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
            tool.url,
          );
          if (!result.success) {
            console.warn(
              `[${tool.name}] ${action === 'newChat' ? '新建对话' : '最近对话'}失败:`,
              result.error,
            );
          }
        }),
      );
    } finally {
      setIsConversationAction(false);
    }
  };
</script>

{#if isChatMode}<ResizableWorkspace
    open={panelOpen}
    size={summaryPanelSize}
    onResize={updateSummaryPanelSize}
  >
    <div class={styles.workspace} role="main" aria-label="多 Webview 工具">
      <div class={styles.main} role="region" aria-label="Webview 内容区域">
        <MultiWebviewGrid
          tools={enabledTools}
          {selectedToolIds}
          {deliveryStates}
          {proxyRevision}
          onRetry={handleRetry}
          onWebviewRef={handleWebviewRef}
        ></MultiWebviewGrid>
      </div>
      <div class={styles.footer} role="region" aria-label="输入和工具选择">
        <div class={styles.composerDock}>
          <div class={styles.footerToolbar}>
            <div class={styles.composerTitle}>
              <span class={styles.composerIcon}
                ><Icon name="MessagesSquare" size={17}></Icon></span
              >
              <span
                ><strong>多平台对话</strong><small
                  >同时发送到 {selectedToolIds.length} 个平台</small
                ></span
              >
            </div>
            <div class={styles.toolbarActions}>
              <button
                type="button"
                class={styles.collectToolbarButton}
                onclick={() => handleConversationAction('recentChat')}
                disabled={isConversationAction || selectedToolIds.length === 0}
                title="在所有已选平台回到最近一次对话"
              >
                <Icon name="History" size={16}></Icon>
                {#if isConversationAction}切换中…{:else}最近对话{/if}
              </button>
              <button
                type="button"
                class={styles.collectToolbarButton}
                onclick={() => handleConversationAction('newChat')}
                disabled={isConversationAction || selectedToolIds.length === 0}
                title="在所有已选平台新建对话"
              >
                <Icon name="MessageSquarePlus" size={16}></Icon> 新建对话
              </button>
              <button
                type="button"
                class={styles.collectToolbarButton}
                onclick={handleCollectResponses}
                disabled={isCollectBusy || selectedToolIds.length === 0}
                title={isSummarizing
                  ? '正在调用 LLM 生成智能汇总'
                  : isCollecting
                    ? '正在从各平台提取回复'
                    : '收集各平台 AI 回复并生成汇总文档'}
              >
                <Icon name="FileText" size={16}></Icon>
                {#if isSummarizing}LLM 汇总中…{:else}{#if isCollecting}收集中…{:else}收集回复{/if}{/if}
              </button>
              <button
                type="button"
                class={`${styles.panelToggleButton} ${panelOpen ? styles.panelToggleActive : ''}`}
                onclick={handleTogglePanel}
                title={panelOpen ? '隐藏汇总面板' : '显示汇总面板'}
                aria-pressed={panelOpen}
              >
                <Icon name="PanelRight" size={16}></Icon> 汇总
              </button>
            </div>
          </div>
          <div class={styles.composerBody}>
            <ToolSelector
              tools={enabledTools}
              {selectedToolIds}
              onSelectionChange={handleSelectionChange}
            ></ToolSelector>
            <UnifiedInput
              value={inputValue}
              onChange={handleInputChange}
              onSend={handleSend}
              {isSending}
              placeholder="向已选平台同时提问…"
            ></UnifiedInput>
          </div>
        </div>
      </div>
    </div>
    {#snippet summary()}<ResponseSummaryPanel
        document={summaryDocument}
        {isCollecting}
        {isSummarizing}
        isBusy={isCollectBusy}
        error={collectError}
        {summarizeWarning}
        onClose={closePanel}
        onCollect={handleCollectResponses}
        onClear={clearDocument}
      ></ResponseSummaryPanel>{/snippet}
  </ResizableWorkspace>{:else}<div
    class={styles.workspace}
    role="main"
    aria-label={`${toolLabel}工具`}
  >
    <div class={styles.main} role="region" aria-label="Webview 内容区域">
      <MultiWebviewGrid
        tools={enabledTools}
        {selectedToolIds}
        {deliveryStates}
        {proxyRevision}
        onRetry={handleRetry}
        onWebviewRef={handleWebviewRef}
      ></MultiWebviewGrid>
    </div>
    <div class={styles.footer} role="region" aria-label="输入和工具选择">
      <div class={styles.composerDock}>
        <div class={styles.footerToolbar}>
          <div class={styles.composerTitle}>
            <span class={styles.composerIcon}
              ><Icon
                name={category === 'video' ? 'Clapperboard' : 'Image'}
                size={17}
              ></Icon></span
            >
            <span
              ><strong
                >{#if category === 'video'}视频创作台{:else}图像创作台{/if}</strong
              ><small>同步创作 · {selectedToolIds.length} 个平台</small></span
            >
          </div>
        </div>
        <div class={styles.composerBody}>
          <ToolSelector
            tools={enabledTools}
            {selectedToolIds}
            onSelectionChange={handleSelectionChange}
          ></ToolSelector>
          <UnifiedInput
            value={inputValue}
            onChange={handleInputChange}
            onSend={handleSend}
            {isSending}
            placeholder={`描述你想生成的${toolLabel}内容、风格与镜头…`}
            enableReferenceImage={supportsReferenceImage}
            {referenceImage}
            onReferenceImageChange={setReferenceImage}
            {referenceImageError}
            onReferenceImageError={setReferenceImageError}
          ></UnifiedInput>
        </div>
      </div>
    </div>
  </div>{/if}
