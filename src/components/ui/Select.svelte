<script lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import styles from './Select.module.css';

  interface Props extends HTMLSelectAttributes {
    compact?: boolean;
    className?: string;
    onChange?: HTMLSelectAttributes['onchange'];
  }
  let {
    compact = false,
    className = '',
    children,
    onChange,
    ...props
  }: Props = $props();
</script>

<select
  {...props}
  onchange={onChange}
  class={[styles.select, compact && styles.selectCompact, className]
    .filter(Boolean)
    .join(' ')}
>
  {@render children?.()}
</select>
