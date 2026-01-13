/**
 * AI服务调用Hook
 * 
 * 封装AI服务调用逻辑，通过IPC与主进程通信
 */

import { useState, useCallback } from 'react';
import type {
  ExpansionOption,
  FinalPrompt,
  ExpansionHistory,
  GenerateExpansionOptionsRequest,
  GenerateExpansionOptionsResponse,
  GenerateFinalPromptRequest,
  GenerateFinalPromptResponse,
} from '../types/prompt-expander';

export function useAIService() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    type: 'expansion' | 'final';
    params: any;
  } | null>(null);

  /**
   * 生成拓展方向
   */
  const generateExpansionOptions = useCallback(async (
    requirement: string,
    context: string,
    iteration: number
  ): Promise<ExpansionOption[]> => {
    setIsLoading(true);
    setError(null);

    const request: GenerateExpansionOptionsRequest = {
      initialRequirement: requirement,
      currentContext: context,
      iteration,
      count: 5,
      provider: 'deepseek',
    };

    setLastRequest({ type: 'expansion', params: { requirement, context, iteration } });

    try {
      const response = await (window as any).electronAPI?.invoke(
        'ai:generate-expansion-options',
        request
      ) as GenerateExpansionOptionsResponse;

      if (!response.success || !response.options) {
        throw new Error(response.error || '生成拓展方向失败');
      }

      setIsLoading(false);
      return response.options;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * 生成最终提示词
   */
  const generateFinalPrompt = useCallback(async (
    requirement: string,
    history: ExpansionHistory
  ): Promise<FinalPrompt> => {
    setIsLoading(true);
    setError(null);

    const request: GenerateFinalPromptRequest = {
      initialRequirement: requirement,
      expansionHistory: history,
      format: 'markdown',
      provider: 'deepseek',
    };

    setLastRequest({ type: 'final', params: { requirement, history } });

    try {
      const response = await (window as any).electronAPI?.invoke(
        'ai:generate-final-prompt',
        request
      ) as GenerateFinalPromptResponse;

      if (!response.success || !response.prompt) {
        throw new Error(response.error || '生成最终提示词失败');
      }

      setIsLoading(false);
      return response.prompt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * 重试最后一次请求
   */
  const retry = useCallback(async () => {
    if (!lastRequest) {
      throw new Error('没有可重试的请求');
    }

    setError(null);

    try {
      if (lastRequest.type === 'expansion') {
        const { requirement, context, iteration } = lastRequest.params;
        return await generateExpansionOptions(requirement, context, iteration);
      } else {
        const { requirement, history } = lastRequest.params;
        return await generateFinalPrompt(requirement, history);
      }
    } catch (err) {
      throw err;
    }
  }, [lastRequest, generateExpansionOptions, generateFinalPrompt]);

  return {
    generateExpansionOptions,
    generateFinalPrompt,
    isLoading,
    error,
    retry,
  };
}
