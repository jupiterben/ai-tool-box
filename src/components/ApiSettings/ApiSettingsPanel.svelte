<script lang="ts">
  import { untrack } from 'svelte';

  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import settingsStyles from '../../styles/settings-shared.module.css';
  import Alert from '../ui/Alert.svelte';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import type {
    ImageGenApiSettings,
    ImageGenApiStatus,
  } from '../../types/image-gen-api-settings';
  const DEFAULT_SETTINGS: ImageGenApiSettings = {
    version: '1.0.0',
    enabled: true,
    port: 3920,
  };

  let settings: ImageGenApiSettings = $state.raw(DEFAULT_SETTINGS);
  function setSettings(
    next: typeof settings | ((previous: typeof settings) => typeof settings),
  ) {
    settings =
      typeof next === 'function' ? untrack(() => next(settings)) : next;
  }
  let status: ImageGenApiStatus | null = $state.raw(null);
  function setStatus(
    next: typeof status | ((previous: typeof status) => typeof status),
  ) {
    status = typeof next === 'function' ? untrack(() => next(status)) : next;
  }
  let isLoading = $state.raw(true);
  function setIsLoading(
    next: typeof isLoading | ((previous: typeof isLoading) => typeof isLoading),
  ) {
    isLoading =
      typeof next === 'function' ? untrack(() => next(isLoading)) : next;
  }
  let isSaving = $state.raw(false);
  function setIsSaving(
    next: typeof isSaving | ((previous: typeof isSaving) => typeof isSaving),
  ) {
    isSaving =
      typeof next === 'function' ? untrack(() => next(isSaving)) : next;
  }
  let error: string | null = $state.raw(null);
  function setError(
    next: typeof error | ((previous: typeof error) => typeof error),
  ) {
    error = typeof next === 'function' ? untrack(() => next(error)) : next;
  }
  let saveMessage: string | null = $state.raw(null);
  function setSaveMessage(
    next:
      | typeof saveMessage
      | ((previous: typeof saveMessage) => typeof saveMessage),
  ) {
    saveMessage =
      typeof next === 'function' ? untrack(() => next(saveMessage)) : next;
  }
  const loadSettings = async () => {
    if (!window.desktopAPI?.getImageGenApiSettings) {
      setError('当前环境不支持 API 设置');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.desktopAPI.getImageGenApiSettings();
      if (!result.success || !result.settings) {
        setError(result.error || '读取 API 设置失败');
        return;
      }
      setSettings(result.settings);
      setStatus(result.status ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 API 设置失败');
    } finally {
      setIsLoading(false);
    }
  };
  $effect(() => {
    void loadSettings;
    return untrack(() => {
      void loadSettings();
    });
  });
  const updateSettings = (patch: Partial<ImageGenApiSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaveMessage(null);
  };
  const saveSettings = async () => {
    if (!window.desktopAPI?.saveImageGenApiSettings) {
      setError('当前环境不支持 API 设置');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const result = await window.desktopAPI.saveImageGenApiSettings(settings);
      if (!result.success || !result.settings) {
        setError(result.error || '保存 API 设置失败');
        if (result.status) setStatus(result.status);
        return;
      }

      setSettings(result.settings);
      setStatus(result.status ?? null);
      setSaveMessage(
        result.status?.running
          ? `API 服务已启动，实际端口 ${result.status.actualPort}`
          : 'API 服务已关闭',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 API 设置失败');
    } finally {
      setIsSaving(false);
    }
  };
  let actualPortChanged = $derived.by(
    () =>
      status?.running &&
      status.actualPort &&
      status.actualPort !== settings.port,
  );
</script>

{#if isLoading}
  <SettingsLoading message="加载 API 设置..."></SettingsLoading>
{:else}
  <section class={settingsStyles.card}>
    <div class={settingsStyles.sectionHeader}>
      <div>
        <h2 class={settingsStyles.sectionTitle}>生图 API 服务</h2>
        <p class={settingsStyles.hint}>
          控制本机 HTTP API 是否随应用启动，并设置首选监听端口。
        </p>
      </div>
      <Toggle
        label="启用 API 服务"
        checked={settings.enabled}
        onChange={(event) =>
          updateSettings({ enabled: event.currentTarget.checked })}
      ></Toggle>
    </div>
    <div class={settingsStyles.fieldGroup}>
      <label class={settingsStyles.label} for="image-api-port">
        首选端口
      </label>
      <Input
        id="image-api-port"
        type="number"
        min={1}
        max={65535}
        step={1}
        value={String(settings.port)}
        onChange={(event) =>
          updateSettings({ port: Number(event.currentTarget.value) })}
        helperText="如果端口被占用，服务会自动尝试后续端口。"
      ></Input>
    </div>
    <div class={settingsStyles.fieldGroup}>
      <span class={settingsStyles.label}>当前状态</span>
      <p class={settingsStyles.hint}>
        {#if status?.running}{`运行中：${status.host}:${status.actualPort}`}{:else}{#if settings.enabled}未运行{:else}已关闭{/if}{/if}
      </p>
      {#if actualPortChanged}<p class={settingsStyles.hint}>
          首选端口 {settings.port} 被占用，已自动使用 {status?.actualPort}。
        </p>{/if}
      {#if status?.accessUrls.length}<div class={settingsStyles.fieldGroup}>
          {#each status.accessUrls as url (url)}
            <code class={settingsStyles.hint}> {url} </code>
          {/each}
        </div>{:else}{/if}
    </div>
  </section>
  {#if error}<Alert variant="error">{error}</Alert>{/if}
  {#if saveMessage}<Alert variant="success">{saveMessage}</Alert>{/if}
  <div class={settingsStyles.actions}>
    <Button onClick={() => void saveSettings()} disabled={isSaving}>
      {#if isSaving}保存中...{:else}保存并应用{/if}
    </Button>
    <Button
      variant="outline"
      onClick={() => void loadSettings()}
      disabled={isSaving}
    >
      刷新状态
    </Button>
  </div>
{/if}
