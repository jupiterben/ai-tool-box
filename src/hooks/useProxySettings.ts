import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TOOLS } from '../config/tools';
import {
  PROXY_SETTINGS_VERSION,
  createDefaultToolProxyConfig,
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
  return { version: PROXY_SETTINGS_VERSION, tools };
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
    setSaveMessage(null);
  }, []);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    for (const config of Object.values(settings.tools)) {
      if (config.mode === 'manual') {
        if (!config.host?.trim() || !config.port?.trim()) {
          setError(`${config.toolId} 的自定义代理需要填写主机和端口`);
          setIsSaving(false);
          return;
        }
      }
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
    saveSettings,
  };
}
