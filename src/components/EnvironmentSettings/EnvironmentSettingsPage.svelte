<script lang="ts">
  import { useGeolocationSettings } from '../../hooks/useGeolocationSettings.svelte';
  import { useProxySettings } from '../../hooks/useProxySettings.svelte';
  import type { ProxyProtocol } from '../../types/proxy-settings';
  import SettingsPageLayout from '../settings/SettingsPageLayout.svelte';
  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import settingsStyles from '../../styles/settings-shared.module.css';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import SegmentControl from '../ui/SegmentControl.svelte';
  import Alert from '../ui/Alert.svelte';
  import styles from './EnvironmentSettingsPage.module.css';
  type EnvTab = 'proxy' | 'geo';
  const ENV_TABS: { value: EnvTab; label: string }[] = [
    { value: 'proxy', label: '网络代理' },
    { value: 'geo', label: 'GPS 定位' },
  ];
  const PROXY_PROTOCOL_OPTIONS: { value: ProxyProtocol; label: string }[] = [
    { value: 'http', label: 'HTTP' },
    { value: 'https', label: 'HTTPS' },
    { value: 'socks5', label: 'SOCKS5' },
  ];
  function parseCoordinate(value: string, fallback: number): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  let activeTab: EnvTab = $state.raw('proxy');
  function setActiveTab(
    value: typeof activeTab | ((prev: typeof activeTab) => typeof activeTab),
  ) {
    activeTab = typeof value === 'function' ? value(activeTab) : value;
  }
  const proxy = useProxySettings();
  const geo = useGeolocationSettings();
  let proxyProfileList = $derived.by(() =>
    Object.values(proxy.settings.profiles),
  );
  let geoProfileList = $derived.by(() => Object.values(geo.settings.profiles));
  let isLoading = $derived(proxy.isLoading || geo.isLoading);
  let isSaving = $derived(proxy.isSaving || geo.isSaving);
  let error = $derived(proxy.error || geo.error);
  let saveMessage = $derived(
    [proxy.saveMessage, geo.saveMessage].filter(Boolean).join(' '),
  );
</script>

{#if isLoading}<SettingsLoading message="加载环境设置..."
  ></SettingsLoading>{:else}<SettingsPageLayout
    title="网络与定位"
    description="定义代理与 GPS 预设，在「网站管理」中为各站分配。"
    ariaLabel="网络与定位设置"
    class={styles.pageCompact}
  >
    {#snippet footer()}<div class={styles.footerCompact}>
        {#if error}<Alert variant="error">
            {error}
          </Alert>{/if}{#if saveMessage}<Alert variant="success">
            {saveMessage}
          </Alert>{/if}
        <div class={styles.footerActions}>
          <Button
            size="sm"
            onclick={() => {
              void proxy.saveSettings();
              void geo.saveSettings();
            }}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '立即应用'}
          </Button><Button
            size="sm"
            variant="outline"
            onclick={() => {
              void proxy.loadSettings();
              void geo.loadSettings();
            }}
            disabled={isSaving}
          >
            重新加载
          </Button>
        </div>
      </div>{/snippet}
    <div class={styles.toolbar}>
      <SegmentControl
        options={ENV_TABS}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="环境设置分类"
      ></SegmentControl>{#if activeTab === 'proxy'}<Button
          size="sm"
          variant="outline"
          onclick={proxy.addProfile}
          disabled={isSaving}
        >
          添加代理
        </Button>{:else}<Button
          size="sm"
          variant="outline"
          onclick={geo.addProfile}
          disabled={isSaving}
        >
          添加位置
        </Button>{/if}
    </div>
    {#if activeTab === 'proxy'}<section
        class={styles.section}
        aria-label="代理库"
      >
        {#if proxyProfileList.length === 0}<p class={styles.emptyHint}>
            暂无代理，点击「添加代理」创建。
          </p>{:else}<div class={styles.profileList}>
            {#each proxyProfileList as profile (profile.id)}<article
                class={styles.profileCard}
                aria-label={`代理 ${profile.name}`}
              >
                <div class={styles.profileCardHeader}>
                  <Input
                    label="名称"
                    placeholder="本地 Clash"
                    value={profile.name}
                    oninput={(event) =>
                      proxy.updateProfile(profile.id, {
                        name: event.currentTarget.value,
                      })}
                  ></Input><Button
                    size="sm"
                    variant="outline"
                    onclick={() => proxy.removeProfile(profile.id)}
                    disabled={isSaving}
                  >
                    删除
                  </Button>
                </div>
                <div class={styles.proxyFields}>
                  <div class={settingsStyles.fieldGroup}>
                    <label
                      class={settingsStyles.label}
                      for={`${profile.id}-protocol`}
                    >
                      协议
                    </label>
                    <Select
                      id={`${profile.id}-protocol`}
                      value={profile.protocol || 'http'}
                      onchange={(event) =>
                        proxy.updateProfile(profile.id, {
                          protocol: event.currentTarget.value as ProxyProtocol,
                        })}
                    >
                      {#each PROXY_PROTOCOL_OPTIONS as option (option.value)}<option
                          value={option.value}
                        >
                          {option.label}
                        </option>{/each}
                    </Select>
                  </div>
                  <Input
                    label="主机"
                    placeholder="127.0.0.1"
                    value={profile.host || ''}
                    oninput={(event) =>
                      proxy.updateProfile(profile.id, {
                        host: event.currentTarget.value,
                      })}
                  ></Input><Input
                    label="端口"
                    placeholder="7890"
                    value={profile.port || ''}
                    oninput={(event) =>
                      proxy.updateProfile(profile.id, {
                        port: event.currentTarget.value,
                      })}
                  ></Input>
                </div>
                <div class={styles.proxyAuthFields}>
                  <Input
                    label="用户名"
                    placeholder="可选"
                    value={profile.username || ''}
                    oninput={(event) =>
                      proxy.updateProfile(profile.id, {
                        username: event.currentTarget.value,
                      })}
                    autocomplete="off"
                  ></Input><Input
                    label="密码"
                    type="password"
                    placeholder="可选"
                    value={profile.password || ''}
                    oninput={(event) =>
                      proxy.updateProfile(profile.id, {
                        password: event.currentTarget.value,
                      })}
                    autocomplete="off"
                  ></Input>
                </div>
              </article>{/each}
          </div>{/if}
      </section>{:else}<section class={styles.section} aria-label="位置库">
        {#if geoProfileList.length === 0}<p class={styles.emptyHint}>
            暂无位置，点击「添加位置」创建。
          </p>{:else}<div class={styles.profileList}>
            {#each geoProfileList as profile (profile.id)}<article
                class={styles.profileCard}
                aria-label={`位置 ${profile.name}`}
              >
                <div class={styles.profileCardHeader}>
                  <Input
                    label="名称"
                    placeholder="北京"
                    value={profile.name}
                    oninput={(event) =>
                      geo.updateProfile(profile.id, {
                        name: event.currentTarget.value,
                      })}
                  ></Input><Button
                    size="sm"
                    variant="outline"
                    onclick={() => geo.removeProfile(profile.id)}
                    disabled={isSaving}
                  >
                    删除
                  </Button>
                </div>
                <div class={styles.coordFields}>
                  <Input
                    label="纬度"
                    placeholder="39.9042"
                    value={String(profile.latitude)}
                    oninput={(event) =>
                      geo.updateProfile(profile.id, {
                        latitude: parseCoordinate(
                          event.currentTarget.value,
                          profile.latitude,
                        ),
                      })}
                  ></Input><Input
                    label="经度"
                    placeholder="116.4074"
                    value={String(profile.longitude)}
                    oninput={(event) =>
                      geo.updateProfile(profile.id, {
                        longitude: parseCoordinate(
                          event.currentTarget.value,
                          profile.longitude,
                        ),
                      })}
                  ></Input><Input
                    label="精度(m)"
                    placeholder="100"
                    value={String(profile.accuracy)}
                    oninput={(event) =>
                      geo.updateProfile(profile.id, {
                        accuracy: parseCoordinate(
                          event.currentTarget.value,
                          profile.accuracy,
                        ),
                      })}
                  ></Input>
                </div>
              </article>{/each}
          </div>{/if}
      </section>{/if}
  </SettingsPageLayout>{/if}
