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
export function createLlmSettings() {
  let settings: LlmSettings = $state.raw(createDefaultLlmSettings());
  function setSettings(
    next: typeof settings | ((previous: typeof settings) => typeof settings),
  ) {
    settings =
      typeof next === 'function' ? untrack(() => next(settings)) : next;
  }
  let apiKeyInput = $state.raw('');
  function setApiKeyInput(
    next:
      | typeof apiKeyInput
      | ((previous: typeof apiKeyInput) => typeof apiKeyInput),
  ) {
    apiKeyInput =
      typeof next === 'function' ? untrack(() => next(apiKeyInput)) : next;
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
  const settingsRef = {
    get current() {
      return settings;
    },
  };
  const apiKeyInputRef = {
    get current() {
      return apiKeyInput;
    },
  };
  let lastPersisted = '';

  const persistSettings = async (options?: { silent?: boolean }) => {
    if (isSaving) return false;
    const currentSettings = settingsRef.current;
    const currentApiKey = apiKeyInputRef.current;
    const serialized = JSON.stringify([currentSettings, currentApiKey]);
    if (serialized === lastPersisted) return true;
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
      if (!window.desktopAPI?.saveLlmSettings) {
        saveLlmSettingsToStorage(currentSettings);
        lastPersisted = serialized;
        if (!options?.silent) {
          setSaveMessage('已保存（浏览器预览模式）');
        } else {
          setSaveMessage('已自动保存');
        }
        return true;
      }

      const response = await window.desktopAPI.saveLlmSettings(input);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存 LLM 设置失败');
      }

      lastPersisted = JSON.stringify([response.settings, currentApiKey.trim() ? '' : currentApiKey]);
      if (settings === currentSettings) setSettings(response.settings);
      if (currentApiKey.trim() && apiKeyInput === currentApiKey) {
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

    const defaults = createDefaultLlmSettings();

    try {
      if (!window.desktopAPI?.getLlmSettings) {
        setSettings(loadLlmSettingsFromStorage(defaults) ?? defaults);
        return;
      }

      const response = await window.desktopAPI.getLlmSettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取 LLM 设置失败');
      }
      setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 LLM 设置失败');
      setSettings(loadLlmSettingsFromStorage(defaults) ?? defaults);
    } finally {
      lastPersisted = JSON.stringify([settings, apiKeyInput]);
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
    void isSaving;
    void persistSettings;
    return untrack(() => {
      if (isLoading || isSaving) return;

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
