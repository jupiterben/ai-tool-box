import { session } from 'electron';
import { DEFAULT_PRESET_ID } from '../src/types/preset.js';
import { getPresetPartition } from '../src/utils/toolPartition.js';

export interface ClearPresetWebviewDataResult {
  success: boolean;
  error?: string;
}

export async function clearPresetWebviewData(presetId: string): Promise<ClearPresetWebviewDataResult> {
  if (!presetId?.trim()) {
    return { success: false, error: '无效的 Preset ID' };
  }

  try {
    const partition = getPresetPartition(presetId);
    const ses = session.fromPartition(partition);

    await ses.clearStorageData();
    await ses.clearCache();
    await ses.clearAuthCache();
    await ses.clearCodeCaches({});

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '清理缓存失败',
    };
  }
}

/** @deprecated 使用 clearPresetWebviewData */
export async function clearToolWebviewData(_toolId: string): Promise<ClearPresetWebviewDataResult> {
  return clearPresetWebviewData(DEFAULT_PRESET_ID);
}
