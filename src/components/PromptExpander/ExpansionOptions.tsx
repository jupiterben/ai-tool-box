/**
 * 拓展方向展示和选择组件
 * 
 * 展示AI生成的拓展方向，允许用户选择
 */

import { Button } from '../ui/Button';
import styles from './ExpansionOptions.module.css';

export interface ExpansionOptionsProps {
  options: Array<{
    id: string;
    title: string;
    description: string;
    generatedAt: string;
  }>;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export const ExpansionOptions: React.FC<ExpansionOptionsProps> = ({
  options,
  selectedId,
  onSelect,
  onConfirm,
  isLoading = false,
  error,
  onRetry,
}) => {
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p className={styles.errorTitle}>生成拓展方向失败</p>
          <p className={styles.errorMessage}>{error}</p>
          {onRetry && (
            <Button onClick={onRetry} variant="primary">
              重试
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>正在生成拓展方向...</p>
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>暂无拓展方向</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>选择拓展方向</h2>
        <p className={styles.description}>
          请选择一个您想要深入拓展的方向
        </p>
      </div>

      <div className={styles.optionsList}>
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <div
              key={option.id}
              className={`${styles.optionCard} ${isSelected ? styles['optionCard--selected'] : ''}`}
              onClick={() => !isLoading && onSelect(option.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                  e.preventDefault();
                  onSelect(option.id);
                }
              }}
              aria-pressed={isSelected}
            >
              <div className={styles.optionHeader}>
                <h3 className={styles.optionTitle}>{option.title}</h3>
                {isSelected && (
                  <div className={styles.selectedIndicator}>
                    <span className={styles.checkmark}>✓</span>
                  </div>
                )}
              </div>
              <p className={styles.optionDescription}>{option.description}</p>
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        {selectedId && (
          <>
            <Button
              variant="outline"
              onClick={() => onSelect('')}
              disabled={isLoading}
            >
              取消选择
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={isLoading}
            >
              确认选择
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExpansionOptions;
