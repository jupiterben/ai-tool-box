export interface ToolSessionConfig {
  toolId: string;
  /** 无痕模式：使用 temp-* 临时 partition，不写入磁盘 */
  incognito: boolean;
}

export interface SessionSettings {
  version: string;
  tools: Record<string, ToolSessionConfig>;
}

export const SESSION_SETTINGS_VERSION = '1.0.0';

export function createDefaultToolSessionConfig(toolId: string): ToolSessionConfig {
  return {
    toolId,
    incognito: false,
  };
}

export function isToolIncognito(settings: SessionSettings, toolId: string): boolean {
  return settings.tools[toolId]?.incognito ?? false;
}
