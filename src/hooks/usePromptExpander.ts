/**
 * Prompt迭代拓展核心逻辑Hook
 * 
 * 管理整个迭代拓展流程的状态和操作
 */

import { useState, useCallback } from 'react';
import { useAIService } from './useAIService';
import type {
  PromptExpanderState,
  ExpansionOption,
  ExpansionStep,
  ExpansionHistory,
  FinalPrompt,
} from '../types/prompt-expander';

const initialState: PromptExpanderState = {
  initialRequirement: '',
  currentIteration: 0,
  currentStep: null,
  expansionHistory: null,
  finalPrompt: null,
  isLoading: false,
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function usePromptExpander() {
  const [state, setState] = useState<PromptExpanderState>(initialState);
  const aiService = useAIService();

  // 设置初始需求
  const setInitialRequirement = useCallback((requirement: string) => {
    setState(prev => ({
      ...prev,
      initialRequirement: requirement,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // 开始拓展
  const startExpansion = useCallback(async () => {
    const requirement = state.initialRequirement.trim();
    if (!requirement || requirement.length < 10) {
      setState(prev => ({
        ...prev,
        error: '初始需求至少需要10个字符',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      currentIteration: 1,
      isLoading: true,
      error: null,
      expansionHistory: {
        steps: [],
        totalIterations: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
      updatedAt: new Date().toISOString(),
    }));

    try {
      const options = await aiService.generateExpansionOptions(
        requirement,
        '',
        1
      );

      const step: ExpansionStep = {
        iteration: 1,
        options,
        selectedOptionId: null,
        selectedAt: null,
        createdAt: new Date().toISOString(),
      };

      setState(prev => ({
        ...prev,
        currentStep: step,
        expansionHistory: prev.expansionHistory ? {
          ...prev.expansionHistory,
          steps: [step],
          totalIterations: 1,
        } : null,
        isLoading: false,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '生成拓展方向失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [state.initialRequirement, aiService]);

  // 选择拓展方向
  const selectExpansionOption = useCallback((optionId: string) => {
    setState(prev => {
      if (!prev.currentStep) return prev;
      
      return {
        ...prev,
        currentStep: {
          ...prev.currentStep,
          selectedOptionId: optionId,
          selectedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  // 确认选择并继续
  const confirmSelection = useCallback(async () => {
    const prevState = state;
    if (!prevState.currentStep || !prevState.currentStep.selectedOptionId) {
      return;
    }

    const selectedOption = prevState.currentStep.options.find(
      opt => opt.id === prevState.currentStep!.selectedOptionId
    );

    if (!selectedOption) {
      return;
    }

    // 更新当前步骤的选择
    const updatedStep: ExpansionStep = {
      ...prevState.currentStep,
      selectedOptionId: prevState.currentStep.selectedOptionId,
      selectedAt: new Date().toISOString(),
    };

    // 构建上下文（包含之前的选择）
    const context = prevState.expansionHistory?.steps
      .filter(s => s.selectedOptionId)
      .map(s => {
        const opt = s.options.find(o => o.id === s.selectedOptionId);
        return opt ? `${opt.title}: ${opt.description}` : '';
      })
      .join('\n') || '';

    const newContext = context 
      ? `${context}\n${selectedOption.title}: ${selectedOption.description}`
      : `${selectedOption.title}: ${selectedOption.description}`;

    const nextIteration = prevState.currentIteration + 1;

    setState(prev => ({
      ...prev,
      currentStep: updatedStep,
      expansionHistory: prev.expansionHistory ? {
        ...prev.expansionHistory,
        steps: [...prev.expansionHistory.steps.map((s, i) => 
          i === prev.expansionHistory!.steps.length - 1 ? updatedStep : s
        )],
      } : null,
      currentIteration: nextIteration,
      isLoading: true,
      error: null,
      updatedAt: new Date().toISOString(),
    }));

    // 如果达到10次迭代，生成最终提示词
    if (nextIteration > 10) {
      setState(prev => ({
        ...prev,
        expansionHistory: prev.expansionHistory ? {
          ...prev.expansionHistory,
          completedAt: new Date().toISOString(),
        } : null,
        currentIteration: 10,
        updatedAt: new Date().toISOString(),
      }));
      
      // 生成最终提示词
      try {
        await generateFinalPrompt();
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '生成最终提示词失败',
          updatedAt: new Date().toISOString(),
        }));
      }
      return;
    }

    try {
      const options = await aiService.generateExpansionOptions(
        prevState.initialRequirement,
        newContext,
        nextIteration
      );

      const newStep: ExpansionStep = {
        iteration: nextIteration,
        options,
        selectedOptionId: null,
        selectedAt: null,
        createdAt: new Date().toISOString(),
      };

      setState(prev => ({
        ...prev,
        currentStep: newStep,
        expansionHistory: prev.expansionHistory ? {
          ...prev.expansionHistory,
          steps: [...prev.expansionHistory.steps, newStep],
          totalIterations: nextIteration,
        } : null,
        isLoading: false,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '生成拓展方向失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [state, aiService]);

  // 提前完成
  const completeEarly = useCallback(async () => {
    const prevState = state;
    if (!prevState.expansionHistory || prevState.expansionHistory.steps.length < 5) {
      setState(prev => ({
        ...prev,
        error: '至少需要完成5次迭代才能提前完成',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    // 更新历史记录为完成状态
    setState(prev => ({
      ...prev,
      expansionHistory: prev.expansionHistory ? {
        ...prev.expansionHistory,
        completedAt: new Date().toISOString(),
      } : null,
      isLoading: true,
      error: null,
      updatedAt: new Date().toISOString(),
    }));

    // 生成最终提示词（将在Phase 7实现）
    try {
      await generateFinalPrompt();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '生成最终提示词失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [state, generateFinalPrompt]);

  // 生成最终提示词
  const generateFinalPrompt = useCallback(async () => {
    const prevState = state;
    if (!prevState.expansionHistory || !prevState.initialRequirement) {
      setState(prev => ({
        ...prev,
        error: '缺少必要的数据',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      updatedAt: new Date().toISOString(),
    }));

    try {
      const prompt = await aiService.generateFinalPrompt(
        prevState.initialRequirement,
        prevState.expansionHistory
      );

      setState(prev => ({
        ...prev,
        finalPrompt: prompt,
        isLoading: false,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '生成最终提示词失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [state, aiService]);

  // 重新生成提示词
  const regeneratePrompt = useCallback(async () => {
    await generateFinalPrompt();
  }, [generateFinalPrompt]);

  // 保存提示词
  const savePrompt = useCallback(async () => {
    const prevState = state;
    if (!prevState.finalPrompt || !prevState.expansionHistory || !prevState.initialRequirement) {
      setState(prev => ({
        ...prev,
        error: '没有可保存的提示词',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    try {
      const savedPrompt = {
        id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        initialRequirement: prevState.initialRequirement,
        expansionHistory: prevState.expansionHistory,
        finalPrompt: prevState.finalPrompt,
        metadata: {
          createdAt: prevState.createdAt,
          savedAt: new Date().toISOString(),
          iterationCount: prevState.expansionHistory.totalIterations,
          version: '1.0.0',
        },
      };

      const response = await (window as any).electronAPI?.invoke('storage:save-prompt', {
        prompt: savedPrompt,
      });

      if (!response.success) {
        throw new Error(response.error || '保存失败');
      }

      // 显示成功提示（可以通过toast或状态更新）
      setState(prev => ({
        ...prev,
        error: null,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '保存提示词失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [state]);

  // 导出提示词
  const exportPrompt = useCallback(async (format: 'txt' | 'md') => {
    const prevState = state;
    if (!prevState.finalPrompt || !prevState.expansionHistory) {
      setState(prev => ({
        ...prev,
        error: '没有可导出的提示词',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    try {
      const response = await (window as any).electronAPI?.invoke('export:save-prompt-file', {
        prompt: prevState.finalPrompt,
        format,
        includeMetadata: true,
        metadata: {
          initialRequirement: prevState.initialRequirement,
          iterationCount: prevState.expansionHistory.totalIterations,
          createdAt: prevState.finalPrompt.generatedAt,
        },
      });

      if (!response.success) {
        if (response.cancelled) {
          // 用户取消了，不显示错误
          return;
        }
        throw new Error(response.error || '导出失败');
      }

      // 显示成功提示
      setState(prev => ({
        ...prev,
        error: null,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '导出提示词失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [state]);

  // 重置
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // 重试
  const retry = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      updatedAt: new Date().toISOString(),
    }));

    try {
      if (prev.currentIteration === 0) {
        // 重试开始拓展
        await startExpansion();
      } else if (prev.currentStep && !prev.currentStep.selectedOptionId) {
        // 重试生成拓展方向
        const requirement = prev.initialRequirement;
        const context = prev.expansionHistory?.steps
          .filter(s => s.selectedOptionId)
          .map(s => {
            const opt = s.options.find(o => o.id === s.selectedOptionId);
            return opt ? `${opt.title}: ${opt.description}` : '';
          })
          .join('\n') || '';

        const options = await aiService.generateExpansionOptions(
          requirement,
          context,
          prev.currentIteration
        );

        const step: ExpansionStep = {
          iteration: prev.currentIteration,
          options,
          selectedOptionId: null,
          selectedAt: null,
          createdAt: new Date().toISOString(),
        };

        setState(prevState => ({
          ...prevState,
          currentStep: step,
          isLoading: false,
          updatedAt: new Date().toISOString(),
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '操作失败',
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [startExpansion, aiService]);

  return {
    state,
    setInitialRequirement,
    startExpansion,
    selectExpansionOption,
    confirmSelection,
    completeEarly,
    generateFinalPrompt,
    regeneratePrompt,
    savePrompt,
    exportPrompt,
    reset,
    clearError,
    retry,
  };
}
