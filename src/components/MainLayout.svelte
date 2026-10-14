<script lang="ts">
  import type { Snippet } from 'svelte';

  import Sidebar, { type ToolPage } from './Sidebar.svelte';
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
  <a class="skip-link" href="#main-content">跳转到主内容</a>
  <Sidebar {pages} {activePageId} {onPageChange}></Sidebar>
  <main id="main-content" tabindex="-1" class={styles.content}>
    <div class={styles.pageContainer}>{@render children?.()}</div>
  </main>
</div>
