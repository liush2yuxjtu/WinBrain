import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

function evidenceTargetUrl(): string {
  const configured = process.env.PLAYWRIGHT_TARGET_URL?.trim();
  if (!configured) {
    throw new Error('PLAYWRIGHT_TARGET_URL is required; PR evidence must capture a real running application.');
  }

  const target = new URL(configured);
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error(`PLAYWRIGHT_TARGET_URL must use http or https, received ${target.protocol}`);
  }

  return target.toString();
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
