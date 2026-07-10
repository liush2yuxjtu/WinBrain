import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const targetUrl = process.env.DATABASE_EXPLORER_URL
const email = process.env.DATABASE_EXPLORER_TEST_EMAIL
const password = process.env.DATABASE_EXPLORER_TEST_PASSWORD

test('database explorer searches schema, renders DDL, and chats with the fallback agent', async ({ page }) => {
  test.skip(!targetUrl || !email || !password, 'Set database explorer URL and test credentials to run this authenticated flow.')

  await page.goto(new URL('/login', targetUrl).toString())
  await page.getByLabel('邮箱').fill(email!)
  await page.getByLabel('密码').fill(password!)
  await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL(new URL('/', targetUrl).toString())

  await page.goto(new URL('/database', targetUrl).toString())
  await expect(page.getByRole('heading', { name: '数据库探索与对话' })).toBeVisible()
  await expect(page.getByText('269', { exact: true }).first()).toBeVisible()

  await page.getByPlaceholder('搜索表名、注释或字段').fill('缺货')
  const shortageTable = page.getByRole('button', { name: /tb_oi_all_qh_result_daily_flat/ })
  await expect(shortageTable).toBeVisible()
  await shortageTable.click()
  await expect(page.getByRole('cell', { name: 'qh_reason', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'DDL', exact: true }).click()
  await expect(page.locator('.ddl-view')).toContainText('CREATE TABLE')

  await page.getByRole('button', { name: /安全的 100 行预览 SQL/ }).click()
  await expect(page.locator('.db-message.assistant').last()).toContainText('只读元数据快照', { timeout: 20_000 })
  await expect(page.locator('.db-message.assistant').last()).toContainText('LIMIT 100')

  await mkdir('artifacts/screenshots', { recursive: true })
  await page.screenshot({ path: 'artifacts/screenshots/database-explorer.png', fullPage: true })
})
