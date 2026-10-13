import { DEFAULT_PRESET_ID } from '../types/preset';

export function usePresetId(): string {
  if (typeof window !== 'undefined' && window.desktopAPI?.getPresetId) {
    return window.desktopAPI.getPresetId();
  }
  return DEFAULT_PRESET_ID;
}
