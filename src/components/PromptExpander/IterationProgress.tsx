/**
 * 迭代进度显示组件
 * 
 * 显示当前迭代次数和进度
 */

import { Button } from '../ui/Button';
import styles from './IterationProgress.module.css';

export interface IterationProgressProps {
  currentIteration: number;
  totalIterations: number;
  minIterations: number;
  onComplete?: () => void;
  canComplete: boolean;
}

export const IterationProgress: React.FC<IterationProgressProps> = ({
  currentIteration,
  totalIterations,
  minIterations,
  onComplete,
  canComplete,
}) => {
  const progress = (currentIteration / totalIterations) * 100;

  return (
    <div className={styles.container}>
      <div className={styles.progressInfo}>
        <span className={styles.iterationText}>
          迭代 {currentIteration} / {totalIterations}
        </span>
        {canComplete && currentIteration >= minIterations && (
          <span className={styles.completeHint}>
            （已达到最小迭代次数，可以提前完成）
          </span>
        )}
      </div>
      
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      {canComplete && currentIteration >= minIterations && onComplete && (
        <div className={styles.actions}>
          <Button
            variant="outline"
            onClick={onComplete}
          >
            完成拓展
          </Button>
        </div>
      )}
    </div>
  );
};

export default IterationProgress;
