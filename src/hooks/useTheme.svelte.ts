import { getContext, setContext } from 'svelte';
import { THEME_STORAGE_KEY } from '../utils/settingsStorage';
export type Theme = 'light' | 'dark';
type ThemeState = {
  readonly theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};
const key = Symbol('theme');

export function useTheme(): ThemeState {
  const existing = getContext<ThemeState | undefined>(key);
  if (existing) return existing;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  let manual = saved === 'light' || saved === 'dark';
  let theme = $state<Theme>(
    manual ? (saved as Theme) : media.matches ? 'dark' : 'light',
  );
  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });
  $effect(() => {
    const change = (event: MediaQueryListEvent) => {
      if (!manual) theme = event.matches ? 'dark' : 'light';
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  });
  function setTheme(value: Theme) {
    manual = true;
    theme = value;
    localStorage.setItem(THEME_STORAGE_KEY, value);
  }
  const state = {
    get theme() {
      return theme;
    },
    setTheme,
    toggleTheme: () => setTheme(theme === 'light' ? 'dark' : 'light'),
  };
  return setContext(key, state);
}
