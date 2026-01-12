import { memo, useMemo, useRef, useCallback } from 'react';
import { AITool } from '../types/ai-tool';
import { InputDeliveryState } from '../types/input-delivery';
import { getInputSelector } from '../utils/inputSelectors';
import { preInjectScript } from './WebviewInputHandler';
import styles from './MultiWebviewGrid.module.css';

interface MultiWebviewGridProps {
  tools: AITool[];
  selectedToolIds: string[];
  deliveryStates: Record<string, InputDeliveryState>;
  onRetry?: (toolId: string) => void;
  onWebviewRef?: (toolId: string, element: HTMLElement | null) => void;
}

const MultiWebviewGrid: React.FC<MultiWebviewGridProps> = memo(({
  tools,
  selectedToolIds,
  deliveryStates,
  onRetry,
  onWebviewRef,
}) => {
  const webviewRefs = useRef<Record<string, HTMLElement>>({});

  // 根据选中工具数量计算网格布局
  const gridStyle = useMemo(() => {
    const count = selectedToolIds.length;
    if (count === 1) {
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    } else if (count === 2) {
      return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    } else if (count === 3) {
      return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    } else {
      return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    }
  }, [selectedToolIds.length]);

  // 获取选中的工具
  const selectedTools = useMemo(() => {
    return tools.filter((tool) => selectedToolIds.includes(tool.id));
  }, [tools, selectedToolIds]);

  // 处理 webview 引用 - 使用 useCallback 优化
  const handleWebviewRef = useCallback((toolId: string, element: HTMLElement | null) => {
    if (element) {
      webviewRefs.current[toolId] = element;
      console.log(`[MultiWebviewGrid] Webview 引用已设置: ${toolId}`, {
        hasExecuteJavaScript: typeof (element as any).executeJavaScript === 'function',
      });
      onWebviewRef?.(toolId, element);
    } else {
      delete webviewRefs.current[toolId];
      onWebviewRef?.(toolId, null);
    }
  }, [onWebviewRef]);

  return (
    <div className={styles.grid} style={gridStyle}>
      {selectedTools.map((tool) => {
        const deliveryState = deliveryStates[tool.id];
        const status = deliveryState?.status || 'pending';

        return (
          <div key={tool.id} className={styles.gridItem}>
            <div className={styles.header}>
              <span className={styles.toolName}>{tool.name}</span>
              {status === 'sending' && (
                <span className={styles.status} aria-label="发送中">
                  ⏳
                </span>
              )}
              {status === 'success' && (
                <span className={styles.status} aria-label="发送成功">
                  ✓
                </span>
              )}
              {status === 'error' && (
                <div className={styles.errorContainer}>
                  <span className={styles.status} aria-label="发送失败">
                    ✗
                  </span>
                  {onRetry && (
                    <button
                      className={styles.retryButton}
                      onClick={() => onRetry(tool.id)}
                      aria-label="重试"
                    >
                      重试
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className={styles.webviewContainer} aria-label={`${tool.name} 内容区域`}>
              <webview
                ref={(el) => {
                  if (el) {
                    // 确保 webview 元素正确传递并预注入脚本
                    handleWebviewRef(tool.id, el as HTMLElement);
                  }
                }}
                data-tool-id={tool.id}
                src={tool.url}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'inline-flex',
                }}
                allowpopups="true"
                webpreferences="allowRunningInsecureContent=true, javascript=yes"
                aria-label={`${tool.name} Webview`}
                onDidFinishLoad={async () => {
                  console.log(`[MultiWebviewGrid] ${tool.name} webview 加载完成`);
                  // 在加载完成后预注入脚本
                  const element = webviewRefs.current[tool.id];
                  if (element) {
                    const selector = getInputSelector(tool.id);
                    if (selector) {
                      try {
                        console.log(`[MultiWebviewGrid] ${tool.name} 在 did-finish-load 后预注入脚本`);
                        await preInjectScript(
                          element as HTMLElement & { executeJavaScript?: (code: string) => Promise<any> },
                          selector,
                          5000
                        );
                      } catch (error) {
                        console.error(`[MultiWebviewGrid] ${tool.name} 预注入脚本失败:`, error);
                      }
                    }
                  }
                }}
              />
            </div>
            {deliveryState?.status === 'error' && deliveryState.errorMessage && (
              <div className={styles.errorMessage} role="alert">
                {deliveryState.errorMessage}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

MultiWebviewGrid.displayName = 'MultiWebviewGrid';

export default MultiWebviewGrid;
