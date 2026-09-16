<script lang="ts">
  import type { AITool } from '../types/ai-tool';
  import styles from './ToolSwitcher.module.css';
  interface ToolSwitcherProps {
    tools: AITool[];
    currentToolId: string;
    onToolChange: (toolId: string) => void;
  }
  let { tools, currentToolId, onToolChange }: ToolSwitcherProps = $props();
  const handleKeyDown = (e: KeyboardEvent, toolId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToolChange(toolId);
    }
  };
</script>

<div class={styles.switcher} role="tablist" aria-label="AI 工具切换">
  {#each tools as tool (tool.id)}<button
      class={`${styles.button} ${
        currentToolId === tool.id ? styles.active : ''
      }`}
      onclick={() => onToolChange(tool.id)}
      role="tab"
      aria-selected={currentToolId === tool.id}
      aria-controls={`tool-${tool.id}`}
      onkeydown={(e) => handleKeyDown(e, tool.id)}
    >
      {tool.name}
    </button>{/each}
</div>
