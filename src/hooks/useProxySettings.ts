import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TOOLS } from '../config/tools';
import {
  PROXY_SETTINGS_VERSION,
  createDefaultToolProxyConfig,
  createProxyProfile,
  type ProxyProfile,
  type ProxySettings,
  type ToolProxyConfig,
} from '../types/proxy-settings';

const PROXY_CHANGED_EVENT = 'proxy-settings-changed';

let proxyRevision = 0;

function notifyProxyChanged() {
  proxyRevision += 1;
  window.dispatchEvent(new CustomEvent(PROXY_CHANGED_EVENT, { detail: proxyRevision }));
}

function buildDefaultSettings(): ProxySettings {
  const tools: Record<string, ToolProxyConfig> = {};
  for (const tool of DEFAULT_TOOLS) {
    if (!tool.url) continue;
    tools[tool.id] = createDefaultToolProxyConfig(tool.id);
  }
  return { version: PROXY_SETTINGS_VERSION, profiles: {}, tools };
}

function validateSettings(settings: ProxySettings): string | null {
  for (const profile of Object.values(settings.profiles)) {
    if (!profile.name?.trim()) {
      return '代理名称不能为空';
    }
    if (!profile.host?.trim() || !profile.port?.trim()) {
      return `代理「${profile.name}」需要填写主机和端口`;
    }
  }

  for (const config of Object.values(settings.tools)) {
    if (config.mode === 'profile') {
      if (!config.profileId) {
        const toolName =
          DEFAULT_TOOLS.find((tool) => tool.id === config.toolId)?.name ?? config.toolId;
        return `${toolName} 需要选择一个代理`;
      }
      if (!settings.profiles[config.profileId]) {
        const toolName =
          DEFAULT_TOOLS.find((tool) => tool.id === config.toolId)?.name ?? config.toolId;
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

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!window.electronAPI) {
        setSettings(buildDefaultSettings());
        return;
      }

      const response = await window.electronAPI.getProxySettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取代理设置失败');
      }
      setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取代理设置失败');
      setSettings(buildDefaultSettings());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const clearSaveFeedback = useCallback(() => {
    setSaveMessage(null);
  }, []);

  const updateToolConfig = useCallback((toolId: string, patch: Partial<ToolProxyConfig>) => {
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
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    const validationError = validateSettings(settings);
    if (validationError) {
      setError(validationError);
      setIsSaving(false);
      return;
    }

    try {
      if (!window.electronAPI) {
        setSaveMessage('当前为浏览器预览模式，代理设置仅在 Electron 中生效');
        notifyProxyChanged();
        return;
      }

      const response = await window.electronAPI.saveProxySettings(settings);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存代理设置失败');
      }

      setSettings(response.settings);
      setSaveMessage('代理设置已保存，Webview 将使用新网络环境');
      notifyProxyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存代理设置失败');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

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
