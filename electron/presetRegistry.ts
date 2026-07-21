import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { PresetMeta, PresetRegistry } from '../src/types/preset.ts';
import {
  createPresetMeta,
  deletePresetInRegistry,
  ensureRegistryDefaults,
  findPreset,
  renamePresetInRegistry,
} from '../src/utils/presetRegistryCore.ts';

const REGISTRY_FILE = 'preset-registry.json';

function getRegistryPath(): string {
  return join(app.getPath('userData'), REGISTRY_FILE);
}

export async function loadPresetRegistry(): Promise<PresetRegistry> {
  try {
    const raw = await fs.readFile(getRegistryPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PresetRegistry>;
    return ensureRegistryDefaults(parsed);
  } catch {
    return ensureRegistryDefaults(null);
  }
}

export async function savePresetRegistry(registry: PresetRegistry): Promise<void> {
  const normalized = ensureRegistryDefaults(registry);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getRegistryPath(), JSON.stringify(normalized, null, 2), 'utf-8');
}

export async function listPresets(): Promise<PresetMeta[]> {
  const registry = await loadPresetRegistry();
  return registry.presets;
}

export async function getPreset(id: string): Promise<PresetMeta | null> {
  const registry = await loadPresetRegistry();
  return findPreset(registry, id);
}

export async function createPreset(name: string): Promise<PresetMeta> {
  const registry = await loadPresetRegistry();
  const meta = createPresetMeta(name, registry.presets.length);
  registry.presets.push(meta);
  await savePresetRegistry(registry);
  return meta;
}

export async function renamePreset(id: string, name: string): Promise<PresetMeta> {
  const registry = await loadPresetRegistry();
  const next = renamePresetInRegistry(registry, id, name);
  await savePresetRegistry(next);
  const meta = findPreset(next, id);
  if (!meta) {
    throw new Error(`Preset 不存在: ${id}`);
  }
  return meta;
}

export async function deletePreset(id: string): Promise<void> {
  const registry = await loadPresetRegistry();
  const next = deletePresetInRegistry(registry, id);
  await savePresetRegistry(next);
}

export {
  createPresetMeta,
  deletePresetInRegistry,
  ensureRegistryDefaults,
  findPreset,
  renamePresetInRegistry,
} from '../src/utils/presetRegistryCore.ts';
