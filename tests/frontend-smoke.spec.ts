import { test, expect } from '@playwright/test'

const targetUrl = process.env.FRONTEND_URL

test('WinBrain SaaS 工作台与 AI 侧栏可见', async ({ page }) => {
  test.skip(!targetUrl, 'Set FRONTEND_URL to run this smoke test against a live frontend.')

  await page.goto(targetUrl!, { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: '业务 Skill 工作台' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'WinBrain AI 助手' })).toBeVisible()
  await expect(page.getByText('WinBrain Copilot')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Skill 草稿' })).toBeVisible()
})
