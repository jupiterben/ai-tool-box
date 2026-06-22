import { app, session } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TOOLS } from '../src/config/tools';
import {
  PROXY_SETTINGS_VERSION,
  createDefaultToolProxyConfig,
  type ProxySettings,
  type ToolProxyConfig,
} from '../src/types/proxy-settings';
import { getToolPartition } from '../src/utils/toolPartition';

const SETTINGS_FILE = 'proxy-settings.json';

const proxyCredentials = new Map<string, { username: string; password: string }>();

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

function getWebviewToolIds(): string[] {
  return DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)).map((tool) => tool.id);
}

function buildProxyRules(config: ToolProxyConfig): string | null {
  if (config.mode !== 'manual') {
    return null;
  }

  const host = config.host?.trim();
  const port = config.port?.trim();
  if (!host || !port) {
    return null;
  }

  const protocol = config.protocol || 'http';
  return `${protocol}://${host}:${port}`;
}

export async function applyToolProxy(toolId: string, config: ToolProxyConfig): Promise<void> {
  const partition = getToolPartition(toolId);
  const ses = session.fromPartition(partition);

  if (config.mode === 'direct') {
    proxyCredentials.delete(partition);
    await ses.setProxy({ mode: 'direct' });
    return;
  }

  if (config.mode === 'system') {
    proxyCredentials.delete(partition);
    await ses.setProxy({ mode: 'system' });
    return;
  }

  const proxyRules = buildProxyRules(config);
  if (!proxyRules) {
    proxyCredentials.delete(partition);
    await ses.setProxy({ mode: 'direct' });
    return;
  }

  await ses.setProxy({
    mode: 'fixed_servers',
    proxyRules,
    proxyBypassRules: '<local>',
  });

  const username = config.username?.trim();
  if (username) {
    proxyCredentials.set(partition, {
      username,
      password: config.password || '',
    });
  } else {
    proxyCredentials.delete(partition);
  }
}

function mergeWithDefaults(settings?: Partial<ProxySettings>): ProxySettings {
  const toolIds = getWebviewToolIds();
  const tools: Record<string, ToolProxyConfig> = {};

  for (const toolId of toolIds) {
    tools[toolId] = {
      ...createDefaultToolProxyConfig(toolId),
      ...(settings?.tools?.[toolId] ?? {}),
      toolId,
    };
  }

  return {
    version: PROXY_SETTINGS_VERSION,
    tools,
  };
}

export async function loadProxySettings(): Promise<ProxySettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProxySettings>;
    return mergeWithDefaults(parsed);
  } catch {
    return mergeWithDefaults();
  }
}

export async function saveProxySettings(settings: ProxySettings): Promise<ProxySettings> {
  const merged = mergeWithDefaults(settings);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');

  for (const [toolId, config] of Object.entries(merged.tools)) {
    await applyToolProxy(toolId, config);
  }

  return merged;
}

export async function initializeProxySettings(): Promise<void> {
  const settings = await loadProxySettings();
  for (const [toolId, config] of Object.entries(settings.tools)) {
    await applyToolProxy(toolId, config);
  }
}

export function registerProxyLoginHandler(): void {
  app.on('login', (event, _webContents, _details, authInfo, callback) => {
    if (!authInfo.isProxy) {
      return;
    }

    for (const creds of proxyCredentials.values()) {
      if (creds.username) {
        event.preventDefault();
        callback(creds.username, creds.password);
        return;
      }
    }
  });
}
