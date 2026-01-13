import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { AIService } from '../src/services/aiService';
import { StorageService } from '../src/services/storageService';
import { formatPromptForExport } from '../src/utils/promptFormatter';
import type {
  GenerateExpansionOptionsRequest,
  GenerateExpansionOptionsResponse,
  GenerateFinalPromptRequest,
  GenerateFinalPromptResponse,
  SavePromptRequest,
  SavePromptResponse,
  ExportPromptRequest,
  ExportPromptResponse,
} from '../src/types/prompt-expander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// 初始化服务
const aiService = new AIService();
const storageService = new StorageService();

// 设置存储路径
app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  storageService.setStoragePath(join(userDataPath, 'prompts'));
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 优化性能：禁用不必要的功能
      sandbox: true,
      // 启用 webview 标签以绕过 X-Frame-Options 限制
      webviewTag: true,
    },
    title: 'AI Tool Box',
    // 优化启动速度
    show: false,
  });

  // 窗口准备好后再显示，提升启动体验
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发环境加载 Vite 开发服务器，生产环境加载构建后的文件
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 注册IPC处理器
function registerIpcHandlers() {
  // AI服务：生成拓展方向
  ipcMain.handle('ai:generate-expansion-options', async (event, request: GenerateExpansionOptionsRequest): Promise<GenerateExpansionOptionsResponse> => {
    try {
      const options = await aiService.generateExpansionOptions(request);
      return { success: true, options };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成拓展方向失败',
      };
    }
  });

  // AI服务：生成最终提示词
  ipcMain.handle('ai:generate-final-prompt', async (event, request: GenerateFinalPromptRequest): Promise<GenerateFinalPromptResponse> => {
    try {
      const prompt = await aiService.generateFinalPrompt(request);
      return { success: true, prompt };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成最终提示词失败',
      };
    }
  });

  // 存储服务：保存提示词
  ipcMain.handle('storage:save-prompt', async (event, request: SavePromptRequest): Promise<SavePromptResponse> => {
    try {
      const filePath = await storageService.savePrompt(request.prompt);
      return { success: true, filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存提示词失败',
      };
    }
  });

  // 文件导出
  ipcMain.handle('export:save-prompt-file', async (event, request: ExportPromptRequest): Promise<ExportPromptResponse> => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        filters: [
          { name: request.format === 'md' ? 'Markdown' : 'Text', extensions: [request.format] },
        ],
        defaultPath: `prompt-${Date.now()}.${request.format}`,
      });

      if (result.canceled) {
        return { success: false, cancelled: true };
      }

      if (!result.filePath) {
        return { success: false, error: '未选择文件路径' };
      }

      const content = formatPromptForExport(
        request.prompt,
        request.metadata,
        request.format
      );
      
      await fs.writeFile(result.filePath, content, 'utf-8');

      return { success: true, filePath: result.filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '导出文件失败',
      };
    }
  });
}

app.whenReady().then(() => {
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
