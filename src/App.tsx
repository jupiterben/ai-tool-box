import React, { useState, useCallback, useMemo } from 'react';
import ToolSwitcher from './components/ToolSwitcher';
import AIFrame from './components/AIFrame';
import { DEFAULT_TOOLS } from './config/tools';
import { AITool } from './types/ai-tool';
import styles from './styles/App.module.css';

const App: React.FC = () => {
  const [currentToolId, setCurrentToolId] = useState<string>(
    DEFAULT_TOOLS[0]?.id || 'chatgpt'
  );

  const currentTool: AITool | undefined = useMemo(
    () => DEFAULT_TOOLS.find((tool) => tool.id === currentToolId),
    [currentToolId]
  );

  // 使用 useCallback 优化性能，避免不必要的重渲染
  const handleToolChange = useCallback((toolId: string) => {
    setCurrentToolId(toolId);
  }, []);

  return (
    <div className={styles.app}>
      <ToolSwitcher
        tools={DEFAULT_TOOLS}
        currentToolId={currentToolId}
        onToolChange={handleToolChange}
      />
      <main className={styles.main}>
        {currentTool ? (
          <AIFrame
            key={currentToolId} // 使用 key 强制重新渲染 webview 当工具切换时
            url={currentTool.url}
            toolName={currentTool.name}
            onLoad={() => {
              console.log(`${currentTool.name} 加载成功`);
            }}
            onError={(error) => {
              console.error(`加载错误: ${error}`);
            }}
          />
        ) : (
          <div className={styles.error}>未找到工具配置</div>
        )}
      </main>
    </div>
  );
};

export default App;
