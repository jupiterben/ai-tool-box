import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { configureIsolatedUserData } from './appEnvironment';
import {
  initializeGeolocationSettings,
  loadGeolocationSettings,
  registerGeolocationWebContentsListener,
  saveGeolocationSettings,
  applyToolGeolocationById,
} from './geolocationManager';
import {
  initializeProxySettings,
  loadProxySettings,
  registerProxyLoginHandler,
  saveProxySettings,
} from './proxyManager';
import { sendWebviewInput } from './webviewInput';
import { extractWebviewResponses } from './webviewExtract';
import {
  clearIncognitoPartition,
  clearToolWebviewData,
  prepareToolSessionMode,
} from './webviewSession';
import {
  initializeSessionSettings,
  loadSessionSettings,
  saveSessionSettings,
} from './sessionSettingsManager';
import { loadLlmSettings, saveLlmSettings } from './llmManager';
import { summarizeResponses } from './llmService';
import { checkForUpdatesManually, initializeAutoUpdater, quitAndInstallUpdate } from './updateManager';
import type { GeolocationSettings } from '../src/types/geolocation-settings';
import type { ProxySettings } from '../src/types/proxy-settings';
import type { SessionSettings } from '../src/types/session-settings';
import type { LlmSettingsInput, SummarizeResponsesPayload } from '../src/types/llm-settings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

configureIsolatedUserData();

let mainWindow: BrowserWindow | null = null;

function getAppIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    return join(process.resourcesPath, iconFile);
  }
  return join(__dirname, '../resources', iconFile);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
    },
    title: 'AI Tool Box',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    initializeAutoUpdater(mainWindow);
  });

  const isDev = process.env.ELECTRON_DEV === '1' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('proxy:get-settings', async () => {
    try {
      const settings = await loadProxySettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取代理设置失败',
      };
    }
  });

  ipcMain.handle('geolocation:get-settings', async () => {
    try {
      const settings = await loadGeolocationSettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 GPS 设置失败',
      };
    }
  });

  ipcMain.handle('geolocation:save-settings', async (_event, settings: GeolocationSettings) => {
    try {
      const saved = await saveGeolocationSettings(settings);
      return { success: true, settings: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存 GPS 设置失败',
      };
    }
  });

  ipcMain.handle('geolocation:apply-for-tool', async (_event, toolId: string) => {
    try {
      await applyToolGeolocationById(toolId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '应用 GPS 设置失败',
      };
    }
  });

  ipcMain.handle('proxy:save-settings', async (_event, settings: ProxySettings) => {
    try {
      const saved = await saveProxySettings(settings);
      return { success: true, settings: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存代理设置失败',
      };
    }
  });

  ipcMain.handle('session:get-settings', async () => {
    try {
      const settings = await loadSessionSettings();
      return { success: true, settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取会话设置失败',
      };
    }
  });

  ipcMain.handle('session:save-settings', async (_event, settings: SessionSettings) => {
    try {
      const saved = await saveSessionSettings(settings);
      return { success: true, settings: saved };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存会话设置失败',
      };
    }
  });

  ipcMain.handle(
    'session:prepare-tool-mode',
    async (_event, payload: { toolId: string; incognito: boolean }) => {
      try {
        return await prepareToolSessionMode(payload.toolId, payload.incognito);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '准备会话失败',
        };
      }
    }
  );

  ipcMain.handle('session:clear-incognito', async (_event, toolId: string) => {
    try {
      return await clearIncognitoPartition(toolId);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理无痕会话失败',
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

  ipcMain.handle('webview:clear-tool-data', async (_event, toolId: string) => {
    try {
      return await clearToolWebviewData(toolId);
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
    checkForUpdatesManually(mainWindow);
    return { success: true };
  });

  ipcMain.handle('update:install', async () => {
    quitAndInstallUpdate();
    return { success: true };
  });
}

registerProxyLoginHandler();
registerGeolocationWebContentsListener();

app.whenReady().then(async () => {
  await initializeSessionSettings();
  await initializeProxySettings();
  await initializeGeolocationSettings();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
