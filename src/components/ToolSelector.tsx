import { memo, useCallback, useMemo } from 'react';
import { AITool } from '../types/ai-tool';
import styles from './ToolSelector.module.css';

interface ToolSelectorProps {
  tools: AITool[];
  selectedToolIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

const ToolSelector: React.FC<ToolSelectorProps> = memo(({
  tools,
  selectedToolIds,
  onSelectionChange,
}) => {
  // 使用 useMemo 优化选中状态检查
  const selectedSet = useMemo(() => new Set(selectedToolIds), [selectedToolIds]);
  const isMinSelection = useMemo(() => selectedToolIds.length === 1, [selectedToolIds.length]);

  const handleToggle = useCallback((toolId: string) => {
    const isSelected = selectedSet.has(toolId);
    if (isSelected && isMinSelection) {
      // 至少保留一个选中项
      return;
    }
    const newSelection = isSelected
      ? selectedToolIds.filter((id) => id !== toolId)
      : [...selectedToolIds, toolId];
    onSelectionChange(newSelection);
  }, [selectedSet, isMinSelection, selectedToolIds, onSelectionChange]);

  return (
    <div className={styles.container} role="group" aria-label="选择 AI 工具">
      {tools.map((tool) => {
        const isSelected = selectedSet.has(tool.id);
        const isDisabled = isSelected && isMinSelection;

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
              disabled={isDisabled}
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
});

ToolSelector.displayName = 'ToolSelector';

export default ToolSelector;
