export interface EnsureImageWebviewHandlerResult {
  success: boolean;
  webContentsId?: number;
  error?: string;
}

type EnsureImageWebviewHandler = (toolId: string) => Promise<EnsureImageWebviewHandlerResult>;

let ensureHandler: EnsureImageWebviewHandler | null = null;

export function registerImageGenEnsureHandler(handler: EnsureImageWebviewHandler): void {
  ensureHandler = handler;
}

export function unregisterImageGenEnsureHandler(): void {
  ensureHandler = null;
}

export async function runImageGenEnsureHandler(
  toolId: string
): Promise<EnsureImageWebviewHandlerResult> {
  if (!ensureHandler) {
    return { success: false, error: '生图页面未就绪' };
  }
  return ensureHandler(toolId);
}

export const APP_NAVIGATE_EVENT = 'app:navigate';

export function navigateToPage(pageId: string): void {
  window.dispatchEvent(new CustomEvent(APP_NAVIGATE_EVENT, { detail: { pageId } }));
}

export function ensurePageVisited(pageId: string): void {
  window.dispatchEvent(new CustomEvent('app:ensure-visited', { detail: { pageId } }));
}
