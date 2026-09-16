import { untrack, getContext, setContext } from 'svelte';
import { ALL_DEFAULT_TOOLS } from '../config/tools';
import {
  PROXY_SETTINGS_VERSION,
  createDefaultToolProxyConfig,
  createProxyProfile,
  type ProxyProfile,
  type ProxySettings,
  type ToolProxyConfig,
} from '../types/proxy-settings';
import {
  loadProxySettingsFromStorage,
  saveProxySettingsToStorage,
} from '../utils/settingsStorage';
const PROXY_CHANGED_EVENT = 'proxy-settings-changed';
const AUTO_SAVE_DELAY_MS = 800;
let proxyRevision = 0;
function areProxySettingsEqual(a: ProxySettings, b: ProxySettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function notifyProxyChanged() {
  proxyRevision += 1;
  window.dispatchEvent(
    new CustomEvent(PROXY_CHANGED_EVENT, { detail: proxyRevision }),
  );
}
function buildDefaultSettings(): ProxySettings {
  const tools: Record<string, ToolProxyConfig> = {};
  for (const tool of ALL_DEFAULT_TOOLS) {
    if (!tool.url) continue;
    tools[tool.id] = createDefaultToolProxyConfig(tool.id);
  }
  return { version: PROXY_SETTINGS_VERSION, profiles: {}, tools };
}
function sanitizeProxySettingsForSave(settings: ProxySettings): ProxySettings {
  const usedProfileIds = new Set(
    Object.values(settings.tools)
      .filter((config) => config.mode === 'profile' && config.profileId)
      .map((config) => config.profileId!),
  );

  const profiles: Record<string, ProxyProfile> = {};
  for (const [id, profile] of Object.entries(settings.profiles)) {
    const hasContent = Boolean(
      profile.host?.trim() || profile.port?.trim() || profile.name?.trim(),
    );
    if (usedProfileIds.has(id) || hasContent) {
      profiles[id] = profile;
    }
  }

  return { ...settings, profiles };
}
function validateSettings(settings: ProxySettings): string | null {
  const sanitized = sanitizeProxySettingsForSave(settings);

  for (const profile of Object.values(sanitized.profiles)) {
    const isUsed = Object.values(sanitized.tools).some(
      (config) => config.mode === 'profile' && config.profileId === profile.id,
    );
    if (!isUsed) {
      continue;
    }
    if (!profile.name?.trim()) {
      return '代理名称不能为空';
    }
    if (!profile.host?.trim() || !profile.port?.trim()) {
      return `代理「${profile.name}」需要填写主机和端口`;
    }
  }

  for (const config of Object.values(sanitized.tools)) {
    if (config.mode === 'profile') {
      if (!config.profileId) {
        const toolName =
          ALL_DEFAULT_TOOLS.find((tool) => tool.id === config.toolId)?.name ??
          config.toolId;
        return `${toolName} 需要选择一个代理`;
      }
      if (!sanitized.profiles[config.profileId]) {
        const toolName =
          ALL_DEFAULT_TOOLS.find((tool) => tool.id === config.toolId)?.name ??
          config.toolId;
        return `${toolName} 引用的代理不存在，请重新选择`;
      }
    }
  }

  return null;
}
export function useProxyRevision() {
  let revision = $state.raw(proxyRevision);
  function setRevision(
    value: typeof revision | ((prev: typeof revision) => typeof revision),
  ) {
    revision = typeof value === 'function' ? value(revision) : value;
  }
  $effect(() => {
    return untrack(() => {
      const handler = (event: Event) => {
        const custom = event as CustomEvent<number>;
        setRevision(custom.detail ?? proxyRevision);
      };
      window.addEventListener(PROXY_CHANGED_EVENT, handler);
      return () => window.removeEventListener(PROXY_CHANGED_EVENT, handler);
    });
  });
  return {
    get current() {
      return revision;
    },
  };
}
export function useProxySettings() {
  const existing =
    getContext<ReturnType<typeof createProxySettings>>('proxy-settings');
  return existing ?? setContext('proxy-settings', createProxySettings());
}
function createProxySettings() {
  let settings: ProxySettings = $state.raw(buildDefaultSettings());
  function setSettings(
    value: typeof settings | ((prev: typeof settings) => typeof settings),
  ) {
    settings = typeof value === 'function' ? value(settings) : value;
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
  const lastPersistedRef = { current: '' };
  const persistSettings = async (options?: { silent?: boolean }) => {
    const currentSettings = sanitizeProxySettingsForSave(settings);
    const serialized = JSON.stringify(currentSettings);

    if (serialized === lastPersistedRef.current) {
      return true;
    }

    const validationError = validateSettings(currentSettings);

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

    try {
      if (!window.electronAPI) {
        saveProxySettingsToStorage(currentSettings);
        lastPersistedRef.current = serialized;
        skipAutoSaveRef.current = true;
        setSettings((prev) =>
          areProxySettingsEqual(prev, currentSettings) ? prev : currentSettings,
        );
        if (!options?.silent) {
          setSaveMessage('已保存（浏览器预览模式）');
        } else {
          setSaveMessage('已自动保存');
        }
        notifyProxyChanged();
        return true;
      }

      const response =
        await window.electronAPI.saveProxySettings(currentSettings);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存代理设置失败');
      }

      const savedSettings = response.settings;
      lastPersistedRef.current = JSON.stringify(savedSettings);
      skipAutoSaveRef.current = true;
      setSettings((prev) =>
        areProxySettingsEqual(prev, savedSettings) ? prev : savedSettings,
      );
      setError(null);
      setSaveMessage(
        options?.silent
          ? '已自动保存'
          : '代理设置已保存，Webview 将使用新网络环境',
      );
      notifyProxyChanged();
      return true;
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : '保存代理设置失败');
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

    const defaults = buildDefaultSettings();

    try {
      if (!window.electronAPI) {
        const loaded = loadProxySettingsFromStorage(defaults) ?? defaults;
        setSettings(loaded);
        lastPersistedRef.current = JSON.stringify(
          sanitizeProxySettingsForSave(loaded),
        );
        return;
      }

      const response = await window.electronAPI.getProxySettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取代理设置失败');
      }
      setSettings(response.settings);
      lastPersistedRef.current = JSON.stringify(
        sanitizeProxySettingsForSave(response.settings),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取代理设置失败');
      const loaded = loadProxySettingsFromStorage(defaults) ?? defaults;
      setSettings(loaded);
      lastPersistedRef.current = JSON.stringify(
        sanitizeProxySettingsForSave(loaded),
      );
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
    void isLoading;
    void persistSettings;
    return untrack(() => {
      if (isLoading) return;
      if (
        JSON.stringify(sanitizeProxySettingsForSave(settings)) ===
        lastPersistedRef.current
      )
        return;

      const timer = window.setTimeout(() => {
        void persistSettings({ silent: true });
      }, AUTO_SAVE_DELAY_MS);

      return () => window.clearTimeout(timer);
    });
  });
  const clearSaveFeedback = () => {
    setSaveMessage(null);
  };
  const updateToolConfig = (
    toolId: string,
    patch: Partial<ToolProxyConfig>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      tools: {
        ...prev.tools,
        [toolId]: {
          ...prev.tools[toolId],
          ...patch,
          toolId,
        },
      },
    }));
    clearSaveFeedback();
  };
  const addProfile = () => {
    setSettings((prev) => {
      const index = Object.keys(prev.profiles).length + 1;
      const profile = createProxyProfile(`代理 ${index}`);
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [profile.id]: profile,
        },
      };
    });
    clearSaveFeedback();
  };
  const updateProfile = (profileId: string, patch: Partial<ProxyProfile>) => {
    setSettings((prev) => {
      const existing = prev.profiles[profileId];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [profileId]: { ...existing, ...patch, id: profileId },
        },
      };
    });
    clearSaveFeedback();
  };
  const removeProfile = (profileId: string) => {
    setSettings((prev) => {
      const { [profileId]: _removed, ...profiles } = prev.profiles;
      const tools: Record<string, ToolProxyConfig> = {};

      for (const [toolId, config] of Object.entries(prev.tools)) {
        if (config.mode === 'profile' && config.profileId === profileId) {
          tools[toolId] = createDefaultToolProxyConfig(toolId);
        } else {
          tools[toolId] = config;
        }
      }

      return { ...prev, profiles, tools };
    });
    clearSaveFeedback();
  };
  const saveSettings = async () => {
    await persistSettings();
  };
  return {
    get settings() {
      return settings;
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
    get updateToolConfig() {
      return updateToolConfig;
    },
    get addProfile() {
      return addProfile;
    },
    get updateProfile() {
      return updateProfile;
    },
    get removeProfile() {
      return removeProfile;
    },
    get saveSettings() {
      return saveSettings;
    },
  };
}
