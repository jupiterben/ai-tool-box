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

export interface ProxySettings {
  version: string;
  profiles: Record<string, ProxyProfile>;
  tools: Record<string, ToolProxyConfig>;
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
