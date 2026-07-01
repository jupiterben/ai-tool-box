import { createRequire } from 'node:module';
import { app, BrowserWindow } from 'electron';
import type { AppUpdater } from 'electron-updater';
import type { UpdateStatus } from '../src/types/update-status';

const { autoUpdater } = createRequire(import.meta.url)('electron-updater') as {
  autoUpdater: AppUpdater;
};

const CHECK_DELAY_MS = 5000;
const SUPPORTED_PLATFORMS = new Set(['win32', 'darwin', 'linux']);

let initialized = false;

function isAutoUpdateSupported(): boolean {
  return app.isPackaged && SUPPORTED_PLATFORMS.has(process.platform);
}

function sendStatus(window: BrowserWindow | null, status: UpdateStatus): void {
  window?.webContents.send('update:status', status);
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = false;

  if (process.platform === 'win32') {
    autoUpdater.disableWebInstaller = true;
  }
}

export function initializeAutoUpdater(window: BrowserWindow | null): void {
  if (initialized || !isAutoUpdateSupported()) {
    return;
  }

  initialized = true;
  configureAutoUpdater();

  autoUpdater.on('checking-for-update', () => {
    sendStatus(window, { state: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus(window, { state: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus(window, { state: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus(window, {
      state: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus(window, { state: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    sendStatus(window, {
      state: 'error',
      message: error.message,
    });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '检查更新失败';
      sendStatus(window, { state: 'error', message });
    });
  }, CHECK_DELAY_MS);
}

export function checkForUpdatesManually(window: BrowserWindow | null): void {
  if (!isAutoUpdateSupported()) {
    return;
  }

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '检查更新失败';
    sendStatus(window, { state: 'error', message });
  });
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall();
}
