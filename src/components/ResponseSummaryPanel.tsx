import { memo, useCallback } from 'react';
import type { ResponseSummaryDocument } from '../utils/responseSummaryDocument';
import { downloadMarkdownFile } from '../utils/responseSummaryDocument';
import Icon from './ui/Icon';
import styles from './ResponseSummaryPanel.module.css';

interface ResponseSummaryPanelProps {
  open: boolean;
  document: ResponseSummaryDocument | null;
  isCollecting: boolean;
  isSummarizing?: boolean;
  error: string | null;
  summarizeWarning?: string | null;
  onClose: () => void;
  onCollect: () => void;
  onClear: () => void;
}

const ResponseSummaryPanel: React.FC<ResponseSummaryPanelProps> = memo(({
  open,
  document,
  isCollecting,
  isSummarizing = false,
  error,
  summarizeWarning,
  onClose,
  onCollect,
  onClear,
}) => {
  const handleDownload = useCallback(() => {
    if (!document) return;
    const safeName = document.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    const filename = `${safeName}_${Date.now()}.md`;
    downloadMarkdownFile(filename, document.markdown);
  }, [document]);

  if (!open) {
    return null;
  }

  const statusText = isCollecting
    ? '正在从各 Webview 提取回复…'
    : isSummarizing
      ? '正在调用 LLM 生成智能汇总…'
      : null;

  return (
    <aside className={styles.panel} aria-label="回复汇总面板">
      <header className={styles.header}>
        <h2 className={styles.title}>回复汇总</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onCollect}
            disabled={isCollecting}
            title="重新收集"
            aria-label="重新收集回复"
          >
            <Icon name="RefreshCw" size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleDownload}
            disabled={!document}
            title="下载 Markdown"
            aria-label="下载汇总文档"
          >
            <Icon name="Download" size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            title="关闭面板"
            aria-label="关闭汇总面板"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.collectButton}
          onClick={onCollect}
          disabled={isCollecting}
        >
          {isCollecting ? (isSummarizing ? 'LLM 汇总中…' : '收集中…') : '收集各平台回复'}
        </button>
        {document && (
          <button type="button" className={styles.clearButton} onClick={onClear}>
            清空
          </button>
        )}
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {summarizeWarning && (
        <div className={styles.warning} role="status">
          {summarizeWarning}
        </div>
      )}

      <div className={styles.content}>
        {!document && !isCollecting && (
          <p className={styles.placeholder}>
            向各 AI 发送问题并等待回复后，点击「收集各平台回复」生成 LLM 智能汇总文档。
          </p>
        )}

        {statusText && (
          <p className={styles.placeholder}>{statusText}</p>
        )}

        {document && !isCollecting && (
          <>
            {document.llmSummarized && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>AI 智能汇总</h3>
                <pre className={styles.llmMarkdown}>{document.llmMarkdown ?? document.markdown}</pre>
              </section>
            )}

            {document.question && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>问题</h3>
                <p className={styles.question}>{document.question}</p>
              </section>
            )}

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>收集状态</h3>
              <pre className={styles.summary}>{document.summarySection}</pre>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>各平台原文</h3>
              {document.responses.map((item) => (
                <article key={item.toolId} className={styles.responseCard}>
                  <h4 className={styles.responseTitle}>{item.toolName}</h4>
                  {item.success ? (
                    <pre className={styles.responseBody}>{item.content}</pre>
                  ) : (
                    <p className={styles.responseError}>
                      {item.error || '未获取到回复'}
                    </p>
                  )}
                </article>
              ))}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>完整 Markdown</h3>
              <pre className={styles.markdownPreview}>{document.markdown}</pre>
            </section>
          </>
        )}
      </div>
    </aside>
  );
});

ResponseSummaryPanel.displayName = 'ResponseSummaryPanel';

export default ResponseSummaryPanel;
