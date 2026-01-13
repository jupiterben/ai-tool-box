/**
 * Prompt迭代拓展生成工具主组件
 * 
 * 管理整个迭代拓展流程
 */

import { useState } from 'react';
import { usePromptExpander } from '../../hooks/usePromptExpander';
import ErrorBoundary from './ErrorBoundary';
import InitialInput from './InitialInput';
import ExpansionOptions from './ExpansionOptions';
import IterationProgress from './IterationProgress';
import FinalPromptComponent from './FinalPrompt';
import HistoryView from './HistoryView';
import styles from './PromptExpander.module.css';

const PromptExpanderContent: React.FC = () => {
  const {
    state,
    setInitialRequirement,
    startExpansion,
    selectExpansionOption,
    confirmSelection,
    completeEarly,
    generateFinalPrompt,
    savePrompt,
    exportPrompt,
    reset,
    clearError,
    retry,
  } = usePromptExpander();

  const [showHistory, setShowHistory] = useState(false);

  // 初始输入阶段
  if (state.currentIteration === 0) {
    return (
      <div className={styles.container}>
        <InitialInput
          value={state.initialRequirement}
          onChange={setInitialRequirement}
          onSubmit={startExpansion}
          disabled={state.isLoading}
          error={state.error || undefined}
        />
      </div>
    );
  }

  // 迭代拓展阶段
  if (state.currentIteration > 0 && state.currentIteration <= 10 && !state.finalPrompt) {
    // 加载状态
    if (state.isLoading && !state.currentStep) {
      return (
        <div className={styles.container}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>正在生成拓展方向...</p>
            <p>当前迭代: {state.currentIteration}</p>
          </div>
        </div>
      );
    }

    // 错误状态
    if (state.error && !state.currentStep) {
      return (
        <div className={styles.container}>
          <div className={styles.error}>
            <p className={styles.errorTitle}>生成拓展方向失败</p>
            <p className={styles.errorMessage}>{state.error}</p>
            <div className={styles.errorActions}>
              <button onClick={retry} className={styles.retryButton}>
                重试
              </button>
              <button onClick={clearError} className={styles.cancelButton}>
                返回
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 显示拓展方向选择
    if (state.currentStep) {
      return (
        <div className={styles.container}>
          <IterationProgress
            currentIteration={state.currentIteration}
            totalIterations={10}
            minIterations={5}
            onComplete={completeEarly}
            canComplete={state.currentIteration >= 5}
          />
          
          {state.expansionHistory && (
            <div className={styles.historyToggle}>
              <button
                className={styles.historyButton}
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? '隐藏' : '显示'}历史记录
              </button>
            </div>
          )}

          {showHistory && state.expansionHistory && (
            <HistoryView
              history={state.expansionHistory}
              expanded={showHistory}
              onToggleExpand={() => setShowHistory(!showHistory)}
            />
          )}

          <ExpansionOptions
            options={state.currentStep.options}
            selectedId={state.currentStep.selectedOptionId}
            onSelect={selectExpansionOption}
            onConfirm={confirmSelection}
            isLoading={state.isLoading}
            error={state.error || undefined}
            onRetry={retry}
          />
        </div>
      );
    }

    return null;
  }

  // 最终提示词展示阶段
  if (state.finalPrompt) {
    return (
      <div className={styles.container}>
        {state.isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>正在生成最终提示词...</p>
          </div>
        ) : (
          <>
            {state.expansionHistory && (
              <div className={styles.historyToggle}>
                <button
                  className={styles.historyButton}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? '隐藏' : '显示'}历史记录
                </button>
              </div>
            )}

            {showHistory && state.expansionHistory && (
              <HistoryView
                history={state.expansionHistory}
                expanded={showHistory}
                onToggleExpand={() => setShowHistory(!showHistory)}
              />
            )}

            <FinalPromptComponent
              prompt={state.finalPrompt}
              onCopy={() => {}}
              onSave={savePrompt}
              onExport={exportPrompt}
              onRegenerate={generateFinalPrompt}
              isLoading={state.isLoading}
            />
          </>
        )}
      </div>
    );
  }

  return null;
};

export const PromptExpander: React.FC = () => {
  return (
    <ErrorBoundary>
      <PromptExpanderContent />
    </ErrorBoundary>
  );
};

export default PromptExpander;
