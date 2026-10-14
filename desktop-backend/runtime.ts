import { EventEmitter } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import { nativeCall, nativeEvents } from './rpc.js';
import { relayForPartition, fetchWithSessionProxy } from './sessionProxy.js';

export const requestPreset = new AsyncLocalStorage<string>();
export interface IpcEvent { sender: WebContents; presetId: string }
const handlers = new Map<string, (event: IpcEvent, payload: any) => unknown>();
export const ipcMain = Object.assign(new EventEmitter(), {
  handle(channel: string, handler: (event: IpcEvent, payload: any) => unknown) {
    handlers.set(channel, handler);
  },
});
export async function dispatch(channel: string, presetId: string, payload: any) {
  if (!presets.has(presetId)) throw new Error('Preset window is closed');
  return requestPreset.run(presetId, async () => {
    const event = { presetId, sender: presets.get(presetId)!.webContents };
    if (channel === 'image-gen:ensure-webview-result') {
      const guest = webContents.fromId(payload?.webContentsId);
      if (payload?.success && guest?.presetId !== presetId) throw new Error('Guest belongs to another preset');
      ipcMain.emit(channel, event, payload);
      return { success: true };
    }
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Unknown desktop command: ${channel}`);
    if (channel === 'webview:send-input') {
      payload = { ...payload, partition: `persist:preset-${presetId}` };
    }
    if (payload?.webContentsId && webContents.fromId(payload.webContentsId)?.presetId !== presetId)
      throw new Error('Guest belongs to another preset');
    for (const id of Object.values(payload?.webContentsIds ?? {})) {
      if (webContents.fromId(id as number)?.presetId !== presetId) throw new Error('Guest belongs to another preset');
    }
    return await handler(event, payload);
  });
}

class Application extends EventEmitter {
  isPackaged = process.env.AI_TOOLBOX_PACKAGED === '1';
  private userData = process.env.AI_TOOLBOX_DATA_DIR || '';
  getPath(name: string): string {
    if (name !== 'userData' || !this.userData) throw new Error(`Unsupported app path: ${name}`);
    return this.userData;
  }
  setPath(name: string, path: string): void {
    if (name !== 'userData') throw new Error('Unsupported app path');
    this.userData = path;
  }
  whenReady() { return Promise.resolve(); }
  quit() { void nativeCall('app:quit'); }
}
export const app = new Application();

const sessions = new Map<string, Session>();
export class Session {
  partition: string;
  proxy: { mode: string; proxyRules?: string } = { mode: 'system' };
  constructor(partition: string) { this.partition = partition; }
  async setProxy(config: { mode: string; proxyRules?: string; proxyBypassRules?: string }) {
    const relay = await relayForPartition(this.partition, config);
    await nativeCall('session:proxy', { partition: this.partition, ...relay });
    this.proxy = config;
  }
  async clearStorageData() { await nativeCall('session:clear', { partition: this.partition }); }
  async clearCache() { /* Included in clearStorageData. */ }
  async clearAuthCache() { /* Included in clearStorageData. */ }
  async clearCodeCaches(_options: object) { /* Included in clearStorageData. */ }
  setPermissionRequestHandler(_handler: (_wc: WebContents, permission: string, callback: (allow: boolean) => void) => void) {}
  setPermissionCheckHandler(_handler: (_wc: WebContents, permission: string) => boolean) {}
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const cookies = await nativeCall<Array<{ name: string; value: string }>>('session:cookies', {
      partition: this.partition, url,
    });
    const headers = new Headers(options.headers);
    if (cookies.length) headers.set('Cookie', cookies.map((c) => `${c.name}=${c.value}`).join('; '));
    // Do not forward session credentials to a different redirect origin.
    let current = url;
    for (let redirect = 0; redirect < 10; redirect++) {
      const response = await fetchWithSessionProxy(this.partition, current, { ...options, headers, redirect: 'manual' });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get('location');
      if (!location) return response;
      const next = new URL(location, current);
      if (!['http:', 'https:'].includes(next.protocol)) throw new Error('Invalid download redirect');
      if (next.origin !== new URL(current).origin) {
        headers.delete('Cookie'); headers.delete('Authorization');
      }
      current = next.href;
      await response.body?.cancel();
    }
    throw new Error('Too many download redirects');
  }
}
export const session = {
  fromPartition(partition: string) {
    if (!sessions.has(partition)) sessions.set(partition, new Session(partition));
    return sessions.get(partition)!;
  },
};

class Debugger extends EventEmitter {
  private attached = false;
  constructor(private contents: WebContents) { super(); }
  isAttached() { return this.attached; }
  attach(_version?: string) { this.attached = true; }
  detach() { this.attached = false; }
  async sendCommand(method: string, params: unknown = {}): Promise<any> {
    return nativeCall('guest:cdp', { id: this.contents.id, method, params });
  }
}
const contents = new Map<number, WebContents>();
export class WebContents extends EventEmitter {
  id: number;
  presetId: string;
  session: Session;
  debugger: Debugger;
  private url: string;
  private destroyed = false;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(info: { id: number; presetId: string; partition: string; url: string }) {
    super();
    this.id = info.id; this.presetId = info.presetId; this.url = info.url;
    this.session = session.fromPartition(info.partition);
    this.debugger = new Debugger(this);
    contents.set(this.id, this);
  }
  isDestroyed() { return this.destroyed; }
  getType() { return 'webview'; }
  getURL() { return this.url; }
  getTitle() { return this.url; }
  async executeJavaScript(script: string): Promise<any> {
    await this.queue;
    return nativeCall('guest:eval', { id: this.id, script });
  }
  sendInputEvent(event: Record<string, unknown>) {
    this.queue = this.queue.then(() => nativeCall('guest:input', { id: this.id, event }));
    void this.queue.catch((error) => console.error('[input]', error));
  }
  insertText(text: string) {
    this.queue = this.queue.then(() => this.debugger.sendCommand('Input.insertText', { text }));
    void this.queue.catch((error) => console.error('[input]', error));
  }
  async loadURL(url: string) { await nativeCall('guest:navigate', { id: this.id, url }); }
  reload() { void nativeCall('guest:reload', { id: this.id }).catch(console.error); }
  send(event: string, payload: unknown) {
    void nativeCall('window:emit', { presetId: this.presetId, event, payload }).catch(console.error);
  }
  async capturePage() {
    const result = await this.debugger.sendCommand('Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(result.data, 'base64');
    return { toPNG: () => png, getSize: () => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }) };
  }
  update(url?: string) { if (url) this.url = url; }
  destroy() { this.destroyed = true; contents.delete(this.id); this.emit('destroyed'); }
}
export const webContents = {
  fromId: (id: number) => contents.get(id) ?? null,
  getAllWebContents: () => [...contents.values()],
};

const presets = new Map<string, BrowserWindow>();
let focusedPreset = 'default';
let windowId = -1;
export class BrowserWindow extends EventEmitter {
  webContents: WebContents;
  constructor(public presetId: string) {
    super();
    this.webContents = new WebContents({
      id: windowId--, presetId, partition: `ui:${presetId}`, url: '',
    });
    presets.set(presetId, this);
  }
  static getFocusedWindow() { return presets.get(requestPreset.getStore() ?? focusedPreset) ?? null; }
  static getAllWindows() { return [...presets.values()]; }
  isDestroyed() { return !presets.has(this.presetId); }
  isMinimized() { return false; }
  restore() { this.focus(); }
  focus() { void nativeCall('window:focus', { presetId: this.presetId }).catch(console.error); }
  async close() { await nativeCall('window:close', { presetId: this.presetId }); this.closed(); }
  async setTitle(title: string) { await nativeCall('window:title', { presetId: this.presetId, title }); }
  closed() {
    if (this.isDestroyed()) return;
    presets.delete(this.presetId);
    this.webContents.destroy();
    this.emit('closed');
  }
}
nativeEvents.on('guest-created', (info) => {
  const wc = new WebContents(info);
  app.emit('web-contents-created', {}, wc);
});
nativeEvents.on('guest-state', ({ id, kind, url }) => {
  const wc = contents.get(id);
  if (!wc) return;
  wc.update(url);
  if (kind === 'closed') wc.destroy();
  else if (kind === 'loaded') wc.emit('did-finish-load');
});
nativeEvents.on('guest-cdp', ({ id, method, params }) => {
  contents.get(id)?.debugger.emit('message', {}, method, params);
});
nativeEvents.on('window-focused', ({ presetId }) => { focusedPreset = presetId; });
nativeEvents.on('window-closed', ({ presetId }) => { presets.get(presetId)?.closed(); });
