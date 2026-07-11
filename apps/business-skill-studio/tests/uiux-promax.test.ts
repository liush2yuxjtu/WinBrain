import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const designCssUrl = new URL('../app/uiux-promax.css', import.meta.url)
const layoutUrl = new URL('../app/layout.tsx', import.meta.url)
const recordingWorkflowUrl = new URL('../../../.github/workflows/uiux-promax-uat-recording.yml', import.meta.url)
const recorderUrl = new URL('../../../tools/record-uiux-promax-uat.mjs', import.meta.url)

async function source(url: URL): Promise<string> {
  return readFile(url, 'utf8')
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
  assert.match(css, /\.workbench-breadcrumb\s*\{\s*color:\s*#52656f/)
  assert.match(css, /\.draft-editor\s*\{[^}]*color-scheme:\s*dark/)
  assert.match(css, /\.assistant-panel\s*\{[^}]*color-scheme:\s*dark/)
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
  assert.match(recorder, /async function moveVideo[\s\S]*try[\s\S]*failed to move video/)
})
