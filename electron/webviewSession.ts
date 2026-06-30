import { session } from 'electron';
import { getToolPartition } from '../src/utils/toolPartition.js';

export interface ClearToolWebviewDataResult {
  success: boolean;
  error?: string;
}

/** Chrome 无痕会清掉的存储类型 */
const ALL_STORAGE_TYPES = [
  'cookies',
  'filesystem',
  'indexdb',
  'localstorage',
  'shadercache',
  'websql',
  'serviceworkers',
  'cachestorage',
] as const;

const configuredIncognitoSessions = new Set<string>();

export async function clearPartitionData(partition: string): Promise<void> {
  const ses = session.fromPartition(partition);

  await ses.clearStorageData({ storages: [...ALL_STORAGE_TYPES] });
  await ses.clearCache();
  await ses.clearAuthCache();
  await ses.clearCodeCaches({});
  await ses.clearHostResolverCache();

  if (typeof ses.flushStorageData === 'function') {
    ses.flushStorageData();
  }
}

/** 为无痕分区应用更接近 Chrome 的 session 策略 */
function configureIncognitoSession(partition: string): void {
  if (configuredIncognitoSessions.has(partition)) {
    return;
  }

  configuredIncognitoSessions.add(partition);
  const ses = session.fromPartition(partition);

  ses.setSpellCheckerEnabled(false);

  // 无痕不持久化站点权限（每次需重新授权）
  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (details?.isMainFrame === false) {
      callback(false);
      return;
    }
    callback(permission === 'geolocation' || permission === 'media');
  });
}

/**
 * 切换浏览模式前的准备（类似 Chrome 打开/关闭无痕窗口）：
 * - 开启无痕：清空临时分区，全新会话
 * - 关闭无痕：销毁临时分区数据，回到持久化分区
 */
export async function prepareToolSessionMode(
  toolId: string,
  incognito: boolean
): Promise<ClearToolWebviewDataResult> {
  if (!toolId?.trim()) {
    return { success: false, error: '无效的工具 ID' };
  }

  try {
    const ephemeralPartition = getToolPartition(toolId, true);

    await clearPartitionData(ephemeralPartition);

    if (incognito) {
      configureIncognitoSession(ephemeralPartition);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '准备会话失败',
    };
  }
}

/** webview 卸载时清理无痕分区（类似关闭无痕窗口） */
export async function clearIncognitoPartition(toolId: string): Promise<ClearToolWebviewDataResult> {
  if (!toolId?.trim()) {
    return { success: false, error: '无效的工具 ID' };
  }

  try {
    await clearPartitionData(getToolPartition(toolId, true));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '清理无痕会话失败',
    };
  }
}

export async function clearToolWebviewData(toolId: string): Promise<ClearToolWebviewDataResult> {
  if (!toolId?.trim()) {
    return { success: false, error: '无效的工具 ID' };
  }

  try {
    const { resolveToolPartition } = await import('./sessionSettingsManager.js');
    const activePartition = resolveToolPartition(toolId);
    const persistPartition = getToolPartition(toolId, false);
    const ephemeralPartition = getToolPartition(toolId, true);

    await clearPartitionData(activePartition);

    if (persistPartition !== activePartition) {
      await clearPartitionData(persistPartition);
    }
    if (ephemeralPartition !== activePartition) {
      await clearPartitionData(ephemeralPartition);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '清理缓存失败',
    };
  }
}
