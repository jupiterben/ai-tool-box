<script lang="ts">
  import { untrack } from 'svelte';

  import LlmSettingsPanel from '../LlmSettings/LlmSettingsPanel.svelte';
  import ToolSettingsPanel from '../ToolSettings/ToolSettingsPanel.svelte';
  import ProxySettingsPanel from '../EnvironmentSettings/ProxySettingsPanel.svelte';
  import GeolocationSettingsPanel from '../EnvironmentSettings/GeolocationSettingsPanel.svelte';
  import ApiSettingsPanel from '../ApiSettings/ApiSettingsPanel.svelte';
  import SettingsPageLayout from './SettingsPageLayout.svelte';
  import Icon from '../ui/Icon.svelte';
  import type { IconName } from '../../types/ui.ts';
  import styles from './SettingsPage.module.css';
  import PresetSettingsPanel from '../PresetSettings/PresetSettingsPanel.svelte';
  type SettingsTab =
    | 'presets'
    | 'llm'
    | 'api'
    | 'chat-tools'
    | 'image-tools'
    | 'video-tools'
    | 'proxy'
    | 'geo';
  interface SettingsNavItem {
    value: SettingsTab;
    label: string;
    icon: IconName;
  }
  const SETTINGS_GROUPS: { label: string; items: SettingsNavItem[] }[] = [
    {
      label: '工作区',
      items: [{ value: 'presets', label: 'Preset 工作区', icon: 'Layers' }],
    },
    {
      label: '智能能力',
      items: [
        { value: 'llm', label: 'LLM 汇总', icon: 'Sparkles' },
        { value: 'api', label: 'API 服务', icon: 'ServerCog' },
      ],
    },
    {
      label: '网站工具',
      items: [
        { value: 'chat-tools', label: '对话网站', icon: 'MessagesSquare' },
        { value: 'image-tools', label: '生图网站', icon: 'Image' },
        { value: 'video-tools', label: '生视频网站', icon: 'Clapperboard' },
      ],
    },
    {
      label: '运行环境',
      items: [
        { value: 'proxy', label: '网络代理', icon: 'Network' },
        { value: 'geo', label: 'GPS 定位', icon: 'MapPin' },
      ],
    },
  ];
  const TAB_DESCRIPTIONS: Record<SettingsTab, string> = {
    presets: '管理命名工作区：新建、重命名、删除；切换时新开窗口并隔离登录态。',
    llm: '配置 LLM API，收集各平台回复时自动调用 AI 生成结构化 Markdown 汇总。',
    api: '控制本机生图 API 服务的启用状态、监听端口和实际访问地址。',
    'chat-tools': '管理对话类网站的启用状态。',
    'image-tools': '管理生图类网站的启用状态。',
    'video-tools': '管理生视频类网站的启用状态。',
    proxy:
      '配置当前 Preset 的上游代理。同一 Preset 共用一个上游；按站分流请在本机代理规则中配置。',
    geo: '配置当前 Preset 的 GPS 定位。',
  };
  function readInitialTab(): SettingsTab {
    const fromStorage = sessionStorage.getItem('ai-tool-box-settings-tab');
    if (fromStorage === 'presets') {
      sessionStorage.removeItem('ai-tool-box-settings-tab');
      return 'presets';
    }
    return 'presets';
  }

  const initial = readInitialTab();
  let activeTab: SettingsTab = $state.raw(initial);
  function setActiveTab(
    next: typeof activeTab | ((previous: typeof activeTab) => typeof activeTab),
  ) {
    activeTab =
      typeof next === 'function' ? untrack(() => next(activeTab)) : next;
  }
  let visitedTabs: Set<SettingsTab> = $state.raw((() => new Set([initial]))());
  function setVisitedTabs(
    next:
      | typeof visitedTabs
      | ((previous: typeof visitedTabs) => typeof visitedTabs),
  ) {
    visitedTabs =
      typeof next === 'function' ? untrack(() => next(visitedTabs)) : next;
  }
  $effect(() => {
    void activeTab;
    return untrack(() => {
      setVisitedTabs((prev) => {
        if (prev.has(activeTab)) return prev;
        return new Set([...prev, activeTab]);
      });
    });
  });
</script>

<SettingsPageLayout
  title="设置"
  description={TAB_DESCRIPTIONS[activeTab]}
  ariaLabel="应用设置"
>
  <div class={styles.settingsShell}>
    <nav class={styles.navigation} aria-label="设置分类">
      {#each SETTINGS_GROUPS as group (group.label)}
        <div class={styles.navGroup}>
          <span class={styles.navGroupLabel}>{group.label}</span>
          <div class={styles.navItems}>
            {#each group.items as item (item.value)}
              {@const isActive = activeTab === item.value}
              <button
                type="button"
                class={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onclick={() => setActiveTab(item.value)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon name={item.icon} size={18} strokeWidth={1.8}></Icon>
                <span>{item.label}</span>
                {#if isActive}<Icon
                    name="ChevronRight"
                    size={15}
                    className={styles.navChevron}
                  ></Icon>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </nav>
    <section class={styles.content} aria-live="polite">
      {#if visitedTabs.has('presets')}<div
          class={activeTab === 'presets' ? undefined : styles.panelHidden}
        >
          <PresetSettingsPanel></PresetSettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('llm')}<div
          class={activeTab === 'llm' ? undefined : styles.panelHidden}
        >
          <LlmSettingsPanel></LlmSettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('api')}<div
          class={activeTab === 'api' ? undefined : styles.panelHidden}
        >
          <ApiSettingsPanel></ApiSettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('chat-tools')}<div
          class={activeTab === 'chat-tools' ? undefined : styles.panelHidden}
        >
          <ToolSettingsPanel category="chat"></ToolSettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('image-tools')}<div
          class={activeTab === 'image-tools' ? undefined : styles.panelHidden}
        >
          <ToolSettingsPanel category="image"></ToolSettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('video-tools')}<div
          class={activeTab === 'video-tools' ? undefined : styles.panelHidden}
        >
          <ToolSettingsPanel category="video"></ToolSettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('proxy')}<div
          class={activeTab === 'proxy' ? undefined : styles.panelHidden}
        >
          <ProxySettingsPanel></ProxySettingsPanel>
        </div>{/if}
      {#if visitedTabs.has('geo')}<div
          class={activeTab === 'geo' ? undefined : styles.panelHidden}
        >
          <GeolocationSettingsPanel></GeolocationSettingsPanel>
        </div>{/if}
    </section>
  </div>
</SettingsPageLayout>
