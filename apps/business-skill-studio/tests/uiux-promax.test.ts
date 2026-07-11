import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const designCssUrl = new URL('../app/uiux-promax.css', import.meta.url)
const layoutUrl = new URL('../app/layout.tsx', import.meta.url)
const uatDatabaseUrl = new URL('../scripts/uat-database.mjs', import.meta.url)
const recordingWorkflowUrl = new URL('../../../.github/workflows/uiux-promax-uat-recording.yml', import.meta.url)
const recorderUrl = new URL('../../../tools/record-uiux-promax-uat.mjs', import.meta.url)

async function source(url: URL): Promise<string> {
  return readFile(url, 'utf8')
}

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  assert.ok(start !== -1, `${selector} rule not found`)
  const end = css.indexOf('}', start)
  assert.ok(end !== -1, `${selector} rule is not closed`)
  return css.slice(start, end + 1)
}

test('UIUXPROMAX design layer is loaded after the base application styles', async () => {
  const layout = await source(layoutUrl)
  const designImport = layout.indexOf("import './uiux-promax.css'")
  const baseImport = layout.indexOf("import './database.css'")

  assert.ok(designImport !== -1, 'uiux-promax.css import not found')
  assert.ok(baseImport !== -1, 'database.css import not found')
  assert.ok(designImport > baseImport, 'UIUXPROMAX must load last so its design tokens consistently override legacy styles')
})

test('UIUXPROMAX includes accessibility and responsive contracts', async () => {
  const css = await source(designCssUrl)

  assert.match(css, /:focus-visible/)
  assert.match(css, /outline:\s*3px solid var\(--uux-brand\)/)
  assert.match(css, /\.brand-copy span\s*\{\s*color:\s*#52656f/)
  assert.match(css, /\.nav-label\s*\{\s*color:\s*#52656f/)
  assert.match(css, /\.workbench-breadcrumb\s*\{\s*color:\s*#52656f/)
  assert.match(css, /font-size:\s*clamp\(23px,\s*1\.5rem \+ 1\.5vw,\s*34px\)/)
  assert.match(css, /\.metric-card\s*\{[^}]*transition:\s*border-color/)
  assert.match(cssRule(css, '.draft-editor'), /color-scheme:\s*dark/)
  assert.match(cssRule(css, '.assistant-panel'), /color-scheme:\s*dark/)
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.assistant-panel\s*\{[^}]*width:\s*100%[^}]*flex-basis:\s*auto/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /@media \(max-width: 820px\)/)
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*font-size:\s*16px/)
  assert.match(css, /--uux-brand:\s*#0f766e/)
})

test('UIUXPROMAX has dedicated desktop and mobile UAT recording evidence', async () => {
  const [workflow, recorder] = await Promise.all([
    source(recordingWorkflowUrl),
    source(recorderUrl)
  ])

  assert.match(workflow, /name:\s*UIUXPROMAX UAT Recording/)
  assert.match(workflow, /node tools\/record-uiux-promax-uat\.mjs/)
  assert.match(workflow, /EVIDENCE_MARKER:\s*uiux-promax-uat-recording/)
  assert.match(workflow, /uiux-promax-uat-recording/)
  assert.doesNotMatch(workflow, /KIMI_API_KEY/)

  for (const id of ['UIUX-UAT-01', 'UIUX-UAT-02', 'UIUX-UAT-03', 'UIUX-UAT-04', 'UIUX-UAT-05', 'UIUX-UAT-06']) {
    assert.match(recorder, new RegExp(id))
  }
  assert.match(recorder, /viewport:\s*\{ width:\s*1440, height:\s*900 \}/)
  assert.match(recorder, /viewport:\s*\{ width:\s*390, height:\s*844 \}/)
  assert.match(recorder, /setViewportSize\(\{ width:\s*320, height:\s*720 \}\)/)
  assert.match(recorder, /desktop\/video\.webm/)
  assert.match(recorder, /mobile\/video\.webm/)
  assert.match(recorder, /copyFile/)
  assert.match(recorder, /EXDEV/)
  assert.match(recorder, /rgba\?\\\(15/)
  assert.match(recorder, /page\.locator\('\.mobile-menu-button'\)/)
  assert.match(recorder, /async function moveVideo[\s\S]*try[\s\S]*failed to move video/)
})

test('UAT database diagnostics distinguish exit codes from operating-system signals', async () => {
  const script = await source(uatDatabaseUrl)

  assert.match(script, /function failureReason\(result\)/)
  assert.match(script, /if \(!result\) return 'no process result'/)
  assert.match(script, /result\.status !== null \? `status \$\{result\.status\}` : `signal \$\{result\.signal \|\| 'unknown'\}`/)
  assert.match(script, /failed with \$\{failureReason\(result\)\}/)
  assert.match(script, /function waitForCleanup\(milliseconds\)/)
  assert.match(script, /waitForCleanup\(2_000\)/)
})
