import { mount } from 'svelte';
import App from './App.svelte';
import './styles/index.css';
import { initializeDesktopBridge } from './desktop/bridge';

const root = document.getElementById('root')!;
try {
  await initializeDesktopBridge();
  mount(App, { target: root });
} catch (error) {
  root.setAttribute('role', 'alert');
  root.textContent = `桌面初始化失败：${String(error)}`;
}
