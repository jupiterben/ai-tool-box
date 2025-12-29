import { useState, useCallback, useRef } from 'react';
import { AITool } from '../types/ai-tool';
import { InputDeliveryState } from '../types/input-delivery';
import { getInputSelector } from '../utils/inputSelectors';
import { handleWebviewInput, WebviewInputHandlerConfig } from '../components/WebviewInputHandler';

export interface UseWebviewInputReturn {
  deliveryStates: Record<string, InputDeliveryState>;
  sendInput: (content: string, webviewElements: Record<string, HTMLElement>) => Promise<void>;
  retry: (toolId: string, content: string, webviewElement: HTMLElement) => Promise<void>;
  clearStates: () => void;
}

export function useWebviewInput(
  selectedToolIds: string[]
): UseWebviewInputReturn {
  const [deliveryStates, setDeliveryStates] = useState<Record<string, InputDeliveryState>>({});
  const lastInputContentRef = useRef<string>('');
  const lastWebviewElementsRef = useRef<Record<string, HTMLElement>>({});

  const updateDeliveryState = useCallback((toolId: string, updates: Partial<InputDeliveryState>) => {
    setDeliveryStates((prev) => {
      const existing = prev[toolId] || {
        toolId,
        status: 'pending' as const,
        timestamp: Date.now(),
      };
      return {
        ...prev,
        [toolId]: {
          ...existing,
          ...updates,
        },
      };
    });
  }, []);

  const sendInput = useCallback(
    async (content: string, webviewElements: Record<string, HTMLElement>) => {
      if (!content.trim()) {
        return;
      }

      // 保存输入内容和 webview 元素引用
      lastInputContentRef.current = content;
      lastWebviewElementsRef.current = webviewElements;

      // 初始化所有选中工具的状态为 sending
      const initialStates: Record<string, InputDeliveryState> = {};
      selectedToolIds.forEach((toolId) => {
        initialStates[toolId] = {
          toolId,
          status: 'sending',
          timestamp: Date.now(),
        };
      });
      setDeliveryStates(initialStates);

      // 并行向所有选中的 webview 传递输入
      const promises = selectedToolIds.map(async (toolId) => {
        const webviewElement = webviewElements[toolId];
        if (!webviewElement) {
          console.error(`[useWebviewInput] Webview 元素未找到: ${toolId}`, webviewElements);
          updateDeliveryState(toolId, {
            status: 'error',
            errorMessage: 'Webview 元素未找到',
            timestamp: Date.now(),
          });
          return;
        }

        console.log(`[useWebviewInput] 开始向 ${toolId} 传递输入`, {
          hasExecuteJavaScript: typeof (webviewElement as any).executeJavaScript === 'function',
          isLoading: (webviewElement as any).isLoading,
        });

        const selector = getInputSelector(toolId);
        if (!selector) {
          updateDeliveryState(toolId, {
            status: 'error',
            errorMessage: '未找到输入框选择器配置',
            timestamp: Date.now(),
          });
          return;
        }

        const config: WebviewInputHandlerConfig = {
          toolId,
          webviewElement: webviewElement as HTMLElement & { executeJavaScript?: (code: string) => Promise<any> },
          inputContent: content,
          selectors: selector,
          timeout: 5000, // 增加超时时间，等待 webview 加载
        };

        try {
          const result = await handleWebviewInput(config);
          console.log(`[useWebviewInput] ${toolId} 传递结果:`, result);
          updateDeliveryState(toolId, {
            status: result.success ? 'success' : 'error',
            errorMessage: result.error,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error(`[useWebviewInput] ${toolId} 传递失败:`, error);
          updateDeliveryState(toolId, {
            status: 'error',
            errorMessage: error instanceof Error ? error.message : '未知错误',
            timestamp: Date.now(),
          });
        }
      });

      await Promise.all(promises);
    },
    [selectedToolIds, updateDeliveryState]
  );

  const retry = useCallback(
    async (toolId: string, content: string, webviewElement: HTMLElement) => {
      const selector = getInputSelector(toolId);
      if (!selector) {
        updateDeliveryState(toolId, {
          status: 'error',
          errorMessage: '未找到输入框选择器配置',
          timestamp: Date.now(),
        });
        return;
      }

      updateDeliveryState(toolId, {
        status: 'sending',
        timestamp: Date.now(),
      });

      const config: WebviewInputHandlerConfig = {
        toolId,
        webviewElement: webviewElement as HTMLElement & { executeJavaScript?: (code: string) => Promise<any> },
        inputContent: content,
        selectors: selector,
        timeout: 5000, // 增加超时时间，等待 webview 加载
      };

      try {
        const result = await handleWebviewInput(config);
        updateDeliveryState(toolId, {
          status: result.success ? 'success' : 'error',
          errorMessage: result.error,
          timestamp: Date.now(),
        });
      } catch (error) {
        updateDeliveryState(toolId, {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : '未知错误',
          timestamp: Date.now(),
        });
      }
    },
    [updateDeliveryState]
  );

  const clearStates = useCallback(() => {
    setDeliveryStates({});
  }, []);

  return {
    deliveryStates,
    sendInput,
    retry,
    clearStates,
  };
}
