import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'release-ui.spec.ts',
  timeout: 30000,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev:web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
