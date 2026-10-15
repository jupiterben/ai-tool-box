import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
export default defineConfig({
  testDir: './tests',
  testMatch: 'release-ui.spec.ts',
  timeout: 30000,
  workers: 2,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm dev:web --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
