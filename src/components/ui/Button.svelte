<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import styles from './Button.module.css';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    className?: string;
    onClick?: HTMLButtonAttributes['onclick'];
    onKeyDown?: HTMLButtonAttributes['onkeydown'];
  }
  let {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
    onClick,
    onKeyDown,
    ...props
  }: Props = $props();
</script>

<button
  {...props}
  onclick={onClick}
  onkeydown={onKeyDown}
  class={[
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    fullWidth && styles['button--full-width'],
    className,
  ]
    .filter(Boolean)
    .join(' ')}
>
  {@render children?.()}
</button>
