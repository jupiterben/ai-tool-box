import type { ProxySettings } from './proxy-settings';

export interface WebviewSendInputPayload {
  toolId: string;
  partition: string;
  content: string;
}

export interface WebviewSendInputResult {
  success: boolean;
  error?: string;
}

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
  sendWebviewInput: (payload: WebviewSendInputPayload) => Promise<WebviewSendInputResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
