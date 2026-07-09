import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SkillSaveRequest, StoredSkillSummary } from './types'
import { normalizeSkillName } from './skill-creator'

const DEFAULT_STORAGE_DIR = 'data/generated-skills'

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.SKILL_STUDIO_STORAGE_DIR || DEFAULT_STORAGE_DIR)
}

export function skillDirectory(skillName: string): string {
  return path.join(storageRoot(), normalizeSkillName(skillName))
}

export async function saveSkill(input: SkillSaveRequest): Promise<StoredSkillSummary> {
  const name = normalizeSkillName(input.skillName)
  const dir = skillDirectory(name)
  await mkdir(dir, { recursive: true })

  await writeFile(path.join(dir, 'SKILL.md'), input.skillMarkdown, 'utf8')

  if (input.evalsJson?.trim()) {
    const evalDir = path.join(dir, 'evals')
    await mkdir(evalDir, { recursive: true })
    await writeFile(path.join(evalDir, 'evals.json'), input.evalsJson, 'utf8')
  }

  return {
    name,
    path: dir,
    updatedAt: new Date().toISOString()
  }
}

export async function listSkills(): Promise<StoredSkillSummary[]> {
  const root = storageRoot()
  await mkdir(root, { recursive: true })

  const entries = await readdir(root, { withFileTypes: true })
  const summaries = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const skillPath = path.join(root, entry.name, 'SKILL.md')
      const stats = await stat(skillPath).catch(() => null)
      if (!stats) return null

      return {
        name: entry.name,
        path: path.dirname(skillPath),
        updatedAt: stats.mtime.toISOString()
      }
    }))

  return summaries
    .filter((summary): summary is StoredSkillSummary => summary !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function readSkill(skillName: string): Promise<string | null> {
  const filePath = path.join(skillDirectory(skillName), 'SKILL.md')
  return readFile(filePath, 'utf8').catch(() => null)
}
