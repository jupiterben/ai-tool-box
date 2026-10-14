<script module lang="ts">
  import type { IconName } from './ui/Icon.svelte';

  export interface ToolPage {
    id: string;
    name: string;
    icon?: string;
    iconName?: IconName;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './ui/Icon.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import styles from './Sidebar.module.css';

  let { pages, activePageId, onPageChange }: {
    pages: ToolPage[];
    activePageId: string;
    onPageChange: (pageId: string) => void;
  } = $props();
  let isCollapsed = $state(false);
  const groups = $derived([
    { label: '工作区', pages: pages.filter((page) => !page.id.endsWith('settings')) },
    { label: '设置', pages: pages.filter((page) => page.id.endsWith('settings')) },
  ]);

  onMount(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    isCollapsed = media.matches;
    const update = (event: MediaQueryListEvent) => { isCollapsed = event.matches; };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
</script>

<svelte:window onkeydown={(event) => {
  if (event.key === 'Escape' && window.innerWidth < 1024) isCollapsed = true;
}} />

<aside
  class={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
  data-collapsed={isCollapsed}
>
  <div class={styles.header}>
    {#if !isCollapsed}
      <div class={styles.brand}>
        <div class={styles.logo}><Icon name="Layers3" size={20} /></div>
        <span class={styles.title}>AI Tool Box</span>
      </div>
    {/if}
    <button
      type="button"
      class={styles.toggleButton}
      onclick={() => (isCollapsed = !isCollapsed)}
      aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      title={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      aria-expanded={!isCollapsed}
      aria-controls="sidebar-navigation"
    >
      <Icon name={isCollapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={18} />
    </button>
  </div>
  <nav id="sidebar-navigation" class={styles.nav} aria-label="工具导航">
    {#each groups as group (group.label)}
      <div class={styles.navGroup} role="group" aria-label={group.label}>
        {#if !isCollapsed}<span class={styles.groupLabel}>{group.label}</span>{/if}
        {#each group.pages as page (page.id)}
          <button
            type="button"
            class={`${styles.navItem} ${activePageId === page.id ? styles.active : ''}`}
            onclick={() => onPageChange(page.id)}
            aria-label={`切换到 ${page.name}`}
            aria-current={activePageId === page.id ? 'page' : undefined}
            title={page.name}
          >
            {#if page.iconName}<Icon name={page.iconName} size={18} />
            {:else if page.icon}<span aria-hidden="true">{page.icon}</span>{/if}
            {#if !isCollapsed}<span class={styles.name}>{page.name}</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
  </nav>
  <div class={styles.footer}>
    {#if !isCollapsed}<span class={styles.footerLabel}>外观</span>{/if}
    <ThemeToggle />
  </div>
</aside>
