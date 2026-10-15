<script lang="ts">
  import styles from './ErrorMessage.module.css';
  interface ErrorMessageProps {
    message: string;
    onRetry?: () => void;
  }
  let { message, onRetry }: ErrorMessageProps = $props();
</script>

<div class={styles.errorContainer} role="alert">
  <div class={styles.errorIcon}>⚠️</div>
  <div class={styles.errorMessage}>{message}</div>
  {#if onRetry}<button class={styles.retryButton} onclick={onRetry}>
      重试
    </button>{/if}
</div>
