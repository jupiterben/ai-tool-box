import { BrowserWindow, app } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRESET_ID } from '../src/types/preset.ts';
import { getPreset } from './presetRegistry.ts';
import { initializeProxySettings } from './proxyManager.ts';
import { initializeGeolocationSettings } from './geolocationManager.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const windows = new Map<string, BrowserWindow>();
const webContentsToPreset = new Map<number, string>();

function getAppIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    return join(process.resourcesPath, iconFile);
  }
  return join(__dirname, '../resources', iconFile);
}

function loadWindowContent(win: BrowserWindow): void {
  const isDev = process.env.ELECTRON_DEV === '1' || !app.isPackaged;
  if (isDev) {
    void win.loadURL('http://127.0.0.1:5173');
    win.webContents.openDevTools();
  } else {
    void win.loadFile(join(__dirname, '../dist/index.html'));
  }
}

export function getPresetIdForWebContentsId(webContentsId: number): string | null {
  return webContentsToPreset.get(webContentsId) ?? null;
}

export function getFocusedPresetId(): string | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused || focused.isDestroyed()) {
    return windows.has(DEFAULT_PRESET_ID) ? DEFAULT_PRESET_ID : listOpenPresetIds()[0] ?? null;
  }
  for (const [presetId, win] of windows.entries()) {
    if (win === focused) {
      return presetId;
    }
  }
  return null;
}

export function getFocusedPresetWindow(): BrowserWindow | null {
  const presetId = getFocusedPresetId();
  if (!presetId) return null;
  return getPresetWindow(presetId);
}

export function getPresetWindow(presetId: string): BrowserWindow | null {
  const win = windows.get(presetId);
  if (!win || win.isDestroyed()) {
    windows.delete(presetId);
    return null;
  }
  return win;
}

export function listOpenPresetIds(): string[] {
  const open: string[] = [];
  for (const [presetId, win] of windows.entries()) {
    if (!win.isDestroyed()) {
      open.push(presetId);
    } else {
      windows.delete(presetId);
    }
  }
  return open;
}

export function closePresetWindow(presetId: string): void {
  const win = getPresetWindow(presetId);
  if (win) {
    win.close();
  }
}

export function setPresetWindowTitle(presetId: string, name: string): void {
  const win = getPresetWindow(presetId);
  if (win) {
    win.setTitle(`AI Tool Box — ${name}`);
  }
}

export async function openPresetWindow(presetId: string): Promise<BrowserWindow> {
  const existing = getPresetWindow(presetId);
  if (existing) {
    if (existing.isMinimized()) {
      existing.restore();
    }
    existing.focus();
    return existing;
  }

  const meta = await getPreset(presetId);
  if (!meta) {
    throw new Error(`Preset not found: ${presetId}`);
  }

  const displayName = meta.name;

  await initializeProxySettings(presetId);
  await initializeGeolocationSettings(presetId);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      additionalArguments: [`--preset-id=${presetId}`],
    },
    title: `AI Tool Box — ${displayName}`,
    show: false,
  });

  windows.set(presetId, win);
  const webContentsId = win.webContents.id;
  webContentsToPreset.set(webContentsId, presetId);

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });

  win.on('closed', () => {
    webContentsToPreset.delete(webContentsId);
    if (windows.get(presetId) === win) {
      windows.delete(presetId);
    }
  });

  loadWindowContent(win);
  return win;
}
