import { contextBridge, ipcRenderer } from 'electron';
import type { GeolocationSettings } from '../src/types/geolocation-settings';
import type { ProxySettings } from '../src/types/proxy-settings';
import type {
  ExtractWebviewResponsesPayload,
  ExtractWebviewResponsesResult,
  WebviewSendInputPayload,
  WebviewSendInputResult,
} from '../src/types/electron-api';
import type { LlmSettings, LlmSettingsInput, SummarizeResponsesPayload, SummarizeResponsesResult } from '../src/types/llm-settings';

const IPC_CHANNELS = [
  'geolocation:get-settings',
  'geolocation:save-settings',
  'geolocation:apply-for-tool',
  'proxy:get-settings',
  'proxy:save-settings',
  'webview:send-input',
  'webview:extract-responses',
  'llm:get-settings',
  'llm:save-settings',
  'llm:summarize-responses',
] as const;

type IpcChannel = (typeof IPC_CHANNELS)[number];

function invoke<T>(channel: IpcChannel, data?: unknown): Promise<T> {
  if (!IPC_CHANNELS.includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, data);
}

contextBridge.exposeInMainWorld('electronAPI', {
  getGeolocationSettings: () =>
    invoke<{ success: boolean; settings?: GeolocationSettings; error?: string }>(
      'geolocation:get-settings'
    ),
  saveGeolocationSettings: (settings: GeolocationSettings) =>
    invoke<{ success: boolean; settings?: GeolocationSettings; error?: string }>(
      'geolocation:save-settings',
      settings
    ),
  applyToolGeolocation: (toolId: string) =>
    invoke<{ success: boolean; error?: string }>('geolocation:apply-for-tool', toolId),
  getProxySettings: () =>
    invoke<{ success: boolean; settings?: ProxySettings; error?: string }>('proxy:get-settings'),
  saveProxySettings: (settings: ProxySettings) =>
    invoke<{ success: boolean; settings?: ProxySettings; error?: string }>(
      'proxy:save-settings',
      settings
    ),
  sendWebviewInput: (payload: WebviewSendInputPayload) =>
    invoke<WebviewSendInputResult>('webview:send-input', payload),
  extractWebviewResponses: (payload: ExtractWebviewResponsesPayload) =>
    invoke<ExtractWebviewResponsesResult>('webview:extract-responses', payload),
  getLlmSettings: () =>
    invoke<{ success: boolean; settings?: LlmSettings; error?: string }>('llm:get-settings'),
  saveLlmSettings: (input: LlmSettingsInput) =>
    invoke<{ success: boolean; settings?: LlmSettings; error?: string }>(
      'llm:save-settings',
      input
    ),
  summarizeResponses: (payload: SummarizeResponsesPayload) =>
    invoke<SummarizeResponsesResult>('llm:summarize-responses', payload),
});
