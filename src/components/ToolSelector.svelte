<script lang="ts">
  import type { AITool } from '../types/ai-tool';
  import { groupToolsByRegion } from '../config/tools';
  import styles from './ToolSelector.module.css';
  interface ToolSelectorProps {
    tools: AITool[];
    selectedToolIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
  }
  import GroupSelectCheckbox from './GroupSelectCheckbox.svelte';
  let { tools, selectedToolIds, onSelectionChange }: ToolSelectorProps =
    $props();
  let selectedSet = $derived.by(() => new Set(selectedToolIds));
  let isMinSelection = $derived.by(() => selectedToolIds.length === 1);
  let toolGroups = $derived.by(() => groupToolsByRegion(tools));
  const handleToggle = (toolId: string) => {
    const isSelected = selectedSet.has(toolId);
    if (isSelected && isMinSelection) {
      return;
    }
    const newSelection = isSelected
      ? selectedToolIds.filter((id) => id !== toolId)
      : [...selectedToolIds, toolId];
    onSelectionChange(newSelection);
  };
  const handleGroupToggle = (toolIds: string[]) => {
    const allSelected = toolIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      const remaining = selectedToolIds.filter((id) => !toolIds.includes(id));
      if (remaining.length === 0) return;
      onSelectionChange(remaining);
      return;
    }
    const merged = new Set([...selectedToolIds, ...toolIds]);
    onSelectionChange([...merged]);
  };
</script>

<div class={styles.container} role="group" aria-label="选择 AI 工具">
  {#each toolGroups as group (group.region)}{@const groupToolIds =
      group.tools.map((tool) => tool.id)}{@const selectedCount =
      groupToolIds.filter((id) =>
        selectedSet.has(id),
      ).length}{@const allSelected =
      selectedCount === groupToolIds.length}{@const isIndeterminate =
      selectedCount > 0 && !allSelected}{@const isGroupDisabled =
      allSelected && selectedToolIds.length === selectedCount}
    <div class={styles.group} role="group" aria-label={group.label}>
      <GroupSelectCheckbox
        label={group.label}
        checked={allSelected}
        indeterminate={isIndeterminate}
        disabled={isGroupDisabled}
        onToggle={() => handleGroupToggle(groupToolIds)}
      ></GroupSelectCheckbox>
      <div class={styles.groupItems}>
        {#each group.tools as tool (tool.id)}{@const isSelected =
            selectedSet.has(tool.id)}{@const isDisabled =
            isSelected && isMinSelection}
          <label class={styles.label}>
            <input
              type="checkbox"
              aria-label={`选择 ${tool.name}`}
              checked={isSelected}
              onchange={() => handleToggle(tool.id)}
              disabled={isDisabled}
              class={styles.checkbox}
            />
            <span class={styles.toolName}>{tool.name}</span>
          </label>{/each}
      </div>
    </div>{/each}
</div>
