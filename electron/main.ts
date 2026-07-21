import { app, BrowserWindow, ipcMain } from 'electron';
import { configureIsolatedUserData } from './appEnvironment';
import {
  loadGeolocationSettings,
  registerGeolocationWebContentsListener,
  saveGeolocationSettings,
  applyPresetGeolocationById,
} from './geolocationManager';
import {
  loadProxySettings,
  registerProxyLoginHandler,
  saveProxySettings,
} from './proxyManager';
import { sendWebviewInput } from './webviewInput';
import { extractWebviewResponses } from './webviewExtract';
import { clearPresetWebviewData } from './webviewSession';
import { loadLlmSettings, saveLlmSettings } from './llmManager';
import { summarizeResponses } from './llmService';
import { checkForUpdatesManually, initializeAutoUpdater, quitAndInstallUpdate } from './updateManager';
import { registerImageGenBridgeHandlers, clearImageGenBridge } from './imageGenBridge';
import { getImageGenApiStatus, startImageGenApi, stopImageGenApi } from './imageGenApi';
import { loadImageGenApiSettings, saveImageGenApiSettings } from './imageGenApiSettings';
import type { GeolocationSettings } from '../src/types/geolocation-settings';
import type { ProxySettings } from '../src/types/proxy-settings';
import type { LlmSettingsInput, SummarizeResponsesPayload } from '../src/types/llm-settings';
import type { ImageGenApiSettings } from '../src/types/image-gen-api-settings';
import type { AgentCliConfig, AgentCliId } from '../src/types/agent-cli';
import { installAgentCli, listAgentClis, saveAgentCliConfig } from './agentCliManager';
import { DEFAULT_PRESET_ID } from '../src/types/preset';
import {
  createPreset,
  deletePreset,
  listPresets,
  loadPresetRegistry,
  renamePreset,
} from './presetRegistry';
import {
  copyPresetSettings,
  deletePresetSettings,
  migrateLegacySettingsIntoDefault,
  loadPresetToolSettings,
  savePresetToolSettings,
} from './presetSettingsStore';
import type { ToolSettings } from '../src/types/tool-settings';
import {
  closePresetWindow,
  getFocusedPresetId,
  getFocusedPresetWindow,
  getPresetIdForWebContentsId,
  listOpenPresetIds,
  openPresetWindow,
  setPresetWindowTitle,
} from './presetWindowManager';

configureIsolatedUserData();

function resolvePresetIdFromEvent(event: Electron.IpcMainInvokeEvent): string {
  return (
    getPresetIdForWebContentsId(event.sender.id) ??
    getFocusedPresetId() ??
    DEFAULT_PRESET_ID
  );
}

function registerIpcHandlers() {
  ipcMain.handle('preset:get-id', async (event) => {
    return { success: true, presetId: resolvePresetIdFromEvent(event) };
  });

  ipcMain.handle('preset:list', async () => {
    try {
      return { success: true, presets: await listPresets(), openIds: listOpenPresetIds() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 Preset 失败',
      };
    }
  });

  ipcMain.handle('preset:create', async (_event, name: string) => {
    try {
      const meta = await createPreset(name);
      await copyPresetSettings(DEFAULT_PRESET_ID, meta.id);
      return { success: true, preset: meta };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建 Preset 失败',
      };
    }
  });

  ipcMain.handle('preset:rename', async (_event, payload: { id: string; name: string }) => {
    try {
      const meta = await renamePreset(payload.id, payload.name);
      setPresetWindowTitle(meta.id, meta.name);
      return { success: true, preset: meta };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '重命名失败',
      };
    }
  });

  ipcMain.handle('preset:delete', async (_event, id: string) => {
    try {
      closePresetWindow(id);
      await deletePresetSettings(id);
      await clearPresetWebviewData(id);
      await deletePreset(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除 Preset 失败',
      };
    }
  });

  ipcMain.handle('preset:open', async (_event, id: string) => {
    try {
      const win = await openPresetWindow(id);
      if (listOpenPresetIds().length === 1) {
        initializeAutoUpdater(win);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '打开 Preset 失败',
      };
    }
  });

  ipcMain.handle('preset:list-open', async () => {
    return { success: true, openIds: listOpenPresetIds() };
  });

  ipcMain.handle('tool-settings:get', async (event) => {
    try {
      const presetId = resolvePresetIdFromEvent(event);
      const settings = await loadPresetToolSettings(presetId);
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取工具设置失败',
      };
    }
  });

  ipcMain.handle('tool-settings:save', async (event, settings: ToolSettings) => {
    try {
      const presetId = resolvePresetIdFromEvent(event);
      const saved = await savePresetToolSettings(presetId, settings);
      return { success: true, settings: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存工具设置失败',
      };
    }
  });

  ipcMain.handle('agent-cli:list', async () => {
    try {
      return { success: true, agents: await listAgentClis() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 Agent CLI 失败',
      };
    }
  });
  ipcMain.handle('agent-cli:install', async (_event, id: AgentCliId) => {
    try {
      await installAgentCli(id);
      return { success: true, agents: await listAgentClis() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装失败',
      };
    }
  });
  ipcMain.handle('agent-cli:save-config', async (_event, payload: { id: AgentCliId; config: AgentCliConfig }) => {
    try {
      await saveAgentCliConfig(payload.id, payload.config);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存配置失败',
      };
    }
  });
  ipcMain.handle('image-gen-api:get-settings', async () => {
    try {
      const settings = await loadImageGenApiSettings();
      return {
        success: true,
        settings,
        status: getImageGenApiStatus(settings.enabled),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 API 设置失败',
      };
    }
  });

  ipcMain.handle('image-gen-api:save-settings', async (_event, input: Partial<ImageGenApiSettings>) => {
    try {
      const settings = await saveImageGenApiSettings(input);
      if (settings.enabled) {
        await stopImageGenApi();
        const status = await startImageGenApi(() => getFocusedPresetWindow(), {
          port: settings.port,
        });
        return { success: true, settings, status };
      }

      await stopImageGenApi();
      return {
        success: true,
        settings,
        status: getImageGenApiStatus(settings.enabled),
      };
    } catch (error) {
      const settings = await loadImageGenApiSettings().catch(() => undefined);
      return {
        success: false,
        settings,
        status: getImageGenApiStatus(settings?.enabled ?? false),
        error: error instanceof Error ? error.message : '保存 API 设置失败',
      };
    }
  });

  ipcMain.handle('proxy:get-settings', async (event) => {
    try {
      const settings = await loadProxySettings(resolvePresetIdFromEvent(event));
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取代理设置失败',
      };
    }
  });

  ipcMain.handle('geolocation:get-settings', async (event) => {
    try {
      const settings = await loadGeolocationSettings(resolvePresetIdFromEvent(event));
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 GPS 设置失败',
      };
    }
  });

  ipcMain.handle('geolocation:save-settings', async (event, settings: GeolocationSettings) => {
    try {
      const saved = await saveGeolocationSettings(settings, resolvePresetIdFromEvent(event));
      return { success: true, settings: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存 GPS 设置失败',
      };
    }
  });

  ipcMain.handle('geolocation:apply-for-tool', async (event, _toolId: string) => {
    try {
      await applyPresetGeolocationById(resolvePresetIdFromEvent(event));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '应用 GPS 设置失败',
      };
    }
  });

  ipcMain.handle('proxy:save-settings', async (event, settings: ProxySettings) => {
    try {
      const saved = await saveProxySettings(settings, resolvePresetIdFromEvent(event));
      return { success: true, settings: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存代理设置失败',
      };
    }
  });

  ipcMain.handle('webview:send-input', async (_event, payload) => {
    try {
      return await sendWebviewInput(payload);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'webview 输入发送失败',
      };
    }
  });

  ipcMain.handle('webview:extract-responses', async (_event, payload) => {
    try {
      return await extractWebviewResponses(payload);
    } catch (error) {
      return {
        success: false,
        responses: [],
        error: error instanceof Error ? error.message : '提取回复失败',
      };
    }
  });

  ipcMain.handle('webview:clear-tool-data', async (event, _toolId?: string) => {
    try {
      return await clearPresetWebviewData(resolvePresetIdFromEvent(event));
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理缓存失败',
      };
    }
  });

  ipcMain.handle('llm:get-settings', async () => {
    try {
      const settings = await loadLlmSettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 LLM 设置失败',
      };
    }
  });

  ipcMain.handle('llm:save-settings', async (_event, input: LlmSettingsInput) => {
    try {
      const settings = await saveLlmSettings(input);
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存 LLM 设置失败',
      };
    }
  });

  ipcMain.handle('llm:summarize-responses', async (_event, payload: SummarizeResponsesPayload) => {
    try {
      return await summarizeResponses(payload);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LLM 汇总失败',
      };
    }
  });

  ipcMain.handle('update:check', async () => {
    checkForUpdatesManually(getFocusedPresetWindow());
    return { success: true };
  });

  ipcMain.handle('update:install', async () => {
    quitAndInstallUpdate();
    return { success: true };
  });
}

registerProxyLoginHandler();
registerGeolocationWebContentsListener();
registerImageGenBridgeHandlers();

app.whenReady().then(async () => {
  await loadPresetRegistry();
  await migrateLegacySettingsIntoDefault();
  registerIpcHandlers();

  const defaultWin = await openPresetWindow(DEFAULT_PRESET_ID);
  initializeAutoUpdater(defaultWin);

  const apiSettings = await loadImageGenApiSettings();
  if (apiSettings.enabled) {
    await startImageGenApi(() => getFocusedPresetWindow(), { port: apiSettings.port }).catch(
      (error) => {
        console.error('[main] Failed to start image API:', error);
      }
    );
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openPresetWindow(DEFAULT_PRESET_ID);
    }
  });
});

app.on('before-quit', () => {
  clearImageGenBridge();
  void stopImageGenApi();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
