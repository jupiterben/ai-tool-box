/** Electron webview session 分区名，与主进程 setProxy 保持一致 */
export function getToolPartition(toolId: string): string {
  return `persist:tool-${toolId}`;
}
