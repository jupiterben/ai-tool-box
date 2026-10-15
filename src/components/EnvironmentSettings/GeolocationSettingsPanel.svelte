<script lang="ts">
  import { createGeolocationSettings } from '../../state/geolocationSettings.svelte';
  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Alert from '../ui/Alert.svelte';
  import styles from './EnvironmentSettingsPage.module.css';
  function parseCoordinate(value: string, fallback: number): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const geo = createGeolocationSettings();
  let geoProfileList = $derived.by(() => Object.values(geo.settings.profiles));
</script>

{#if geo.isLoading}
  <SettingsLoading message="加载定位设置..."></SettingsLoading>
{:else}
  <div class={styles.toolbar}>
    <Button
      size="sm"
      variant="outline"
      onClick={geo.addProfile}
      disabled={geo.isSaving}
    >
      添加位置
    </Button>
  </div>
  <section class={styles.section} aria-label="位置库">
    {#if geoProfileList.length === 0}<p class={styles.emptyHint}>
        暂无位置，点击「添加位置」创建。
      </p>{:else}<div class={styles.profileList}>
        {#each geoProfileList as profile (profile.id)}
          <article
            class={styles.profileCard}
            aria-label={`位置 ${profile.name}`}
          >
            <div class={styles.profileCardHeader}>
              <Input
                label="名称"
                placeholder="北京"
                value={profile.name}
                onChange={(event) =>
                  geo.updateProfile(profile.id, {
                    name: event.currentTarget.value,
                  })}
              ></Input>
              <Button
                size="sm"
                variant="outline"
                onClick={() => geo.removeProfile(profile.id)}
                disabled={geo.isSaving}
              >
                删除
              </Button>
            </div>
            <div class={styles.coordFields}>
              <Input
                label="纬度"
                placeholder="39.9042"
                value={String(profile.latitude)}
                onChange={(event) =>
                  geo.updateProfile(profile.id, {
                    latitude: parseCoordinate(
                      event.currentTarget.value,
                      profile.latitude,
                    ),
                  })}
              ></Input>
              <Input
                label="经度"
                placeholder="116.4074"
                value={String(profile.longitude)}
                onChange={(event) =>
                  geo.updateProfile(profile.id, {
                    longitude: parseCoordinate(
                      event.currentTarget.value,
                      profile.longitude,
                    ),
                  })}
              ></Input>
              <Input
                label="精度(m)"
                placeholder="100"
                value={String(profile.accuracy)}
                onChange={(event) =>
                  geo.updateProfile(profile.id, {
                    accuracy: parseCoordinate(
                      event.currentTarget.value,
                      profile.accuracy,
                    ),
                  })}
              ></Input>
            </div>
          </article>
        {/each}
      </div>{/if}
  </section>
  <div class={styles.footerCompact}>
    {#if geo.error}<Alert variant="error">{geo.error}</Alert>{/if}
    {#if geo.saveMessage}<Alert variant="success">{geo.saveMessage}</Alert>{/if}
    <div class={styles.footerActions}>
      <Button
        size="sm"
        onClick={() => void geo.saveSettings()}
        disabled={geo.isSaving}
      >
        {#if geo.isSaving}保存中...{:else}立即应用{/if}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void geo.loadSettings()}
        disabled={geo.isSaving}
      >
        重新加载
      </Button>
    </div>
  </div>
{/if}
