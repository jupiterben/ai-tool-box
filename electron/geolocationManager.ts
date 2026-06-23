import { app, session, webContents, type WebContents } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TOOLS } from '../src/config/tools';
import {
  GEOLOCATION_SETTINGS_VERSION,
  createDefaultGeolocationProfiles,
  createDefaultToolGeolocationConfig,
  resolveToolGeolocation,
  type GeolocationSettings,
  type ResolvedGeolocation,
  type ToolGeolocationConfig,
} from '../src/types/geolocation-settings';
import { getToolPartition } from '../src/utils/toolPartition';

const SETTINGS_FILE = 'geolocation-settings.json';

const partitionOverrides = new Map<string, ResolvedGeolocation | null>();
const configuredSessions = new Set<string>();

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

function getWebviewToolIds(): string[] {
  return DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)).map((tool) => tool.id);
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

  return {
    version: GEOLOCATION_SETTINGS_VERSION,
    profiles,
    tools,
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

export async function applyToolGeolocation(
  toolId: string,
  settings: GeolocationSettings,
  config: ToolGeolocationConfig
): Promise<void> {
  const partition = getToolPartition(toolId);
  const coords = resolveToolGeolocation(settings, config);
  await applyGeolocationForPartition(partition, coords);
}

export async function applyToolGeolocationById(toolId: string): Promise<void> {
  const settings = await loadGeolocationSettings();
  const config = settings.tools[toolId] ?? createDefaultToolGeolocationConfig(toolId);
  await applyToolGeolocation(toolId, settings, config);
}

export async function loadGeolocationSettings(): Promise<GeolocationSettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<GeolocationSettings>;
    return mergeWithDefaults(parsed);
  } catch {
    return mergeWithDefaults();
  }
}

export async function saveGeolocationSettings(
  settings: GeolocationSettings
): Promise<GeolocationSettings> {
  const merged = mergeWithDefaults(settings);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');

  for (const [toolId, config] of Object.entries(merged.tools)) {
    await applyToolGeolocation(toolId, merged, config);
  }

  return merged;
}

export async function initializeGeolocationSettings(): Promise<void> {
  const settings = await loadGeolocationSettings();
  for (const [toolId, config] of Object.entries(settings.tools)) {
    await applyToolGeolocation(toolId, settings, config);
  }
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
