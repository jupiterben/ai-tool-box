import { memo, useCallback } from 'react';
import type { ResponseSummaryDocument } from '../utils/responseSummaryDocument';
import { downloadMarkdownFile } from '../utils/responseSummaryDocument';
import Icon from './ui/Icon';
import styles from './ResponseSummaryPanel.module.css';

interface ResponseSummaryPanelProps {
  open: boolean;
  document: ResponseSummaryDocument | null;
  isCollecting: boolean;
  error: string | null;
  onClose: () => void;
  onCollect: () => void;
  onClear: () => void;
}

const ResponseSummaryPanel: React.FC<ResponseSummaryPanelProps> = memo(({
  open,
  document,
  isCollecting,
  error,
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
          {isCollecting ? '收集中…' : '收集各平台回复'}
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

      <div className={styles.content}>
        {!document && !isCollecting && (
          <p className={styles.placeholder}>
            向各 AI 发送问题并等待回复后，点击「收集各平台回复」生成汇总文档。
          </p>
        )}

        {isCollecting && (
          <p className={styles.placeholder}>正在从各 Webview 提取回复…</p>
        )}

        {document && (
          <>
            {document.question && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>问题</h3>
                <p className={styles.question}>{document.question}</p>
              </section>
            )}

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>概要</h3>
              <pre className={styles.summary}>{document.summarySection}</pre>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>详细回复</h3>
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
