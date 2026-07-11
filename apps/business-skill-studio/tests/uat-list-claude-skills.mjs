import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve from this script so the UAT behaves identically from the repo root and app directory.
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(appRoot, '.claude', 'skills')
const reportPath = process.env.UAT_REPORT_PATH
  ? path.resolve(process.cwd(), process.env.UAT_REPORT_PATH)
  : path.join(appRoot, 'uat-claude-skills.md')

async function findSkillFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await findSkillFiles(fullPath))
    else if (entry.isFile() && entry.name === 'SKILL.md') files.push(fullPath)
  }
  return files
}

function frontmatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*["']?([^\\n"']+)["']?\\s*$`, 'm'))
  return match?.[1]?.trim()
}

const skillFiles = (await findSkillFiles(skillsRoot)).sort()
assert.ok(skillFiles.length > 0, 'expected at least one installed Claude skill')

const skills = []
for (const file of skillFiles) {
  const content = await readFile(file, 'utf8')
  const relative = path.relative(skillsRoot, path.dirname(file)).replaceAll(path.sep, '/')
  skills.push({
    name: frontmatterValue(content, 'name') || relative,
    description: frontmatterValue(content, 'description') || '',
    path: relative
  })
}

assert.ok(
  skills.some((skill) => skill.path === 'data-context-extractor' || skill.name === 'data-context-extractor'),
  'expected the Anthropic data-context-extractor skill'
)

const lines = [
  '# Claude Agent SDK default skills — UAT',
  '',
  `Installed skills: **${skills.length}**`,
  '',
  '| # | Skill | Path | Description |',
  '|---:|---|---|---|',
  ...skills.map((skill, index) =>
    `| ${index + 1} | ${skill.name.replaceAll('|', '\\|')} | \`${skill.path}\` | ${skill.description.replaceAll('|', '\\|')} |`
  ),
  ''
]

await writeFile(reportPath, lines.join('\n'))
console.log(lines.join('\n'))