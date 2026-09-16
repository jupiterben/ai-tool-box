<script lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import styles from './Select.module.css';
  let {
    compact = false,
    class: className = '',
    children,
    value,
    ...props
  }: HTMLSelectAttributes & { compact?: boolean } = $props();
</script>

<select
  {value}
  class={[styles.select, compact && styles.selectCompact, className]
    .filter(Boolean)
    .join(' ')}
  {...props}
>
  {@render children?.()}
</select>
