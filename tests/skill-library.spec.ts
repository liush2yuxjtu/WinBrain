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
    expect(skillName).toMatch(/^business-skill-[a-f0-9]{12}$/)

    const detailResponse = await page.request.get(new URL(`/api/skills/${skillName}`, appUrl).toString())
    const detailBody = await detailResponse.json() as { skill: { skillMarkdown: string } }
    expect(detailBody.skill.skillMarkdown).toContain(`name: ${skillName}`)
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
    await expect(page.getByText('版本 v2')).toBeVisible()

    const staleResponse = await page.request.put(new URL(`/api/skills/${skillName}`, appUrl).toString(), {
      data: { skillMarkdown: detailBody.skill.skillMarkdown, evalsJson: '', expectedVersion: 1 }
    })
    expect(staleResponse.status()).toBe(409)

    await page.getByPlaceholder('搜索名称或描述').fill('续约风险')
    await expect(page.locator('.skill-list-item')).toHaveCount(1)
    await expect(page.getByText('1 个结果')).toBeVisible()

    const listResponse = await page.request.get(new URL('/api/skills', appUrl).toString())
    expect(listResponse.ok()).toBeTruthy()
    const listBody = await listResponse.json() as { skills: Array<{ id: string; slug: string; version: number }> }
    expect(listBody.skills[0]).toMatchObject({ slug: skillName, version: 2 })
    expect(listBody.skills[0].id).toBeTruthy()

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

    const canonicalResponse = await page.request.post(new URL('/api/skills', appUrl).toString(), {
      data: {
        skillName: '销售 CRM 复盘',
        skillMarkdown: '---\nname: pending-skill-name\ndescription: CRM 复盘流程\n---\n\n# CRM 复盘',
        evalsJson: JSON.stringify({ skill_name: 'pending-skill-name', evals: [] }),
        overwrite: false
      }
    })
    expect(canonicalResponse.status()).toBe(201)
    const canonicalBody = await canonicalResponse.json() as {
      skill: { slug: string; skillMarkdown: string; evalsJson: string }
    }
    expect(canonicalBody.skill.slug).toMatch(/^crm-[a-f0-9]{12}$/)
    expect(canonicalBody.skill.skillMarkdown).toContain(`name: ${canonicalBody.skill.slug}`)
    expect(JSON.parse(canonicalBody.skill.evalsJson).skill_name).toBe(canonicalBody.skill.slug)
    expect((await page.request.delete(new URL(`/api/skills/${canonicalBody.skill.slug}`, appUrl).toString())).ok()).toBeTruthy()

    const scopedInput = (organizationId: string, heading: string) => ({
      organizationId,
      expertId: `${organizationId}-expert`,
      skillName: 'Weekly Expert Review',
      skillMarkdown: `---\nname: pending-skill-name\ndescription: ${organizationId} expert workflow\n---\n\n# ${heading}`,
      evalsJson: '',
      overwrite: false
    })
    const firstScopedResponse = await page.request.post(new URL('/api/skills', appUrl).toString(), {
      data: scopedInput('company-a', 'Scope A')
    })
    const secondScopedResponse = await page.request.post(new URL('/api/skills', appUrl).toString(), {
      data: scopedInput('company-b', 'Scope B')
    })
    expect(firstScopedResponse.status()).toBe(201)
    expect(secondScopedResponse.status()).toBe(201)
    const firstScoped = await firstScopedResponse.json() as { skill: { slug: string; skillMarkdown: string } }
    const secondScoped = await secondScopedResponse.json() as { skill: { slug: string; skillMarkdown: string } }
    expect(firstScoped.skill.slug).toBe(secondScoped.skill.slug)

    const scopedItem = (organizationId: string) => {
      const url = new URL(`/api/skills/${firstScoped.skill.slug}`, appUrl)
      url.searchParams.set('organizationId', organizationId)
      return url.toString()
    }
    const globalSkills = await page.request.get(new URL('/api/skills', appUrl).toString())
    expect((await globalSkills.json() as { skills: unknown[] }).skills).toHaveLength(0)
    expect((await page.request.get(scopedItem('company-a'))).status()).toBe(200)
    expect((await page.request.get(scopedItem('company-b'))).status()).toBe(200)
    expect((await page.request.get(scopedItem('company-c'))).status()).toBe(404)

    const scopedLibraryUrl = new URL('/skills', appUrl)
    scopedLibraryUrl.searchParams.set('organizationId', 'company-a')
    scopedLibraryUrl.searchParams.set('selected', firstScoped.skill.slug)
    await page.goto(scopedLibraryUrl.toString())
    await expect(page.getByLabel('组织作用域')).toHaveValue('company-a')
    await expect(page.getByRole('heading', { name: 'Scope A' })).toBeVisible()
    await page.getByLabel('编辑 SKILL.md').fill(firstScoped.skill.skillMarkdown.replace('# Scope A', '# Scope A v2'))
    await page.getByRole('button', { name: '保存修改' }).click()
    await expect(page.getByText('修改已保存')).toBeVisible()

    const firstAfterUpdate = await (await page.request.get(scopedItem('company-a'))).json() as {
      skill: { version: number; skillMarkdown: string }
    }
    const secondAfterUpdate = await (await page.request.get(scopedItem('company-b'))).json() as {
      skill: { version: number; skillMarkdown: string }
    }
    expect(firstAfterUpdate.skill).toMatchObject({ version: 2 })
    expect(firstAfterUpdate.skill.skillMarkdown).toContain('# Scope A v2')
    expect(secondAfterUpdate.skill).toMatchObject({ version: 1 })
    expect(secondAfterUpdate.skill.skillMarkdown).toContain('# Scope B')

    await page.getByRole('button', { name: '删除' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '确认删除' }).click()
    await expect(page.getByText('库里还没有 Skill')).toBeVisible()
    expect((await page.request.get(scopedItem('company-a'))).status()).toBe(404)
    expect((await page.request.get(scopedItem('company-b'))).status()).toBe(200)
    expect((await page.request.delete(scopedItem('company-b'))).ok()).toBeTruthy()
  })
})
