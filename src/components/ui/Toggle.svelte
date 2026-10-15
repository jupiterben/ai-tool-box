<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import styles from './Toggle.module.css';
  interface Props extends Omit<HTMLInputAttributes, 'type'> {
    label?: string;
    className?: string;
    onChange?: HTMLInputAttributes['onchange'];
  }
  let { label, className = '', disabled, onChange, ...props }: Props = $props();
</script>

<label
  class={`${styles.toggle} ${className}`}
  title={disabled ? undefined : props.title}
>
  <input
    {...props}
    type="checkbox"
    class={styles.input}
    {disabled}
    aria-label={label}
    onchange={onChange}
  />
  <span class={styles.track} aria-hidden="true"
    ><span class={styles.thumb}></span></span
  >
</label>
