<script lang="ts">
  import {
    TOOL_CATEGORY_LABELS,
    getToolsByCategory,
    groupToolsByRegion,
  } from '../../config/tools';
  import { useGeolocationSettings } from '../../hooks/useGeolocationSettings.svelte';
  import { useProxySettings } from '../../hooks/useProxySettings.svelte';
  import { useSessionSettings } from '../../hooks/useSessionSettings.svelte';
  import { useToolSettings } from '../../hooks/useToolSettings.svelte';
  import type { ToolCategory } from '../../types/ai-tool';
  import type { GeolocationMode } from '../../types/geolocation-settings';
  import type { ProxyMode } from '../../types/proxy-settings';
  import SettingsPageLayout from '../settings/SettingsPageLayout.svelte';
  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import settingsStyles from '../../styles/settings-shared.module.css';
  import Toggle from '../ui/Toggle.svelte';
  import Select from '../ui/Select.svelte';
  import SegmentControl from '../ui/SegmentControl.svelte';
  import Alert from '../ui/Alert.svelte';
  import styles from './ToolSettingsPage.module.css';
  const CATEGORY_TABS: { value: ToolCategory; label: string }[] = [
    { value: 'chat', label: TOOL_CATEGORY_LABELS.chat },
    { value: 'image', label: TOOL_CATEGORY_LABELS.image },
  ];
  const PROXY_MODE_OPTIONS: { value: ProxyMode; label: string }[] = [
    { value: 'direct', label: '直连' },
    { value: 'system', label: '系统代理' },
    { value: 'profile', label: '使用代理' },
  ];
  const GEO_MODE_OPTIONS: { value: GeolocationMode; label: string }[] = [
    { value: 'system', label: '系统定位' },
    { value: 'profile', label: '虚拟定位' },
  ];
  let activeCategory: ToolCategory = $state.raw('chat');
  function setActiveCategory(
    value:
      | typeof activeCategory
      | ((prev: typeof activeCategory) => typeof activeCategory),
  ) {
    activeCategory =
      typeof value === 'function' ? value(activeCategory) : value;
  }
  const useToolSettingsState = useToolSettings();
  let isToolLoading = $derived(useToolSettingsState.isLoading);
  let saveMessage = $derived(useToolSettingsState.saveMessage);
  let setToolEnabled = $derived(useToolSettingsState.setToolEnabled);
  let isToolEnabled = $derived(useToolSettingsState.isToolEnabled);
  const proxy = useProxySettings();
  const geo = useGeolocationSettings();
  const session = useSessionSettings();
  let proxyProfileList = $derived.by(() =>
    Object.values(proxy.settings.profiles),
  );
  let geoProfileList = $derived.by(() => Object.values(geo.settings.profiles));
  let categoryTools = $derived.by(() =>
    getToolsByCategory(activeCategory).filter((tool) => Boolean(tool.url)),
  );
  let toolGroups = $derived.by(() => groupToolsByRegion(categoryTools));
  let enabledCount = $derived.by(
    () => categoryTools.filter((tool) => isToolEnabled(tool.id)).length,
  );
  let isLoading = $derived(
    isToolLoading || proxy.isLoading || geo.isLoading || session.isLoading,
  );
  let alerts = $derived.by(() => {
    const items: { id: string; message: string }[] = [];
    if (saveMessage) items.push({ id: 'tool', message: saveMessage });
    if (proxy.saveMessage)
      items.push({ id: 'proxy', message: proxy.saveMessage });
    if (geo.saveMessage) items.push({ id: 'geo', message: geo.saveMessage });
    if (session.saveMessage)
      items.push({ id: 'session', message: session.saveMessage });
    return items;
  });
  let errors = $derived.by(() => {
    const items: { id: string; message: string }[] = [];
    if (proxy.error) items.push({ id: 'proxy', message: proxy.error });
    if (geo.error) items.push({ id: 'geo', message: geo.error });
    if (session.error) items.push({ id: 'session', message: session.error });
    return items;
  });
</script>

{#if isLoading}<SettingsLoading message="加载网站设置..."
  ></SettingsLoading>{:else}<SettingsPageLayout
    title="网站管理"
    description="按对话与生图分类管理各网站的启用状态、无痕模式、网络代理与 GPS 定位。代理与位置预设请在「网络与定位」页面定义。"
    ariaLabel="网站管理"
    class={styles.pageWide}
  >
    <div class={styles.categoryTabs}>
      <SegmentControl
        options={CATEGORY_TABS}
        value={activeCategory}
        onChange={setActiveCategory}
        ariaLabel="网站分类"
      ></SegmentControl>
    </div>
    <section
      class={settingsStyles.section}
      aria-label={`${TOOL_CATEGORY_LABELS[activeCategory]}网站`}
    >
      {#each toolGroups as group (group.region)}<div
          class={settingsStyles.siteGroup}
          aria-label={group.label}
        >
          <div class={styles.siteGroupTitleBar}>
            <span class={settingsStyles.siteGroupLabel}>{group.label}</span>
          </div>
          <div class={styles.tableWrap}>
            <table class={styles.siteTable}>
              <colgroup>
                <col />
                <col class={styles.colToggle} />
                <col class={styles.colToggle} />
                <col class={styles.colEnv} />
                <col class={styles.colEnv} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">网站</th>
                  <th scope="col">启用</th>
                  <th scope="col">无痕</th>
                  <th scope="col">网络</th>
                  <th scope="col">定位</th>
                </tr>
              </thead>
              <tbody>
                {#each group.tools as tool (tool.id)}{@const enabled =
                    isToolEnabled(tool.id)}{@const isLastEnabled =
                    enabled && enabledCount <= 1}{@const proxyConfig = proxy
                    .settings.tools[tool.id] ?? {
                    toolId: tool.id,
                    mode: 'system' as const,
                  }}{@const geoConfig = geo.settings.tools[tool.id] ?? {
                    toolId: tool.id,
                    mode: 'system' as const,
                  }}{@const incognito = session.isToolIncognito(tool.id)}
                  <tr>
                    <td class={styles.siteCell}>
                      <div class={settingsStyles.siteInfo}>
                        <span class={settingsStyles.siteName}>{tool.name}</span>
                        <span class={settingsStyles.siteUrl} title={tool.url}>
                          {tool.url}
                        </span>
                      </div>
                    </td>
                    <td class={styles.toggleCell}>
                      <Toggle
                        checked={enabled}
                        disabled={isLastEnabled}
                        onchange={(event) =>
                          setToolEnabled(tool.id, event.currentTarget.checked)}
                        label={`${tool.name} ${enabled ? '已启用' : '已关闭'}`}
                        title={isLastEnabled
                          ? '至少保留一个启用的网站'
                          : enabled
                            ? '点击关闭'
                            : '点击启用'}
                      ></Toggle>
                    </td>
                    <td class={styles.toggleCell}>
                      <Toggle
                        checked={incognito}
                        onchange={(event) =>
                          session.setToolIncognito(
                            tool.id,
                            event.currentTarget.checked,
                          )}
                        label={`${tool.name} ${incognito ? '无痕模式' : '普通模式'}`}
                        title={incognito
                          ? '无痕模式：临时会话，切换/关闭后清除数据'
                          : '开启无痕：独立临时会话，不写入磁盘（类似 Chrome 无痕窗口）'}
                      ></Toggle>
                    </td>
                    <td class={styles.envCell}>
                      <div class={styles.envControlGroup}>
                        <SegmentControl
                          options={PROXY_MODE_OPTIONS}
                          value={proxyConfig.mode}
                          onChange={(mode) => {
                            if (mode === 'profile') {
                              const firstProfileId = proxyProfileList[0]?.id;
                              proxy.updateToolConfig(tool.id, {
                                mode: 'profile',
                                profileId:
                                  proxyConfig.profileId ?? firstProfileId,
                              });
                              return;
                            }
                            proxy.updateToolConfig(tool.id, {
                              mode,
                              profileId: undefined,
                            });
                          }}
                          ariaLabel={`${tool.name} 网络模式`}

                        ></SegmentControl>{#if proxyConfig.mode === 'profile'}{#if proxyProfileList.length === 0}<span
                              class={settingsStyles.siteProfileHint}
                            >
                              请先添加代理
                            </span>{:else}<Select
                              compact
                              id={`${tool.id}-proxy-profile`}
                              value={proxyConfig.profileId ||
                                proxyProfileList[0]?.id ||
                                ''}
                              onchange={(event) =>
                                proxy.updateToolConfig(tool.id, {
                                  profileId: event.currentTarget.value,
                                })}
                              aria-label={`${tool.name} 选择代理`}
                            >
                              {#each proxyProfileList as profile (profile.id)}<option
                                  value={profile.id}
                                >
                                  {profile.name || '未命名'}
                                </option>{/each}
                            </Select>{/if}{/if}
                      </div>
                    </td>
                    <td class={styles.envCell}>
                      <div class={styles.envControlGroup}>
                        <SegmentControl
                          options={GEO_MODE_OPTIONS}
                          value={geoConfig.mode}
                          onChange={(mode) => {
                            if (mode === 'profile') {
                              const firstProfileId = geoProfileList[0]?.id;
                              geo.updateToolConfig(tool.id, {
                                mode: 'profile',
                                profileId:
                                  geoConfig.profileId ?? firstProfileId,
                              });
                              return;
                            }
                            geo.updateToolConfig(tool.id, {
                              mode,
                              profileId: undefined,
                            });
                          }}
                          ariaLabel={`${tool.name} 定位模式`}

                        ></SegmentControl>{#if geoConfig.mode === 'profile'}{#if geoProfileList.length === 0}<span
                              class={settingsStyles.siteProfileHint}
                            >
                              请先添加位置
                            </span>{:else}<Select
                              compact
                              id={`${tool.id}-geo-profile`}
                              value={geoConfig.profileId ||
                                geoProfileList[0]?.id ||
                                ''}
                              onchange={(event) =>
                                geo.updateToolConfig(tool.id, {
                                  profileId: event.currentTarget.value,
                                })}
                              aria-label={`${tool.name} 选择虚拟位置`}
                            >
                              {#each geoProfileList as profile (profile.id)}<option
                                  value={profile.id}
                                >
                                  {profile.name || '未命名'}
                                </option>{/each}
                            </Select>{/if}{/if}
                      </div>
                    </td>
                  </tr>{/each}
              </tbody>
            </table>
          </div>
        </div>{/each}
    </section>
    {#if errors.length > 0 || alerts.length > 0}<div
        class={styles.footerAlerts}
      >
        {#each errors as item (item.id)}<Alert variant="error">
            {item.message}
          </Alert>{/each}{#each alerts as item (item.id)}<Alert
            variant="success"
          >
            {item.message}
          </Alert>{/each}
      </div>{/if}
  </SettingsPageLayout>{/if}
