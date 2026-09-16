import { untrack, getContext, setContext } from 'svelte';
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
function areSessionSettingsEqual(
  a: SessionSettings,
  b: SessionSettings,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function notifySessionChanged() {
  sessionRevision += 1;
  window.dispatchEvent(
    new CustomEvent(SESSION_CHANGED_EVENT, { detail: sessionRevision }),
  );
}
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
export function useSessionRevision() {
  let revision = $state.raw(sessionRevision);
  function setRevision(
    value: typeof revision | ((prev: typeof revision) => typeof revision),
  ) {
    revision = typeof value === 'function' ? value(revision) : value;
  }
  $effect(() => {
    return untrack(() => {
      const handler = (event: Event) => {
        const custom = event as CustomEvent<number>;
        setRevision(custom.detail ?? sessionRevision);
      };
      window.addEventListener(SESSION_CHANGED_EVENT, handler);
      return () => window.removeEventListener(SESSION_CHANGED_EVENT, handler);
    });
  });
  return {
    get current() {
      return revision;
    },
  };
}
export function useSessionSettings() {
  const existing =
    getContext<ReturnType<typeof createSessionSettings>>('session-settings');
  return existing ?? setContext('session-settings', createSessionSettings());
}
function createSessionSettings() {
  let settings: SessionSettings = $state.raw(
    (() => getSessionSettingsSnapshot())(),
  );
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
    const currentSettings = settings;
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

      const response =
        await window.electronAPI.saveSessionSettings(currentSettings);
      if (!response.success || !response.settings) {
        throw new Error(response.error || '保存会话设置失败');
      }

      const savedSettings = response.settings;
      syncSessionSettingsCache(savedSettings);
      lastPersistedRef.current = JSON.stringify(savedSettings);
      skipAutoSaveRef.current = true;
      setSettings((prev) =>
        areSessionSettingsEqual(prev, savedSettings) ? prev : savedSettings,
      );
      setError(null);
      setSaveMessage(
        options?.silent
          ? '已自动保存'
          : '会话设置已保存，Webview 将使用新的浏览模式',
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
  };
  const loadSettings = async () => {
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
      if (JSON.stringify(settings) === lastPersistedRef.current) return;

      const timer = window.setTimeout(() => {
        void persistSettings({ silent: true });
      }, AUTO_SAVE_DELAY_MS);

      return () => window.clearTimeout(timer);
    });
  });
  const setToolIncognito = (toolId: string, incognito: boolean) => {
    void (async () => {
      if (window.electronAPI?.prepareToolSessionMode) {
        const result = await window.electronAPI.prepareToolSessionMode(
          toolId,
          incognito,
        );
        if (!result.success) {
          setError(result.error ?? '切换浏览模式失败');
          return;
        }
      }

      const next: SessionSettings = {
        ...settings,
        tools: {
          ...settings.tools,
          [toolId]: {
            ...settings.tools[toolId],
            toolId,
            incognito,
          },
        },
      };
      settings = next;
      syncSessionSettingsCache(next);
      setSettings(next);
      setError(null);
      notifySessionChanged();
      skipAutoSaveRef.current = true;
      void persistSettings({ silent: true });
      setSaveMessage(
        incognito ? '已开启无痕，会话已重置' : '已关闭无痕，临时数据已清除',
      );
    })();
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
    get setToolIncognito() {
      return setToolIncognito;
    },
    isToolIncognito: (toolId: string) => isToolIncognito(settings, toolId),
  };
}
