<script lang="ts">
  import { type Snippet } from 'svelte';

  import Sidebar from './Sidebar.svelte';
  import type { ToolPage } from '../types/ui.ts';
  import styles from './MainLayout.module.css';
  interface MainLayoutProps {
    pages: ToolPage[];
    activePageId: string;
    onPageChange: (pageId: string) => void;
    children: Snippet;
  }
  let { pages, activePageId, onPageChange, children }: MainLayoutProps =
    $props();
</script>

<div class={styles.layout}>
  <Sidebar {pages} {activePageId} {onPageChange}></Sidebar>
  <main class={styles.content}>
    <div class={styles.pageContainer}>{@render children?.()}</div>
  </main>
</div>
