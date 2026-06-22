export type ProxyMode = 'direct' | 'system' | 'manual';

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export interface ToolProxyConfig {
  toolId: string;
  mode: ProxyMode;
  protocol?: ProxyProtocol;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
}

export interface ProxySettings {
  version: string;
  tools: Record<string, ToolProxyConfig>;
}

export const PROXY_SETTINGS_VERSION = '1.0.0';

export function createDefaultToolProxyConfig(toolId: string): ToolProxyConfig {
  return {
    toolId,
    mode: 'system',
    protocol: 'http',
    host: '',
    port: '',
    username: '',
    password: '',
  };
}
