<script lang="ts">
  import { type Snippet } from 'svelte';

  import styles from './KeepAlivePage.module.css';
  interface KeepAlivePageProps {
    id: string;
    active: boolean;
    children: Snippet;
  }
  let { id, active, children }: KeepAlivePageProps = $props();
</script>

<div
  id={`page-${id}`}
  role="tabpanel"
  aria-hidden={!active}
  {...!active ? { inert: true } : {}}
  class={`${styles.pageSlot} ${active ? styles.pageSlotActive : styles.pageSlotHidden}`}
>
  {@render children?.()}
</div>
