import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  initializeProxySettings,
  loadProxySettings,
  registerProxyLoginHandler,
  saveProxySettings,
} from './proxyManager';
import { sendWebviewInput } from './webviewInput';
import { extractWebviewResponses } from './webviewExtract';
import { loadLlmSettings, saveLlmSettings } from './llmManager';
import { summarizeResponses } from './llmService';
import type { ProxySettings } from '../src/types/proxy-settings';
import type { LlmSettingsInput, SummarizeResponsesPayload } from '../src/types/llm-settings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
}

registerProxyLoginHandler();

app.whenReady().then(async () => {
  await initializeProxySettings();
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
