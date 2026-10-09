import { useEffect } from 'react';
import {
  ensurePageVisited,
  navigateToPage,
  activateImageToolTab,
  runImageGenEnsureHandler,
  waitForImageGenEnsureHandler,
} from '../services/imageGenBridge';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ImageGenBridge: React.FC = () => {
  useEffect(() => {
    if (!window.electronAPI?.onEnsureImageWebview) {
      return;
    }

    const unsubscribe = window.electronAPI.onEnsureImageWebview(async ({ requestId, toolId, threadId }) => {
      try {
        const pageId = threadId ? 'api-webview' : 'image-webview';
        ensurePageVisited(pageId);
        navigateToPage(pageId);

        const handlerReady = await waitForImageGenEnsureHandler(30_000, threadId ? 'api' : 'default');
        if (!handlerReady) {
          window.electronAPI?.reportEnsureImageWebview?.({
            requestId,
            success: false,
            error: '生图页面未就绪',
          });
          return;
        }

        activateImageToolTab(threadId || toolId);
        await sleep(500);

        let result = await runImageGenEnsureHandler(toolId, threadId);
        if (!result.success) {
          for (let i = 0; i < 40 && !result.success; i += 1) {
            await sleep(500);
            result = await runImageGenEnsureHandler(toolId, threadId);
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
