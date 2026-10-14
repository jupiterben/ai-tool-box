import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ThemeProvider from './components/ThemeProvider';
import './styles/index.css';
import { initializeDesktopBridge } from './desktop/bridge';

const root = document.getElementById('root')!;
try {
await initializeDesktopBridge();
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
} catch (error) {
  root.setAttribute('role', 'alert');
  root.textContent = `桌面初始化失败：${String(error)}`;
}
