import type { GeolocationSettings } from '../types/geolocation-settings';
import type { LlmSettings } from '../types/llm-settings';
import type { ProxySettings } from '../types/proxy-settings';
import type { ToolSettings } from '../types/tool-settings';
import { withAppEnvSuffix } from './appEnvironment';

export const LLM_SETTINGS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-llm-settings');
export const PROXY_SETTINGS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-proxy-settings');
export const GEOLOCATION_SETTINGS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-geolocation-settings');
export const TOOL_SETTINGS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-tool-settings');
export const THEME_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-theme');
export const SELECTED_TOOLS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-selected-tools');
export const SELECTED_IMAGE_TOOLS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-selected-image-tools');
export const SELECTED_VIDEO_TOOLS_STORAGE_KEY = withAppEnvSuffix('ai-tool-box-selected-video-tools');
export const SUMMARY_PANEL_WIDTH_STORAGE_KEY = withAppEnvSuffix('response-summary-panel-width');
export const SUMMARY_PANEL_OPEN_STORAGE_KEY = withAppEnvSuffix('response-summary-panel-open');

/** Preset 隔离的 localStorage 键（同 origin 多窗共享 localStorage） */
export function presetStorageKey(base: string, presetId: string): string {
  return `${base}::${presetId}`;
}

function readScopedOrLegacy(scopedKey: string, legacyKey: string): string | null {
  const scoped = localStorage.getItem(scopedKey);
  if (scoped != null) return scoped;
  return localStorage.getItem(legacyKey);
}
export function loadLlmSettingsFromStorage(
  defaults: LlmSettings
): LlmSettings | null {
  try {
    const raw = localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      ...defaults,
      ...parsed,
      hasApiKey: false,
      version: defaults.version,
    };
  } catch {
    return null;
  }
}

export function saveLlmSettingsToStorage(settings: LlmSettings): void {
  const { hasApiKey: _hasApiKey, ...rest } = settings;
  localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, JSON.stringify(rest));
}

export function loadProxySettingsFromStorage(
  defaults: ProxySettings,
  presetId?: string
): ProxySettings | null {
  try {
    const key = presetId
      ? presetStorageKey(PROXY_SETTINGS_STORAGE_KEY, presetId)
      : PROXY_SETTINGS_STORAGE_KEY;
    const raw = presetId
      ? readScopedOrLegacy(key, PROXY_SETTINGS_STORAGE_KEY)
      : localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ProxySettings>;
    if (!parsed.tools || !parsed.profiles) return null;

    return {
      version: defaults.version,
      profiles: parsed.profiles,
      tools: { ...defaults.tools, ...parsed.tools },
      session: parsed.session ?? defaults.session,
    };
  } catch {
    return null;
  }
}

export function saveProxySettingsToStorage(settings: ProxySettings, presetId?: string): void {
  const key = presetId
    ? presetStorageKey(PROXY_SETTINGS_STORAGE_KEY, presetId)
    : PROXY_SETTINGS_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(settings));
}

export function loadGeolocationSettingsFromStorage(
  defaults: GeolocationSettings,
  presetId?: string
): GeolocationSettings | null {
  try {
    const key = presetId
      ? presetStorageKey(GEOLOCATION_SETTINGS_STORAGE_KEY, presetId)
      : GEOLOCATION_SETTINGS_STORAGE_KEY;
    const raw = presetId
      ? readScopedOrLegacy(key, GEOLOCATION_SETTINGS_STORAGE_KEY)
      : localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<GeolocationSettings>;
    if (!parsed.tools || !parsed.profiles) return null;

    return {
      version: defaults.version,
      profiles: parsed.profiles,
      tools: { ...defaults.tools, ...parsed.tools },
      session: parsed.session ?? defaults.session,
    };
  } catch {
    return null;
  }
}

export function saveGeolocationSettingsToStorage(
  settings: GeolocationSettings,
  presetId?: string
): void {
  const key = presetId
    ? presetStorageKey(GEOLOCATION_SETTINGS_STORAGE_KEY, presetId)
    : GEOLOCATION_SETTINGS_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(settings));
}

export function loadToolSettingsFromStorage(
  defaults: ToolSettings,
  presetId?: string
): ToolSettings | null {
  try {
    const key = presetId
      ? presetStorageKey(TOOL_SETTINGS_STORAGE_KEY, presetId)
      : TOOL_SETTINGS_STORAGE_KEY;
    const raw = presetId
      ? readScopedOrLegacy(key, TOOL_SETTINGS_STORAGE_KEY)
      : localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ToolSettings>;
    if (!Array.isArray(parsed.disabledToolIds)) return null;

    return {
      version: defaults.version,
      disabledToolIds: parsed.disabledToolIds,
    };
  } catch {
    return null;
  }
}

export function saveToolSettingsToStorage(settings: ToolSettings, presetId?: string): void {
  const key = presetId
    ? presetStorageKey(TOOL_SETTINGS_STORAGE_KEY, presetId)
    : TOOL_SETTINGS_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(settings));
}
