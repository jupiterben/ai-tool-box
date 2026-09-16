<script lang="ts">
  import type { ResponseSummaryDocument } from '../utils/responseSummaryDocument';
  import { downloadMarkdownFile } from '../utils/responseSummaryDocument';
  import MarkdownContent from './MarkdownContent.svelte';
  import Button from './ui/Button.svelte';
  import Icon from './ui/Icon.svelte';
  import styles from './ResponseSummaryPanel.module.css';
  interface ResponseSummaryPanelProps {
    document: ResponseSummaryDocument | null;
    isCollecting: boolean;
    isSummarizing?: boolean;
    isBusy?: boolean;
    error: string | null;
    summarizeWarning?: string | null;
    onClose: () => void;
    onCollect: () => void;
    onClear: () => void;
  }
  let {
    document,
    isCollecting,
    isSummarizing = false,
    isBusy: isBusyProp,
    error,
    summarizeWarning,
    onClose,
    onCollect,
    onClear,
  }: ResponseSummaryPanelProps = $props();
  const handleDownload = () => {
    if (!document) return;
    const safeName = document.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    const filename = `${safeName}_${Date.now()}.md`;
    downloadMarkdownFile(filename, document.markdown);
  };
  let isBusy = $derived(isBusyProp ?? (isCollecting || isSummarizing));
  let statusText = $derived(
    isCollecting
      ? '正在从各 Webview 提取回复…'
      : isSummarizing
        ? '正在调用 LLM 生成智能汇总…'
        : null,
  );
</script>

<aside class={styles.panel} aria-label="回复汇总面板">
  <header class={styles.header}>
    <h2 class={styles.title}>回复汇总</h2>
    <div class={styles.headerActions}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class={styles.iconButton}
        onclick={onCollect}
        disabled={isBusy}
        title="重新收集"
        aria-label="重新收集回复"
      >
        <Icon name="RefreshCw" size={16}></Icon>
      </Button><Button
        type="button"
        variant="ghost"
        size="sm"
        class={styles.iconButton}
        onclick={handleDownload}
        disabled={!document}
        title="下载 Markdown"
        aria-label="下载汇总文档"
      >
        <Icon name="Download" size={16}></Icon>
      </Button><Button
        type="button"
        variant="ghost"
        size="sm"
        class={styles.iconButton}
        onclick={onClose}
        title="关闭面板"
        aria-label="关闭汇总面板"
      >
        <Icon name="X" size={16}></Icon>
      </Button>
    </div>
  </header>
  <div class={styles.toolbar}>
    <Button
      type="button"
      variant="primary"
      size="sm"
      class={styles.collectButton}
      onclick={onCollect}
      disabled={isBusy}
    >
      {isSummarizing
        ? 'LLM 汇总中…'
        : isCollecting
          ? '收集中…'
          : '收集各平台回复'}
    </Button>{#if document}<Button
        type="button"
        variant="secondary"
        size="sm"
        class={styles.clearButton}
        onclick={onClear}
      >
        清空
      </Button>{/if}
  </div>
  {#if error}<div class={styles.error} role="alert">
      {error}
    </div>{/if}{#if summarizeWarning}<div class={styles.warning} role="status">
      {summarizeWarning}
    </div>{/if}
  <div class={styles.content}>
    {#if !document && !isBusy}<p class={styles.placeholder}>
        向各 AI 发送问题并等待回复后，点击「收集各平台回复」生成 LLM
        智能汇总文档。
      </p>{/if}{#if statusText}<p class={styles.placeholder}>
        {statusText}
      </p>{/if}{#if document && !isBusy}{#if document.llmSummarized}<section
          class={styles.section}
        >
          <h3 class={styles.sectionTitle}>AI 智能汇总</h3>
          <div class={styles.markdownBox}>
            <MarkdownContent content={document.llmMarkdown ?? document.markdown}
            ></MarkdownContent>
          </div>
        </section>{/if}{#if document.question}<section class={styles.section}>
          <h3 class={styles.sectionTitle}>问题</h3>
          <p class={styles.question}>{document.question}</p>
        </section>{/if}
      <section class={styles.section}>
        <h3 class={styles.sectionTitle}>收集状态</h3>
        <div class={styles.markdownBox}>
          <MarkdownContent content={document.summarySection}></MarkdownContent>
        </div>
      </section>
      <section class={styles.section}>
        <h3 class={styles.sectionTitle}>各平台原文</h3>
        {#each document.responses as item (item.toolId)}<article
            class={styles.responseCard}
          >
            <h4 class={styles.responseTitle}>{item.toolName}</h4>
            {#if item.success}<div class={styles.markdownBox}>
                <MarkdownContent content={item.content}></MarkdownContent>
              </div>{:else}<p class={styles.responseError}>
                {item.error || '未获取到回复'}
              </p>{/if}
          </article>{/each}
      </section>{/if}
  </div>
</aside>
