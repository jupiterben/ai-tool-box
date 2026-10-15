<script lang="ts">
  import { createTheme } from '../state/theme.svelte';
  import Icon from './ui/Icon.svelte';
  import styles from './ThemeToggle.module.css';
  let { className = '' }: { className?: string } = $props();
  const themeState = createTheme();
  let theme = $derived(themeState.theme);
  let toggleTheme = $derived(themeState.toggleTheme);
</script>

<button
  class={`${styles.toggle} ${className}`.trim()}
  onclick={toggleTheme}
  aria-label={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
  title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
>
  {#if theme === 'light'}<Icon name="Moon" size={20} aria-hidden="true"
    ></Icon>{:else}<Icon name="Sun" size={20} aria-hidden="true"></Icon>{/if}
</button>
