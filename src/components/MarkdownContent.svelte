<script lang="ts">
  import { renderMarkdown } from '../utils/markdown';
  import styles from './MarkdownContent.module.css';

  let { content, className = '' }: { content: string; className?: string } =
    $props();
  let html = $derived(renderMarkdown(content));
</script>

<div class={`${styles.markdownContent} ${className}`}>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown sanitizes with DOMPurify. -->
  {@html html}
</div>
