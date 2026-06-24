export const TOOL_SETTINGS_VERSION = 1;

export interface ToolSettings {
  version: typeof TOOL_SETTINGS_VERSION;
  /** 默认启用的网站中，被用户关闭的 tool id 列表 */
  disabledToolIds: string[];
}

export function createDefaultToolSettings(disabledToolIds: string[] = []): ToolSettings {
  return {
    version: TOOL_SETTINGS_VERSION,
    disabledToolIds: [...disabledToolIds],
  };
}
