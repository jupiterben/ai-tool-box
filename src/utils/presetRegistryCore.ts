import {
  DEFAULT_PRESET_ID,
  PRESET_REGISTRY_VERSION,
  createDefaultPresetMeta,
  type PresetMeta,
  type PresetRegistry,
} from '../types/preset.ts';

export function ensureRegistryDefaults(
  input: Partial<PresetRegistry> | null | undefined
): PresetRegistry {
  const presets = Array.isArray(input?.presets) ? [...input.presets] : [];
  if (!presets.some((p) => p.id === DEFAULT_PRESET_ID)) {
    presets.unshift(createDefaultPresetMeta());
  }
  return {
    version: input?.version || PRESET_REGISTRY_VERSION,
    presets,
  };
}

export function createPresetMeta(name: string, order?: number): PresetMeta {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Preset 名称不能为空');
  }
  return {
    id: `preset-${crypto.randomUUID()}`,
    name: trimmed,
    createdAt: Date.now(),
    order,
  };
}

export function renamePresetInRegistry(
  registry: PresetRegistry,
  id: string,
  name: string
): PresetRegistry {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Preset 名称不能为空');
  }
  const index = registry.presets.findIndex((p) => p.id === id);
  if (index < 0) {
    throw new Error(`Preset 不存在: ${id}`);
  }
  const presets = [...registry.presets];
  presets[index] = { ...presets[index], name: trimmed };
  return { ...registry, presets };
}

export function deletePresetInRegistry(registry: PresetRegistry, id: string): PresetRegistry {
  if (id === DEFAULT_PRESET_ID) {
    throw new Error('不可删除默认 Preset');
  }
  if (!registry.presets.some((p) => p.id === id)) {
    throw new Error(`Preset 不存在: ${id}`);
  }
  return {
    ...registry,
    presets: registry.presets.filter((p) => p.id !== id),
  };
}

export function findPreset(registry: PresetRegistry, id: string): PresetMeta | null {
  return registry.presets.find((p) => p.id === id) ?? null;
}
