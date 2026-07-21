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
import type { UpdateStatus } from '../src/types/update-status';
import type {
  EnsureImageWebviewRequest,
  EnsureImageWebviewResult,
} from '../src/types/image-gen-api';
import type {
  ImageGenApiSettings,
  ImageGenApiSettingsResult,
} from '../src/types/image-gen-api-settings';
import type { AgentCliConfig, AgentCliId, AgentCliResult } from '../src/types/agent-cli';
import type { PresetMeta } from '../src/types/preset';
import { DEFAULT_PRESET_ID } from '../src/types/preset';
import type { ToolSettings } from '../src/types/tool-settings';

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

function readPresetIdFromArgv(): string {
  const arg = process.argv.find((a) => a.startsWith('--preset-id='));
  return arg?.slice('--preset-id='.length) || DEFAULT_PRESET_ID;
}

const PRESET_ID = readPresetIdFromArgv();

function invoke<T>(channel: IpcChannel, data?: unknown): Promise<T> {
  if (!IPC_CHANNELS.includes(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, data);
}

contextBridge.exposeInMainWorld('electronAPI', {
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
    const listener = (_event: Electron.IpcRendererEvent, payload: EnsureImageWebviewRequest) => {
      callback(payload);
    };
    ipcRenderer.on('image-gen:ensure-webview', listener);
    return () => {
      ipcRenderer.removeListener('image-gen:ensure-webview', listener);
    };
  },
  reportEnsureImageWebview: (result: EnsureImageWebviewResult) => {
    ipcRenderer.send('image-gen:ensure-webview-result', result);
  },
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => {
      callback(status);
    };
    ipcRenderer.on('update:status', listener);
    return () => {
      ipcRenderer.removeListener('update:status', listener);
    };
  },
  checkForUpdates: () => invoke<{ success: boolean }>('update:check'),
  installUpdate: () => invoke<{ success: boolean }>('update:install'),
  getImageGenApiSettings: () =>
    invoke<ImageGenApiSettingsResult>('image-gen-api:get-settings'),
  saveImageGenApiSettings: (settings: Partial<ImageGenApiSettings>) =>
    invoke<ImageGenApiSettingsResult>('image-gen-api:save-settings', settings),
});
