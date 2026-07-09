import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const fallbackPageUrl = new URL('../demo/index.html', import.meta.url).toString();

function evidenceTargetUrl(): string {
  return process.env.PLAYWRIGHT_TARGET_URL || fallbackPageUrl;
}

test('capture PR evidence screenshot and video', async ({ page }, testInfo) => {
  const targetUrl = evidenceTargetUrl();

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator('body')).toBeVisible();

  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/${testInfo.project.name}-pr-evidence.png`,
    fullPage: true,
  });
});
