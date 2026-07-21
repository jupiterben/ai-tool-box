import { app, session, webContents, type WebContents } from 'electron';
import { ALL_DEFAULT_TOOLS } from '../src/config/tools';
import {
  GEOLOCATION_SETTINGS_VERSION,
  createDefaultGeolocationProfiles,
  createDefaultSessionGeolocationConfig,
  createDefaultToolGeolocationConfig,
  deriveSessionGeolocationFromTools,
  resolveSessionGeolocation,
  type GeolocationSettings,
  type ResolvedGeolocation,
  type SessionGeolocationConfig,
  type ToolGeolocationConfig,
} from '../src/types/geolocation-settings';
import { DEFAULT_PRESET_ID } from '../src/types/preset';
import { getPresetPartition } from '../src/utils/toolPartition';
import {
  loadPresetGeolocationSettingsRaw,
  savePresetGeolocationSettingsRaw,
} from './presetSettingsStore';

const partitionOverrides = new Map<string, ResolvedGeolocation | null>();
const configuredSessions = new Set<string>();

function getWebviewToolIds(): string[] {
  return ALL_DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)).map((tool) => tool.id);
}

function mergeWithDefaults(settings?: Partial<GeolocationSettings>): GeolocationSettings {
  const toolIds = getWebviewToolIds();
  const tools: Record<string, ToolGeolocationConfig> = {};
  const profiles =
    settings?.profiles && Object.keys(settings.profiles).length > 0
      ? { ...settings.profiles }
      : createDefaultGeolocationProfiles();

  for (const toolId of toolIds) {
    tools[toolId] = {
      ...createDefaultToolGeolocationConfig(toolId),
      ...(settings?.tools?.[toolId] ?? {}),
      toolId,
    };
  }

  const session =
    settings?.session ??
    deriveSessionGeolocationFromTools(tools) ??
    createDefaultSessionGeolocationConfig();

  if (session.mode === 'profile' && session.profileId && !profiles[session.profileId]) {
    session.mode = 'system';
    delete session.profileId;
  }

  return {
    version: GEOLOCATION_SETTINGS_VERSION,
    profiles,
    tools,
    session,
  };
}

async function attachDebugger(wc: WebContents): Promise<boolean> {
  if (wc.isDestroyed()) {
    return false;
  }

  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
    }
    return true;
  } catch {
    return false;
  }
}

async function applyGeolocationToWebContents(
  wc: WebContents,
  coords: ResolvedGeolocation | null
): Promise<void> {
  if (wc.isDestroyed()) {
    return;
  }

  const attached = await attachDebugger(wc);
  if (!attached) {
    return;
  }

  try {
    if (coords) {
      await wc.debugger.sendCommand('Emulation.setGeolocationOverride', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
    } else {
      await wc.debugger.sendCommand('Emulation.clearGeolocationOverride');
    }
  } catch (error) {
    console.warn('[geolocationManager] 应用定位覆盖失败:', error);
  }
}

function ensureGeolocationPermissionHandler(partition: string): void {
  if (configuredSessions.has(partition)) {
    return;
  }

  configuredSessions.add(partition);
  const ses = session.fromPartition(partition);

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'geolocation');
  });

  ses.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'geolocation';
  });
}

function getWebContentsForPartition(partition: string): WebContents[] {
  let targetSession;
  try {
    targetSession = session.fromPartition(partition);
  } catch {
    return [];
  }

  const matches: WebContents[] = [];
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed()) {
      continue;
    }
    try {
      if (wc.session === targetSession) {
        matches.push(wc);
      }
    } catch {
      // ignore
    }
  }
  return matches;
}

async function applyGeolocationForPartition(
  partition: string,
  coords: ResolvedGeolocation | null
): Promise<void> {
  partitionOverrides.set(partition, coords);
  ensureGeolocationPermissionHandler(partition);

  await Promise.all(
    getWebContentsForPartition(partition).map((wc) => applyGeolocationToWebContents(wc, coords))
  );
}

export async function applyPresetGeolocation(
  presetId: string,
  settings: GeolocationSettings,
  sessionConfig?: SessionGeolocationConfig
): Promise<void> {
  const partition = getPresetPartition(presetId);
  const coords = resolveSessionGeolocation(settings, sessionConfig ?? settings.session);
  await applyGeolocationForPartition(partition, coords);
}

/** @deprecated 使用 applyPresetGeolocation */
export async function applyToolGeolocation(
  toolId: string,
  settings: GeolocationSettings,
  config: ToolGeolocationConfig
): Promise<void> {
  void toolId;
  void config;
  await applyPresetGeolocation(DEFAULT_PRESET_ID, settings, settings.session);
}

export async function applyToolGeolocationById(toolId: string): Promise<void> {
  void toolId;
  const settings = await loadGeolocationSettings(DEFAULT_PRESET_ID);
  await applyPresetGeolocation(DEFAULT_PRESET_ID, settings, settings.session);
}

export async function applyPresetGeolocationById(presetId: string): Promise<void> {
  const settings = await loadGeolocationSettings(presetId);
  await applyPresetGeolocation(presetId, settings, settings.session);
}

export async function loadGeolocationSettings(
  presetId: string = DEFAULT_PRESET_ID
): Promise<GeolocationSettings> {
  const raw = await loadPresetGeolocationSettingsRaw(presetId);
  return mergeWithDefaults(raw ?? undefined);
}

export async function saveGeolocationSettings(
  settings: GeolocationSettings,
  presetId: string = DEFAULT_PRESET_ID
): Promise<GeolocationSettings> {
  const merged = mergeWithDefaults(settings);
  await savePresetGeolocationSettingsRaw(presetId, merged);
  await applyPresetGeolocation(presetId, merged, merged.session);
  return merged;
}

export async function initializeGeolocationSettings(
  presetId: string = DEFAULT_PRESET_ID
): Promise<void> {
  const settings = await loadGeolocationSettings(presetId);
  await applyPresetGeolocation(presetId, settings, settings.session);
}

export function registerGeolocationWebContentsListener(): void {
  app.on('web-contents-created', (_event, wc) => {
    wc.on('did-finish-load', () => {
      if (wc.isDestroyed()) {
        return;
      }

      for (const [partition, override] of partitionOverrides.entries()) {
        try {
          if (wc.session === session.fromPartition(partition)) {
            void applyGeolocationToWebContents(wc, override);
            return;
          }
        } catch {
          // ignore
        }
      }
    });
  });
}
