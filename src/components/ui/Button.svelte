<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import styles from './Button.module.css';
  let {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    class: className = '',
    children,
    type = 'button',
    ...props
  }: HTMLButtonAttributes & {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
  } = $props();
</script>

<button
  {type}
  class={[
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    fullWidth && styles['button--full-width'],
    className,
  ]
    .filter(Boolean)
    .join(' ')}
  {...props}
>
  {@render children?.()}
</button>
