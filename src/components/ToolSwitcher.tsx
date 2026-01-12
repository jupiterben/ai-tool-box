import { memo, useCallback } from 'react';
import { AITool } from '../types/ai-tool';
import styles from './ToolSwitcher.module.css';

interface ToolSwitcherProps {
  tools: AITool[];
  currentToolId: string;
  onToolChange: (toolId: string) => void;
}

const ToolSwitcher: React.FC<ToolSwitcherProps> = memo(({
  tools,
  currentToolId,
  onToolChange,
}) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, toolId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToolChange(toolId);
    }
  }, [onToolChange]);

  return (
    <nav className={styles.switcher} role="tablist" aria-label="AI 工具切换">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`${styles.button} ${
            currentToolId === tool.id ? styles.active : ''
          }`}
          onClick={() => onToolChange(tool.id)}
          role="tab"
          aria-selected={currentToolId === tool.id}
          aria-controls={`tool-${tool.id}`}
          onKeyDown={(e) => handleKeyDown(e, tool.id)}
        >
          {tool.name}
        </button>
      ))}
    </nav>
  );
});

ToolSwitcher.displayName = 'ToolSwitcher';

export default ToolSwitcher;
