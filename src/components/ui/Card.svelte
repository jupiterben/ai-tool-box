<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import styles from './Card.module.css';
  interface Props extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
  }
  let {
    children,
    variant = 'default',
    padding = 'md',
    className = '',
    ...props
  }: Props = $props();
</script>

<div
  {...props}
  class={[
    styles.card,
    styles[`card--${variant}`],
    styles[`card--padding-${padding}`],
    className,
  ].join(' ')}
>
  {@render children?.()}
</div>
