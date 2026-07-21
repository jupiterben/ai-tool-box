import { useCallback, useEffect, useRef, useState } from 'react';
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
  window.dispatchEvent(new CustomEvent(PROXY_CHANGED_EVENT, { detail: proxyRevision }));
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
      .map((config) => config.profileId!)
  );

  const profiles: Record<string, ProxyProfile> = {};
  for (const [id, profile] of Object.entries(settings.profiles)) {
    const hasContent = Boolean(
      profile.host?.trim() || profile.port?.trim() || profile.name?.trim()
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
      (config) => config.mode === 'profile' && config.profileId === profile.id
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
          ALL_DEFAULT_TOOLS.find((tool) => tool.id === config.toolId)?.name ?? config.toolId;
        return `${toolName} 需要选择一个代理`;
      }
      if (!sanitized.profiles[config.profileId]) {
        const toolName =
          ALL_DEFAULT_TOOLS.find((tool) => tool.id === config.toolId)?.name ?? config.toolId;
        return `${toolName} 引用的代理不存在，请重新选择`;
      }
    }
  }

  return null;
}

export function useProxyRevision(): number {
  const [revision, setRevision] = useState(proxyRevision);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<number>;
      setRevision(custom.detail ?? proxyRevision);
    };
    window.addEventListener(PROXY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PROXY_CHANGED_EVENT, handler);
  }, []);

  return revision;
}

export function useProxySettings() {
  const [settings, setSettings] = useState<ProxySettings>(buildDefaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const skipAutoSaveRef = useRef(true);
  const lastPersistedRef = useRef('');

  settingsRef.current = settings;

  const persistSettings = useCallback(async (options?: { silent?: boolean }) => {
    const currentSettings = sanitizeProxySettingsForSave(settingsRef.current);
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
          areProxySettingsEqual(prev, currentSettings) ? prev : currentSettings
        );
        if (!options?.silent) {
          setSaveMessage('已保存（浏览器预览模式）');
        } else {
          setSaveMessage('已自动保存');
        }
        notifyProxyChanged();
        return true;
      }

      const response = await window.electronAPI.saveProxySettings(currentSettings);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存代理设置失败');
      }

      const savedSettings = response.settings;
      lastPersistedRef.current = JSON.stringify(savedSettings);
      skipAutoSaveRef.current = true;
      setSettings((prev) =>
        areProxySettingsEqual(prev, savedSettings) ? prev : savedSettings
      );
      setError(null);
      setSaveMessage(
        options?.silent
          ? '已自动保存'
          : '代理设置已保存，Webview 将使用新网络环境'
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
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    skipAutoSaveRef.current = true;

    const defaults = buildDefaultSettings();

    try {
      if (!window.electronAPI) {
        const loaded = loadProxySettingsFromStorage(defaults) ?? defaults;
        setSettings(loaded);
        lastPersistedRef.current = JSON.stringify(sanitizeProxySettingsForSave(loaded));
        return;
      }

      const response = await window.electronAPI.getProxySettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取代理设置失败');
      }
      setSettings(response.settings);
      lastPersistedRef.current = JSON.stringify(
        sanitizeProxySettingsForSave(response.settings)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取代理设置失败');
      const loaded = loadProxySettingsFromStorage(defaults) ?? defaults;
      setSettings(loaded);
      lastPersistedRef.current = JSON.stringify(sanitizeProxySettingsForSave(loaded));
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
  }, [settings, isLoading, persistSettings]);

  const clearSaveFeedback = useCallback(() => {
    setSaveMessage(null);
  }, []);

  const updateToolConfig = useCallback((toolId: string, patch: Partial<ToolProxyConfig>) => {
    setSettings((prev) => {
      const nextTool = {
        ...prev.tools[toolId],
        ...patch,
        toolId,
      };
      return {
        ...prev,
        tools: {
          ...prev.tools,
          [toolId]: nextTool,
        },
        // 同 Preset 共用一份上游：以最近修改的工具配置作为 session
        session: {
          mode: nextTool.mode,
          profileId: nextTool.profileId,
        },
      };
    });
    clearSaveFeedback();
  }, [clearSaveFeedback]);

  const addProfile = useCallback(() => {
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
  }, [clearSaveFeedback]);

  const updateProfile = useCallback((profileId: string, patch: Partial<ProxyProfile>) => {
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
  }, [clearSaveFeedback]);

  const removeProfile = useCallback((profileId: string) => {
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
  }, [clearSaveFeedback]);

  const saveSettings = useCallback(async () => {
    await persistSettings();
  }, [persistSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    saveMessage,
    loadSettings,
    updateToolConfig,
    addProfile,
    updateProfile,
    removeProfile,
    saveSettings,
  };
}
