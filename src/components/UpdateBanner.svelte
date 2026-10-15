<script lang="ts">
  import { createAutoUpdate } from '../state/autoUpdate.svelte';
  import Button from './ui/Button.svelte';
  import styles from './UpdateBanner.module.css';
  const updates = createAutoUpdate();
  let status = $derived(updates.status);
  let message = $derived.by(() => {
    switch (status?.state) {
      case 'available':
        return status.version
          ? `发现新版本 v${status.version}，正在下载...`
          : '发现新版本，正在下载...';
      case 'downloading':
        return `正在下载更新${status.percent != null ? `（${status.percent}%）` : ''}...`;
      case 'downloaded':
        return status.version
          ? `新版本 v${status.version} 已就绪`
          : '新版本已就绪';
      case 'error':
        return status.message
          ? `更新检查失败：${status.message}`
          : '更新检查失败';
      default:
        return '';
    }
  });
</script>

{#if updates.visible && status}
  <div class={styles.banner} role="status">
    <span class={styles.message}>{message}</span>
    {#if status.state === 'downloaded'}
      <div class={styles.actions}>
        <Button size="sm" onClick={() => void updates.installUpdate()}
          >立即重启安装</Button
        >
        <Button variant="ghost" size="sm" onClick={updates.dismiss}>稍后</Button
        >
      </div>
    {:else if status.state === 'error'}
      <div class={styles.actions}>
        <Button variant="ghost" size="sm" onClick={updates.dismiss}>关闭</Button
        >
      </div>
    {/if}
  </div>
{/if}
