import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  LLM_SETTINGS_VERSION,
  createDefaultLlmSettings,
  type LlmSettings,
  type LlmSettingsInput,
} from '../src/types/llm-settings';

const SETTINGS_FILE = 'llm-settings.json';
const API_KEY_FILE = 'llm-api-key.enc';

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

function getApiKeyPath(): string {
  return join(app.getPath('userData'), API_KEY_FILE);
}

async function readApiKey(): Promise<string | null> {
  try {
    const encrypted = await fs.readFile(getApiKeyPath());
    if (!safeStorage.isEncryptionAvailable()) {
      return encrypted.toString('utf-8');
    }
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

async function writeApiKey(apiKey: string): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const trimmed = apiKey.trim();
  if (!trimmed) {
    try {
      await fs.unlink(getApiKeyPath());
    } catch {
      // ignore missing file
    }
    return;
  }

  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(trimmed)
    : Buffer.from(trimmed, 'utf-8');
  await fs.writeFile(getApiKeyPath(), data);
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
