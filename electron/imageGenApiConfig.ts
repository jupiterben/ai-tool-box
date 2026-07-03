import { networkInterfaces } from 'node:os';
import { IMAGE_GEN_API_PORT } from '../src/types/image-gen-api.js';

export function getApiBindHost(): string {
  const host = process.env.AI_TOOLBOX_API_HOST?.trim();
  if (host) {
    return host;
  }

  const lan = process.env.AI_TOOLBOX_API_LAN?.trim().toLowerCase();
  if (lan === '0' || lan === 'false' || lan === 'no') {
    return '127.0.0.1';
  }

  return '0.0.0.0';
}

export function isLanBindHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::';
}

export function getApiPort(): number {
  const raw = process.env.AI_TOOLBOX_API_PORT?.trim();
  if (!raw) {
    return IMAGE_GEN_API_PORT;
  }
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 && port < 65536 ? port : IMAGE_GEN_API_PORT;
}

export function getLanIPv4Addresses(): string[] {
  const addresses = new Set<string>();

  for (const entries of Object.values(networkInterfaces())) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      addresses.add(entry.address);
    }
  }

  return [...addresses];
}

export function formatApiAccessUrls(host: string, port: number): string[] {
  const urls = [`http://127.0.0.1:${port}`];

  if (isLanBindHost(host)) {
    for (const ip of getLanIPv4Addresses()) {
      urls.push(`http://${ip}:${port}`);
    }
  }

  return urls;
}
