import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_DEFAULT_TOOLS, findToolById } from '../config/tools';
import {
  GEOLOCATION_SETTINGS_VERSION,
  createDefaultGeolocationProfiles,
  createDefaultToolGeolocationConfig,
  createGeolocationProfile,
  isValidAccuracy,
  isValidLatitude,
  isValidLongitude,
  type GeolocationProfile,
  type GeolocationSettings,
  type ToolGeolocationConfig,
} from '../types/geolocation-settings';
import {
  loadGeolocationSettingsFromStorage,
  saveGeolocationSettingsToStorage,
} from '../utils/settingsStorage';

const AUTO_SAVE_DELAY_MS = 800;

function areGeolocationSettingsEqual(a: GeolocationSettings, b: GeolocationSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildDefaultSettings(): GeolocationSettings {
  const tools: Record<string, ToolGeolocationConfig> = {};
  for (const tool of ALL_DEFAULT_TOOLS) {
    if (!tool.url) continue;
    tools[tool.id] = createDefaultToolGeolocationConfig(tool.id);
  }
  return {
    version: GEOLOCATION_SETTINGS_VERSION,
    profiles: createDefaultGeolocationProfiles(),
    tools,
  };
}

function sanitizeGeolocationSettingsForSave(settings: GeolocationSettings): GeolocationSettings {
  const usedProfileIds = new Set(
    Object.values(settings.tools)
      .filter((config) => config.mode === 'profile' && config.profileId)
      .map((config) => config.profileId!)
  );

  const profiles: Record<string, GeolocationProfile> = {};
  for (const [id, profile] of Object.entries(settings.profiles)) {
    const hasContent = Boolean(profile.name?.trim() || profile.latitude || profile.longitude);
    if (usedProfileIds.has(id) || hasContent) {
      profiles[id] = profile;
    }
  }

  return { ...settings, profiles };
}

function validateSettings(settings: GeolocationSettings): string | null {
  const sanitized = sanitizeGeolocationSettingsForSave(settings);

  for (const profile of Object.values(sanitized.profiles)) {
    const isUsed = Object.values(sanitized.tools).some(
      (config) => config.mode === 'profile' && config.profileId === profile.id
    );
    if (!isUsed) {
      continue;
    }
    if (!profile.name?.trim()) {
      return '位置名称不能为空';
    }
    if (!isValidLatitude(profile.latitude)) {
      return `位置「${profile.name}」纬度无效（-90 ~ 90）`;
    }
    if (!isValidLongitude(profile.longitude)) {
      return `位置「${profile.name}」经度无效（-180 ~ 180）`;
    }
    if (!isValidAccuracy(profile.accuracy)) {
      return `位置「${profile.name}」精度无效（≥ 0）`;
    }
  }

  for (const config of Object.values(sanitized.tools)) {
    if (config.mode === 'profile') {
      if (!config.profileId) {
        const toolName =
          findToolById(config.toolId)?.name ?? config.toolId;
        return `${toolName} 需要选择一个虚拟位置`;
      }
      if (!sanitized.profiles[config.profileId]) {
        const toolName =
          findToolById(config.toolId)?.name ?? config.toolId;
        return `${toolName} 引用的位置不存在，请重新选择`;
      }
    }
  }

  return null;
}

export function useGeolocationSettings() {
  const [settings, setSettings] = useState<GeolocationSettings>(buildDefaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const skipAutoSaveRef = useRef(true);
  const lastPersistedRef = useRef('');

  settingsRef.current = settings;

  const persistSettings = useCallback(async (options?: { silent?: boolean }) => {
    const currentSettings = sanitizeGeolocationSettingsForSave(settingsRef.current);
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
        saveGeolocationSettingsToStorage(currentSettings);
        lastPersistedRef.current = serialized;
        skipAutoSaveRef.current = true;
        setSettings((prev) =>
          areGeolocationSettingsEqual(prev, currentSettings) ? prev : currentSettings
        );
        if (!options?.silent) {
          setSaveMessage('已保存（浏览器预览模式）');
        } else {
          setSaveMessage('已自动保存');
        }
        return true;
      }

      const response = await window.electronAPI.saveGeolocationSettings(currentSettings);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存 GPS 设置失败');
      }

      const savedSettings = response.settings;
      lastPersistedRef.current = JSON.stringify(savedSettings);
      skipAutoSaveRef.current = true;
      setSettings((prev) =>
        areGeolocationSettingsEqual(prev, savedSettings) ? prev : savedSettings
      );
      setError(null);
      setSaveMessage(
        options?.silent ? '已自动保存' : 'GPS 设置已保存，Webview 将使用新定位'
      );
      return true;
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : '保存 GPS 设置失败');
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
        const loaded = loadGeolocationSettingsFromStorage(defaults) ?? defaults;
        setSettings(loaded);
        lastPersistedRef.current = JSON.stringify(sanitizeGeolocationSettingsForSave(loaded));
        return;
      }

      const response = await window.electronAPI.getGeolocationSettings();
      if (!response.success || !response.settings) {
        throw new Error(response.error || '读取 GPS 设置失败');
      }
      setSettings(response.settings);
      lastPersistedRef.current = JSON.stringify(
        sanitizeGeolocationSettingsForSave(response.settings)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 GPS 设置失败');
      const loaded = loadGeolocationSettingsFromStorage(defaults) ?? defaults;
      setSettings(loaded);
      lastPersistedRef.current = JSON.stringify(sanitizeGeolocationSettingsForSave(loaded));
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

  const updateToolConfig = useCallback((toolId: string, patch: Partial<ToolGeolocationConfig>) => {
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
      const profile = createGeolocationProfile(`位置 ${index}`);
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

  const updateProfile = useCallback((profileId: string, patch: Partial<GeolocationProfile>) => {
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
      const tools: Record<string, ToolGeolocationConfig> = {};

      for (const [toolId, config] of Object.entries(prev.tools)) {
        if (config.mode === 'profile' && config.profileId === profileId) {
          tools[toolId] = createDefaultToolGeolocationConfig(toolId);
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
