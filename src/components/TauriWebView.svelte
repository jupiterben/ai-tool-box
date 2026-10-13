<script module lang="ts">
  export type { DesktopWebViewElement } from '../desktop/webview';
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { mountGuest, type DesktopWebViewElement } from '../desktop/webview';
  let {
    src,
    partition,
    toolId,
    label,
    incognito = false,
    onElement,
  }: {
    src: string;
    partition: string;
    toolId: string;
    label: string;
    incognito?: boolean;
    onElement: (element: DesktopWebViewElement) => () => void;
  } = $props();
  let host: HTMLDivElement;
  let error = $state('');
  onMount(() => {
    if (!window.desktopAPI) return;
    return mountGuest(host, { src, partition, toolId, incognito }, onElement,
      (message) => { error = message; });
  });
</script>

<div bind:this={host} data-tool-id={toolId} aria-label={label} style="width:100%;height:100%">
  {#if !window.desktopAPI}
    <div class="preview" role="status">
      <p>{label}</p>
      <p>网站内容仅在 Tauri 桌面应用中可用</p>
    </div>
  {/if}
  {#if error}<div class="preview" role="alert">{error}</div>{/if}
</div>

<style>
  .preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }
</style>
