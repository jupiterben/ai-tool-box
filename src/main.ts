import { mount } from 'svelte';
import App from './App.svelte';
import { ensureSessionSettingsLoaded } from './hooks/useSessionSettings.svelte';
import './styles/index.css';

// Resolve session partitions before any guest webview is created.
await ensureSessionSettingsLoaded();
mount(App, { target: document.getElementById('root')! });
