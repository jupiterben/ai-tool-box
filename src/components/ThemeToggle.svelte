<script lang="ts">
  import { useTheme } from '../hooks/useTheme.svelte';
  import Icon from './ui/Icon.svelte';
  import styles from './ThemeToggle.module.css';
  const useThemeState = useTheme();
  let theme = $derived(useThemeState.theme);
  let toggleTheme = $derived(useThemeState.toggleTheme);
</script>

<button
  class={styles.toggle}
  onclick={toggleTheme}
  aria-label={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
  title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
>
  {#if theme === 'light'}<Icon name="Moon" size={20} aria-hidden="true"
    ></Icon>{:else}<Icon name="Sun" size={20} aria-hidden="true"></Icon>{/if}
</button>
