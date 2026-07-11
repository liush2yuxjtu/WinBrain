import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [sourceRootArg] = process.argv.slice(2)
if (!sourceRootArg) {
  throw new Error('Usage: node tools/install-claude-data-skills.mjs <knowledge-work-plugins/data>')
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repoRoot, 'apps', 'business-skill-studio')
const sourceSkills = path.resolve(sourceRootArg, 'skills')
const targetSkills = path.join(appRoot, '.claude', 'skills')
const agentSdkPath = path.join(appRoot, 'lib', 'agent-sdk.ts')

await rm(targetSkills, { recursive: true, force: true })
await mkdir(path.dirname(targetSkills), { recursive: true })
await cp(sourceSkills, targetSkills, { recursive: true })

let agentSdk = await readFile(agentSdkPath, 'utf8')
const eol = agentSdk.includes('\r\n') ? '\r\n' : '\n'
const marker = `        systemPrompt: input.systemPrompt,${eol}`
if (!agentSdk.includes(marker)) {
  throw new Error('Could not locate Claude Agent SDK options block')
}

const cwdExpression = "process.cwd().endsWith(path.join('apps', 'business-skill-studio')) ? process.cwd() : path.resolve(process.cwd(), 'apps/business-skill-studio')"
const projectSettingsLine = `        settingSources: ['project'],${eol}`
const existingCwdPattern = /        cwd: .*?,\r?\n(?=        settingSources: \['project'\],)/

if (agentSdk.includes(projectSettingsLine)) {
  if (existingCwdPattern.test(agentSdk)) {
    agentSdk = agentSdk.replace(existingCwdPattern, `        cwd: ${cwdExpression},${eol}`)
  } else {
    agentSdk = agentSdk.replace(projectSettingsLine, `        cwd: ${cwdExpression},${eol}${projectSettingsLine}`)
  }
} else {
  agentSdk = agentSdk.replace(
    marker,
    `${marker}        cwd: ${cwdExpression},${eol}${projectSettingsLine}`
  )
}

if (!agentSdk.includes("import path from 'node:path'")) {
  const importMarker = `import { query } from '@anthropic-ai/claude-agent-sdk'${eol}`
  if (!agentSdk.includes(importMarker)) {
    throw new Error('Could not locate Claude Agent SDK import block')
  }
  agentSdk = agentSdk.replace(
    importMarker,
    `import path from 'node:path'${eol}${importMarker}`
  )
}

await writeFile(agentSdkPath, agentSdk)
console.log(`Installed Claude data skills into ${path.relative(repoRoot, targetSkills)}`)
console.log('Configured Claude Agent SDK to load project skills by default')