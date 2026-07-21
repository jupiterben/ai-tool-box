import { DEFAULT_PRESET_ID } from '../src/types/preset.js';
import { getPresetPartition } from '../src/utils/toolPartition.js';
import { getFocusedPresetId } from './presetWindowManager.js';

export function resolveActivePresetId(): string {
  return getFocusedPresetId() ?? DEFAULT_PRESET_ID;
}

export function getActivePresetPartition(): string {
  return getPresetPartition(resolveActivePresetId());
}
