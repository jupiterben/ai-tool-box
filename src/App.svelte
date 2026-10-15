<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import MainLayout from './components/MainLayout.svelte';
  import KeepAlivePage from './components/KeepAlivePage.svelte';
  import LazyPage from './components/LazyPage.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import ImageGenBridge from './components/ImageGenBridge.svelte';
  import { APP_NAVIGATE_EVENT } from './services/imageGenBridge';
  import { createTheme } from './state/theme.svelte';
  import type { ToolPage } from './types/ui';

  const pages: ToolPage[] = [
    { id: 'multi-webview', name: '对话', iconName: 'Globe' },
    { id: 'image-webview', name: '生图', iconName: 'Image' },
    { id: 'video-webview', name: '生视频', iconName: 'Video' },
    { id: 'api-webview', name: 'API', iconName: 'Workflow' },
    { id: 'agent-cli', name: 'Agent CLI', iconName: 'TerminalSquare' },
    { id: 'settings', name: '设置', iconName: 'Settings' },
  ];
  const loaders: Record<string, () => Promise<{ default: Component }>> = {
    'multi-webview': () => import('./components/MultiWebviewTool.svelte'),
    'image-webview': () => import('./components/ImageWebviewTool.svelte'),
    'video-webview': () => import('./components/VideoWebviewTool.svelte'),
    'api-webview': () => import('./components/ApiWebviewPage.svelte'),
    'agent-cli': () =>
      import('./components/AgentCliSettings/AgentCliPage.svelte'),
    settings: () => import('./components/settings/SettingsPage.svelte'),
  };
  let activePageId = $state('multi-webview');
  let visited = $state.raw(['multi-webview', 'image-webview']);
  createTheme();

  function ensureVisited(id: string) {
    if (loaders[id] && !visited.includes(id)) visited = [...visited, id];
  }

  function navigate(id: string) {
    if (!loaders[id]) return;
    ensureVisited(id);
    activePageId = id;
  }

  onMount(() => {
    const onNavigate = (event: Event) =>
      navigate((event as CustomEvent<{ pageId: string }>).detail?.pageId);
    const onEnsureVisited = (event: Event) =>
      ensureVisited((event as CustomEvent<{ pageId: string }>).detail?.pageId);
    window.addEventListener(APP_NAVIGATE_EVENT, onNavigate);
    window.addEventListener('app:ensure-visited', onEnsureVisited);
    return () => {
      window.removeEventListener(APP_NAVIGATE_EVENT, onNavigate);
      window.removeEventListener('app:ensure-visited', onEnsureVisited);
    };
  });
</script>

<MainLayout {pages} {activePageId} onPageChange={navigate}>
  {#each pages as page (page.id)}
    {#if visited.includes(page.id)}
      <KeepAlivePage id={page.id} active={activePageId === page.id}>
        <LazyPage load={loaders[page.id]} />
      </KeepAlivePage>
    {/if}
  {/each}
</MainLayout>
<ImageGenBridge />
<UpdateBanner />
