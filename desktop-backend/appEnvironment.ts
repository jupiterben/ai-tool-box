import { app } from './runtime.js';

export function isDevEnvironment(): boolean {
  return !app.isPackaged;
}

/** 开发环境使用独立 userData 子目录，与正式安装版设置隔离 */
export function configureIsolatedUserData(): void {
  // Tauri passes an already isolated data directory to its child process.
}
