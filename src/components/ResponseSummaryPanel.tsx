import { memo, useCallback } from 'react';
import type { ResponseSummaryDocument } from '../utils/responseSummaryDocument';
import { downloadMarkdownFile } from '../utils/responseSummaryDocument';
import MarkdownContent from './MarkdownContent';
import { Button } from './ui/Button';
import Icon from './ui/Icon';
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

const ResponseSummaryPanel: React.FC<ResponseSummaryPanelProps> = memo(({
  document,
  isCollecting,
  isSummarizing = false,
  isBusy: isBusyProp,
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

  const isBusy = isBusyProp ?? (isCollecting || isSummarizing);

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.iconButton}
            onClick={onCollect}
            disabled={isBusy}
            title="重新收集"
            aria-label="重新收集回复"
          >
            <Icon name="RefreshCw" size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.iconButton}
            onClick={handleDownload}
            disabled={!document}
            title="下载 Markdown"
            aria-label="下载汇总文档"
          >
            <Icon name="Download" size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.iconButton}
            onClick={onClose}
            title="关闭面板"
            aria-label="关闭汇总面板"
          >
            <Icon name="X" size={16} />
          </Button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={styles.collectButton}
          onClick={onCollect}
          disabled={isBusy}
        >
          {isSummarizing ? 'LLM 汇总中…' : isCollecting ? '收集中…' : '收集各平台回复'}
        </Button>
        {document && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.clearButton}
            onClick={onClear}
          >
            清空
          </Button>
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
        {!document && !isBusy && (
          <p className={styles.placeholder}>
            向各 AI 发送问题并等待回复后，点击「收集各平台回复」生成 LLM 智能汇总文档。
          </p>
        )}

        {statusText && (
          <p className={styles.placeholder}>{statusText}</p>
        )}

        {document && !isBusy && (
          <>
            {document.llmSummarized && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>AI 智能汇总</h3>
                <div className={styles.markdownBox}>
                  <MarkdownContent content={document.llmMarkdown ?? document.markdown} />
                </div>
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
              <div className={styles.markdownBox}>
                <MarkdownContent content={document.summarySection} />
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>各平台原文</h3>
              {document.responses.map((item) => (
                <article key={item.toolId} className={styles.responseCard}>
                  <h4 className={styles.responseTitle}>{item.toolName}</h4>
                  {item.success ? (
                    <div className={styles.markdownBox}>
                      <MarkdownContent content={item.content} />
                    </div>
                  ) : (
                    <p className={styles.responseError}>
                      {item.error || '未获取到回复'}
                    </p>
                  )}
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </aside>
  );
});

ResponseSummaryPanel.displayName = 'ResponseSummaryPanel';

export default ResponseSummaryPanel;
