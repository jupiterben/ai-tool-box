<script lang="ts">
  import styles from './ToolSelector.module.css';
  let {
    label,
    checked,
    indeterminate,
    disabled,
    onToggle,
  }: {
    label: string;
    checked: boolean;
    indeterminate: boolean;
    disabled: boolean;
    onToggle: () => void;
  } = $props();
</script>

<label class={styles.groupLabel}>
  <input
    type="checkbox"
    {checked}
    {indeterminate}
    {disabled}
    onchange={onToggle}
    class={styles.checkbox}
    aria-label={`${label} 全选`}
  />
  <span>{label}</span>
</label>
