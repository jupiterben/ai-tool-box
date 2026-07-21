import { DEFAULT_PRESET_ID } from '../types/preset.js';

export { DEFAULT_PRESET_ID };

/** Electron webview session 分区名：按 Preset 共享登录态 */
export function getPresetPartition(presetId: string): string {
  if (!presetId?.trim()) {
    throw new Error('presetId is required');
  }
  return `persist:preset-${presetId}`;
}

/**
 * @deprecated 使用 getPresetPartition(presetId)
 * 过渡期转发到 Default，避免未改完的调用点立即炸掉；Task 7 清掉所有调用。
 */
export function getToolPartition(_toolId: string): string {
  return getPresetPartition(DEFAULT_PRESET_ID);
}
