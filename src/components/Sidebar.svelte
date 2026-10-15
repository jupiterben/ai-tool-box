<script lang="ts">
  import { untrack } from 'svelte';

  import Icon from './ui/Icon.svelte';
  import { createPresetId } from '../state/presetContext.svelte';
  import { DEFAULT_PRESET_ID, type PresetMeta } from '../types/preset';
  import styles from './Sidebar.module.css';
  import type { ToolPage } from '../types/ui';
  interface SidebarProps {
    pages: ToolPage[];
    activePageId: string;
    onPageChange: (pageId: string) => void;
  }
  let { pages, activePageId, onPageChange }: SidebarProps = $props();
  let isCollapsed = $state.raw(false);
  function setIsCollapsed(
    next:
      | typeof isCollapsed
      | ((previous: typeof isCollapsed) => typeof isCollapsed),
  ) {
    isCollapsed =
      typeof next === 'function' ? untrack(() => next(isCollapsed)) : next;
  }
  let presets: PresetMeta[] = $state.raw([]);
  function setPresets(
    next: typeof presets | ((previous: typeof presets) => typeof presets),
  ) {
    presets = typeof next === 'function' ? untrack(() => next(presets)) : next;
  }
  let openIds: string[] = $state.raw([]);
  function setOpenIds(
    next: typeof openIds | ((previous: typeof openIds) => typeof openIds),
  ) {
    openIds = typeof next === 'function' ? untrack(() => next(openIds)) : next;
  }
  let menuOpen = $state.raw(false);
  function setMenuOpen(
    next: typeof menuOpen | ((previous: typeof menuOpen) => typeof menuOpen),
  ) {
    menuOpen =
      typeof next === 'function' ? untrack(() => next(menuOpen)) : next;
  }
  let busy = $state.raw(false);
  function setBusy(
    next: typeof busy | ((previous: typeof busy) => typeof busy),
  ) {
    busy = typeof next === 'function' ? untrack(() => next(busy)) : next;
  }
  let error: string | null = $state.raw(null);
  function setError(
    next: typeof error | ((previous: typeof error) => typeof error),
  ) {
    error = typeof next === 'function' ? untrack(() => next(error)) : next;
  }
  const presetId = createPresetId();
  let footer: HTMLDivElement | undefined = $state.raw();
  let settingsPage = $derived(pages.find((page) => page.id === 'settings'));
  let navPages = $derived(pages.filter((page) => page.id !== 'settings'));
  const refreshPresets = async () => {
    const result = await window.desktopAPI?.listPresets?.();
    if (result?.success && result.presets) {
      setPresets(result.presets);
      setOpenIds(result.openIds ?? []);
    }
  };
  $effect(() => {
    void refreshPresets;
    return untrack(() => {
      void refreshPresets();
    });
  });
  $effect(() => {
    return untrack(() => {
      const handleResize = () => {
        setIsCollapsed(window.innerWidth < 1024);
      };

      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    });
  });
  $effect(() => {
    void menuOpen;
    return untrack(() => {
      if (!menuOpen) return;
      const onDocClick = (event: MouseEvent) => {
        if (!footer?.contains(event.target as Node)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    });
  });
  let currentName = $derived(
    presets.find((p) => p.id === presetId)?.name ??
      (presetId === DEFAULT_PRESET_ID ? '默认' : presetId),
  );
  const openPresetSettings = () => {
    setMenuOpen(false);
    sessionStorage.setItem('ai-tool-box-settings-tab', 'presets');
    if (settingsPage) {
      onPageChange(settingsPage.id);
    }
  };
  const openSettings = () => {
    setMenuOpen(false);
    if (settingsPage) {
      onPageChange(settingsPage.id);
    }
  };
  const handleSwitch = async (id: string) => {
    setError(null);
    if (id === presetId) {
      setMenuOpen(false);
      return;
    }
    if (!window.desktopAPI?.openPreset) {
      setError('切换不可用，请重启应用');
      return;
    }
    setBusy(true);
    try {
      const result = await window.desktopAPI.openPreset(id);
      if (!result.success) {
        setError(result.error ?? '切换失败');
        return;
      }
      setMenuOpen(false);
      await refreshPresets();
    } finally {
      setBusy(false);
    }
  };
</script>

<aside class={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
  <div class={styles.header}>
    <div class={styles.brand}>
      <div class={styles.logo} aria-hidden="true">
        <Icon name="Sparkles" size={18}></Icon>
      </div>
      {#if !isCollapsed}<div class={styles.brandText}>
          <h2 class={styles.title}>AI Tool Box</h2>
          <span class={styles.subtitle}>工具集</span>
        </div>{/if}
    </div>
  </div>
  <nav id="sidebar-navigation" class={styles.nav} aria-label="工具导航">
    {#each navPages as page (page.id)}
      <button
        class={`${styles.navItem} ${activePageId === page.id ? styles.active : ''}`}
        onclick={() => onPageChange(page.id)}
        aria-label={`切换到 ${page.name}`}
        aria-current={activePageId === page.id ? 'page' : undefined}
        title={isCollapsed ? page.name : undefined}
      >
        {#if page.iconName}<Icon
            name={page.iconName}
            size={20}
            className={styles.icon}
            aria-hidden="true"
          ></Icon>{:else}{#if page.icon}<span
              class={styles.icon}
              aria-hidden="true"
            >
              {page.icon}
            </span>{:else}{/if}{/if}
        {#if !isCollapsed}<span class={styles.name}>{page.name}</span>{/if}
      </button>
    {/each}
  </nav>
  <div class={styles.footer} bind:this={footer}>
    <div class={styles.presetSwitch}>
      <button
        type="button"
        class={styles.presetLabel}
        onclick={() => {
          setError(null);
          setMenuOpen((open) => !open);
          void refreshPresets();
        }}
        title={`当前 Preset：${currentName}`}
        aria-label={`当前 Preset ${currentName}，快捷切换`}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        disabled={busy}
      >
        {#if !isCollapsed}
          <span class={styles.presetLabelText}>{currentName}</span>
          <Icon name="ChevronDown" size={14} aria-hidden="true"></Icon>
        {/if}
        {#if isCollapsed}<Icon name="Layers" size={16} aria-hidden="true"
          ></Icon>{/if}
      </button>
      {#if menuOpen}<div class={styles.presetMenu} role="listbox">
          {#each presets as preset (preset.id)}
            <button
              type="button"
              class={`${styles.presetMenuItem} ${
                preset.id === presetId ? styles.presetMenuItemActive : ''
              }`}
              role="option"
              aria-selected={preset.id === presetId}
              disabled={busy}
              onclick={() => void handleSwitch(preset.id)}
            >
              <span>{preset.name}</span>
              {#if openIds.includes(preset.id)}<span class={styles.presetBadge}
                  >已打开</span
                >{/if}
            </button>
          {/each}
          <div class={styles.presetMenuDivider}></div>
          <button
            type="button"
            class={styles.presetMenuItem}
            disabled={busy}
            onclick={openPresetSettings}
          >
            管理 Preset…
          </button>
        </div>{/if}
      {#if error}<p class={styles.presetError}>{error}</p>{/if}
    </div>
    {#if settingsPage}<button
        type="button"
        class={`${styles.settingsIconButton} ${
          activePageId === settingsPage.id
            ? styles.settingsIconButtonActive
            : ''
        }`}
        onclick={openSettings}
        aria-label="设置"
        aria-current={activePageId === settingsPage.id ? 'page' : undefined}
        title="设置"
      >
        <Icon name="Settings" size={20} aria-hidden="true"></Icon>
      </button>{/if}
  </div>
</aside>
