/**
 * 本地存储服务（主进程）
 * 
 * 使用Electron文件系统API保存和加载提示词
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { SavedPrompt } from '../types/prompt-expander';

// 注意：此文件应在Electron主进程中使用
// 在渲染进程中应通过IPC调用

export class StorageService {
  private storagePath: string = '';

  /**
   * 设置存储路径
   */
  setStoragePath(path: string): void {
    this.storagePath = path;
  }

  /**
   * 获取存储路径
   */
  getStoragePath(): string {
    return this.storagePath;
  }

  /**
   * 确保存储目录存在
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }

  /**
   * 保存提示词
   */
  async savePrompt(prompt: SavedPrompt): Promise<string> {
    await this.ensureStorageDir();
    
    const fileName = `${prompt.id}.json`;
    const filePath = join(this.storagePath, fileName);
    
    const data = JSON.stringify(prompt, null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
    
    return filePath;
  }

  /**
   * 加载提示词
   * TODO: 实现具体逻辑
   */
  async loadPrompt(id: string): Promise<any> {
    // 实现将在后续任务中完成
    throw new Error('Not implemented');
  }

  /**
   * 加载提示词列表
   * TODO: 实现具体逻辑
   */
  async loadPromptList(limit?: number, offset?: number): Promise<any[]> {
    // 实现将在后续任务中完成
    throw new Error('Not implemented');
  }

  /**
   * 删除提示词
   * TODO: 实现具体逻辑
   */
  async deletePrompt(id: string): Promise<void> {
    // 实现将在后续任务中完成
    throw new Error('Not implemented');
  }
}
