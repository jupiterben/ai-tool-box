import type { GeolocationSettings } from '../types/geolocation-settings';
import type { LlmSettings } from '../types/llm-settings';
import type { ProxySettings } from '../types/proxy-settings';

export const LLM_SETTINGS_STORAGE_KEY = 'ai-tool-box-llm-settings';
export const PROXY_SETTINGS_STORAGE_KEY = 'ai-tool-box-proxy-settings';
export const GEOLOCATION_SETTINGS_STORAGE_KEY = 'ai-tool-box-geolocation-settings';

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
  defaults: ProxySettings
): ProxySettings | null {
  try {
    const raw = localStorage.getItem(PROXY_SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ProxySettings>;
    if (!parsed.tools || !parsed.profiles) return null;

    return {
      version: defaults.version,
      profiles: parsed.profiles,
      tools: { ...defaults.tools, ...parsed.tools },
    };
  } catch {
    return null;
  }
}

export function saveProxySettingsToStorage(settings: ProxySettings): void {
  localStorage.setItem(PROXY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function loadGeolocationSettingsFromStorage(
  defaults: GeolocationSettings
): GeolocationSettings | null {
  try {
    const raw = localStorage.getItem(GEOLOCATION_SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<GeolocationSettings>;
    if (!parsed.tools || !parsed.profiles) return null;

    return {
      version: defaults.version,
      profiles: parsed.profiles,
      tools: { ...defaults.tools, ...parsed.tools },
    };
  } catch {
    return null;
  }
}

export function saveGeolocationSettingsToStorage(settings: GeolocationSettings): void {
  localStorage.setItem(GEOLOCATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
