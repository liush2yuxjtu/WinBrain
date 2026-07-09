import { test, expect } from '@playwright/test';

const targetUrl = process.env.FRONTEND_URL;

test('configured frontend URL renders a visible document', async ({ page }) => {
  test.skip(!targetUrl, 'Set FRONTEND_URL to run this smoke test against a live frontend.');

  await page.goto(targetUrl!, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
});
