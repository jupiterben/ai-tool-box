import { useCallback, useState } from 'react';

const STORAGE_KEY = 'response-summary-panel-width';
export const DEFAULT_SUMMARY_PANEL_SIZE = 380;
export const MIN_SUMMARY_PANEL_SIZE = 280;
export const MAX_SUMMARY_PANEL_RATIO = 0.7;

function clampSize(size: number): number {
  const maxSize = Math.floor(window.innerWidth * MAX_SUMMARY_PANEL_RATIO);
  return Math.min(Math.max(size, MIN_SUMMARY_PANEL_SIZE), maxSize);
}

function readStoredSize(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SUMMARY_PANEL_SIZE;
    const parsed = Number(saved);
    if (!Number.isFinite(parsed)) return DEFAULT_SUMMARY_PANEL_SIZE;
    return clampSize(parsed);
  } catch {
    return DEFAULT_SUMMARY_PANEL_SIZE;
  }
}

export function useSummaryPanelSize() {
  const [size, setSize] = useState(() => readStoredSize());

  const updateSize = useCallback((nextSize: number) => {
    const clamped = clampSize(nextSize);
    setSize(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // ignore storage errors
    }
  }, []);

  return { size, updateSize };
}
