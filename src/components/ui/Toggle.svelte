<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import styles from './Toggle.module.css';
  let {
    label,
    class: className = '',
    disabled,
    ...props
  }: Omit<HTMLInputAttributes, 'type'> & { label?: string } = $props();
</script>

<label
  class={`${styles.toggle} ${className}`}
  title={disabled ? undefined : props.title}
>
  <input
    type="checkbox"
    class={styles.input}
    {disabled}
    aria-label={label}
    {...props}
  />
  <span class={styles.track} aria-hidden="true">
    <span class={styles.thumb}></span>
  </span>
</label>
