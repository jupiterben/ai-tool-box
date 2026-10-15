<script lang="ts">
  import { untrack, type Component } from 'svelte';
  import styles from '../styles/App.module.css';

  let { load }: { load: () => Promise<{ default: Component }> } = $props();
  // Each kept-alive page owns its load promise for its entire lifetime.
  const page = untrack(() => load());
</script>

{#await page}
  <div class={styles.emptyPage}><p>加载中...</p></div>
{:then module}
  <module.default />
{:catch error}
  <div class={styles.emptyPage} role="alert">页面加载失败：{String(error)}</div>
{/await}
