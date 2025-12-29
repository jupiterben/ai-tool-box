import { contextBridge } from 'electron';

// 暴露受保护的方法给渲染进程
// 当前不需要暴露任何方法，但保留此文件以备将来使用
contextBridge.exposeInMainWorld('electronAPI', {
  // 可以在这里添加需要暴露给渲染进程的 API
});
