import { mount } from 'svelte';
import App from './App.svelte';
import { ensureSessionSettingsLoaded } from './hooks/useSessionSettings.svelte';
import './styles/index.css';
import './styles/shadcn.css';
import { initializeDesktopBridge } from './desktop/bridge';

// Resolve session partitions before any guest webview is created.
const root = document.getElementById('root')!;
try {
  await initializeDesktopBridge();
  await ensureSessionSettingsLoaded();
  mount(App, { target: root });
} catch (error) {
  console.error('Desktop initialization failed:', error);
  root.setAttribute('role', 'alert');
  root.textContent = `桌面初始化失败：${String(error)}`;
}
