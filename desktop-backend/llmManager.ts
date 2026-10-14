import { app } from './runtime.js';
import { nativeCall } from './rpc.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  LLM_SETTINGS_VERSION,
  createDefaultLlmSettings,
  type LlmSettings,
  type LlmSettingsInput,
} from '../src/types/llm-settings';

const SETTINGS_FILE = 'llm-settings.json';

interface StoredLlmSettings {
  version: string;
  enabled: boolean;
  provider: LlmSettings['provider'];
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE);
}

async function readApiKey(): Promise<string | null> {
  return nativeCall('credential:get');
}

async function writeApiKey(apiKey: string): Promise<void> {
  await nativeCall('credential:set', { value: apiKey.trim() });
}

function toPublicSettings(stored: StoredLlmSettings): LlmSettings {
  return {
    ...stored,
    hasApiKey: false,
  };
}

async function loadStoredSettings(): Promise<StoredLlmSettings> {
  const defaults = createDefaultLlmSettings();
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredLlmSettings>;
    return {
      version: LLM_SETTINGS_VERSION,
      enabled: parsed.enabled ?? defaults.enabled,
      provider: parsed.provider ?? defaults.provider,
      baseUrl: parsed.baseUrl,
      model: parsed.model ?? defaults.model,
      temperature: parsed.temperature ?? defaults.temperature,
      maxTokens: parsed.maxTokens ?? defaults.maxTokens,
    };
  } catch {
    return {
      version: defaults.version,
      enabled: defaults.enabled,
      provider: defaults.provider,
      baseUrl: defaults.baseUrl,
      model: defaults.model,
      temperature: defaults.temperature,
      maxTokens: defaults.maxTokens,
    };
  }
}

export async function loadLlmSettings(): Promise<LlmSettings> {
  const stored = await loadStoredSettings();
  const apiKey = await readApiKey();
  return {
    ...toPublicSettings(stored),
    hasApiKey: !!apiKey,
  };
}

export async function saveLlmSettings(input: LlmSettingsInput): Promise<LlmSettings> {
  const stored: StoredLlmSettings = {
    version: LLM_SETTINGS_VERSION,
    enabled: input.enabled,
    provider: input.provider,
    baseUrl: input.baseUrl?.trim() || undefined,
    model: input.model.trim(),
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  };

  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(stored, null, 2), 'utf-8');

  if (input.apiKey !== undefined) {
    await writeApiKey(input.apiKey);
  }

  const apiKey = await readApiKey();
  return {
    ...toPublicSettings(stored),
    hasApiKey: !!apiKey,
  };
}

export async function getLlmApiKey(): Promise<string | null> {
  return readApiKey();
}
