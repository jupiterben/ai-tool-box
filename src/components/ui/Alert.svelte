<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import styles from './Alert.module.css';
  let {
    variant = 'info',
    children,
    class: className = '',
    ...props
  }: HTMLAttributes<HTMLDivElement> & {
    variant?: 'success' | 'error' | 'info' | 'warning';
  } = $props();
</script>

<div
  class={`${styles.alert} ${styles[variant]} ${className}`}
  role={variant === 'error' ? 'alert' : 'status'}
  {...props}
>
  {@render children?.()}
</div>
