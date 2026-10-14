import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';

export const nativeEvents = new EventEmitter();
const pending = new Map<string, {
  resolve: (value: any) => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();
const output = process.stdout.write.bind(process.stdout);
export function writeMessage(message: unknown): void {
  output(`${JSON.stringify(message)}\n`);
}
export function nativeCall<T = any>(method: string, params: unknown = {}): Promise<T> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Native request timed out: ${method}`));
    }, 180_000);
    pending.set(id, { resolve, reject, timer });
    writeMessage({ type: 'native', id, method, params });
  });
}
export function startRpc(handler: (message: any) => Promise<unknown>): void {
  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    void (async () => {
      const message = JSON.parse(line);
      if (message.type === 'native-result') {
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) entry.reject(new Error(message.error));
        else entry.resolve(message.result);
      } else if (message.type === 'event') {
        nativeEvents.emit(message.event, message.payload);
      } else if (message.type === 'request') {
        try {
          writeMessage({ type: 'result', id: message.id, result: await handler(message) });
        } catch (error) {
          writeMessage({ type: 'result', id: message.id, error: String(error) });
        }
      }
    })().catch((error) => console.error('[rpc]', error));
  });
  lines.on('close', () => process.exit(0));
}
