export type AgentCliId = 'cursor' | 'claude' | 'gemini' | 'openclaw' | 'codex' | 'opencode' | 'hermes';

export interface AgentCliConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  defaultArgs: string;
  permissionMode: 'default' | 'plan' | 'auto';
  enabled: boolean;
}

export interface AgentCliInfo {
  id: AgentCliId;
  name: string;
  description: string;
  command: string;
  installed: boolean;
  version?: string;
  latestVersion?: string;
  config: AgentCliConfig;
}

export interface AgentCliResult {
  success: boolean;
  agents?: AgentCliInfo[];
  agent?: AgentCliInfo;
  error?: string;
}
