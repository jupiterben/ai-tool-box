<script lang="ts" generics="T extends string">
  import styles from './SegmentControl.module.css';
  interface Props {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    ariaLabel?: string;
    className?: string;
  }
  let {
    options,
    value,
    onChange,
    disabled = false,
    ariaLabel,
    className = '',
  }: Props = $props();
</script>

<div
  class={`${styles.segment} ${className}`}
  role="group"
  aria-label={ariaLabel}
>
  {#each options as option (option.value)}
    <button
      type="button"
      class={`${styles.button} ${value === option.value ? styles.active : ''}`}
      onclick={() => onChange(option.value)}
      {disabled}
      aria-pressed={value === option.value}
    >
      {option.label}
    </button>
  {/each}
</div>
