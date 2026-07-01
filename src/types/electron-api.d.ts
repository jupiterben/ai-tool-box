import type { GeolocationSettings } from './geolocation-settings';
import type { LlmSettings, LlmSettingsInput, SummarizeResponsesPayload, SummarizeResponsesResult } from './llm-settings';
import type { ProxySettings } from './proxy-settings';
import type { UpdateStatus } from './update-status';
import type { ReferenceImage } from './reference-image';

export interface WebviewSendInputPayload {
  toolId: string;
  partition: string;
  content: string;
  referenceImage?: ReferenceImage | null;
  webContentsId?: number;
}

export interface WebviewSendInputResult {
  success: boolean;
  error?: string;
}

export interface ExtractedToolResponse {
  toolId: string;
  success: boolean;
  content: string;
  userQuestion?: string;
  responseCount?: number;
  error?: string;
}

export interface ExtractWebviewResponsesPayload {
  toolIds: string[];
  webContentsIds?: Record<string, number>;
}

export interface ExtractWebviewResponsesResult {
  success: boolean;
  responses: ExtractedToolResponse[];
  error?: string;
}

export interface ElectronAPI {
  getGeolocationSettings: () => Promise<{
    success: boolean;
    settings?: GeolocationSettings;
    error?: string;
  }>;
  saveGeolocationSettings: (settings: GeolocationSettings) => Promise<{
    success: boolean;
    settings?: GeolocationSettings;
    error?: string;
  }>;
  applyToolGeolocation: (toolId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
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
  extractWebviewResponses: (
    payload: ExtractWebviewResponsesPayload
  ) => Promise<ExtractWebviewResponsesResult>;
  clearToolWebviewData: (toolId: string) => Promise<{ success: boolean; error?: string }>;
  getLlmSettings: () => Promise<{
    success: boolean;
    settings?: LlmSettings;
    error?: string;
  }>;
  saveLlmSettings: (input: LlmSettingsInput) => Promise<{
    success: boolean;
    settings?: LlmSettings;
    error?: string;
  }>;
  summarizeResponses: (payload: SummarizeResponsesPayload) => Promise<SummarizeResponsesResult>;
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
  checkForUpdates?: () => Promise<{ success: boolean }>;
  installUpdate?: () => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
