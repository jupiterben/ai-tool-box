export type ProxyMode = 'direct' | 'system' | 'profile';

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export interface ProxyProfile {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username?: string;
  password?: string;
}

export interface ToolProxyConfig {
  toolId: string;
  mode: ProxyMode;
  profileId?: string;
}

/** Preset 级上游代理（同 session 只能设一份） */
export interface SessionProxyConfig {
  mode: ProxyMode;
  profileId?: string;
}

export interface ProxySettings {
  version: string;
  profiles: Record<string, ProxyProfile>;
  tools: Record<string, ToolProxyConfig>;
  /** 整 Preset 共用的上游；缺省时由 tools 聚合推断 */
  session?: SessionProxyConfig;
}

export interface ResolvedManualProxy {
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username?: string;
  password?: string;
}

export type ResolvedToolProxy = 'direct' | 'system' | ResolvedManualProxy;

export const PROXY_SETTINGS_VERSION = '2.0.0';

export function createDefaultToolProxyConfig(toolId: string): ToolProxyConfig {
  return {
    toolId,
    mode: 'system',
  };
}

export function createProxyProfile(name: string): ProxyProfile {
  return {
    id: crypto.randomUUID(),
    name,
    protocol: 'http',
    host: '',
    port: '',
    username: '',
    password: '',
  };
}

export function resolveToolProxy(
  settings: ProxySettings,
  config: ToolProxyConfig
): ResolvedToolProxy | null {
  if (config.mode === 'direct') {
    return 'direct';
  }

  if (config.mode === 'system') {
    return 'system';
  }

  if (config.mode !== 'profile' || !config.profileId) {
    return null;
  }

  const profile = settings.profiles[config.profileId];
  if (!profile) {
    return null;
  }

  const host = profile.host?.trim();
  const port = profile.port?.trim();
  if (!host || !port) {
    return null;
  }

  return {
    protocol: profile.protocol || 'http',
    host,
    port,
    username: profile.username,
    password: profile.password,
  };
}

export function formatProxyProfile(profile: ProxyProfile): string {
  const host = profile.host?.trim();
  const port = profile.port?.trim();
  if (!host || !port) {
    return profile.name || '未配置';
  }
  return `${profile.name} (${profile.protocol}://${host}:${port})`;
}

export function createDefaultSessionProxyConfig(): SessionProxyConfig {
  return { mode: 'system' };
}

/** 从历史 per-tool 配置推断 Preset 上游：取出现次数最多的 mode/profile */
export function deriveSessionProxyFromTools(
  tools: Record<string, ToolProxyConfig>
): SessionProxyConfig {
  const entries = Object.values(tools);
  if (entries.length === 0) {
    return createDefaultSessionProxyConfig();
  }

  const counts = new Map<string, { config: SessionProxyConfig; count: number }>();
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

  let best: { config: SessionProxyConfig; count: number } | null = null;
  for (const item of counts.values()) {
    if (!best || item.count > best.count) {
      best = item;
    }
  }
  return best?.config ?? createDefaultSessionProxyConfig();
}

export function resolveSessionProxy(
  settings: ProxySettings,
  sessionConfig?: SessionProxyConfig
): ResolvedToolProxy | null {
  const config = sessionConfig ?? settings.session ?? deriveSessionProxyFromTools(settings.tools);
  return resolveToolProxy(settings, { toolId: '__session__', ...config });
}
