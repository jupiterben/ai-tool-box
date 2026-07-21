import { app, session } from 'electron';
import { ALL_DEFAULT_TOOLS } from '../src/config/tools';
import {
  PROXY_SETTINGS_VERSION,
  createDefaultSessionProxyConfig,
  createDefaultToolProxyConfig,
  deriveSessionProxyFromTools,
  resolveSessionProxy,
  type ProxyMode,
  type ProxyProfile,
  type ProxySettings,
  type ResolvedManualProxy,
  type SessionProxyConfig,
  type ToolProxyConfig,
} from '../src/types/proxy-settings';
import { DEFAULT_PRESET_ID } from '../src/types/preset';
import { getPresetPartition } from '../src/utils/toolPartition';
import {
  loadPresetProxySettingsRaw,
  savePresetProxySettingsRaw,
} from './presetSettingsStore';

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
  session?: SessionProxyConfig;
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
    session: parsed.session,
  };
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

  const session =
    migrated.session ??
    deriveSessionProxyFromTools(tools) ??
    createDefaultSessionProxyConfig();

  if (session.mode === 'profile' && session.profileId && !profiles[session.profileId]) {
    session.mode = 'system';
    delete session.profileId;
  }

  return {
    version: PROXY_SETTINGS_VERSION,
    profiles,
    tools,
    session,
  };
}

async function applyResolvedProxy(
  partition: string,
  resolved: ReturnType<typeof resolveSessionProxy>
): Promise<void> {
  const ses = session.fromPartition(partition);

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

export async function applyPresetProxy(
  presetId: string,
  settings: ProxySettings,
  sessionConfig?: SessionProxyConfig
): Promise<void> {
  const partition = getPresetPartition(presetId);
  const resolved = resolveSessionProxy(settings, sessionConfig ?? settings.session);
  await applyResolvedProxy(partition, resolved);
}

/** @deprecated 同 Preset 共享分区后请用 applyPresetProxy */
export async function applyToolProxy(
  toolId: string,
  settings: ProxySettings,
  config: ToolProxyConfig
): Promise<void> {
  void toolId;
  void config;
  await applyPresetProxy(DEFAULT_PRESET_ID, settings, settings.session);
}

export async function loadProxySettings(
  presetId: string = DEFAULT_PRESET_ID
): Promise<ProxySettings> {
  const raw = await loadPresetProxySettingsRaw(presetId);
  return mergeWithDefaults(raw ?? undefined);
}

export async function saveProxySettings(
  settings: ProxySettings,
  presetId: string = DEFAULT_PRESET_ID
): Promise<ProxySettings> {
  const merged = mergeWithDefaults(settings);
  await savePresetProxySettingsRaw(presetId, merged);
  await applyPresetProxy(presetId, merged, merged.session);
  return merged;
}

export async function initializeProxySettings(presetId: string = DEFAULT_PRESET_ID): Promise<void> {
  const settings = await loadProxySettings(presetId);
  await applyPresetProxy(presetId, settings, settings.session);
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

export type { ProxyMode, SessionProxyConfig };
