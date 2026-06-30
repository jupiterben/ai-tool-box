import { app } from 'electron';
import { join } from 'node:path';

export function isDevEnvironment(): boolean {
  return process.env.ELECTRON_DEV === '1' || !app.isPackaged;
}

/** 开发环境使用独立 userData 子目录，与正式安装版设置隔离 */
export function configureIsolatedUserData(): void {
  if (!isDevEnvironment()) return;

  const userDataPath = app.getPath('userData');
  app.setPath('userData', join(userDataPath, 'dev'));
}
