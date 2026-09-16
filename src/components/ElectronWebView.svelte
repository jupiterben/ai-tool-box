<script module lang="ts">
  export type ElectronWebViewElement = HTMLElement & {
    src: string;
    reload?: () => void;
    goBack?: () => void;
    goForward?: () => void;
    canGoBack?: () => boolean;
    canGoForward?: () => boolean;
    executeJavaScript?: (code: string) => Promise<unknown>;
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
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
    onElement: (element: ElectronWebViewElement) => () => void;
  } = $props();
  let host: HTMLDivElement;
  onMount(() => {
    if (!window.electronAPI) return;
    const webview = document.createElement('webview') as ElectronWebViewElement;
    // Partition and listeners must be set before navigation starts.
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('data-tool-id', toolId);
    webview.setAttribute('aria-label', label);
    webview.setAttribute(
      'webpreferences',
      incognito
        ? 'allowRunningInsecureContent=true, javascript=yes, spellcheck=no'
        : 'allowRunningInsecureContent=true, javascript=yes',
    );
    webview.style.cssText = 'width:100%;height:100%;display:inline-flex';
    const cleanup = onElement(webview);
    webview.setAttribute('src', src);
    host.appendChild(webview);
    return () => {
      cleanup();
    };
  });
</script>

<div bind:this={host} style="width:100%;height:100%">
  {#if !window.electronAPI}
    <div class="preview" role="status">
      <p>{label}</p>
      <p>网站内容仅在 Electron 桌面应用中可用</p>
    </div>
  {/if}
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
