<script module lang="ts">
  export interface ToolPage {
    id: string;
    name: string;
    icon?: string;
    iconName?:
      | 'Globe'
      | 'Settings'
      | 'Zap'
      | 'Layout'
      | 'Grid'
      | 'Code'
      | 'Sparkles'
      | 'MapPin'
      | 'Image';
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import Icon from './ui/Icon.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import styles from './Sidebar.module.css';
  interface SidebarProps {
    pages: ToolPage[];
    activePageId: string;
    onPageChange: (pageId: string) => void;
  }
  let { pages, activePageId, onPageChange }: SidebarProps = $props();
  let isCollapsed = $state.raw(false);
  function setIsCollapsed(
    value:
      typeof isCollapsed | ((prev: typeof isCollapsed) => typeof isCollapsed),
  ) {
    isCollapsed = typeof value === 'function' ? value(isCollapsed) : value;
  }
  $effect(() => {
    return untrack(() => {
      const handleResize = () => {
        setIsCollapsed(window.innerWidth < 1024);
      };

      // 初始检查
      handleResize();

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    });
  });
</script>

<aside class={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
  <div class={styles.header}>
    {#if !isCollapsed}<div class={styles.brand}>
        <div class={styles.logo} aria-hidden="true">
          <Icon name="Sparkles" size={18}></Icon>
        </div>
        <div class={styles.brandText}>
          <h2 class={styles.title}>AI Tool Box</h2>
          <span class={styles.subtitle}>工具集</span>
        </div>
      </div>{/if}
    <button
      class={styles.toggleButton}
      onclick={() => setIsCollapsed(!isCollapsed)}
      aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      aria-expanded={!isCollapsed}
      aria-controls="sidebar-navigation"
    >
      <Icon name={isCollapsed ? 'Menu' : 'X'} size={20} aria-hidden="true"
      ></Icon>
    </button>
  </div>
  {#if !isCollapsed}<nav
      id="sidebar-navigation"
      class={styles.nav}
      aria-label="工具导航"
    >
      {#each pages as page (page.id)}<button
          class={`${styles.navItem} ${activePageId === page.id ? styles.active : ''}`}
          onclick={() => onPageChange(page.id)}
          aria-label={`切换到 ${page.name}`}
          aria-current={activePageId === page.id ? 'page' : undefined}
        >
          {#if page.iconName}<Icon
              name={page.iconName}
              size={20}
              class={styles.icon}
              aria-hidden="true"
            ></Icon>{:else}{#if page.icon}<span
                class={styles.icon}
                aria-hidden="true"
              >
                {page.icon}
              </span>{:else}{/if}{/if}
          <span class={styles.name}>{page.name}</span>
        </button>{/each}
    </nav>
    <div class={styles.footer}>
      <ThemeToggle></ThemeToggle>
    </div>{/if}{#if isCollapsed}<div class={styles.footer}>
      <ThemeToggle></ThemeToggle>
    </div>{/if}
</aside>
