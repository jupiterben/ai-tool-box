import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_DEFAULT_TOOLS } from '../config/tools';
import {
  SESSION_SETTINGS_VERSION,
  createDefaultToolSessionConfig,
  isToolIncognito,
  type SessionSettings,
  type ToolSessionConfig,
} from '../types/session-settings';
import {
  loadSessionSettingsFromStorage,
  saveSessionSettingsToStorage,
} from '../utils/settingsStorage';

const SESSION_CHANGED_EVENT = 'session-settings-changed';
const AUTO_SAVE_DELAY_MS = 800;

let sessionRevision = 0;
let sessionSettingsCache: SessionSettings | null = null;
let sessionSettingsLoadPromise: Promise<SessionSettings> | null = null;

function buildDefaultSettings(): SessionSettings {
  const tools: Record<string, ToolSessionConfig> = {};
  for (const tool of ALL_DEFAULT_TOOLS) {
    if (!tool.url) continue;
    tools[tool.id] = createDefaultToolSessionConfig(tool.id);
  }
  return { version: SESSION_SETTINGS_VERSION, tools };
}

function areSessionSettingsEqual(a: SessionSettings, b: SessionSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function notifySessionChanged() {
  sessionRevision += 1;
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT, { detail: sessionRevision }));
}

/** 同步内存缓存与 localStorage，供 webview 分区读取 */
export function syncSessionSettingsCache(settings: SessionSettings): void {
  sessionSettingsCache = settings;
  saveSessionSettingsToStorage(settings);
}

export function getSessionSettingsSnapshot(): SessionSettings {
  if (sessionSettingsCache) {
    return sessionSettingsCache;
  }
  const defaults = buildDefaultSettings();
  const loaded = loadSessionSettingsFromStorage(defaults) ?? defaults;
  sessionSettingsCache = loaded;
  return loaded;
}

/** 应用启动时从主进程/本地加载，确保 webview 使用正确分区 */
export async function ensureSessionSettingsLoaded(): Promise<SessionSettings> {
  if (sessionSettingsCache) {
    return sessionSettingsCache;
  }
  if (sessionSettingsLoadPromise) {
    return sessionSettingsLoadPromise;
  }

  sessionSettingsLoadPromise = (async () => {
    const defaults = buildDefaultSettings();

    try {
      if (window.electronAPI?.getSessionSettings) {
        const response = await window.electronAPI.getSessionSettings();
        if (response.success && response.settings) {
          syncSessionSettingsCache(response.settings);
          return response.settings;
        }
      }
    } catch {
      // fall through to localStorage
    }

    const loaded = loadSessionSettingsFromStorage(defaults) ?? defaults;
    syncSessionSettingsCache(loaded);
    return loaded;
  })();

  return sessionSettingsLoadPromise;
}

export function useSessionRevision(): number {
  const [revision, setRevision] = useState(sessionRevision);

  useEffect(() => {
    void ensureSessionSettingsLoaded().then(() => {
      notifySessionChanged();
    });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<number>;
      setRevision(custom.detail ?? sessionRevision);
    };
    window.addEventListener(SESSION_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, handler);
  }, []);

  return revision;
}

export function useSessionSettings() {
  const [settings, setSettings] = useState<SessionSettings>(() => getSessionSettingsSnapshot());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const skipAutoSaveRef = useRef(true);
  const lastPersistedRef = useRef('');

  settingsRef.current = settings;

  const persistSettings = useCallback(async (options?: { silent?: boolean }) => {
    const currentSettings = settingsRef.current;
    const serialized = JSON.stringify(currentSettings);

    if (serialized === lastPersistedRef.current) {
      return true;
    }

    setIsSaving(true);
    if (!options?.silent) {
      setError(null);
      setSaveMessage(null);
    }

    try {
      syncSessionSettingsCache(currentSettings);

      if (!window.electronAPI?.saveSessionSettings) {
        lastPersistedRef.current = serialized;
        skipAutoSaveRef.current = true;
        if (!options?.silent) {
          setSaveMessage('已保存（浏览器预览模式）');
        } else {
          setSaveMessage('已自动保存');
        }
        notifySessionChanged();
        return true;
      }

      const response = await window.electronAPI.saveSessionSettings(currentSettings);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存会话设置失败');
      }

      const savedSettings = response.settings;
      syncSessionSettingsCache(savedSettings);
      lastPersistedRef.current = JSON.stringify(savedSettings);
      skipAutoSaveRef.current = true;
      setSettings((prev) =>
        areSessionSettingsEqual(prev, savedSettings) ? prev : savedSettings
      );
      setError(null);
      setSaveMessage(
        options?.silent
          ? '已自动保存'
          : '会话设置已保存，Webview 将使用新的浏览模式'
      );
      notifySessionChanged();
      return true;
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : '保存会话设置失败');
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

    try {
      const loaded = await ensureSessionSettingsLoaded();
      setSettings(loaded);
      lastPersistedRef.current = JSON.stringify(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取会话设置失败');
      const defaults = buildDefaultSettings();
      const loaded = loadSessionSettingsFromStorage(defaults) ?? defaults;
      syncSessionSettingsCache(loaded);
      setSettings(loaded);
      lastPersistedRef.current = JSON.stringify(loaded);
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

  const setToolIncognito = useCallback(
    (toolId: string, incognito: boolean) => {
      void (async () => {
        if (window.electronAPI?.prepareToolSessionMode) {
          const result = await window.electronAPI.prepareToolSessionMode(toolId, incognito);
          if (!result.success) {
            setError(result.error ?? '切换浏览模式失败');
            return;
          }
        }

        const next: SessionSettings = {
          ...settingsRef.current,
          tools: {
            ...settingsRef.current.tools,
            [toolId]: {
              ...settingsRef.current.tools[toolId],
              toolId,
              incognito,
            },
          },
        };
        settingsRef.current = next;
        syncSessionSettingsCache(next);
        setSettings(next);
        setError(null);
        notifySessionChanged();
        skipAutoSaveRef.current = true;
        void persistSettings({ silent: true });
        setSaveMessage(incognito ? '已开启无痕，会话已重置' : '已关闭无痕，临时数据已清除');
      })();
    },
    [persistSettings]
  );

  return {
    settings,
    isLoading,
    isSaving,
    error,
    saveMessage,
    loadSettings,
    setToolIncognito,
    isToolIncognito: (toolId: string) => isToolIncognito(settings, toolId),
  };
}
