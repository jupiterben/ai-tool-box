import { untrack } from 'svelte';

import { THEME_STORAGE_KEY } from '../utils/settingsStorage';
export type Theme = 'light' | 'dark';
export function createTheme() {
  let theme: Theme = $state.raw(
    (() => {
      // 从 localStorage 读取保存的主题
      const savedTheme = localStorage.getItem(
        THEME_STORAGE_KEY,
      ) as Theme | null;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        return savedTheme;
      }

      // 如果没有保存的主题，使用系统偏好
      if (
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark';
      }

      return 'light';
    })(),
  );
  function setThemeState(
    next: typeof theme | ((previous: typeof theme) => typeof theme),
  ) {
    theme = typeof next === 'function' ? untrack(() => next(theme)) : next;
  }
  $effect(() => {
    void theme;
    return untrack(() => {
      const root = document.documentElement;
      root.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    });
  });
  $effect(() => {
    return untrack(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        // 只有在用户没有手动设置主题时才跟随系统
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (!savedTheme) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      };

      // 现代浏览器
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else {
        // 兼容旧浏览器
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    });
  });
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };
  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };
  return {
    get theme() {
      return theme;
    },
    get setTheme() {
      return setTheme;
    },
    get toggleTheme() {
      return toggleTheme;
    },
  };
}
