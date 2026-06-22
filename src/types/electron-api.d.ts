import type { LlmSettings, LlmSettingsInput, SummarizeResponsesPayload, SummarizeResponsesResult } from './llm-settings';
import type { ProxySettings } from './proxy-settings';

export interface WebviewSendInputPayload {
  toolId: string;
  partition: string;
  content: string;
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
