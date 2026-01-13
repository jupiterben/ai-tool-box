/**
 * 最终提示词展示组件
 * 
 * 展示生成的最终提示词，支持复制、保存、导出
 */

import { useState, useCallback } from 'react';
import { Button } from '../ui/Button';
import { countWords, countParagraphs } from '../../utils/promptFormatter';
import type { FinalPrompt } from '../../types/prompt-expander';
import styles from './FinalPrompt.module.css';

export interface FinalPromptProps {
  prompt: FinalPrompt;
  onCopy: () => void;
  onSave: () => void;
  onExport: (format: 'txt' | 'md') => void;
  onRegenerate?: () => void;
  isLoading?: boolean;
}

export const FinalPromptComponent: React.FC<FinalPromptProps> = ({
  prompt,
  onCopy,
  onSave,
  onExport,
  onRegenerate,
  isLoading = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, [prompt.content, onCopy]);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      await onSave();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '保存失败');
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 3000);
    }
  }, [onSave]);

  const handleExport = useCallback(async (format: 'txt' | 'md') => {
    setExportStatus('exporting');
    setErrorMessage('');
    try {
      await onExport(format);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error) {
      setExportStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '导出失败');
      setTimeout(() => {
        setExportStatus('idle');
        setErrorMessage('');
      }, 3000);
    }
  }, [onExport]);

  const wordCount = prompt.wordCount || countWords(prompt.content);
  const paragraphCount = prompt.paragraphCount || countParagraphs(prompt.content);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>生成的提示词</h2>
        <div className={styles.stats}>
          <span className={styles.statItem}>字数: {wordCount}</span>
          <span className={styles.statItem}>段落: {paragraphCount}</span>
        </div>
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.content}>
          <pre className={styles.textContent}>{prompt.content}</pre>
        </div>
      </div>

      {errorMessage && (
        <div className={styles.errorMessage} role="alert">
          {errorMessage}
        </div>
      )}

      <div className={styles.actions}>
        <Button
          variant="outline"
          onClick={handleCopy}
          disabled={isLoading}
        >
          {copied ? '已复制' : '复制'}
        </Button>
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={isLoading || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'success' ? '已保存' : '保存'}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleExport('txt')}
          disabled={isLoading || exportStatus === 'exporting'}
        >
          {exportStatus === 'exporting' ? '导出中...' : exportStatus === 'success' ? '已导出' : '导出为TXT'}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleExport('md')}
          disabled={isLoading || exportStatus === 'exporting'}
        >
          导出为MD
        </Button>
        {onRegenerate && (
          <Button
            variant="primary"
            onClick={onRegenerate}
            disabled={isLoading}
          >
            重新生成
          </Button>
        )}
      </div>
    </div>
  );
};

export default FinalPromptComponent;
