import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { TauriWebViewElement } from '../types/ui';

interface NativeState {
  id: number; label: string; kind: string; url?: string;
  canGoBack?: boolean; canGoForward?: boolean;
}
export function mountGuest(
  host: HTMLElement,
  options: { src: string; partition?: string; toolId: string; threadId?: string },
  attach: (element: TauriWebViewElement | null) => void,
  fail: (message: string) => void,
): () => void {
  const label = `guest-${crypto.randomUUID()}`;
  const element = host as TauriWebViewElement & { getWebContentsId: () => number };
  let disposed = false, created = false, loaded = false;
  let id = 0, source = options.src, back = false, forward = false;
  let frame = 0, previous = '', unlisten: (() => void) | undefined;
  const onError = (error: unknown) => { if (!disposed) fail(String(error)); };
  const call = (action: string, payload?: unknown) =>
    invoke('guest_call', { label, action, payload: payload ?? null });
  element.getWebContentsId = () => loaded ? id : 0;
  element.executeJavaScript = (script) => call('eval', script);
  element.reload = () => { void call('reload').catch(onError); };
  element.goBack = () => { void call('back').catch(onError); };
  element.goForward = () => { void call('forward').catch(onError); };
  element.canGoBack = () => back;
  element.canGoForward = () => forward;
  element.isLoading = true;
  Object.defineProperty(element, 'src', {
    configurable: true, get: () => source,
    set: (url: string) => {
      source = url;
      if (url && created) void call('navigate', url).catch(onError);
    },
  });
  function bounds() {
    const rect = host.getBoundingClientRect();
    const visible = host.checkVisibility({ checkVisibilityCSS: true }) &&
      !host.closest('[aria-hidden="true"], [inert], [data-resizing="true"]') &&
      rect.width > 0 && rect.height > 0;
    return {
      x: Math.max(0, rect.x), y: Math.max(0, rect.y),
      width: Math.max(1, rect.width), height: Math.max(1, rect.height), visible: !!visible,
    };
  }
  async function sync() {
    if (disposed) return;
    const current = bounds(), serialized = JSON.stringify(current);
    if (serialized !== previous) {
      try { await invoke('guest_bounds', { label, bounds: current }); previous = serialized; }
      catch (error) { onError(error); }
    }
    if (!disposed) frame = requestAnimationFrame(() => { void sync(); });
  }
  attach(element);
  void (async () => {
    unlisten = await listen<NativeState>('guest-state', ({ payload }) => {
      if (payload.label !== label || disposed) return;
      if (payload.url) source = payload.url;
      if (payload.canGoBack !== undefined) back = payload.canGoBack;
      if (payload.canGoForward !== undefined) forward = payload.canGoForward;
      if (payload.kind === 'loading') { element.isLoading = true; }
      if (payload.kind === 'loaded') {
        id = payload.id; loaded = true; element.isLoading = false;
        element.dispatchEvent(new Event('dom-ready'));
        element.dispatchEvent(new Event('did-finish-load'));
      }
      if (payload.kind === 'loaded' || payload.kind === 'navigation')
        element.dispatchEvent(new Event('did-navigate'));
    });
    if (disposed) { unlisten(); return; }
    id = await invoke<number>('create_guest', {
      label, ...options, partition: options.partition ?? null, threadId: options.threadId ?? null, bounds: bounds(),
    });
    created = true;
    if (disposed) { await invoke('close_guest', { label }); return; }
    void sync();
  })().catch(onError);
  return () => {
    disposed = true; cancelAnimationFrame(frame); unlisten?.(); attach(null);
    if (created) void invoke('close_guest', { label }).catch(console.error);
  };
}
