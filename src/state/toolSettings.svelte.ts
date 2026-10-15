import { untrack } from 'svelte';

import {
  ALL_DEFAULT_TOOLS,
  DEFAULT_DISABLED_TOOL_IDS,
  getToolsByCategory,
} from '../config/tools';
import type { AITool, ToolCategory } from '../types/ai-tool';
import {
  TOOL_SETTINGS_VERSION,
  createDefaultToolSettings,
  type ToolSettings,
} from '../types/tool-settings';
import {
  loadToolSettingsFromStorage,
  saveToolSettingsToStorage,
} from '../utils/settingsStorage';
const TOOL_SETTINGS_CHANGED_EVENT = 'tool-settings-changed';
let toolSettingsRevision = 0;
let cachedToolSettings: ToolSettings | null = null;
let cachedPresetId: string | null = null;
function currentPresetId(): string {
  if (typeof window !== 'undefined' && window.desktopAPI?.getPresetId) {
    return window.desktopAPI.getPresetId();
  }
  return 'default';
}
function readToolSettingsFromStorage(): ToolSettings {
  const defaults = buildDefaultSettings();
  const loaded =
    loadToolSettingsFromStorage(defaults, currentPresetId()) ?? defaults;
  return sanitizeSettings(loaded);
}
function getCachedToolSettings(): ToolSettings {
  const presetId = currentPresetId();
  if (!cachedToolSettings || cachedPresetId !== presetId) {
    cachedPresetId = presetId;
    cachedToolSettings = readToolSettingsFromStorage();
  }
  return cachedToolSettings;
}
function notifyToolSettingsChanged() {
  toolSettingsRevision += 1;
  window.dispatchEvent(
    new CustomEvent(TOOL_SETTINGS_CHANGED_EVENT, {
      detail: toolSettingsRevision,
    }),
  );
}
function buildDefaultSettings(): ToolSettings {
  return createDefaultToolSettings(DEFAULT_DISABLED_TOOL_IDS);
}
function sanitizeSettings(settings: Partial<ToolSettings>): ToolSettings {
  const validIds = new Set(ALL_DEFAULT_TOOLS.map((tool) => tool.id));
  const disabledToolIds = (settings.disabledToolIds ?? []).filter((id) =>
    validIds.has(id),
  );
  return {
    version: TOOL_SETTINGS_VERSION,
    disabledToolIds,
  };
}
function computeNextToolSettings(
  prev: ToolSettings,
  toolId: string,
  enabled: boolean,
): ToolSettings | null {
  const tool = ALL_DEFAULT_TOOLS.find((item) => item.id === toolId);
  if (!tool) return null;

  // This temporary set builds an immutable settings snapshot, not reactive state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const disabled = new Set(prev.disabledToolIds);
  const categoryTools = getToolsByCategory(tool.category);

  if (enabled) {
    disabled.delete(toolId);
  } else if (!disabled.has(toolId)) {
    const enabledInCategory = categoryTools.filter(
      (item) => !disabled.has(item.id),
    ).length;
    if (enabledInCategory <= 1) {
      return null;
    }
    disabled.add(toolId);
  } else {
    return null;
  }

  return { ...prev, disabledToolIds: [...disabled] };
}
export function getEnabledTools(
  settings: ToolSettings,
  category?: ToolCategory,
): AITool[] {
  const tools = category ? getToolsByCategory(category) : ALL_DEFAULT_TOOLS;
  return tools.filter((tool) => !settings.disabledToolIds.includes(tool.id));
}
export function isToolEnabled(settings: ToolSettings, toolId: string): boolean {
  return !settings.disabledToolIds.includes(toolId);
}
export function createToolSettingsRevision() {
  let revision = $state.raw(toolSettingsRevision);
  function setRevision(
    next: typeof revision | ((previous: typeof revision) => typeof revision),
  ) {
    revision =
      typeof next === 'function' ? untrack(() => next(revision)) : next;
  }
  $effect(() => {
    return untrack(() => {
      const handler = (event: Event) => {
        const custom = event as CustomEvent<number>;
        setRevision(custom.detail ?? toolSettingsRevision);
      };
      window.addEventListener(TOOL_SETTINGS_CHANGED_EVENT, handler);
      return () =>
        window.removeEventListener(TOOL_SETTINGS_CHANGED_EVENT, handler);
    });
  });
  return {
    get revision() {
      return revision;
    },
  };
}
export function createToolSettings() {
  let settings: ToolSettings = $state.raw((() => getCachedToolSettings())());
  function setSettings(
    next: typeof settings | ((previous: typeof settings) => typeof settings),
  ) {
    settings =
      typeof next === 'function' ? untrack(() => next(settings)) : next;
  }
  const settingsRef = {
    get current() {
      return settings;
    },
  };

  let isLoading = $state.raw(true);
  function setIsLoading(
    next: typeof isLoading | ((previous: typeof isLoading) => typeof isLoading),
  ) {
    isLoading =
      typeof next === 'function' ? untrack(() => next(isLoading)) : next;
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
  const loadSettings = () => {
    setIsLoading(true);
    const sanitized = readToolSettingsFromStorage();
    cachedToolSettings = sanitized;
    cachedPresetId = currentPresetId();
    setSettings(sanitized);
    setIsLoading(false);
  };
  $effect(() => {
    void loadSettings;
    return untrack(() => {
      loadSettings();
    });
  });
  const persistSettings = (next: ToolSettings) => {
    const sanitized = sanitizeSettings(next);
    cachedToolSettings = sanitized;
    cachedPresetId = currentPresetId();
    saveToolSettingsToStorage(sanitized, cachedPresetId);
    void window.desktopAPI
      ?.saveToolSettings?.(sanitized)
      .then((result) => {
        if (!result.success) setSaveMessage(result.error || '保存网站设置失败');
      })
      .catch((error) => setSaveMessage(String(error)));
    setSaveMessage('已保存');
    notifyToolSettingsChanged();
    window.setTimeout(() => setSaveMessage(null), 2000);
  };
  const setToolEnabled = (toolId: string, enabled: boolean) => {
    const next = computeNextToolSettings(settingsRef.current, toolId, enabled);
    if (!next) {
      return;
    }
    setSettings(next);
    persistSettings(next);
  };
  let enabledTools = $derived.by(() => getEnabledTools(settings));
  return {
    get settings() {
      return settings;
    },
    get enabledTools() {
      return enabledTools;
    },
    get isLoading() {
      return isLoading;
    },
    get saveMessage() {
      return saveMessage;
    },
    get loadSettings() {
      return loadSettings;
    },
    get setToolEnabled() {
      return setToolEnabled;
    },
    get isToolEnabled() {
      return (toolId: string) => isToolEnabled(settings, toolId);
    },
  };
}
export function createEnabledTools(category: () => ToolCategory) {
  const revision = createToolSettingsRevision();
  let tools = $derived.by(() => {
    void revision.revision;
    return getEnabledTools(getCachedToolSettings(), category());
  });
  return {
    get tools() {
      return tools;
    },
  };
}
