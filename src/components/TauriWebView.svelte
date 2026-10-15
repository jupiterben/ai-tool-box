<script lang="ts">
  import { untrack } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { mountGuest } from '../desktop/webview';
  import type { TauriWebViewElement } from '../types/ui';

  interface Props {
    src?: string;
    style?: string;
    partition?: string;
    webpreferences?: string;
    'data-tool-id'?: string;
    'data-thread-id'?: string;
    'aria-label'?: string;
    ref?: (element: TauriWebViewElement | null) => void;
  }
  let {
    src = '',
    partition,
    style,
    ref,
    'data-tool-id': toolId = '',
    'data-thread-id': threadId,
    'aria-label': ariaLabel,
  }: Props = $props();
  let host: HTMLDivElement;
  let error = $state('');
  // Worker status updates must not recreate a native guest with the same identity.
  let guestIdentity = $derived(JSON.stringify([src, partition, toolId, threadId]));

  $effect(() => {
    if (!isTauri()) return;
    void guestIdentity;
    return untrack(() =>
      mountGuest(
        host,
        { src, partition, toolId, threadId },
        (element) => ref?.(element),
        (message) => {
          error = message;
        },
      ),
    );
  });
</script>

<div
  bind:this={host}
  {style}
  data-native-webview
  data-tool-id={toolId}
  data-thread-id={threadId}
  aria-label={ariaLabel}
>
  {#if error}
    <div role="alert">{error}</div>
  {:else if !isTauri()}
    <div role="status">网站内容仅在 Tauri 桌面应用中可用</div>
  {/if}
</div>
