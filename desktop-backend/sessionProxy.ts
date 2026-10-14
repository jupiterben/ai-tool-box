import { Server } from 'proxy-chain';
import { ProxyAgent, fetch as proxyFetch } from 'undici';

interface Relay { server: Server; upstream?: string; agent: ProxyAgent }
const relays = new Map<string, Relay>();
const active = new Set<string>();
export async function closeSessionProxies(): Promise<void> {
  await Promise.all([...relays.values()].map(async (relay) => {
    await relay.agent.close();
    await relay.server.close(true);
  }));
  relays.clear();
  active.clear();
}
export async function relayForPartition(
  partition: string, config: { mode: string; proxyRules?: string },
): Promise<{ mode: string; proxyRules?: string }> {
  if (config.mode === 'system') { active.delete(partition); return { mode: 'system' }; }
  let upstream: string | undefined;
  if (config.mode === 'fixed_servers') {
    const url = new URL(config.proxyRules || '');
    if (!['http:', 'https:', 'socks5:'].includes(url.protocol)) throw new Error('Unsupported proxy protocol');
    upstream = url.href;
  }
  let relay = relays.get(partition);
  if (!relay) {
    const server = new Server({
      host: '127.0.0.1', port: 0,
      prepareRequestFunction: () => ({ upstreamProxyUrl: relays.get(partition)?.upstream }),
    });
    await server.listen();
    relay = { server, upstream, agent: new ProxyAgent(`http://127.0.0.1:${server.port}`) };
    relays.set(partition, relay);
  }
  relay.upstream = upstream;
  active.add(partition);
  return { mode: 'fixed_servers', proxyRules: `http://127.0.0.1:${relay.server.port}` };
}
export async function fetchWithSessionProxy(partition: string, url: string, options: RequestInit): Promise<Response> {
  const relay = relays.get(partition);
  if (!relay || !active.has(partition)) return fetch(url, options);
  return await proxyFetch(url, { ...options, dispatcher: relay.agent } as Parameters<typeof proxyFetch>[1]) as unknown as Response;
}
