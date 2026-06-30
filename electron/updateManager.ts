import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus } from '../src/types/update-status';

const CHECK_DELAY_MS = 5000;

let initialized = false;

function sendStatus(window: BrowserWindow | null, status: UpdateStatus): void {
  window?.webContents.send('update:status', status);
}

export function initializeAutoUpdater(window: BrowserWindow | null): void {
  if (initialized || !app.isPackaged || process.platform !== 'win32') {
    return;
  }

  initialized = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;

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
  if (!app.isPackaged || process.platform !== 'win32') {
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
