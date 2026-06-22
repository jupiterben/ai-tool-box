import type { ProxySettings } from './proxy-settings';

export interface ElectronAPI {
  getProxySettings: () => Promise<{
    success: boolean;
    settings?: ProxySettings;
    error?: string;
  }>;
  saveProxySettings: (settings: ProxySettings) => Promise<{
    success: boolean;
    settings?: ProxySettings;
    error?: string;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
