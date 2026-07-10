import { expect, test } from '@playwright/test'

const appUrl = process.env.SKILL_LIBRARY_URL
const email = process.env.SKILL_LIBRARY_TEST_EMAIL
const password = process.env.SKILL_LIBRARY_TEST_PASSWORD

test.describe('Skill library management', () => {
  test.skip(!appUrl || !email || !password, 'Set the Skill library test URL and credentials to run this authenticated scenario.')

  test('creates, searches, edits, and deletes a generated Skill', async ({ page }, testInfo) => {
    const unauthorizedResponse = await page.request.get(new URL('/api/skills', appUrl).toString())
    expect(unauthorizedResponse.status()).toBe(401)

    await page.goto(new URL('/login', appUrl).toString())
    await page.getByLabel('邮箱').fill(email!)
    await page.getByLabel('密码').fill(password!)
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(new URL('/', appUrl).toString())

    await page.goto(new URL('/skills', appUrl).toString())
    await expect(page.getByRole('heading', { name: 'Skill 库管理' })).toBeVisible()
    await expect(page.getByText('库里还没有 Skill')).toBeVisible()

    await page.getByRole('button', { name: /新建 Skill/ }).first().click()
    const createDialog = page.getByRole('dialog', { name: '新建 Skill' })
    await createDialog.getByLabel('显示名称').fill('客户续约风险评审')
    await createDialog.getByLabel('触发描述').fill('当销售运营团队需要统一识别客户续约风险、确定 CSM 介入优先级时使用。')
    await createDialog.getByRole('button', { name: '创建 Skill' }).click()

    await expect(page.getByRole('heading', { name: '客户续约风险评审' })).toBeVisible()
    const skillName = (await page.locator('.skill-detail-identity code').textContent())!.trim()
    expect(skillName).toMatch(/^business-skill-[a-z0-9]{6}$/)

    const detailResponse = await page.request.get(new URL(`/api/skills/${skillName}`, appUrl).toString())
    const detailBody = await detailResponse.json() as { skill: { skillMarkdown: string } }
    const duplicateResponse = await page.request.post(new URL('/api/skills', appUrl).toString(), {
      data: { skillName, skillMarkdown: detailBody.skill.skillMarkdown, evalsJson: '', overwrite: false }
    })
    expect(duplicateResponse.status()).toBe(409)

    await page.getByRole('tab', { name: /evals\/evals\.json/ }).click()
    await page.getByLabel('编辑 evals/evals.json').fill('{ invalid json')
    await page.getByRole('button', { name: '保存修改' }).click()
    await expect(page.locator('.library-notice.error')).toContainText('valid JSON')
    await page.getByLabel('编辑 evals/evals.json').fill(JSON.stringify({ skill_name: skillName, evals: [] }, null, 2))
    await page.getByRole('button', { name: '保存修改' }).click()
    await expect(page.getByText('修改已保存')).toBeVisible()
    await expect(page.getByText('Evals 已配置')).toBeVisible()

    await page.getByPlaceholder('搜索名称或描述').fill('续约风险')
    await expect(page.locator('.skill-list-item')).toHaveCount(1)
    await expect(page.getByText('1 个结果')).toBeVisible()

    const listResponse = await page.request.get(new URL('/api/skills', appUrl).toString())
    expect(listResponse.ok()).toBeTruthy()
    const listBody = await listResponse.json() as { skills: Array<{ path: string }> }
    expect(listBody.skills[0].path).toMatch(new RegExp(`/${skillName}$`))
    expect(listBody.skills[0].path).not.toMatch(/^\//)
    expect(listBody.skills[0].path).not.toContain('/workspace/')

    await page.locator('.studio-main').evaluate((element) => { element.scrollTop = 0 })
    await page.screenshot({ path: testInfo.outputPath('skill-library-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.getByRole('button', { name: '打开导航' }).click()
    await expect(page.getByRole('link', { name: 'Skill 库' })).toHaveAttribute('aria-current', 'page')
    await page.screenshot({ path: testInfo.outputPath('skill-library-mobile.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '关闭导航' })).toBeHidden()
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.getByRole('button', { name: '删除' }).click()
    const deleteDialog = page.getByRole('alertdialog')
    await expect(deleteDialog).toContainText(skillName)
    await deleteDialog.getByRole('button', { name: '确认删除' }).click()
    await expect(page.getByText('库里还没有 Skill')).toBeVisible()
  })
})
