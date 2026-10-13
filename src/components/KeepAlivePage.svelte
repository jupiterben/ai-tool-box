<script lang="ts">
  import type { Snippet } from 'svelte';
  import styles from './KeepAlivePage.module.css';
  let {
    id,
    active,
    children,
  }: { id: string; active: boolean; children: Snippet } = $props();
</script>

<div
  id={`page-${id}`}
  aria-hidden={!active}
  inert={!active}
  class={`${styles.pageSlot} ${active ? styles.pageSlotActive : styles.pageSlotHidden}`}
>
  {@render children()}
</div>
