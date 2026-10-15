<script lang="ts">
  import { untrack } from 'svelte';
  import styles from './ToolSelector.module.css';
  interface GroupSelectCheckboxProps {
    label: string;
    checked: boolean;
    indeterminate: boolean;
    disabled: boolean;
    onToggle: () => void;
  }
  let {
    label,
    checked,
    indeterminate,
    disabled,
    onToggle,
  }: GroupSelectCheckboxProps = $props();
  let input: HTMLInputElement | undefined = $state.raw();
  $effect(() => {
    void indeterminate;
    return untrack(() => {
      if (input) {
        input.indeterminate = indeterminate;
      }
    });
  });
</script>

<label class={styles.groupLabel}>
  <input
    bind:this={input}
    aria-label={`${label} 全选`}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onToggle();
      }
    }}
    type="checkbox"
    {checked}
    oninput={onToggle}
    {disabled}
    class={styles.checkbox}
  /> <span>{label}</span>
</label>
