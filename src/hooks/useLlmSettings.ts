import { useCallback, useEffect, useState } from 'react';
import {
  LLM_PROVIDER_PRESETS,
  createDefaultLlmSettings,
  type LlmProvider,
  type LlmSettings,
  type LlmSettingsInput,
} from '../types/llm-settings';

export function useLlmSettings() {
  const [settings, setSettings] = useState<LlmSettings>(createDefaultLlmSettings);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!window.electronAPI?.getLlmSettings) {
        setSettings(createDefaultLlmSettings());
        return;
      }

      const response = await window.electronAPI.getLlmSettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取 LLM 设置失败');
      }
      setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 LLM 设置失败');
      setSettings(createDefaultLlmSettings());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback((patch: Partial<LlmSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaveMessage(null);
  }, []);

  const setProvider = useCallback((provider: LlmProvider) => {
    setSettings((prev) => {
      if (provider === 'custom') {
        return { ...prev, provider, baseUrl: prev.baseUrl ?? '' };
      }
      const preset = LLM_PROVIDER_PRESETS[provider];
      return {
        ...prev,
        provider,
        model: preset.defaultModel,
        baseUrl: undefined,
      };
    });
    setSaveMessage(null);
  }, []);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    if (settings.enabled && !settings.hasApiKey && !apiKeyInput.trim()) {
      setError('启用 LLM 汇总需要填写 API Key');
      setIsSaving(false);
      return;
    }

    if (settings.provider === 'custom' && !settings.baseUrl?.trim()) {
      setError('自定义提供商需要填写 API Base URL');
      setIsSaving(false);
      return;
    }

    if (!settings.model.trim()) {
      setError('请填写模型名称');
      setIsSaving(false);
      return;
    }

    const input: LlmSettingsInput = {
      enabled: settings.enabled,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };

    if (apiKeyInput.trim()) {
      input.apiKey = apiKeyInput.trim();
    }

    try {
      if (!window.electronAPI?.saveLlmSettings) {
        setSaveMessage('当前为浏览器预览模式，LLM 设置仅在 Electron 中生效');
        return;
      }

      const response = await window.electronAPI.saveLlmSettings(input);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存 LLM 设置失败');
      }

      setSettings(response.settings);
      setApiKeyInput('');
      setSaveMessage('LLM 设置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 LLM 设置失败');
    } finally {
      setIsSaving(false);
    }
  }, [settings, apiKeyInput]);

  return {
    settings,
    apiKeyInput,
    isLoading,
    isSaving,
    error,
    saveMessage,
    loadSettings,
    updateSettings,
    setProvider,
    setApiKeyInput,
    saveSettings,
  };
}
