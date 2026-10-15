<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import styles from './Input.module.css';

  interface Props extends Omit<HTMLInputAttributes, 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    className?: string;
    autoComplete?: HTMLInputAttributes['autocomplete'];
    onChange?: HTMLInputAttributes['oninput'];
    onKeyDown?: HTMLInputAttributes['onkeydown'];
  }
  const uid = $props.id();
  let {
    label,
    error,
    helperText,
    className = '',
    id,
    onChange,
    onKeyDown,
    autoComplete,
    ...props
  }: Props = $props();
  let inputId = $derived(id || `input-${uid}`);
</script>

<div class={styles.inputWrapper}>
  {#if label}<label for={inputId} class={styles.label}>{label}</label>{/if}
  <input
    {...props}
    id={inputId}
    autocomplete={autoComplete}
    oninput={onChange}
    onkeydown={onKeyDown}
    class={[styles.input, error && styles['input--error'], className]
      .filter(Boolean)
      .join(' ')}
    aria-invalid={!!error}
    aria-describedby={error
      ? `${inputId}-error`
      : helperText
        ? `${inputId}-helper`
        : undefined}
  />
  {#if error}
    <span id={`${inputId}-error`} class={styles.errorText} role="alert"
      >{error}</span
    >
  {:else if helperText}
    <span id={`${inputId}-helper`} class={styles.helperText}>{helperText}</span>
  {/if}
</div>
