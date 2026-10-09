import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_PRESET_ID } from '../src/types/preset.ts';
import {
  TOOL_SETTINGS_VERSION,
  createDefaultToolSettings,
  type ToolSettings,
} from '../src/types/tool-settings.ts';
import type { ProxySettings } from '../src/types/proxy-settings.ts';
import type { GeolocationSettings } from '../src/types/geolocation-settings.ts';
import {
  deriveSessionProxyFromTools,
  PROXY_SETTINGS_VERSION,
} from '../src/types/proxy-settings.ts';
import {
  deriveSessionGeolocationFromTools,
  GEOLOCATION_SETTINGS_VERSION,
} from '../src/types/geolocation-settings.ts';

const LEGACY_PROXY_FILE = 'proxy-settings.json';
const LEGACY_GEO_FILE = 'geolocation-settings.json';
const LEGACY_TOOL_FILE = 'tool-settings.json';
const MIGRATION_FLAG = 'preset-settings-migrated.json';

export function getPresetDir(presetId: string): string {
  return join(app.getPath('userData'), 'presets', presetId);
}

function presetFile(presetId: string, name: string): string {
  return join(getPresetDir(presetId), name);
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadPresetToolSettings(presetId: string): Promise<ToolSettings> {
  const parsed = await readJsonFile<Partial<ToolSettings>>(presetFile(presetId, 'tool-settings.json'));
  if (!parsed || !Array.isArray(parsed.disabledToolIds)) {
    return createDefaultToolSettings();
  }
  return {
    version: TOOL_SETTINGS_VERSION,
    disabledToolIds: parsed.disabledToolIds,
  };
}

export async function savePresetToolSettings(
  presetId: string,
  settings: ToolSettings
): Promise<ToolSettings> {
  const next = createDefaultToolSettings(settings.disabledToolIds);
  await writeJsonFile(presetFile(presetId, 'tool-settings.json'), next);
  return next;
}

export async function loadPresetProxySettingsRaw(
  presetId: string
): Promise<Partial<ProxySettings> | null> {
  return readJsonFile<Partial<ProxySettings>>(presetFile(presetId, 'proxy-settings.json'));
}

export async function savePresetProxySettingsRaw(
  presetId: string,
  settings: ProxySettings
): Promise<void> {
  await writeJsonFile(presetFile(presetId, 'proxy-settings.json'), settings);
}

export async function loadPresetGeolocationSettingsRaw(
  presetId: string
): Promise<Partial<GeolocationSettings> | null> {
  return readJsonFile<Partial<GeolocationSettings>>(
    presetFile(presetId, 'geolocation-settings.json')
  );
}

export async function savePresetGeolocationSettingsRaw(
  presetId: string,
  settings: GeolocationSettings
): Promise<void> {
  await writeJsonFile(presetFile(presetId, 'geolocation-settings.json'), settings);
}

export async function copyPresetSettings(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return;
  await fs.mkdir(getPresetDir(toId), { recursive: true });
  const names = ['tool-settings.json', 'proxy-settings.json', 'geolocation-settings.json'] as const;
  for (const name of names) {
    try {
      await fs.copyFile(presetFile(fromId, name), presetFile(toId, name));
    } catch {
      // source file may not exist
    }
  }
}

export async function deletePresetSettings(presetId: string): Promise<void> {
  if (presetId === DEFAULT_PRESET_ID) {
    throw new Error('不可删除默认 Preset 的设置目录');
  }
  await fs.rm(getPresetDir(presetId), { recursive: true, force: true });
}

/**
 * 首次升级：把根目录 legacy 设置迁入 presets/default/。
 * Cookie 不迁移。
 */
export async function migrateLegacySettingsIntoDefault(): Promise<void> {
  const userData = app.getPath('userData');
  const flagPath = join(userData, MIGRATION_FLAG);
  const flag = await readJsonFile<{ migrated?: boolean }>(flagPath);
  if (flag?.migrated) {
    return;
  }

  const defaultDir = getPresetDir(DEFAULT_PRESET_ID);
  await fs.mkdir(defaultDir, { recursive: true });

  const legacyProxy = await readJsonFile<ProxySettings>(join(userData, LEGACY_PROXY_FILE));
  if (legacyProxy && !(await readJsonFile(presetFile(DEFAULT_PRESET_ID, 'proxy-settings.json')))) {
    const withSession: ProxySettings = {
      version: legacyProxy.version || PROXY_SETTINGS_VERSION,
      profiles: legacyProxy.profiles ?? {},
      tools: legacyProxy.tools ?? {},
      session: legacyProxy.session ?? deriveSessionProxyFromTools(legacyProxy.tools ?? {}),
    };
    await writeJsonFile(presetFile(DEFAULT_PRESET_ID, 'proxy-settings.json'), withSession);
  }

  const legacyGeo = await readJsonFile<GeolocationSettings>(join(userData, LEGACY_GEO_FILE));
  if (legacyGeo && !(await readJsonFile(presetFile(DEFAULT_PRESET_ID, 'geolocation-settings.json')))) {
    const withSession: GeolocationSettings = {
      version: legacyGeo.version || GEOLOCATION_SETTINGS_VERSION,
      profiles: legacyGeo.profiles ?? {},
      tools: legacyGeo.tools ?? {},
      session: legacyGeo.session ?? deriveSessionGeolocationFromTools(legacyGeo.tools ?? {}),
    };
    await writeJsonFile(presetFile(DEFAULT_PRESET_ID, 'geolocation-settings.json'), withSession);
  }

  const legacyTools = await readJsonFile<ToolSettings>(join(userData, LEGACY_TOOL_FILE));
  if (
    legacyTools &&
    !(await readJsonFile(presetFile(DEFAULT_PRESET_ID, 'tool-settings.json')))
  ) {
    await writeJsonFile(
      presetFile(DEFAULT_PRESET_ID, 'tool-settings.json'),
      createDefaultToolSettings(legacyTools.disabledToolIds ?? [])
    );
  }

  await writeJsonFile(flagPath, { migrated: true, at: Date.now() });
}
