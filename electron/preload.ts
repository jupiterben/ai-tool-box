import { contextBridge, ipcRenderer } from 'electron';

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 调用主进程的IPC处理器
   */
  invoke: (channel: string, data?: any) => {
    // 白名单：只允许特定的channel
    const validChannels = [
      'ai:generate-expansion-options',
      'ai:generate-final-prompt',
      'storage:save-prompt',
      'storage:load-prompt-list',
      'storage:load-prompt',
      'storage:delete-prompt',
      'export:save-prompt-file',
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    
    throw new Error(`Invalid IPC channel: ${channel}`);
  },
});
