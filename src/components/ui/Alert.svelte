<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import styles from './Alert.module.css';
  interface Props extends HTMLAttributes<HTMLDivElement> {
    variant?: 'success' | 'error' | 'info' | 'warning';
    className?: string;
  }
  let {
    variant = 'info',
    children,
    className = '',
    ...props
  }: Props = $props();
</script>

<div
  {...props}
  class={`${styles.alert} ${styles[variant]} ${className}`}
  role={variant === 'error' ? 'alert' : 'status'}
>
  {@render children?.()}
</div>
