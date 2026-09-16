<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked } from 'marked';
  import styles from './MarkdownContent.module.css';
  let { content }: { content: string } = $props();
  const html = $derived(
    DOMPurify.sanitize(marked.parse(content, { async: false, gfm: true }), {
      FORBID_TAGS: ['style', 'input', 'form'],
    }),
  );
</script>

<div class={styles.markdownContent}>{@html html}</div>
