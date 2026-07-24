import { useMemo } from 'react';
import { useLlmSettings } from '../../hooks/useLlmSettings';
import { LLM_PROVIDER_PRESETS, type LlmProvider } from '../../types/llm-settings';
import { SettingsLoading, settingsStyles } from '../settings/SettingsPageLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentControl } from '../ui/SegmentControl';
import { Alert } from '../ui/Alert';

const PROVIDER_OPTIONS: { value: LlmProvider; label: string }[] = [
  ...(Object.entries(LLM_PROVIDER_PRESETS) as [Exclude<LlmProvider, 'custom'>, (typeof LLM_PROVIDER_PRESETS)[Exclude<LlmProvider, 'custom'>]][]).map(
    ([value, preset]) => ({ value, label: preset.label })
  ),
  { value: 'custom', label: '自定义' },
];

const LlmSettingsPanel: React.FC = () => {
  const {
    settings,
    apiKeyInput,
    isLoading,
    isSaving,
    error,
    saveMessage,
    updateSettings,
    setProvider,
    setApiKeyInput,
    saveSettings,
  } = useLlmSettings();

  const providerHint = useMemo(() => {
    if (settings.provider === 'custom') return null;
    return LLM_PROVIDER_PRESETS[settings.provider].baseUrl;
  }, [settings.provider]);

  if (isLoading) {
    return <SettingsLoading message="加载 LLM 设置..." />;
  }

  return (
    <>
      <section className={settingsStyles.card}>
        <label className={settingsStyles.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
          <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
            启用 LLM 方案提炼
          </span>
        </label>

        <div className={settingsStyles.fieldGroup}>
          <span className={settingsStyles.label}>API 提供商</span>
          <SegmentControl
            options={PROVIDER_OPTIONS}
            value={settings.provider}
            onChange={setProvider}
            ariaLabel="API 提供商"
          />
          {providerHint && <p className={settingsStyles.hint}>API 地址：{providerHint}</p>}
        </div>

        {settings.provider === 'custom' && (
          <div className={settingsStyles.fieldGroup}>
            <label className={settingsStyles.label} htmlFor="llm-base-url">
              API Base URL
            </label>
            <Input
              id="llm-base-url"
              value={settings.baseUrl ?? ''}
              onChange={(e) => updateSettings({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </div>
        )}

        <div className={settingsStyles.fieldGroup}>
          <label className={settingsStyles.label} htmlFor="llm-model">
            模型
          </label>
          <Input
            id="llm-model"
            value={settings.model}
            onChange={(e) => updateSettings({ model: e.target.value })}
            placeholder="deepseek-chat"
          />
        </div>

        <div className={settingsStyles.fieldGroup}>
          <label className={settingsStyles.label} htmlFor="llm-api-key">
            API Key
          </label>
          <Input
            id="llm-api-key"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={settings.hasApiKey ? '已配置（留空则不修改）' : 'sk-...'}
          />
        </div>

        <div className={settingsStyles.inlineFields}>
          <div className={settingsStyles.fieldGroup}>
            <label className={settingsStyles.label} htmlFor="llm-temperature">
              Temperature
            </label>
            <Input
              id="llm-temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={String(settings.temperature)}
              onChange={(e) => updateSettings({ temperature: Number(e.target.value) })}
            />
          </div>
          <div className={settingsStyles.fieldGroup}>
            <label className={settingsStyles.label} htmlFor="llm-max-tokens">
              Max Tokens
            </label>
            <Input
              id="llm-max-tokens"
              type="number"
              min={512}
              max={16384}
              step={256}
              value={String(settings.maxTokens)}
              onChange={(e) => updateSettings({ maxTokens: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {error && <Alert variant="error">{error}</Alert>}
      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

      <div className={settingsStyles.actions}>
        <Button onClick={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? '保存中…' : '立即保存'}
        </Button>
      </div>
    </>
  );
};

export default LlmSettingsPanel;
