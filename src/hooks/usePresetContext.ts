import { DEFAULT_PRESET_ID } from '../types/preset';

export function usePresetId(): string {
  if (typeof window !== 'undefined' && window.electronAPI?.getPresetId) {
    return window.electronAPI.getPresetId();
  }
  return DEFAULT_PRESET_ID;
}
