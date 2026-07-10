import { defineConfig, devices } from '@playwright/test';

const requestedChannel = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
const channel = requestedChannel === 'chromium' ? undefined : requestedChannel;

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
  webServer: process.env.SKILL_LIBRARY_START_SERVER === '1' ? {
    command: 'npm --prefix apps/business-skill-studio run dev -- --hostname 127.0.0.1 --port 3000',
    url: process.env.SKILL_LIBRARY_URL || 'http://127.0.0.1:3000/login',
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
