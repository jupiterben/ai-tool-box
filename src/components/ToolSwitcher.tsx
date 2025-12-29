import React from 'react';
import { AITool } from '../types/ai-tool';
import styles from './ToolSwitcher.module.css';

interface ToolSwitcherProps {
  tools: AITool[];
  currentToolId: string;
  onToolChange: (toolId: string) => void;
}

const ToolSwitcher: React.FC<ToolSwitcherProps> = ({
  tools,
  currentToolId,
  onToolChange,
}) => {
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToolChange(tool.id);
            }
          }}
        >
          {tool.name}
        </button>
      ))}
    </nav>
  );
};

export default ToolSwitcher;
