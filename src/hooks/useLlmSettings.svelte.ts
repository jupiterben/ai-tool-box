import { untrack } from 'svelte';
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
function validateLlmSettings(
  settings: LlmSettings,
  apiKeyInput: string,
): string | null {
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
  let settings: LlmSettings = $state.raw(createDefaultLlmSettings());
  function setSettings(
    value: typeof settings | ((prev: typeof settings) => typeof settings),
  ) {
    settings = typeof value === 'function' ? value(settings) : value;
  }
  let apiKeyInput = $state.raw('');
  function setApiKeyInput(
    value:
      typeof apiKeyInput | ((prev: typeof apiKeyInput) => typeof apiKeyInput),
  ) {
    apiKeyInput = typeof value === 'function' ? value(apiKeyInput) : value;
  }
  let isLoading = $state.raw(true);
  function setIsLoading(
    value: typeof isLoading | ((prev: typeof isLoading) => typeof isLoading),
  ) {
    isLoading = typeof value === 'function' ? value(isLoading) : value;
  }
  let isSaving = $state.raw(false);
  function setIsSaving(
    value: typeof isSaving | ((prev: typeof isSaving) => typeof isSaving),
  ) {
    isSaving = typeof value === 'function' ? value(isSaving) : value;
  }
  let error: string | null = $state.raw(null);
  function setError(
    value: typeof error | ((prev: typeof error) => typeof error),
  ) {
    error = typeof value === 'function' ? value(error) : value;
  }
  let saveMessage: string | null = $state.raw(null);
  function setSaveMessage(
    value:
      typeof saveMessage | ((prev: typeof saveMessage) => typeof saveMessage),
  ) {
    saveMessage = typeof value === 'function' ? value(saveMessage) : value;
  }
  const skipAutoSaveRef = { current: true };
  const persistSettings = async (options?: { silent?: boolean }) => {
    const currentSettings = settings;
    const currentApiKey = apiKeyInput;
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

      skipAutoSaveRef.current = true;
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
  };
  const loadSettings = async () => {
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
  };
  $effect(() => {
    void loadSettings;
    return untrack(() => {
      void loadSettings();
    });
  });
  $effect(() => {
    void settings;
    void apiKeyInput;
    void isLoading;
    void persistSettings;
    return untrack(() => {
      if (isLoading) return;
      if (skipAutoSaveRef.current) {
        skipAutoSaveRef.current = false;
        return;
      }

      const timer = window.setTimeout(() => {
        void persistSettings({ silent: true });
      }, AUTO_SAVE_DELAY_MS);

      return () => window.clearTimeout(timer);
    });
  });
  const updateSettings = (patch: Partial<LlmSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaveMessage(null);
  };
  const setProvider = (provider: LlmProvider) => {
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
  };
  const saveSettings = async () => {
    await persistSettings();
  };
  return {
    get settings() {
      return settings;
    },
    get apiKeyInput() {
      return apiKeyInput;
    },
    get isLoading() {
      return isLoading;
    },
    get isSaving() {
      return isSaving;
    },
    get error() {
      return error;
    },
    get saveMessage() {
      return saveMessage;
    },
    get loadSettings() {
      return loadSettings;
    },
    get updateSettings() {
      return updateSettings;
    },
    get setProvider() {
      return setProvider;
    },
    get setApiKeyInput() {
      return setApiKeyInput;
    },
    get saveSettings() {
      return saveSettings;
    },
  };
}
