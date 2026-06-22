import { contextBridge, ipcRenderer } from 'electron';
import type { ProxySettings } from '../src/types/proxy-settings';

const PROXY_CHANNELS = ['proxy:get-settings', 'proxy:save-settings'] as const;

type ProxyChannel = (typeof PROXY_CHANNELS)[number];

function invoke<T>(channel: ProxyChannel, data?: unknown): Promise<T> {
  if (!PROXY_CHANNELS.includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, data);
}

contextBridge.exposeInMainWorld('electronAPI', {
  getProxySettings: () =>
    invoke<{ success: boolean; settings?: ProxySettings; error?: string }>('proxy:get-settings'),
  saveProxySettings: (settings: ProxySettings) =>
    invoke<{ success: boolean; settings?: ProxySettings; error?: string }>(
      'proxy:save-settings',
      settings
    ),
});
