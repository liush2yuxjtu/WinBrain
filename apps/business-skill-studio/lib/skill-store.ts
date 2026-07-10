import { Effect } from 'effect'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runAppEffect, tryPromiseEffect } from './effect-runtime'
import type { SkillSaveRequest, StoredSkillSummary } from './types'
import { normalizeSkillName } from './skill-creator'

const DEFAULT_STORAGE_DIR = 'data/generated-skills'

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.SKILL_STUDIO_STORAGE_DIR || DEFAULT_STORAGE_DIR)
}

export function skillDirectory(skillName: string): string {
  return path.join(storageRoot(), normalizeSkillName(skillName))
}

function saveSkillEffect(input: SkillSaveRequest) {
  return Effect.gen(function* () {
    const name = normalizeSkillName(input.skillName)
    const dir = skillDirectory(name)

    yield* tryPromiseEffect('Create skill directory', () => mkdir(dir, { recursive: true }))
    yield* tryPromiseEffect('Write SKILL.md', () => writeFile(path.join(dir, 'SKILL.md'), input.skillMarkdown, 'utf8'))

    const evalsJson = input.evalsJson?.trim()
    if (evalsJson) {
      const evalDir = path.join(dir, 'evals')
      yield* tryPromiseEffect('Create evals directory', () => mkdir(evalDir, { recursive: true }))
      yield* tryPromiseEffect('Write evals.json', () => writeFile(path.join(evalDir, 'evals.json'), evalsJson, 'utf8'))
    }

    return {
      name,
      path: dir,
      updatedAt: new Date().toISOString()
    }
  })
}

function listSkillsEffect() {
  return Effect.gen(function* () {
    const root = storageRoot()
    yield* tryPromiseEffect('Create skill storage root', () => mkdir(root, { recursive: true }))

    const entries = yield* tryPromiseEffect('Read skill storage root', () => readdir(root, { withFileTypes: true }))
    const summaries = yield* tryPromiseEffect('Read local skill metadata', async () => Promise.all(entries
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
      })))

    return summaries
      .filter((summary): summary is StoredSkillSummary => summary !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

function readSkillEffect(skillName: string) {
  const filePath = path.join(skillDirectory(skillName), 'SKILL.md')

  return Effect.catchAll(
    tryPromiseEffect('Read local skill', () => readFile(filePath, 'utf8')),
    () => Effect.succeed(null)
  )
}

export async function saveSkill(input: SkillSaveRequest): Promise<StoredSkillSummary> {
  return runAppEffect(saveSkillEffect(input))
}

export async function listSkills(): Promise<StoredSkillSummary[]> {
  return runAppEffect(listSkillsEffect())
}

export async function readSkill(skillName: string): Promise<string | null> {
  return runAppEffect(readSkillEffect(skillName))
}
