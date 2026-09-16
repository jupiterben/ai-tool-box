<script lang="ts">
  import type { Component } from 'svelte';
  import MainLayout from './components/MainLayout.svelte';
  import KeepAlivePage from './components/KeepAlivePage.svelte';
  import type { ToolPage } from './components/Sidebar.svelte';
  import { useTheme } from './hooks/useTheme.svelte';
  import { useProxySettings } from './hooks/useProxySettings.svelte';
  import { useGeolocationSettings } from './hooks/useGeolocationSettings.svelte';
  import { useSessionSettings } from './hooks/useSessionSettings.svelte';
  import styles from './styles/App.module.css';

  const pages: ToolPage[] = [
    { id: 'multi-webview', name: '对话', iconName: 'Globe' },
    { id: 'image-webview', name: '生图', iconName: 'Image' },
    { id: 'llm-settings', name: 'LLM 设置', iconName: 'Sparkles' },
    { id: 'tool-settings', name: '网站管理', iconName: 'Grid' },
    { id: 'environment-settings', name: '网络与定位', iconName: 'MapPin' },
  ];
  const loaders: Record<string, () => Promise<{ default: Component }>> = {
    'multi-webview': () => import('./components/MultiWebviewTool.svelte'),
    'image-webview': () => import('./components/ImageWebviewTool.svelte'),
    'llm-settings': () =>
      import('./components/LlmSettings/LlmSettingsPage.svelte'),
    'tool-settings': () =>
      import('./components/ToolSettings/ToolSettingsPage.svelte'),
    'environment-settings': () =>
      import('./components/EnvironmentSettings/EnvironmentSettingsPage.svelte'),
  };
  let activePageId = $state('multi-webview');
  let visited = $state.raw([
    { id: 'multi-webview', module: loaders['multi-webview']() },
  ]);
  useTheme();
  useProxySettings();
  useGeolocationSettings();
  useSessionSettings();

  function changePage(id: string) {
    if (!visited.some((page) => page.id === id))
      visited = [...visited, { id, module: loaders[id]() }];
    activePageId = id;
  }
</script>

<MainLayout {pages} {activePageId} onPageChange={changePage}>
  {#each visited as page (page.id)}
    <KeepAlivePage id={page.id} active={activePageId === page.id}>
      {#await page.module}
        <div class={styles.emptyPage}><p>加载中...</p></div>
      {:then module}
        <module.default />
      {:catch error}
        <div class={styles.emptyPage} role="alert">
          {error instanceof Error ? error.message : '页面加载失败'}
        </div>
      {/await}
    </KeepAlivePage>
  {/each}
</MainLayout>
