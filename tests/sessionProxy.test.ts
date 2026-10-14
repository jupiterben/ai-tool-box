import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, test } from 'node:test';
import { relayForPartition, fetchWithSessionProxy, closeSessionProxies } from '../desktop-backend/sessionProxy.ts';
after(closeSessionProxies);

test('authenticated upstream proxies and preset relays stay isolated', async () => {
  const headers: string[] = [];
  const upstream = createServer((req, res) => {
    headers.push(String(req.headers['proxy-authorization'] || ''));
    res.end('proxy result');
  });
  const direct = createServer((_req, res) => res.end('direct result'));
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  await new Promise<void>(resolve => direct.listen(0, '127.0.0.1', resolve));
  try {
    const upstreamPort = (upstream.address() as { port: number }).port;
    const directPort = (direct.address() as { port: number }).port;
    const a = await relayForPartition('preset-a', { mode: 'fixed_servers', proxyRules: `http://user:password@127.0.0.1:${upstreamPort}` });
    const b = await relayForPartition('preset-b', { mode: 'direct' });
    assert.notEqual(a.proxyRules, b.proxyRules);
    assert.equal(await (await fetchWithSessionProxy('preset-a', 'http://test.invalid/image', {})).text(), 'proxy result');
    assert.equal(headers[0], `Basic ${Buffer.from('user:password').toString('base64')}`);
    const switched = await relayForPartition('preset-a', { mode: 'direct' });
    assert.equal(switched.proxyRules, a.proxyRules);
    assert.equal(await (await fetchWithSessionProxy('preset-a', `http://127.0.0.1:${directPort}`, {})).text(), 'direct result');
    await relayForPartition('preset-a', { mode: 'system' });
    assert.equal(await (await fetchWithSessionProxy('preset-a', `http://127.0.0.1:${directPort}`, {})).text(), 'direct result');
  } finally {
    upstream.closeAllConnections();
    direct.closeAllConnections();
    await Promise.all([upstream, direct].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
});
