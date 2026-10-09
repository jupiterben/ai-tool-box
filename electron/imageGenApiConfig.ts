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

export function getApiWorkerCount(): number {
  return getApiDefaultWorkerCount();
}

function normalizeWorkerCount(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const count = Number(raw);
  if (!Number.isFinite(count)) {
    return fallback;
  }

  return Math.min(Math.max(1, Math.floor(count)), 16);
}

function normalizeEnvToolId(toolId: string): string {
  return toolId.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function getToolWorkerCountFromJson(toolId: string): number | null {
  const raw = process.env.AI_TOOLBOX_API_TOOL_THREADS?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[toolId] ?? parsed[normalizeEnvToolId(toolId)];
    if (typeof value === 'number' || typeof value === 'string') {
      return normalizeWorkerCount(String(value), getApiDefaultWorkerCount());
    }
  } catch {
    // ignore invalid JSON and fall back to env/default settings
  }

  return null;
}

export function getApiDefaultWorkerCount(): number {
  const defaultWorkerCount = 2;
  const raw =
    process.env.AI_TOOLBOX_API_DEFAULT_THREADS?.trim() ||
    process.env.AI_TOOLBOX_API_DEFAULT_WORKERS?.trim() ||
    process.env.AI_TOOLBOX_API_THREADS?.trim() ||
    process.env.AI_TOOLBOX_API_WORKERS?.trim();

  return normalizeWorkerCount(raw, defaultWorkerCount);
}

export function getApiToolWorkerCount(toolId: string): number {
  const normalizedToolId = normalizeEnvToolId(toolId);
  const explicit =
    process.env[`AI_TOOLBOX_API_THREADS_${normalizedToolId}`]?.trim() ||
    process.env[`AI_TOOLBOX_API_WORKERS_${normalizedToolId}`]?.trim();

  if (explicit) {
    return normalizeWorkerCount(explicit, getApiDefaultWorkerCount());
  }

  const jsonCount = getToolWorkerCountFromJson(toolId);
  if (jsonCount != null) {
    return jsonCount;
  }

  return getApiDefaultWorkerCount();
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
