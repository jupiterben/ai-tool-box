import { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { AITool } from '../types/ai-tool';
import { groupToolsByRegion } from '../config/tools';
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
  const selectedSet = useMemo(() => new Set(selectedToolIds), [selectedToolIds]);
  const isMinSelection = useMemo(() => selectedToolIds.length === 1, [selectedToolIds.length]);
  const toolGroups = useMemo(() => groupToolsByRegion(tools), [tools]);

  const handleToggle = useCallback((toolId: string) => {
    const isSelected = selectedSet.has(toolId);
    if (isSelected && isMinSelection) {
      return;
    }
    const newSelection = isSelected
      ? selectedToolIds.filter((id) => id !== toolId)
      : [...selectedToolIds, toolId];
    onSelectionChange(newSelection);
  }, [selectedSet, isMinSelection, selectedToolIds, onSelectionChange]);

  const handleGroupToggle = useCallback((toolIds: string[]) => {
    const allSelected = toolIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      const remaining = selectedToolIds.filter((id) => !toolIds.includes(id));
      if (remaining.length === 0) return;
      onSelectionChange(remaining);
      return;
    }
    const merged = new Set([...selectedToolIds, ...toolIds]);
    onSelectionChange([...merged]);
  }, [selectedSet, selectedToolIds, onSelectionChange]);

  return (
    <div className={styles.container} role="group" aria-label="选择 AI 工具">
      {toolGroups.map((group) => {
        const groupToolIds = group.tools.map((tool) => tool.id);
        const selectedCount = groupToolIds.filter((id) => selectedSet.has(id)).length;
        const allSelected = selectedCount === groupToolIds.length;
        const isIndeterminate = selectedCount > 0 && !allSelected;
        const isGroupDisabled = allSelected && selectedToolIds.length === selectedCount;

        return (
        <div
          key={group.region}
          className={styles.group}
          role="group"
          aria-label={group.label}
        >
          <GroupSelectCheckbox
            label={group.label}
            checked={allSelected}
            indeterminate={isIndeterminate}
            disabled={isGroupDisabled}
            onToggle={() => handleGroupToggle(groupToolIds)}
          />
          <div className={styles.groupItems}>
            {group.tools.map((tool) => {
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
        </div>
        );
      })}
    </div>
  );
});

interface GroupSelectCheckboxProps {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onToggle: () => void;
}

const GroupSelectCheckbox: React.FC<GroupSelectCheckboxProps> = memo(({
  label,
  checked,
  indeterminate,
  disabled,
  onToggle,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label
      className={styles.groupLabel}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      tabIndex={disabled ? -1 : 0}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={`${label} 全选`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        className={styles.checkbox}
        tabIndex={-1}
        aria-hidden="true"
      />
      <span>{label}</span>
    </label>
  );
});

GroupSelectCheckbox.displayName = 'GroupSelectCheckbox';

ToolSelector.displayName = 'ToolSelector';

export default ToolSelector;
