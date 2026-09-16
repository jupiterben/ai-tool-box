<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import styles from './Card.module.css';
  let {
    variant = 'default',
    padding = 'md',
    children,
    class: className = '',
    ...props
  }: HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
  } = $props();
</script>

<div
  class={[
    styles.card,
    styles[`card--${variant}`],
    styles[`card--padding-${padding}`],
    className,
  ].join(' ')}
  {...props}
>
  {@render children?.()}
</div>
