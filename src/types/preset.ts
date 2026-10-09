export const DEFAULT_PRESET_ID = 'default';
export const PRESET_REGISTRY_VERSION = '1.0.0';

export interface PresetMeta {
  id: string;
  name: string;
  createdAt: number;
  order?: number;
}

export interface PresetRegistry {
  version: string;
  presets: PresetMeta[];
}

export function createDefaultPresetMeta(): PresetMeta {
  return {
    id: DEFAULT_PRESET_ID,
    name: '默认',
    createdAt: 0,
    order: 0,
  };
}
