import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_DISABLED_TOOL_IDS, DEFAULT_TOOLS } from '../config/tools';
import type { AITool } from '../types/ai-tool';
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

function notifyToolSettingsChanged() {
  toolSettingsRevision += 1;
  window.dispatchEvent(
    new CustomEvent(TOOL_SETTINGS_CHANGED_EVENT, { detail: toolSettingsRevision })
  );
}

function buildDefaultSettings(): ToolSettings {
  return createDefaultToolSettings(DEFAULT_DISABLED_TOOL_IDS);
}

function sanitizeSettings(settings: Partial<ToolSettings>): ToolSettings {
  const validIds = new Set(DEFAULT_TOOLS.map((tool) => tool.id));
  const disabledToolIds = (settings.disabledToolIds ?? []).filter((id) => validIds.has(id));
  return {
    version: TOOL_SETTINGS_VERSION,
    disabledToolIds,
  };
}

function computeNextToolSettings(
  prev: ToolSettings,
  toolId: string,
  enabled: boolean
): ToolSettings | null {
  const disabled = new Set(prev.disabledToolIds);

  if (enabled) {
    disabled.delete(toolId);
  } else if (!disabled.has(toolId)) {
    const enabledCount = DEFAULT_TOOLS.length - disabled.size;
    if (enabledCount <= 1) {
      return null;
    }
    disabled.add(toolId);
  } else {
    return null;
  }

  return { ...prev, disabledToolIds: [...disabled] };
}

export function getEnabledTools(settings: ToolSettings): AITool[] {
  const disabled = new Set(settings.disabledToolIds);
  return DEFAULT_TOOLS.filter((tool) => !disabled.has(tool.id));
}

export function isToolEnabled(settings: ToolSettings, toolId: string): boolean {
  return !settings.disabledToolIds.includes(toolId);
}

export function useToolSettingsRevision(): number {
  const [revision, setRevision] = useState(toolSettingsRevision);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<number>;
      setRevision(custom.detail ?? toolSettingsRevision);
    };
    window.addEventListener(TOOL_SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TOOL_SETTINGS_CHANGED_EVENT, handler);
  }, []);

  return revision;
}

export function useToolSettings() {
  const [settings, setSettings] = useState<ToolSettings>(buildDefaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    setIsLoading(true);
    const defaults = buildDefaultSettings();
    const loaded = loadToolSettingsFromStorage(defaults) ?? defaults;
    setSettings(sanitizeSettings(loaded));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const persistSettings = useCallback((next: ToolSettings) => {
    const sanitized = sanitizeSettings(next);
    saveToolSettingsToStorage(sanitized);
    setSaveMessage('已保存');
    notifyToolSettingsChanged();
    window.setTimeout(() => setSaveMessage(null), 2000);
  }, []);

  const setToolEnabled = useCallback(
    (toolId: string, enabled: boolean) => {
      let nextToPersist: ToolSettings | null = null;

      setSettings((prev) => {
        const next = computeNextToolSettings(prev, toolId, enabled);
        if (!next) {
          return prev;
        }
        nextToPersist = next;
        return next;
      });

      if (nextToPersist) {
        persistSettings(nextToPersist);
      }
    },
    [persistSettings]
  );

  const enabledTools = useMemo(() => getEnabledTools(settings), [settings]);

  return {
    settings,
    enabledTools,
    isLoading,
    saveMessage,
    loadSettings,
    setToolEnabled,
    isToolEnabled: (toolId: string) => isToolEnabled(settings, toolId),
  };
}

export function useEnabledTools(): AITool[] {
  const revision = useToolSettingsRevision();
  return useMemo(() => {
    void revision;
    const defaults = buildDefaultSettings();
    const loaded = loadToolSettingsFromStorage(defaults) ?? defaults;
    return getEnabledTools(sanitizeSettings(loaded));
  }, [revision]);
}
