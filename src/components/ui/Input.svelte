<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import styles from './Input.module.css';
  const uid = $props.id();
  let {
    label,
    error,
    helperText,
    class: className = '',
    id = uid,
    ...props
  }: HTMLInputAttributes & {
    label?: string;
    error?: string;
    helperText?: string;
  } = $props();
</script>

<div class={styles.inputWrapper}>
  {#if label}<label for={id} class={styles.label}>{label}</label>{/if}
  <input
    {id}
    class={[styles.input, error && styles['input--error'], className]
      .filter(Boolean)
      .join(' ')}
    aria-invalid={!!error}
    aria-describedby={error
      ? `${id}-error`
      : helperText
        ? `${id}-helper`
        : undefined}
    {...props}
  />
  {#if error}<span id={`${id}-error`} class={styles.errorText} role="alert">
      {error}
    </span>{/if}
  {#if helperText && !error}<span id={`${id}-helper`} class={styles.helperText}>
      {helperText}
    </span>{/if}
</div>
