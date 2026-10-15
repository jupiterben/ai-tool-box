<script lang="ts">
  import {
    TOOL_CATEGORY_LABELS,
    getToolsByCategory,
    groupToolsByRegion,
  } from '../../config/tools';
  import { createGeolocationSettings } from '../../state/geolocationSettings.svelte';
  import { createProxySettings } from '../../state/proxySettings.svelte';
  import { createToolSettings } from '../../state/toolSettings.svelte';
  import type { ToolCategory } from '../../types/ai-tool';
  import type { GeolocationMode } from '../../types/geolocation-settings';
  import type { ProxyMode } from '../../types/proxy-settings';
  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import settingsStyles from '../../styles/settings-shared.module.css';
  import Toggle from '../ui/Toggle.svelte';
  import Select from '../ui/Select.svelte';
  import SegmentControl from '../ui/SegmentControl.svelte';
  import Alert from '../ui/Alert.svelte';
  import styles from './ToolSettingsPage.module.css';
  const PROXY_MODE_OPTIONS: { value: ProxyMode; label: string }[] = [
    { value: 'direct', label: '直连' },
    { value: 'system', label: '系统代理' },
    { value: 'profile', label: '使用代理' },
  ];
  const GEO_MODE_OPTIONS: { value: GeolocationMode; label: string }[] = [
    { value: 'system', label: '系统定位' },
    { value: 'profile', label: '虚拟定位' },
  ];
  interface ToolSettingsPanelProps {
    category: ToolCategory;
  }
  let { category }: ToolSettingsPanelProps = $props();
  const toolSettings = createToolSettings();
  let isToolLoading = $derived(toolSettings.isLoading);
  let saveMessage = $derived(toolSettings.saveMessage);
  let setToolEnabled = $derived(toolSettings.setToolEnabled);
  let isToolEnabled = $derived(toolSettings.isToolEnabled);
  const proxy = createProxySettings();
  const geo = createGeolocationSettings();
  let proxyProfileList = $derived.by(() =>
    Object.values(proxy.settings.profiles),
  );
  let geoProfileList = $derived.by(() => Object.values(geo.settings.profiles));
  let categoryTools = $derived.by(() =>
    getToolsByCategory(category).filter((tool) => Boolean(tool.url)),
  );
  let toolGroups = $derived.by(() => groupToolsByRegion(categoryTools));
  let enabledCount = $derived.by(
    () => categoryTools.filter((tool) => isToolEnabled(tool.id)).length,
  );
  let isLoading = $derived(isToolLoading || proxy.isLoading || geo.isLoading);
  let alerts = $derived.by(() => {
    const items: { id: string; message: string }[] = [];
    if (saveMessage) items.push({ id: 'tool', message: saveMessage });
    if (proxy.saveMessage)
      items.push({ id: 'proxy', message: proxy.saveMessage });
    if (geo.saveMessage) items.push({ id: 'geo', message: geo.saveMessage });
    return items;
  });
  let errors = $derived.by(() => {
    const items: { id: string; message: string }[] = [];
    if (proxy.error) items.push({ id: 'proxy', message: proxy.error });
    if (geo.error) items.push({ id: 'geo', message: geo.error });
    return items;
  });
</script>

{#if isLoading}
  <SettingsLoading message={`加载${TOOL_CATEGORY_LABELS[category]}网站设置...`}
  ></SettingsLoading>
{:else}
  <section
    class={settingsStyles.section}
    aria-label={`${TOOL_CATEGORY_LABELS[category]}网站`}
  >
    {#each toolGroups as group (group.region)}
      <div class={settingsStyles.siteGroup} aria-label={group.label}>
        <div class={styles.siteGroupTitleBar}>
          <span class={settingsStyles.siteGroupLabel}>{group.label}</span>
        </div>
        <div class={styles.tableWrap}>
          <table class={styles.siteTable}>
            <colgroup>
              <col /> <col class={styles.colToggle} />
              <col class={styles.colEnv} /> <col class={styles.colEnv} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">网站</th> <th scope="col">启用</th>
                <th scope="col">网络</th> <th scope="col">定位</th>
              </tr>
            </thead>
            <tbody>
              {#each group.tools as tool (tool.id)}
                {@const enabled = isToolEnabled(tool.id)}
                {@const isLastEnabled = enabled && enabledCount <= 1}
                {@const proxyConfig = proxy.settings.tools[tool.id] ?? {
                  toolId: tool.id,
                  mode: 'system' as const,
                }}
                {@const geoConfig = geo.settings.tools[tool.id] ?? {
                  toolId: tool.id,
                  mode: 'system' as const,
                }}
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
                      onChange={(event) =>
                        setToolEnabled(tool.id, event.currentTarget.checked)}
                      label={`${tool.name} ${enabled ? '已启用' : '已关闭'}`}
                      title={isLastEnabled
                        ? '至少保留一个启用的网站'
                        : enabled
                          ? '点击关闭'
                          : '点击启用'}
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
                      ></SegmentControl>
                      {#if proxyConfig.mode === 'profile'}{#if proxyProfileList.length === 0}<span
                            class={settingsStyles.siteProfileHint}
                            >请先添加代理</span
                          >{:else}<Select
                            compact
                            id={`${tool.id}-proxy-profile`}
                            value={proxyConfig.profileId ||
                              proxyProfileList[0]?.id ||
                              ''}
                            onChange={(event) =>
                              proxy.updateToolConfig(tool.id, {
                                profileId: event.currentTarget.value,
                              })}
                            aria-label={`${tool.name} 选择代理`}
                          >
                            {#each proxyProfileList as profile (profile.id)}
                              <option value={profile.id}>
                                {profile.name || '未命名'}
                              </option>
                            {/each}
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
                              profileId: geoConfig.profileId ?? firstProfileId,
                            });
                            return;
                          }
                          geo.updateToolConfig(tool.id, {
                            mode,
                            profileId: undefined,
                          });
                        }}
                        ariaLabel={`${tool.name} 定位模式`}
                      ></SegmentControl>
                      {#if geoConfig.mode === 'profile'}{#if geoProfileList.length === 0}<span
                            class={settingsStyles.siteProfileHint}
                            >请先添加位置</span
                          >{:else}<Select
                            compact
                            id={`${tool.id}-geo-profile`}
                            value={geoConfig.profileId ||
                              geoProfileList[0]?.id ||
                              ''}
                            onChange={(event) =>
                              geo.updateToolConfig(tool.id, {
                                profileId: event.currentTarget.value,
                              })}
                            aria-label={`${tool.name} 选择虚拟位置`}
                          >
                            {#each geoProfileList as profile (profile.id)}
                              <option value={profile.id}>
                                {profile.name || '未命名'}
                              </option>
                            {/each}
                          </Select>{/if}{/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
  </section>
  {#if errors.length > 0 || alerts.length > 0}<div class={styles.footerAlerts}>
      {#each errors as item (item.id)}
        <Alert variant="error">{item.message}</Alert>
      {/each}
      {#each alerts as item (item.id)}
        <Alert variant="success">{item.message}</Alert>
      {/each}
    </div>{/if}
{/if}
