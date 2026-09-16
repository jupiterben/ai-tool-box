<script lang="ts">
  import type { Snippet } from 'svelte';
  import styles from './KeepAlivePage.module.css';
  let {
    id,
    active,
    children,
  }: { id: string; active: boolean; children: Snippet } = $props();
  let container: HTMLDivElement;

  $effect(() => {
    const visible = active;
    const update = () =>
      container.querySelectorAll<HTMLElement>('webview').forEach((node) => {
        node.style.display = visible ? 'inline-flex' : 'none';
      });
    update();
    const observer = new MutationObserver(update);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
</script>

<div
  bind:this={container}
  id={`page-${id}`}
  aria-hidden={!active}
  inert={!active}
  class={`${styles.pageSlot} ${active ? styles.pageSlotActive : styles.pageSlotHidden}`}
>
  {@render children()}
</div>
