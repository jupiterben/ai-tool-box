import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ALL_DEFAULT_TOOLS } from '../src/config/tools';
import {
  SESSION_SETTINGS_VERSION,
  createDefaultToolSessionConfig,
  isToolIncognito,
  type SessionSettings,
  type ToolSessionConfig,
} from '../src/types/session-settings';
import { getToolPartition } from '../src/utils/toolPartition';

const SETTINGS_FILE = 'session-settings.json';

let cachedSettings: SessionSettings | null = null;

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

function getWebviewToolIds(): string[] {
  return ALL_DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)).map((tool) => tool.id);
}

function mergeWithDefaults(settings?: Partial<SessionSettings>): SessionSettings {
  const toolIds = getWebviewToolIds();
  const tools: Record<string, ToolSessionConfig> = {};

  for (const toolId of toolIds) {
    tools[toolId] = {
      ...createDefaultToolSessionConfig(toolId),
      ...(settings?.tools?.[toolId] ?? {}),
      toolId,
    };
  }

  return {
    version: SESSION_SETTINGS_VERSION,
    tools,
  };
}

export function getCachedSessionSettings(): SessionSettings {
  return cachedSettings ?? mergeWithDefaults();
}

export function resolveToolPartition(toolId: string): string {
  const incognito = isToolIncognito(getCachedSessionSettings(), toolId);
  return getToolPartition(toolId, incognito);
}

async function reapplyEnvironmentForAllTools(): Promise<void> {
  const { loadProxySettings, applyToolProxy } = await import('./proxyManager.js');
  const { loadGeolocationSettings, applyToolGeolocation } = await import(
    './geolocationManager.js'
  );

  const proxySettings = await loadProxySettings();
  for (const [toolId, config] of Object.entries(proxySettings.tools)) {
    await applyToolProxy(toolId, proxySettings, config);
  }

  const geoSettings = await loadGeolocationSettings();
  for (const [toolId, config] of Object.entries(geoSettings.tools)) {
    await applyToolGeolocation(toolId, geoSettings, config);
  }
}

export async function loadSessionSettings(): Promise<SessionSettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SessionSettings>;
    cachedSettings = mergeWithDefaults(parsed);
    return cachedSettings;
  } catch {
    cachedSettings = mergeWithDefaults();
    return cachedSettings;
  }
}

export async function saveSessionSettings(settings: SessionSettings): Promise<SessionSettings> {
  const merged = mergeWithDefaults(settings);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  cachedSettings = merged;
  await reapplyEnvironmentForAllTools();
  return merged;
}

export async function initializeSessionSettings(): Promise<void> {
  const settings = await loadSessionSettings();
  const { prepareToolSessionMode } = await import('./webviewSession.js');

  for (const [toolId, config] of Object.entries(settings.tools)) {
    if (config.incognito) {
      await prepareToolSessionMode(toolId, true);
    }
  }
}
