import { useEffect } from 'react';
import {
  ensurePageVisited,
  navigateToPage,
  runImageGenEnsureHandler,
} from '../services/imageGenBridge';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ImageGenBridge: React.FC = () => {
  useEffect(() => {
    if (!window.electronAPI?.onEnsureImageWebview) {
      return;
    }

    const unsubscribe = window.electronAPI.onEnsureImageWebview(async ({ requestId, toolId }) => {
      try {
        ensurePageVisited('image-webview');
        navigateToPage('image-webview');
        await sleep(800);

        let result = await runImageGenEnsureHandler(toolId);
        if (!result.success) {
          for (let i = 0; i < 40 && !result.success; i += 1) {
            await sleep(500);
            result = await runImageGenEnsureHandler(toolId);
          }
        }

        window.electronAPI?.reportEnsureImageWebview?.({
          requestId,
          success: result.success,
          webContentsId: result.webContentsId,
          error: result.error,
        });
      } catch (error) {
        window.electronAPI?.reportEnsureImageWebview?.({
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'ensure webview 失败',
        });
      }
    });

    return unsubscribe;
  }, []);

  return null;
};

export default ImageGenBridge;
