import { app, session } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ALL_DEFAULT_TOOLS } from '../src/config/tools';
import {
  PROXY_SETTINGS_VERSION,
  createDefaultToolProxyConfig,
  resolveToolProxy,
  type ProxyProfile,
  type ProxySettings,
  type ResolvedManualProxy,
  type ToolProxyConfig,
} from '../src/types/proxy-settings';
import { getToolPartition } from '../src/utils/toolPartition';

const SETTINGS_FILE = 'proxy-settings.json';

const proxyCredentials = new Map<string, { username: string; password: string }>();

interface LegacyToolProxyConfig {
  toolId?: string;
  mode?: 'direct' | 'system' | 'manual' | 'profile';
  protocol?: ProxyProfile['protocol'];
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  profileId?: string;
}

interface LegacyProxySettings {
  version?: string;
  profiles?: Record<string, ProxyProfile>;
  tools?: Record<string, LegacyToolProxyConfig>;
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

function getWebviewToolIds(): string[] {
  return ALL_DEFAULT_TOOLS.filter((tool) => Boolean(tool.url)).map((tool) => tool.id);
}

function getToolName(toolId: string): string {
  return ALL_DEFAULT_TOOLS.find((tool) => tool.id === toolId)?.name ?? toolId;
}

function buildProxyRules(manual: ResolvedManualProxy): string {
  const protocol = manual.protocol || 'http';
  return `${protocol}://${manual.host}:${manual.port}`;
}

function profileFingerprint(profile: Pick<ProxyProfile, 'protocol' | 'host' | 'port' | 'username'>): string {
  return [
    profile.protocol || 'http',
    profile.host?.trim() ?? '',
    profile.port?.trim() ?? '',
    profile.username?.trim() ?? '',
  ].join('|');
}

function migrateLegacySettings(parsed: LegacyProxySettings): Partial<ProxySettings> {
  if (parsed.version === PROXY_SETTINGS_VERSION && parsed.profiles) {
    return parsed as Partial<ProxySettings>;
  }

  const profiles: Record<string, ProxyProfile> = { ...(parsed.profiles ?? {}) };
  const fingerprintToId = new Map<string, string>();

  for (const profile of Object.values(profiles)) {
    fingerprintToId.set(profileFingerprint(profile), profile.id);
  }

  const tools: Record<string, ToolProxyConfig> = {};

  for (const toolId of getWebviewToolIds()) {
    const legacy = parsed.tools?.[toolId];
    if (!legacy) {
      continue;
    }

    if (legacy.mode === 'profile' && legacy.profileId && profiles[legacy.profileId]) {
      tools[toolId] = { toolId, mode: 'profile', profileId: legacy.profileId };
      continue;
    }

    if (legacy.mode === 'manual' && legacy.host?.trim() && legacy.port?.trim()) {
      const candidate: ProxyProfile = {
        id: '',
        name: `${getToolName(toolId)} 代理`,
        protocol: legacy.protocol || 'http',
        host: legacy.host.trim(),
        port: legacy.port.trim(),
        username: legacy.username,
        password: legacy.password,
      };

      const fingerprint = profileFingerprint(candidate);
      let profileId = fingerprintToId.get(fingerprint);
      if (!profileId) {
        profileId = `migrated-${toolId}`;
        while (profiles[profileId]) {
          profileId = `${profileId}-${Object.keys(profiles).length}`;
        }
        profiles[profileId] = { ...candidate, id: profileId };
        fingerprintToId.set(fingerprint, profileId);
      }

      tools[toolId] = { toolId, mode: 'profile', profileId };
      continue;
    }

    const mode =
      legacy.mode === 'direct' || legacy.mode === 'system' ? legacy.mode : 'system';
    tools[toolId] = { toolId, mode };
  }

  return {
    version: PROXY_SETTINGS_VERSION,
    profiles,
    tools,
  };
}

export async function applyToolProxy(
  toolId: string,
  settings: ProxySettings,
  config: ToolProxyConfig
): Promise<void> {
  const partition = getToolPartition(toolId);
  const ses = session.fromPartition(partition);
  const resolved = resolveToolProxy(settings, config);

  if (resolved === 'direct' || resolved === null) {
    proxyCredentials.delete(partition);
    await ses.setProxy({ mode: 'direct' });
    return;
  }

  if (resolved === 'system') {
    proxyCredentials.delete(partition);
    await ses.setProxy({ mode: 'system' });
    return;
  }

  await ses.setProxy({
    mode: 'fixed_servers',
    proxyRules: buildProxyRules(resolved),
    proxyBypassRules: '<local>',
  });

  const username = resolved.username?.trim();
  if (username) {
    proxyCredentials.set(partition, {
      username,
      password: resolved.password || '',
    });
  } else {
    proxyCredentials.delete(partition);
  }
}

function mergeWithDefaults(settings?: Partial<ProxySettings>): ProxySettings {
  const migrated = migrateLegacySettings((settings ?? {}) as LegacyProxySettings);
  const toolIds = getWebviewToolIds();
  const tools: Record<string, ToolProxyConfig> = {};
  const profiles: Record<string, ProxyProfile> = { ...(migrated.profiles ?? {}) };

  for (const toolId of toolIds) {
    tools[toolId] = {
      ...createDefaultToolProxyConfig(toolId),
      ...(migrated.tools?.[toolId] ?? {}),
      toolId,
    };

    if (tools[toolId].mode === 'profile' && tools[toolId].profileId) {
      if (!profiles[tools[toolId].profileId!]) {
        tools[toolId] = createDefaultToolProxyConfig(toolId);
      }
    }
  }

  return {
    version: PROXY_SETTINGS_VERSION,
    profiles,
    tools,
  };
}

export async function loadProxySettings(): Promise<ProxySettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as LegacyProxySettings;
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
    await applyToolProxy(toolId, merged, config);
  }

  return merged;
}

export async function initializeProxySettings(): Promise<void> {
  const settings = await loadProxySettings();
  for (const [toolId, config] of Object.entries(settings.tools)) {
    await applyToolProxy(toolId, settings, config);
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
