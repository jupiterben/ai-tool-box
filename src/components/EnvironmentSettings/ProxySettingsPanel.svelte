<script lang="ts">
  import { createProxySettings } from '../../state/proxySettings.svelte';
  import type { ProxyProtocol } from '../../types/proxy-settings';
  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import settingsStyles from '../../styles/settings-shared.module.css';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Alert from '../ui/Alert.svelte';
  import styles from './EnvironmentSettingsPage.module.css';
  const PROXY_PROTOCOL_OPTIONS: { value: ProxyProtocol; label: string }[] = [
    { value: 'http', label: 'HTTP' },
    { value: 'https', label: 'HTTPS' },
    { value: 'socks5', label: 'SOCKS5' },
  ];

  const proxy = createProxySettings();
  let proxyProfileList = $derived.by(() =>
    Object.values(proxy.settings.profiles),
  );
</script>

{#if proxy.isLoading}
  <SettingsLoading message="加载代理设置..."></SettingsLoading>
{:else}
  <Alert variant="info">
    当前 Preset 共用一个上游代理。若需不同网站走不同出口，请把上游设为本机 Clash
    等，并在其中配置域名规则。
  </Alert>
  <div class={styles.toolbar}>
    <Button
      size="sm"
      variant="outline"
      onClick={proxy.addProfile}
      disabled={proxy.isSaving}
    >
      添加代理
    </Button>
  </div>
  <section class={styles.section} aria-label="代理库">
    {#if proxyProfileList.length === 0}<p class={styles.emptyHint}>
        暂无代理，点击「添加代理」创建。
      </p>{:else}<div class={styles.profileList}>
        {#each proxyProfileList as profile (profile.id)}
          <article
            class={styles.profileCard}
            aria-label={`代理 ${profile.name}`}
          >
            <div class={styles.profileCardHeader}>
              <Input
                label="名称"
                placeholder="本地 Clash"
                value={profile.name}
                onChange={(event) =>
                  proxy.updateProfile(profile.id, {
                    name: event.currentTarget.value,
                  })}
              ></Input>
              <Button
                size="sm"
                variant="outline"
                onClick={() => proxy.removeProfile(profile.id)}
                disabled={proxy.isSaving}
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
                  onChange={(event) =>
                    proxy.updateProfile(profile.id, {
                      protocol: event.currentTarget.value as ProxyProtocol,
                    })}
                >
                  {#each PROXY_PROTOCOL_OPTIONS as option (option.value)}
                    <option value={option.value}> {option.label} </option>
                  {/each}
                </Select>
              </div>
              <Input
                label="主机"
                placeholder="127.0.0.1"
                value={profile.host || ''}
                onChange={(event) =>
                  proxy.updateProfile(profile.id, {
                    host: event.currentTarget.value,
                  })}
              ></Input>
              <Input
                label="端口"
                placeholder="7890"
                value={profile.port || ''}
                onChange={(event) =>
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
                onChange={(event) =>
                  proxy.updateProfile(profile.id, {
                    username: event.currentTarget.value,
                  })}
                autoComplete="off"
              ></Input>
              <Input
                label="密码"
                type="password"
                placeholder="可选"
                value={profile.password || ''}
                onChange={(event) =>
                  proxy.updateProfile(profile.id, {
                    password: event.currentTarget.value,
                  })}
                autoComplete="off"
              ></Input>
            </div>
          </article>
        {/each}
      </div>{/if}
  </section>
  <div class={styles.footerCompact}>
    {#if proxy.error}<Alert variant="error">{proxy.error}</Alert>{/if}
    {#if proxy.saveMessage}<Alert variant="success">{proxy.saveMessage}</Alert
      >{/if}
    <div class={styles.footerActions}>
      <Button
        size="sm"
        onClick={() => void proxy.saveSettings()}
        disabled={proxy.isSaving}
      >
        {#if proxy.isSaving}保存中...{:else}立即应用{/if}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void proxy.loadSettings()}
        disabled={proxy.isSaving}
      >
        重新加载
      </Button>
    </div>
  </div>
{/if}
