import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type DesktopWebViewElement = HTMLElement & {
  src: string;
  isLoading: boolean;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  getWebContentsId: () => number;
  executeJavaScript: (code: string) => Promise<unknown>;
};

interface Guest {
  label: string;
  toolId: string;
  id: number;
}
interface GuestEvent {
  label: string;
  kind: string;
  url?: string;
}
const guests = new Map<number, Guest>();
let nextId = 1;

export function findGuest(toolId: string, id?: number): Guest | undefined {
  if (id !== undefined) {
    const guest = guests.get(id);
    return guest?.toolId === toolId ? guest : undefined;
  }
  return [...guests.values()].find((guest) => guest.toolId === toolId);
}

export function evaluateGuest(label: string, script: string): Promise<unknown> {
  return invoke('evaluate_guest', { label, script });
}

// CSS cannot hide native child webviews. Keep their bounds and visibility in sync
// with a DOM anchor, which also preserves the existing site-handler interface.
export function mountGuest(
  host: HTMLElement,
  options: { src: string; toolId: string; partition: string; incognito: boolean },
  onElement: (element: DesktopWebViewElement) => () => void,
  onError: (message: string) => void,
): () => void {
  const id = nextId++;
  const label = `guest-${crypto.randomUUID()}`;
  const element = host as DesktopWebViewElement;
  let disposed = false;
  let created = false;
  let source = options.src;
  let historyIndex = 0;
  const history = [source];
  let historyTarget: number | null = null;
  let lastBounds = '';
  let frame = 0;
  let unlisten: (() => void) | undefined;
  let cleanup: (() => void) | undefined;
  let synchronizing = false;
  const fail = (error: unknown) => { if (!disposed) onError(String(error)); };
  const action = (action: string, url?: string) =>
    invoke('guest_action', { label, action, url: url ?? null });
  Object.defineProperty(element, 'src', {
    configurable: true,
    get: () => source,
    set: (url: string) => {
      source = url;
      if (created) void action('navigate', url).catch(fail);
    },
  });
  element.isLoading = true;
  element.executeJavaScript = (script) => evaluateGuest(label, script);
  element.getWebContentsId = () => id;
  element.reload = () => { void action('reload').catch(fail); };
  element.canGoBack = () => historyIndex > 0;
  element.canGoForward = () => historyIndex < history.length - 1;
  element.goBack = () => {
    if (historyIndex > 0) {
      historyTarget = historyIndex - 1;
      void action('back').catch(fail);
    }
  };
  element.goForward = () => {
    if (historyIndex < history.length - 1) {
      historyTarget = historyIndex + 1;
      void action('forward').catch(fail);
    }
  };

  function bounds() {
    const rect = host.getBoundingClientRect();
    const visible = host.checkVisibility({ checkVisibilityCSS: true }) &&
      !host.closest('[inert], [aria-hidden="true"], .dragging') &&
      rect.width > 0 && rect.height > 0;
    return {
      x: Math.max(0, rect.x), y: Math.max(0, rect.y),
      width: Math.max(1, Math.min(rect.width, innerWidth - rect.x)),
      height: Math.max(1, Math.min(rect.height, innerHeight - rect.y)),
      visible: !!visible,
    };
  }

  async function syncBounds() {
    if (disposed) return;
    // Serialize updates so late show/resize requests cannot overtake hide.
    if (created && !synchronizing) {
      const current = bounds();
      const serialized = JSON.stringify(current);
      if (serialized !== lastBounds) {
        synchronizing = true;
        try {
          await invoke('update_guest_bounds', { label, bounds: current });
          lastBounds = serialized;
        } catch (error) { fail(error); }
        finally { synchronizing = false; }
      }
    }
    if (!disposed) frame = requestAnimationFrame(() => { void syncBounds(); });
  }

  void (async () => {
    unlisten = await listen<GuestEvent>('guest-state', ({ payload }) => {
      if (payload.label !== label || disposed) return;
      if (payload.url && payload.kind === 'loaded') {
        source = payload.url;
        if (historyTarget !== null) {
          historyIndex = historyTarget;
          history[historyIndex] = source;
          historyTarget = null;
        } else if (source !== history[historyIndex]) {
          history.splice(historyIndex + 1);
          history.push(source);
          historyIndex = history.length - 1;
        }
      }
      element.isLoading = payload.kind === 'loading';
      if (payload.kind === 'loaded') {
        element.dispatchEvent(new Event('dom-ready'));
        element.dispatchEvent(new Event('did-finish-load'));
        element.dispatchEvent(new Event('did-navigate'));
      }
    });
    if (disposed) { unlisten(); return; }
    cleanup = onElement(element);
    guests.set(id, { label, toolId: options.toolId, id });
    await invoke('create_guest', { label, ...options, bounds: bounds() });
    created = true;
    if (disposed) {
      await invoke('close_guest', { label });
      return;
    }
    void syncBounds();
  })().catch(fail);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    unlisten?.();
    cleanup?.();
    guests.delete(id);
    if (created) void invoke('close_guest', { label }).catch(console.error);
  };
}
