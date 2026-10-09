export interface EnsureImageWebviewHandlerResult {
  success: boolean;
  webContentsId?: number;
  error?: string;
}

type EnsureImageWebviewHandler = (
  toolId: string,
  threadId?: string
) => Promise<EnsureImageWebviewHandlerResult>;

type EnsureHandlerScope = 'default' | 'api';

const ensureHandlers: Partial<Record<EnsureHandlerScope, EnsureImageWebviewHandler>> = {};

export function registerImageGenEnsureHandler(
  handler: EnsureImageWebviewHandler,
  scope: EnsureHandlerScope = 'default'
): void {
  ensureHandlers[scope] = handler;
}

export function unregisterImageGenEnsureHandler(scope: EnsureHandlerScope = 'default'): void {
  delete ensureHandlers[scope];
}

export async function runImageGenEnsureHandler(
  toolId: string,
  threadId?: string
): Promise<EnsureImageWebviewHandlerResult> {
  const ensureHandler = threadId ? ensureHandlers.api : ensureHandlers.default || ensureHandlers.api;
  if (!ensureHandler) {
    return { success: false, error: '生图页面未就绪' };
  }
  return ensureHandler(toolId, threadId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 等待生图页挂载并注册 ensure handler */
export async function waitForImageGenEnsureHandler(
  timeoutMs = 30_000,
  scope: EnsureHandlerScope = 'default'
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ensureHandlers[scope]) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

export const APP_NAVIGATE_EVENT = 'app:navigate';
export const ACTIVATE_IMAGE_TOOL_EVENT = 'app:activate-image-tool';

export function navigateToPage(pageId: string): void {
  window.dispatchEvent(new CustomEvent(APP_NAVIGATE_EVENT, { detail: { pageId } }));
}

export function ensurePageVisited(pageId: string): void {
  window.dispatchEvent(new CustomEvent('app:ensure-visited', { detail: { pageId } }));
}

/** API 生图前将指定工具的 webview tab 切到前台 */
export function activateImageToolTab(toolId: string): void {
  window.dispatchEvent(
    new CustomEvent(ACTIVATE_IMAGE_TOOL_EVENT, { detail: { toolId } })
  );
}
