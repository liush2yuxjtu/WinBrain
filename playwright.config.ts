import { defineConfig, devices } from '@playwright/test';

const channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome';

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
  use: {
    baseURL: process.env.PLAYWRIGHT_TARGET_URL || undefined,
    channel,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: process.env.CI ? 'on' : 'retain-on-failure',
    viewport: { width: 1440, height: 900 }
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel }
    }
  ]
});
