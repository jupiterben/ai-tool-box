import { BrowserWindow } from './runtime.js';
import { nativeCall } from './rpc.js';
import { DEFAULT_PRESET_ID } from '../src/types/preset.ts';
import { getPreset } from './presetRegistry.ts';
import { initializeProxySettings } from './proxyManager.ts';
import { initializeGeolocationSettings } from './geolocationManager.ts';

const windows = new Map<string, BrowserWindow>();
const webContentsToPreset = new Map<number, string>();

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

export async function closePresetWindow(presetId: string): Promise<void> {
  const win = getPresetWindow(presetId);
  if (win) {
    await win.close();
  }
}

export async function setPresetWindowTitle(presetId: string, name: string): Promise<void> {
  const win = getPresetWindow(presetId);
  if (win) {
    await win.setTitle(`AI Tool Box — ${name}`);
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

  const win = new BrowserWindow(presetId);

  windows.set(presetId, win);
  const webContentsId = win.webContents.id;
  webContentsToPreset.set(webContentsId, presetId);

  win.on('closed', () => {
    webContentsToPreset.delete(webContentsId);
    if (windows.get(presetId) === win) {
      windows.delete(presetId);
    }
  });

  try {
    await nativeCall('window:create', { presetId, title: `AI Tool Box — ${displayName}` });
  } catch (error) {
    win.closed();
    throw error;
  }
  return win;
}
