import { format } from 'node:util';
import { startRpc, writeMessage } from './rpc.js';
import { dispatch } from './runtime.js';
// stdout is a private transport; all diagnostic messages go to stderr.
console.log = (...args) => { process.stderr.write(`${format(...args)}\n`); };
console.info = console.log;
console.warn = console.log;
console.error = console.log;
startRpc(async (message) => {
  await ready;
  return dispatch(message.channel, message.presetId, message.payload);
});
const ready = import('./main.js').then((module) => module.startApplication());
ready.then(() => writeMessage({ type: 'ready' })).catch((error) => {
  console.error(error);
  writeMessage({ type: 'fatal', error: String(error) });
  process.exit(1);
});
