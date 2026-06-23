import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LLM_PROVIDER_PRESETS,
  createDefaultLlmSettings,
  type LlmProvider,
  type LlmSettings,
  type LlmSettingsInput,
} from '../types/llm-settings';
import {
  loadLlmSettingsFromStorage,
  saveLlmSettingsToStorage,
} from '../utils/settingsStorage';

const AUTO_SAVE_DELAY_MS = 600;

function validateLlmSettings(settings: LlmSettings, apiKeyInput: string): string | null {
  if (settings.enabled && !settings.hasApiKey && !apiKeyInput.trim()) {
    return '启用 LLM 汇总需要填写 API Key';
  }
  if (settings.provider === 'custom' && !settings.baseUrl?.trim()) {
    return '自定义提供商需要填写 API Base URL';
  }
  if (!settings.model.trim()) {
    return '请填写模型名称';
  }
  return null;
}

export function useLlmSettings() {
  const [settings, setSettings] = useState<LlmSettings>(createDefaultLlmSettings);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const apiKeyInputRef = useRef(apiKeyInput);
  const skipAutoSaveRef = useRef(true);

  settingsRef.current = settings;
  apiKeyInputRef.current = apiKeyInput;

  const persistSettings = useCallback(async (options?: { silent?: boolean }) => {
    const currentSettings = settingsRef.current;
    const currentApiKey = apiKeyInputRef.current;
    const validationError = validateLlmSettings(currentSettings, currentApiKey);

    if (validationError) {
      if (!options?.silent) {
        setError(validationError);
      }
      return false;
    }

    setIsSaving(true);
    if (!options?.silent) {
      setError(null);
      setSaveMessage(null);
    }

    const input: LlmSettingsInput = {
      enabled: currentSettings.enabled,
      provider: currentSettings.provider,
      baseUrl: currentSettings.baseUrl,
      model: currentSettings.model,
      temperature: currentSettings.temperature,
      maxTokens: currentSettings.maxTokens,
    };

    if (currentApiKey.trim()) {
      input.apiKey = currentApiKey.trim();
    }

    try {
      if (!window.electronAPI?.saveLlmSettings) {
        saveLlmSettingsToStorage(currentSettings);
        if (!options?.silent) {
          setSaveMessage('已保存（浏览器预览模式）');
        } else {
          setSaveMessage('已自动保存');
        }
        return true;
      }

      const response = await window.electronAPI.saveLlmSettings(input);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存 LLM 设置失败');
      }

      setSettings(response.settings);
      if (currentApiKey.trim()) {
        setApiKeyInput('');
      }
      setError(null);
      setSaveMessage(options?.silent ? '已自动保存' : 'LLM 设置已保存');
      return true;
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : '保存 LLM 设置失败');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    skipAutoSaveRef.current = true;

    const defaults = createDefaultLlmSettings();

    try {
      if (!window.electronAPI?.getLlmSettings) {
        setSettings(loadLlmSettingsFromStorage(defaults) ?? defaults);
        return;
      }

      const response = await window.electronAPI.getLlmSettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取 LLM 设置失败');
      }
      setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 LLM 设置失败');
      setSettings(loadLlmSettingsFromStorage(defaults) ?? defaults);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isLoading) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void persistSettings({ silent: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [settings, apiKeyInput, isLoading, persistSettings]);

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
    await persistSettings();
  }, [persistSettings]);

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
