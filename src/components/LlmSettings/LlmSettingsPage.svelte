<script lang="ts">
  import { useLlmSettings } from '../../hooks/useLlmSettings.svelte';
  import {
    LLM_PROVIDER_PRESETS,
    type LlmProvider,
  } from '../../types/llm-settings';
  import SettingsPageLayout from '../settings/SettingsPageLayout.svelte';
  import SettingsLoading from '../settings/SettingsLoading.svelte';
  import settingsStyles from '../../styles/settings-shared.module.css';
  import Button from '../ui/Button.svelte';
  import Input from '../ui/Input.svelte';
  import SegmentControl from '../ui/SegmentControl.svelte';
  import Alert from '../ui/Alert.svelte';
  const PROVIDER_OPTIONS: { value: LlmProvider; label: string }[] = [
    ...(
      Object.entries(LLM_PROVIDER_PRESETS) as [
        Exclude<LlmProvider, 'custom'>,
        (typeof LLM_PROVIDER_PRESETS)[Exclude<LlmProvider, 'custom'>],
      ][]
    ).map(([value, preset]) => ({ value, label: preset.label })),
    { value: 'custom', label: '自定义' },
  ];
  const useLlmSettingsState = useLlmSettings();
  let settings = $derived(useLlmSettingsState.settings);
  let apiKeyInput = $derived(useLlmSettingsState.apiKeyInput);
  let isLoading = $derived(useLlmSettingsState.isLoading);
  let isSaving = $derived(useLlmSettingsState.isSaving);
  let error = $derived(useLlmSettingsState.error);
  let saveMessage = $derived(useLlmSettingsState.saveMessage);
  let updateSettings = $derived(useLlmSettingsState.updateSettings);
  let setProvider = $derived(useLlmSettingsState.setProvider);
  let setApiKeyInput = $derived(useLlmSettingsState.setApiKeyInput);
  let saveSettings = $derived(useLlmSettingsState.saveSettings);
  let providerHint = $derived.by(() => {
    if (settings.provider === 'custom') return null;
    return LLM_PROVIDER_PRESETS[settings.provider].baseUrl;
  });
</script>

{#if isLoading}<SettingsLoading message="加载 LLM 设置..."
  ></SettingsLoading>{:else}<SettingsPageLayout
    title="LLM 汇总设置"
    description="配置 LLM API 后，收集各平台回复时将自动调用 AI 生成结构化 Markdown 汇总。修改后会自动保存。"
    ariaLabel="LLM 设置"
  >
    {#snippet footer()}<div class={settingsStyles.actions}>
        <Button onclick={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? '保存中…' : '立即保存'}
        </Button>
      </div>{/snippet}
    <section class={settingsStyles.card}>
      <label
        class={settingsStyles.label}
        style:display={'flex'}
        style:align-items={'center'}
        style:gap={'var(--spacing-2)'}
        style:cursor={'pointer'}
      >
        <input
          type="checkbox"
          checked={settings.enabled}
          onchange={(e) => updateSettings({ enabled: e.currentTarget.checked })}
        />
        <span
          style:font-weight={'var(--font-weight-medium)'}
          style:color={'var(--color-text-primary)'}
        >
          启用 LLM 智能汇总
        </span>
      </label>
      <div class={settingsStyles.fieldGroup}>
        <span class={settingsStyles.label}>API 提供商</span>
        <SegmentControl
          options={PROVIDER_OPTIONS}
          value={settings.provider}
          onChange={setProvider}
          ariaLabel="API 提供商"
        ></SegmentControl>{#if providerHint}<p class={settingsStyles.hint}>
            API 地址：{providerHint}
          </p>{/if}
      </div>
      {#if settings.provider === 'custom'}<div
          class={settingsStyles.fieldGroup}
        >
          <label class={settingsStyles.label} for="llm-base-url">
            API Base URL
          </label>
          <Input
            id="llm-base-url"
            value={settings.baseUrl ?? ''}
            oninput={(e) => updateSettings({ baseUrl: e.currentTarget.value })}
            placeholder="https://api.example.com/v1/chat/completions"
          ></Input>
        </div>{/if}
      <div class={settingsStyles.fieldGroup}>
        <label class={settingsStyles.label} for="llm-model">模型</label>
        <Input
          id="llm-model"
          value={settings.model}
          oninput={(e) => updateSettings({ model: e.currentTarget.value })}
          placeholder="deepseek-chat"
        ></Input>
      </div>
      <div class={settingsStyles.fieldGroup}>
        <label class={settingsStyles.label} for="llm-api-key">API Key</label>
        <Input
          id="llm-api-key"
          type="password"
          value={apiKeyInput}
          oninput={(e) => setApiKeyInput(e.currentTarget.value)}
          placeholder={settings.hasApiKey ? '已配置（留空则不修改）' : 'sk-...'}
        ></Input>
      </div>
      <div class={settingsStyles.inlineFields}>
        <div class={settingsStyles.fieldGroup}>
          <label class={settingsStyles.label} for="llm-temperature">
            Temperature
          </label>
          <Input
            id="llm-temperature"
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={String(settings.temperature)}
            oninput={(e) =>
              updateSettings({ temperature: Number(e.currentTarget.value) })}
          ></Input>
        </div>
        <div class={settingsStyles.fieldGroup}>
          <label class={settingsStyles.label} for="llm-max-tokens">
            Max Tokens
          </label>
          <Input
            id="llm-max-tokens"
            type="number"
            min={512}
            max={16384}
            step={256}
            value={String(settings.maxTokens)}
            oninput={(e) =>
              updateSettings({ maxTokens: Number(e.currentTarget.value) })}
          ></Input>
        </div>
      </div>
    </section>
    {#if error}<Alert variant="error">
        {error}
      </Alert>{/if}{#if saveMessage}<Alert variant="success">
        {saveMessage}
      </Alert>{/if}
  </SettingsPageLayout>{/if}
