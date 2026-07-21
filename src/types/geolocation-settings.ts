export type GeolocationMode = 'system' | 'profile';

export interface GeolocationProfile {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface ToolGeolocationConfig {
  toolId: string;
  mode: GeolocationMode;
  profileId?: string;
}

/** Preset 级 GPS（同 session 一份） */
export interface SessionGeolocationConfig {
  mode: GeolocationMode;
  profileId?: string;
}

export interface GeolocationSettings {
  version: string;
  profiles: Record<string, GeolocationProfile>;
  tools: Record<string, ToolGeolocationConfig>;
  session?: SessionGeolocationConfig;
}

export interface ResolvedGeolocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const GEOLOCATION_SETTINGS_VERSION = '1.0.0';

export const DEFAULT_GEOLOCATION_PRESETS: Omit<GeolocationProfile, 'id'>[] = [
  { name: '北京', latitude: 39.9042, longitude: 116.4074, accuracy: 100 },
  { name: '上海', latitude: 31.2304, longitude: 121.4737, accuracy: 100 },
  { name: '纽约', latitude: 40.7128, longitude: -74.006, accuracy: 100 },
  { name: '伦敦', latitude: 51.5074, longitude: -0.1278, accuracy: 100 },
  { name: '旧金山', latitude: 37.7749, longitude: -122.4194, accuracy: 100 },
];

export function createDefaultToolGeolocationConfig(toolId: string): ToolGeolocationConfig {
  return {
    toolId,
    mode: 'system',
  };
}

export function createGeolocationProfile(name: string): GeolocationProfile {
  return {
    id: crypto.randomUUID(),
    name,
    latitude: 0,
    longitude: 0,
    accuracy: 100,
  };
}

export function createDefaultGeolocationProfiles(): Record<string, GeolocationProfile> {
  const profiles: Record<string, GeolocationProfile> = {};
  for (const preset of DEFAULT_GEOLOCATION_PRESETS) {
    const profile = createGeolocationProfile(preset.name);
    profiles[profile.id] = { ...profile, ...preset };
  }
  return profiles;
}

export function resolveToolGeolocation(
  settings: GeolocationSettings,
  config: ToolGeolocationConfig
): ResolvedGeolocation | null {
  if (config.mode !== 'profile' || !config.profileId) {
    return null;
  }

  const profile = settings.profiles[config.profileId];
  if (!profile) {
    return null;
  }

  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    accuracy: profile.accuracy,
  };
}

export function formatGeolocationProfile(profile: GeolocationProfile): string {
  if (!profile.name?.trim()) {
    return `${profile.latitude}, ${profile.longitude}`;
  }
  return `${profile.name} (${profile.latitude}, ${profile.longitude})`;
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidAccuracy(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function createDefaultSessionGeolocationConfig(): SessionGeolocationConfig {
  return { mode: 'system' };
}

export function deriveSessionGeolocationFromTools(
  tools: Record<string, ToolGeolocationConfig>
): SessionGeolocationConfig {
  const entries = Object.values(tools);
  if (entries.length === 0) {
    return createDefaultSessionGeolocationConfig();
  }

  const counts = new Map<string, { config: SessionGeolocationConfig; count: number }>();
  for (const tool of entries) {
    const key = `${tool.mode}|${tool.profileId ?? ''}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        config: { mode: tool.mode, profileId: tool.profileId },
        count: 1,
      });
    }
  }

  let best: { config: SessionGeolocationConfig; count: number } | null = null;
  for (const item of counts.values()) {
    if (!best || item.count > best.count) {
      best = item;
    }
  }
  return best?.config ?? createDefaultSessionGeolocationConfig();
}

export function resolveSessionGeolocation(
  settings: GeolocationSettings,
  sessionConfig?: SessionGeolocationConfig
): ResolvedGeolocation | null {
  const config =
    sessionConfig ?? settings.session ?? deriveSessionGeolocationFromTools(settings.tools);
  return resolveToolGeolocation(settings, { toolId: '__session__', ...config });
}
