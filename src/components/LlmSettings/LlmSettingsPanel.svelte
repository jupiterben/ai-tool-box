<script lang="ts">
  import { createLlmSettings } from '../../state/llmSettings.svelte';
  import {
    LLM_PROVIDER_PRESETS,
    type LlmProvider,
  } from '../../types/llm-settings';
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

  const llm = createLlmSettings();
  let settings = $derived(llm.settings);
  let apiKeyInput = $derived(llm.apiKeyInput);
  let isLoading = $derived(llm.isLoading);
  let isSaving = $derived(llm.isSaving);
  let error = $derived(llm.error);
  let saveMessage = $derived(llm.saveMessage);
  let updateSettings = $derived(llm.updateSettings);
  let setProvider = $derived(llm.setProvider);
  let setApiKeyInput = $derived(llm.setApiKeyInput);
  let saveSettings = $derived(llm.saveSettings);
  let providerHint = $derived.by(() => {
    if (settings.provider === 'custom') return null;
    return LLM_PROVIDER_PRESETS[settings.provider].baseUrl;
  });
</script>

{#if isLoading}
  <SettingsLoading message="加载 LLM 设置..."></SettingsLoading>
{:else}
  <section class={settingsStyles.card}>
    <label
      class={settingsStyles.label}
      style={`display: ${'flex'}; align-items: ${'center'}; gap: ${'var(--spacing-2)'}; cursor: ${'pointer'}`}
    >
      <input
        type="checkbox"
        checked={settings.enabled}
        oninput={(e) => updateSettings({ enabled: e.currentTarget.checked })}
      />
      <span
        style={`font-weight: ${'var(--font-weight-medium)'}; color: ${'var(--color-text-primary)'}`}
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
      ></SegmentControl>
      {#if providerHint}<p class={settingsStyles.hint}>
          API 地址：{providerHint}
        </p>{/if}
    </div>
    {#if settings.provider === 'custom'}<div class={settingsStyles.fieldGroup}>
        <label class={settingsStyles.label} for="llm-base-url">
          API Base URL
        </label>
        <Input
          id="llm-base-url"
          value={settings.baseUrl ?? ''}
          onChange={(e) => updateSettings({ baseUrl: e.currentTarget.value })}
          placeholder="https://api.example.com/v1/chat/completions"
        ></Input>
      </div>{/if}
    <div class={settingsStyles.fieldGroup}>
      <label class={settingsStyles.label} for="llm-model"> 模型 </label>
      <Input
        id="llm-model"
        value={settings.model}
        onChange={(e) => updateSettings({ model: e.currentTarget.value })}
        placeholder="deepseek-chat"
      ></Input>
    </div>
    <div class={settingsStyles.fieldGroup}>
      <label class={settingsStyles.label} for="llm-api-key"> API Key </label>
      <Input
        id="llm-api-key"
        type="password"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.currentTarget.value)}
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
          onChange={(e) =>
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
          onChange={(e) =>
            updateSettings({ maxTokens: Number(e.currentTarget.value) })}
        ></Input>
      </div>
    </div>
  </section>
  {#if error}<Alert variant="error">{error}</Alert>{/if}
  {#if saveMessage}<Alert variant="success">{saveMessage}</Alert>{/if}
  <div class={settingsStyles.actions}>
    <Button onClick={() => void saveSettings()} disabled={isSaving}>
      {#if isSaving}保存中…{:else}立即保存{/if}
    </Button>
  </div>
{/if}
