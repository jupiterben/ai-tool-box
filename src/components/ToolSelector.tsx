import React from 'react';
import { AITool } from '../types/ai-tool';
import styles from './ToolSelector.module.css';

interface ToolSelectorProps {
  tools: AITool[];
  selectedToolIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

const ToolSelector: React.FC<ToolSelectorProps> = ({
  tools,
  selectedToolIds,
  onSelectionChange,
}) => {
  const handleToggle = (toolId: string) => {
    const isSelected = selectedToolIds.includes(toolId);
    if (isSelected && selectedToolIds.length === 1) {
      // 至少保留一个选中项
      return;
    }
    const newSelection = isSelected
      ? selectedToolIds.filter((id) => id !== toolId)
      : [...selectedToolIds, toolId];
    onSelectionChange(newSelection);
  };

  return (
    <div className={styles.container} role="group" aria-label="选择 AI 工具">
      {tools.map((tool) => {
        const isSelected = selectedToolIds.includes(tool.id);
        return (
          <label
            key={tool.id}
            className={styles.label}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(tool.id);
              }
            }}
            tabIndex={0}
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`选择 ${tool.name}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggle(tool.id)}
              disabled={isSelected && selectedToolIds.length === 1}
              className={styles.checkbox}
              tabIndex={-1}
              aria-hidden="true"
            />
            <span className={styles.toolName}>{tool.name}</span>
          </label>
        );
      })}
    </div>
  );
};

export default ToolSelector;
