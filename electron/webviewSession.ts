import { session } from 'electron';
import { getToolPartition } from '../src/utils/toolPartition.js';

export interface ClearToolWebviewDataResult {
  success: boolean;
  error?: string;
}

export async function clearToolWebviewData(toolId: string): Promise<ClearToolWebviewDataResult> {
  if (!toolId?.trim()) {
    return { success: false, error: '无效的工具 ID' };
  }

  try {
    const partition = getToolPartition(toolId);
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
