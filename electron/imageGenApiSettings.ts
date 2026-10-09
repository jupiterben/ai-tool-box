import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getApiPort } from './imageGenApiConfig.js';
import {
  IMAGE_GEN_API_SETTINGS_VERSION,
  type ImageGenApiSettings,
} from '../src/types/image-gen-api-settings.js';

const SETTINGS_FILE = 'image-gen-api-settings.json';

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

function normalizePort(port: unknown, fallback: number): number {
  const value = Number(port);
  return Number.isFinite(value) && value > 0 && value < 65536
    ? Math.floor(value)
    : fallback;
}

function mergeWithDefaults(settings?: Partial<ImageGenApiSettings>): ImageGenApiSettings {
  const defaultPort = getApiPort();
  return {
    version: IMAGE_GEN_API_SETTINGS_VERSION,
    enabled: settings?.enabled ?? true,
    port: normalizePort(settings?.port, defaultPort),
  };
}

export async function loadImageGenApiSettings(): Promise<ImageGenApiSettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ImageGenApiSettings>;
    return mergeWithDefaults(parsed);
  } catch {
    return mergeWithDefaults();
  }
}

export async function saveImageGenApiSettings(
  settings: Partial<ImageGenApiSettings>
): Promise<ImageGenApiSettings> {
  const merged = mergeWithDefaults(settings);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
