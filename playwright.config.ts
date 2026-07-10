import { defineConfig, devices } from '@playwright/test';

const requestedChannel = process.env.PLAYWRIGHT_CHANNEL || 'chrome';
const channel = requestedChannel === 'bundled' ? undefined : requestedChannel;
const databaseExplorerUrl = process.env.DATABASE_EXPLORER_URL || 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests',
  outputDir: 'artifacts/playwright-output',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-html-report', open: 'never' }]
  ],
  webServer: process.env.START_DATABASE_EXPLORER === '1' ? {
    command: 'npm start -- -H 127.0.0.1',
    cwd: 'apps/business-skill-studio',
    url: databaseExplorerUrl,
    reuseExistingServer: false,
    timeout: 120_000
  } : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_TARGET_URL || undefined,
    ...(channel ? { channel } : {}),
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: process.env.CI ? 'on' : 'retain-on-failure',
    viewport: { width: 1440, height: 900 }
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) }
    }
  ]
});
