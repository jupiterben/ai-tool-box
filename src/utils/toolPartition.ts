import { DEFAULT_PRESET_ID } from '../types/preset.ts';
import { isToolIncognito, type SessionSettings } from '../types/session-settings.ts';

export { DEFAULT_PRESET_ID };

const TEMP_PREFIX = 'temp-';

/** 桌面 WebView 会话标识：按 Preset 共享登录态 */
export function getPresetPartition(presetId: string): string {
  if (!presetId?.trim()) {
    throw new Error('presetId is required');
  }
  return `persist:preset-${presetId}`;
}

/** 无痕临时分区（无 persist: 前缀，仅内存） */
export function getTempToolPartition(toolId: string): string {
  return `${TEMP_PREFIX}tool-${toolId}`;
}

/** 普通模式走 Default Preset 分区；incognito 为 true 时走该工具的临时分区。 */
export function getToolPartition(toolId: string, incognito = false): string {
  if (incognito) return getTempToolPartition(toolId);
  return getPresetPartition(DEFAULT_PRESET_ID);
}

export function getToolPartitionFromSettings(toolId: string, settings: SessionSettings): string {
  return getToolPartition(toolId, isToolIncognito(settings, toolId));
}
