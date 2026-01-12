import React, { useState, useCallback, useRef } from 'react';
import UnifiedInput from './UnifiedInput';
import ToolSelector from './ToolSelector';
import MultiWebviewGrid from './MultiWebviewGrid';
import { DEFAULT_TOOLS } from '../config/tools';
import { useWebviewInput } from '../hooks/useWebviewInput';
import styles from './MultiWebviewTool.module.css';

const MultiWebviewTool: React.FC = () => {
  // 统一输入状态
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  
  // 工具选择状态（默认选中所有工具）
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    DEFAULT_TOOLS.map((tool) => tool.id)
  );
  
  // Webview 元素引用
  const webviewElementsRef = useRef<Record<string, HTMLElement>>({});
  
  // 输入历史（当前会话）
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  
  // 使用 useWebviewInput Hook
  const { deliveryStates, sendInput, retry, clearStates } = useWebviewInput(
    selectedToolIds
  );

  // 处理输入变化
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  // 处理发送
  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) {
        return;
      }

      setIsSending(true);
      clearStates();

      try {
        await sendInput(content, webviewElementsRef.current);
        
        // 添加到输入历史（最多50条）
        setInputHistory((prev) => {
          const newHistory = [content, ...prev].slice(0, 50);
          return newHistory;
        });
        
        // 清空输入框
        setInputValue('');
      } catch (error) {
        console.error('发送输入失败:', error);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, sendInput, clearStates]
  );

  // 处理工具选择变化
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedToolIds(selectedIds);
    clearStates();
  }, [clearStates]);

  // 处理重试
  const handleRetry = useCallback(
    async (toolId: string) => {
      const lastInput = inputHistory[0];
      if (!lastInput) {
        return;
      }

      const webviewElement = webviewElementsRef.current[toolId];
      if (!webviewElement) {
        return;
      }

      await retry(toolId, lastInput, webviewElement);
    },
    [retry, inputHistory]
  );

  // 处理 webview 引用
  const handleWebviewRef = useCallback((toolId: string, element: HTMLElement | null) => {
    if (element) {
      webviewElementsRef.current[toolId] = element;
      console.log(`[MultiWebviewTool] Webview 引用已保存: ${toolId}`, {
        totalRefs: Object.keys(webviewElementsRef.current).length,
        refs: Object.keys(webviewElementsRef.current),
      });
    } else {
      delete webviewElementsRef.current[toolId];
      console.log(`[MultiWebviewTool] Webview 引用已删除: ${toolId}`);
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <UnifiedInput
          value={inputValue}
          onChange={handleInputChange}
          onSend={handleSend}
          isSending={isSending}
        />
        <ToolSelector
          tools={DEFAULT_TOOLS}
          selectedToolIds={selectedToolIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>
      <div className={styles.main}>
        <MultiWebviewGrid
          tools={DEFAULT_TOOLS}
          selectedToolIds={selectedToolIds}
          deliveryStates={deliveryStates}
          onRetry={handleRetry}
          onWebviewRef={handleWebviewRef}
        />
      </div>
    </div>
  );
};

export default MultiWebviewTool;
