import { app, type BrowserWindow } from './runtime.js';
import { nativeCall } from './rpc.js';
let initialized = false;
export function initializeAutoUpdater(window: BrowserWindow | null): void {
  if (initialized || !app.isPackaged) return;
  initialized = true;
  setTimeout(() => { void checkForUpdatesManually(window).catch(console.error); }, 5000);
}
export async function checkForUpdatesManually(window: BrowserWindow | null): Promise<void> {
  await nativeCall('update:check', { presetId: window?.presetId ?? 'default' });
}
export async function quitAndInstallUpdate(): Promise<void> {
  await nativeCall('update:install');
}
