import { chromium } from 'playwright'
import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const targetUrl = process.env.UIUX_UAT_URL || 'http://127.0.0.1:3000'
const artifactDir = resolve(process.env.UIUX_UAT_ARTIFACT_DIR || 'artifacts/uiux-promax-uat')
const email = process.env.FRONTEND_RECORD_EMAIL
const password = process.env.FRONTEND_RECORD_PASSWORD

if (!email || !password) {
  throw new Error('FRONTEND_RECORD_EMAIL and FRONTEND_RECORD_PASSWORD are required')
}

const results = []
const consoleMessages = []
let failure

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function verify(id, name, test) {
  try {
    const detail = await test()
    results.push({ id, name, status: 'PASS', detail: detail || 'Verified' })
    return detail
  } catch (error) {
    results.push({ id, name, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

async function launchBrowser() {
  const channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome'
  try {
    return await chromium.launch({ channel, headless: true, args: ['--no-sandbox'] })
  } catch (error) {
    console.warn(`Unable to launch ${channel}; falling back to bundled Chromium: ${error.message}`)
    return chromium.launch({ headless: true, args: ['--no-sandbox'] })
  }
}

async function authenticate(page) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

  const loginEmail = page.locator('input[name="email"]')
  if (await loginEmail.isVisible().catch(() => false)) {
    await loginEmail.fill(email)
    await page.locator('input[name="password"]').fill(password)
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
      page.getByRole('button', { name: '登录' }).click()
    ])
  }

  await page.locator('#studio-home').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
}

async function moveVideo(video, destination) {
  try {
    const source = await video.path()
    await rm(destination, { force: true })
    try {
      await rename(source, destination)
    } catch (renameError) {
      if (renameError?.code === 'EXDEV') {
        await copyFile(source, destination)
        await rm(source, { force: true })
      } else {
        throw renameError
      }
    }
  } catch (error) {
    console.error(`[uat-record] failed to move video to ${destination}:`, error)
  }
}

async function recordDesktop(browser) {
  const directory = resolve(artifactDir, 'desktop')
  const videoDirectory = resolve(directory, 'raw-video')
  await mkdir(videoDirectory, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 900 } }
  })
  const page = await context.newPage()
  const video = page.video()
  page.on('console', (message) => consoleMessages.push(`[desktop:${message.type()}] ${message.text()}`))

  try {
    await authenticate(page)

    await verify('UIUX-UAT-01', 'Desktop command workspace keeps navigation, canvas, and copilot visible', async () => {
      const sidebar = await page.locator('.studio-sidebar').boundingBox()
      const canvas = await page.locator('.workbench-canvas').boundingBox()
      const assistant = await page.locator('.assistant-panel').boundingBox()
      assert(sidebar && sidebar.width >= 220, 'Desktop sidebar is missing or too narrow')
      assert(canvas && canvas.width >= 600, 'Primary workbench canvas is missing or too narrow')
      assert(assistant && assistant.width >= 360, 'Persistent AI assistant is missing or too narrow')
      return `sidebar=${Math.round(sidebar.width)}px, canvas=${Math.round(canvas.width)}px, assistant=${Math.round(assistant.width)}px`
    })
    await page.screenshot({ path: resolve(directory, '01-command-workspace.png'), fullPage: false })

    await verify('UIUX-UAT-02', 'Keyboard focus indicator uses the accessible solid brand color', async () => {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      })
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')
      const style = await focused.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          tag: element.tagName,
          label: element.getAttribute('aria-label') || element.textContent?.trim() || '',
          outlineColor: computed.outlineColor,
          outlineStyle: computed.outlineStyle,
          outlineWidth: computed.outlineWidth
        }
      })
      assert(style.outlineStyle !== 'none', 'Focused control has no visible outline')
      assert(Number.parseFloat(style.outlineWidth) >= 3, `Focus outline is thinner than 3px: ${style.outlineWidth}`)
      assert(/^rgba?\(15,\s*118,\s*110(?:,\s*1)?\)$/.test(style.outlineColor), `Unexpected focus color: ${style.outlineColor}`)
      return `${style.tag} ${style.label}; ${style.outlineWidth} ${style.outlineColor}`
    })
    await page.screenshot({ path: resolve(directory, '02-keyboard-focus.png'), fullPage: false })

    await verify('UIUX-UAT-03', 'Small breadcrumb text uses the WCAG-reviewed dark neutral', async () => {
      const color = await page.locator('.workbench-breadcrumb').evaluate((element) => getComputedStyle(element).color)
      assert(color === 'rgb(82, 101, 111)', `Unexpected breadcrumb color: ${color}`)
      return `breadcrumb color=${color}`
    })

    const goal = page.locator('#business-goal')
    await goal.scrollIntoViewIfNeeded()
    await goal.fill('沉淀客户续约风险评审流程，并形成可审计的 Skill')
    await page.screenshot({ path: resolve(directory, '03-context-form-interaction.png'), fullPage: false })
    await page.waitForTimeout(1_200)
  } catch (error) {
    await page.screenshot({ path: resolve(directory, 'failure.png'), fullPage: false }).catch(() => undefined)
    throw error
  } finally {
    await context.close()
    await moveVideo(video, resolve(directory, 'video.webm'))
    await rm(videoDirectory, { recursive: true, force: true })
  }
}

async function recordMobile(browser) {
  const directory = resolve(artifactDir, 'mobile')
  const videoDirectory = resolve(directory, 'raw-video')
  await mkdir(videoDirectory, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: videoDirectory, size: { width: 390, height: 844 } }
  })
  const page = await context.newPage()
  const video = page.video()
  page.on('console', (message) => consoleMessages.push(`[mobile:${message.type()}] ${message.text()}`))

  try {
    await authenticate(page)

    await verify('UIUX-UAT-04', 'Mobile navigation opens, closes with Escape, and restores focus', async () => {
      const menu = page.getByRole('button', { name: '打开导航' })
      await menu.click()
      await page.locator('.studio-sidebar.mobile-open').waitFor({ state: 'visible' })
      await page.screenshot({ path: resolve(directory, '01-mobile-navigation-open.png'), fullPage: false })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: '打开导航' }).waitFor({ state: 'visible' })
      const state = await page.getByRole('button', { name: '打开导航' }).evaluate((element) => ({
        expanded: element.getAttribute('aria-expanded'),
        focused: document.activeElement === element
      }))
      assert(state.expanded === 'false', `Mobile menu remained expanded: ${state.expanded}`)
      assert(state.focused, 'Focus was not restored to the mobile menu button')
      return 'Escape closes navigation and returns keyboard focus to the menu button'
    })

    await verify('UIUX-UAT-05', 'Mobile form controls use 16px text to prevent iOS auto-zoom', async () => {
      const input = page.locator('#expert-role')
      await input.scrollIntoViewIfNeeded()
      await input.focus()
      const fontSize = await input.evaluate((element) => getComputedStyle(element).fontSize)
      assert(fontSize === '16px', `Mobile input font size is ${fontSize}, expected 16px`)
      return `expert role input font-size=${fontSize}`
    })
    await page.screenshot({ path: resolve(directory, '02-mobile-form-focus.png'), fullPage: false })

    await verify('UIUX-UAT-06', 'Narrow mobile layout stacks without horizontal overflow', async () => {
      await page.setViewportSize({ width: 320, height: 720 })
      await page.waitForTimeout(300)
      const layout = await page.evaluate(() => {
        const workbenchBody = document.querySelector('.workbench-body')
        const assistant = document.querySelector('.assistant-panel')
        const assistantBox = assistant?.getBoundingClientRect()
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          workbenchDisplay: workbenchBody ? getComputedStyle(workbenchBody).display : null,
          assistantWidth: assistantBox?.width || 0
        }
      })
      assert(layout.clientWidth === 320, `Narrow UAT viewport was not applied: ${layout.clientWidth}px`)
      assert(layout.scrollWidth <= layout.clientWidth + 1, `Horizontal overflow: ${layout.scrollWidth}px > ${layout.clientWidth}px`)
      assert(layout.workbenchDisplay === 'block', `Workbench did not stack on mobile: display=${layout.workbenchDisplay}`)
      assert(layout.assistantWidth <= layout.clientWidth, `Assistant exceeds viewport: ${layout.assistantWidth}px`)
      return `viewport=${layout.clientWidth}px, scrollWidth=${layout.scrollWidth}px, assistant=${Math.round(layout.assistantWidth)}px`
    })
    await page.screenshot({ path: resolve(directory, '03-narrow-320-layout.png'), fullPage: false })
    await page.waitForTimeout(1_200)
  } catch (error) {
    await page.screenshot({ path: resolve(directory, 'failure.png'), fullPage: false }).catch(() => undefined)
    throw error
  } finally {
    await context.close()
    await moveVideo(video, resolve(directory, 'video.webm'))
    await rm(videoDirectory, { recursive: true, force: true })
  }
}

function renderSummary() {
  const rows = results.map((result) => `| ${result.id} | ${result.name} | ${result.status} | ${String(result.detail).replaceAll('|', '\\|')} |`).join('\n')
  const passed = results.filter((result) => result.status === 'PASS').length
  const failed = results.filter((result) => result.status === 'FAIL').length
  const errorSection = failure ? `\n## Failure\n\n\`\`\`text\n${failure.stack || failure.message || String(failure)}\n\`\`\`\n` : ''
  return `# UIUXPROMAX UAT recording\n\n- Target: ${targetUrl}\n- Desktop viewport: 1440x900\n- Mobile interaction viewport: 390x844\n- Narrow mobile viewport: 320x720\n- Result: ${failed === 0 && passed === 6 ? 'PASS' : 'FAIL'}\n- Passed: ${passed}/6\n- Failed: ${failed}\n\n| UAT | Acceptance criterion | Status | Observed evidence |\n| --- | --- | --- | --- |\n${rows}\n\n## Media\n\n- Desktop video: desktop/video.webm\n- Mobile video: mobile/video.webm\n- Screenshots: desktop/*.png and mobile/*.png\n${errorSection}`
}

await mkdir(artifactDir, { recursive: true })
let browser

try {
  browser = await launchBrowser()
  await recordDesktop(browser)
  await recordMobile(browser)
  assert(results.length === 6 && results.every((result) => result.status === 'PASS'), 'Not all six UIUX UAT cases passed')
} catch (error) {
  failure = error
  process.exitCode = 1
} finally {
  await browser?.close().catch(() => undefined)
  await writeFile(resolve(artifactDir, 'uat-results.json'), `${JSON.stringify({ targetUrl, results, failure: failure ? String(failure.message || failure) : null }, null, 2)}\n`, 'utf8')
  await writeFile(resolve(artifactDir, 'browser-console.log'), `${consoleMessages.join('\n')}\n`, 'utf8')
  const summary = renderSummary()
  await writeFile(resolve(artifactDir, 'summary.md'), summary, 'utf8')
  console.log(summary)
}
