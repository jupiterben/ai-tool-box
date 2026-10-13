import { invoke, isTauri } from '@tauri-apps/api/core';
import type { DesktopAPI } from '../types/desktop-api';
import { DEFAULT_PRESET_ID } from '../types/preset';
import { getSiteHandler } from '../webview-handlers';
import { findGuest, evaluateGuest } from './webview';
import { ALL_DEFAULT_TOOLS, DEFAULT_DISABLED_TOOL_IDS } from '../config/tools';
import { createDefaultToolSettings } from '../types/tool-settings';
import { createDefaultLlmSettings } from '../types/llm-settings';
import { createDefaultGeolocationProfiles } from '../types/geolocation-settings';
import { saveToolSettingsToStorage } from '../utils/settingsStorage';

async function request<T>(action: string, payload?: unknown): Promise<T> {
  try {
    return await invoke<T>('desktop_request', { action, payload: payload ?? null });
  } catch (error) {
    return { success: false, error: String(error) } as T;
  }
}

export async function initializeDesktopBridge(): Promise<void> {
  if (!isTauri()) return;
  const tools = Object.fromEntries(ALL_DEFAULT_TOOLS.filter((tool) => tool.url)
    .map((tool) => [tool.id, { toolId: tool.id, mode: 'system' }]));
  // Initialize native defaults before loading settings or creating any guest.
  await invoke('desktop_request', {
    action: 'initialize',
    payload: {
      'tool-settings': createDefaultToolSettings(DEFAULT_DISABLED_TOOL_IDS),
      session: { version: '1.0.0', tools: Object.fromEntries(
        Object.keys(tools).map((toolId) => [toolId, { toolId, incognito: false }]),
      ) },
      proxy: { version: '2.0.0', profiles: {}, tools },
      geolocation: { version: '1.0.0', profiles: createDefaultGeolocationProfiles(), tools },
      llm: createDefaultLlmSettings(),
    },
  });
  window.desktopAPI = {
    getPresetId: () => DEFAULT_PRESET_ID,
    listPresets: () => request('preset:list'),
    createPreset: (name) => request('preset:create', name),
    renamePreset: (id, name) => request('preset:rename', { id, name }),
    deletePreset: (id) => request('preset:delete', id),
    openPreset: (id) => request('preset:open', id),
    listOpenPresets: () => request('preset:list-open'),
    getToolSettings: () => request('tool-settings:get'),
    saveToolSettings: (settings) => request('tool-settings:save', settings),
    getSessionSettings: () => request('session:get'),
    saveSessionSettings: (settings) => request('session:save', settings),
    prepareToolSessionMode: (toolId, incognito) =>
      request('session:prepare', { toolId, incognito }),
    clearIncognitoPartition: (toolId) => request('session:clear-incognito', toolId),
    getProxySettings: () => request('proxy:get'),
    saveProxySettings: (settings) => request('proxy:save', settings),
    getGeolocationSettings: () => request('geolocation:get'),
    saveGeolocationSettings: (settings) => request('geolocation:save', settings),
    applyToolGeolocation: (toolId) => request('geolocation:apply', toolId),
    clearToolWebviewData: (toolId) => request('webview:clear', toolId),
    getLlmSettings: () => request('llm:get'),
    saveLlmSettings: (settings) => request('llm:save', settings),
    summarizeResponses: (payload) => request('llm:summarize', payload),
    listAgentClis: () => request('agent-cli:list'),
    installAgentCli: (id) => request('agent-cli:install', id),
    saveAgentCliConfig: (id, config) => request('agent-cli:save-config', { id, config }),
    getImageGenApiSettings: () => request('image-gen-api:get'),
    saveImageGenApiSettings: (settings) => request('image-gen-api:save', settings),
    async sendWebviewInput(payload) {
      const guest = findGuest(payload.toolId, payload.webContentsId);
      const handler = getSiteHandler(payload.toolId);
      if (!guest || !handler) return { success: false, error: 'Webview 不可用' };
      try {
        await evaluateGuest(guest.label, handler.buildInjectScript());
        return await evaluateGuest(guest.label,
          `window.__injectInput__(${JSON.stringify({
            content: payload.content, referenceImage: payload.referenceImage,
          })})`) as { success: boolean; error?: string };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    async extractWebviewResponses(payload) {
      const responses = await Promise.all(payload.toolIds.map(async (toolId) => {
        const guest = findGuest(toolId, payload.webContentsIds?.[toolId]);
        const handler = getSiteHandler(toolId);
        if (!guest || !handler)
          return { toolId, success: false, content: '', error: 'Webview 不可用' };
        try {
          const result = await evaluateGuest(guest.label, handler.buildExtractResponsesScript());
          return { ...result as { success: boolean; content: string; userQuestion?: string }, toolId };
        } catch (error) {
          return { toolId, success: false, content: '', error: String(error) };
        }
      }));
      return { success: responses.some((result) => result.success), responses };
    },
  } satisfies DesktopAPI;
  const toolSettings = await window.desktopAPI.getToolSettings!();
  if (!toolSettings.success || !toolSettings.settings)
    throw new Error(toolSettings.error || '读取网站设置失败');
  saveToolSettingsToStorage(toolSettings.settings);
}
