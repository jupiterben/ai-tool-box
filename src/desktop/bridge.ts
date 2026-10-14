import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { GeolocationSettings } from '../types/geolocation-settings';
import type { ProxySettings } from '../types/proxy-settings';
import type {
  ExtractWebviewResponsesPayload,
  ExtractWebviewResponsesResult,
  WebviewSendInputPayload,
  WebviewSendInputResult,
} from '../types/desktop-api';
import type { LlmSettings, LlmSettingsInput, SummarizeResponsesPayload, SummarizeResponsesResult } from '../types/llm-settings';
import type { UpdateStatus } from '../types/update-status';
import type {
  EnsureImageWebviewRequest,
  EnsureImageWebviewResult,
} from '../types/image-gen-api';
import type {
  ImageGenApiSettings,
  ImageGenApiSettingsResult,
} from '../types/image-gen-api-settings';
import type { AgentCliConfig, AgentCliId, AgentCliResult } from '../types/agent-cli';
import type { PresetMeta } from '../types/preset';
import { DEFAULT_PRESET_ID } from '../types/preset';
import type { ToolSettings } from '../types/tool-settings';
import { saveToolSettingsToStorage } from '../utils/settingsStorage';

const IPC_CHANNELS = [
  'preset:get-id',
  'preset:list',
  'preset:create',
  'preset:rename',
  'preset:delete',
  'preset:open',
  'preset:list-open',
  'tool-settings:get',
  'tool-settings:save',
  'geolocation:get-settings',
  'geolocation:save-settings',
  'geolocation:apply-for-tool',
  'proxy:get-settings',
  'proxy:save-settings',
  'webview:send-input',
  'webview:extract-responses',
  'webview:clear-tool-data',
  'llm:get-settings',
  'llm:save-settings',
  'llm:summarize-responses',
  'update:check',
  'update:install',
  'image-gen-api:get-settings',
  'image-gen-api:save-settings',
  'agent-cli:list',
  'agent-cli:install',
  'agent-cli:save-config',
] as const;

type IpcChannel = (typeof IPC_CHANNELS)[number];

const PRESET_ID = isTauri()
  ? getCurrentWebview().label.slice('preset-'.length)
  : DEFAULT_PRESET_ID;

function invoke<T>(channel: IpcChannel, data?: unknown): Promise<T> {
  if (!IPC_CHANNELS.includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return tauriInvoke<T>('backend_call', { channel, payload: data ?? null });
}

const callbacks = new Map<string, Set<(payload: any) => void>>();
function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  if (!callbacks.has(event)) callbacks.set(event, new Set());
  callbacks.get(event)!.add(callback);
  return () => { callbacks.get(event)?.delete(callback); };
}
export async function initializeDesktopBridge(): Promise<void> {
if (!isTauri()) return;
await listen<{ event: string; payload: unknown }>('backend-event', ({ payload }) => {
  callbacks.get(payload.event)?.forEach((callback) => callback(payload.payload));
});
window.desktopAPI = {
  getPresetId: () => PRESET_ID,
  listPresets: () =>
    invoke<{ success: boolean; presets?: PresetMeta[]; openIds?: string[]; error?: string }>(
      'preset:list'
    ),
  createPreset: (name: string) =>
    invoke<{ success: boolean; preset?: PresetMeta; error?: string }>('preset:create', name),
  renamePreset: (id: string, name: string) =>
    invoke<{ success: boolean; preset?: PresetMeta; error?: string }>('preset:rename', {
      id,
      name,
    }),
  deletePreset: (id: string) =>
    invoke<{ success: boolean; error?: string }>('preset:delete', id),
  openPreset: (id: string) => invoke<{ success: boolean; error?: string }>('preset:open', id),
  listOpenPresets: () =>
    invoke<{ success: boolean; openIds?: string[]; error?: string }>('preset:list-open'),
  getToolSettings: () =>
    invoke<{ success: boolean; settings?: ToolSettings; error?: string }>('tool-settings:get'),
  saveToolSettings: (settings: ToolSettings) =>
    invoke<{ success: boolean; settings?: ToolSettings; error?: string }>(
      'tool-settings:save',
      settings
    ),
  listAgentClis: () => invoke<AgentCliResult>('agent-cli:list'),
  installAgentCli: (id: AgentCliId) => invoke<AgentCliResult>('agent-cli:install', id),
  saveAgentCliConfig: (id: AgentCliId, config: AgentCliConfig) =>
    invoke<AgentCliResult>('agent-cli:save-config', { id, config }),
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
  clearToolWebviewData: (toolId?: string) =>
    invoke<{ success: boolean; error?: string }>('webview:clear-tool-data', toolId),
  getLlmSettings: () =>
    invoke<{ success: boolean; settings?: LlmSettings; error?: string }>('llm:get-settings'),
  saveLlmSettings: (input: LlmSettingsInput) =>
    invoke<{ success: boolean; settings?: LlmSettings; error?: string }>(
      'llm:save-settings',
      input
    ),
  summarizeResponses: (payload: SummarizeResponsesPayload) =>
    invoke<SummarizeResponsesResult>('llm:summarize-responses', payload),
  onEnsureImageWebview: (callback: (payload: EnsureImageWebviewRequest) => void) => {
    return subscribe('image-gen:ensure-webview', callback);
  },
  reportEnsureImageWebview: (result: EnsureImageWebviewResult) => {
    void tauriInvoke('backend_call', {
      channel: 'image-gen:ensure-webview-result', payload: result,
    }).catch(console.error);
  },
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    return subscribe('update:status', callback);
  },
  checkForUpdates: () => invoke<{ success: boolean }>('update:check'),
  installUpdate: () => invoke<{ success: boolean }>('update:install'),
  getImageGenApiSettings: () =>
    invoke<ImageGenApiSettingsResult>('image-gen-api:get-settings'),
  saveImageGenApiSettings: (settings: Partial<ImageGenApiSettings>) =>
    invoke<ImageGenApiSettingsResult>('image-gen-api:save-settings', settings),
};
const settings = await window.desktopAPI.getToolSettings!();
if (!settings.success || !settings.settings) throw new Error(settings.error || '读取网站设置失败');
saveToolSettingsToStorage(settings.settings, PRESET_ID);
}
