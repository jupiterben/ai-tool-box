/**
 * 历史记录查看组件
 * 
 * 显示完整的迭代拓展历史记录
 */

import { useState } from 'react';
import type { ExpansionHistory } from '../../types/prompt-expander';
import styles from './HistoryView.module.css';

export interface HistoryViewProps {
  history: ExpansionHistory;
  onNavigate?: (iteration: number) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onNavigate,
  expanded: controlledExpanded,
  onToggleExpand,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpand || (() => setInternalExpanded(prev => !prev));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>拓展历史</h3>
        <button
          className={styles.toggleButton}
          onClick={toggleExpanded}
          aria-expanded={expanded}
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className={styles.timeline}>
          {history.steps.map((step, index) => {
            const selectedOption = step.selectedOptionId
              ? step.options.find(opt => opt.id === step.selectedOptionId)
              : null;

            return (
              <div key={step.iteration} className={styles.timelineItem}>
                <div className={styles.timelineMarker}>
                  <span className={styles.iterationNumber}>{step.iteration}</span>
                </div>
                <div className={styles.timelineContent}>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepTitle}>迭代 {step.iteration}</span>
                    <span className={styles.stepTime}>
                      {new Date(step.createdAt).toLocaleTimeString('zh-CN')}
                    </span>
                  </div>
                  
                  <div className={styles.optionsList}>
                    <p className={styles.optionsLabel}>生成的拓展方向：</p>
                    {step.options.map((option) => {
                      const isSelected = option.id === step.selectedOptionId;
                      return (
                        <div
                          key={option.id}
                          className={`${styles.optionItem} ${isSelected ? styles['optionItem--selected'] : ''}`}
                        >
                          <div className={styles.optionTitle}>{option.title}</div>
                          {isSelected && (
                            <span className={styles.selectedBadge}>已选择</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selectedOption && (
                    <div className={styles.selectedSection}>
                      <p className={styles.selectedLabel}>选择的方向：</p>
                      <div className={styles.selectedOption}>
                        <strong>{selectedOption.title}</strong>
                        <p>{selectedOption.description}</p>
                      </div>
                    </div>
                  )}

                  {onNavigate && (
                    <button
                      className={styles.navigateButton}
                      onClick={() => onNavigate(step.iteration)}
                    >
                      查看详情
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!expanded && (
        <div className={styles.summary}>
          <p>共完成 {history.totalIterations} 次迭代</p>
          <p>开始时间: {new Date(history.startedAt).toLocaleString('zh-CN')}</p>
          {history.completedAt && (
            <p>完成时间: {new Date(history.completedAt).toLocaleString('zh-CN')}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryView;
