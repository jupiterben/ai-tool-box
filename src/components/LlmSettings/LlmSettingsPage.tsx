import { useMemo } from 'react';
import { useLlmSettings } from '../../hooks/useLlmSettings';
import { LLM_PROVIDER_PRESETS, type LlmProvider } from '../../types/llm-settings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import styles from './LlmSettingsPage.module.css';

const PROVIDER_OPTIONS: { value: LlmProvider; label: string }[] = [
  ...(Object.entries(LLM_PROVIDER_PRESETS) as [Exclude<LlmProvider, 'custom'>, (typeof LLM_PROVIDER_PRESETS)[Exclude<LlmProvider, 'custom'>]][]).map(
    ([value, preset]) => ({ value, label: preset.label })
  ),
  { value: 'custom', label: '自定义' },
];

const LlmSettingsPage: React.FC = () => {
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
    return <div className={styles.loading}>加载 LLM 设置...</div>;
  }

  return (
    <div className={styles.page} role="main" aria-label="LLM 设置">
      <header className={styles.header}>
        <h1 className={styles.title}>LLM 汇总设置</h1>
        <p className={styles.description}>
          配置 LLM API 后，收集各平台回复时将自动调用 AI 生成结构化 Markdown 汇总。
        </p>
      </header>

      <section className={styles.card}>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
          <span>启用 LLM 智能汇总</span>
        </label>

        <div className={styles.fieldGroup}>
          <span className={styles.label}>API 提供商</span>
          <div className={styles.modeOptions} role="group" aria-label="API 提供商">
            {PROVIDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.modeButton} ${
                  settings.provider === option.value ? styles.modeButtonActive : ''
                }`}
                onClick={() => setProvider(option.value)}
                aria-pressed={settings.provider === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          {providerHint && <p className={styles.hint}>API 地址：{providerHint}</p>}
        </div>

        {settings.provider === 'custom' && (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="llm-base-url">
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

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="llm-model">
            模型
          </label>
          <Input
            id="llm-model"
            value={settings.model}
            onChange={(e) => updateSettings({ model: e.target.value })}
            placeholder="deepseek-chat"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="llm-api-key">
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

        <div className={styles.inlineFields}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="llm-temperature">
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
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="llm-max-tokens">
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

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {saveMessage && <div className={styles.success}>{saveMessage}</div>}

      <div className={styles.actions}>
        <Button onClick={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? '保存中…' : '保存设置'}
        </Button>
      </div>
    </div>
  );
};

export default LlmSettingsPage;
