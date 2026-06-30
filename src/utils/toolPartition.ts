import type { SessionSettings } from '../types/session-settings';
import { isToolIncognito } from '../types/session-settings';

const PERSIST_PREFIX = 'persist:';
const TEMP_PREFIX = 'temp-';

/** 持久化分区（普通模式） */
export function getPersistToolPartition(toolId: string): string {
  return `${PERSIST_PREFIX}tool-${toolId}`;
}

/** 无痕临时分区（无 persist: 前缀，仅内存，关闭后清除） */
export function getTempToolPartition(toolId: string): string {
  return `${TEMP_PREFIX}tool-${toolId}`;
}

/** Electron webview session 分区名，与主进程 setProxy 保持一致 */
export function getToolPartition(toolId: string, incognito = false): string {
  return incognito ? getTempToolPartition(toolId) : getPersistToolPartition(toolId);
}

export function getToolPartitionFromSettings(
  toolId: string,
  settings: SessionSettings
): string {
  return getToolPartition(toolId, isToolIncognito(settings, toolId));
}

export function isTempPartition(partition: string): boolean {
  return partition.startsWith(TEMP_PREFIX) && !partition.startsWith(PERSIST_PREFIX);
}
