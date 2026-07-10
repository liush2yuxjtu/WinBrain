import { Effect } from 'effect'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError, runAppEffect, tryPromiseEffect } from './effect-runtime'
import type { SkillSaveRequest, StoredSkillDetail, StoredSkillSummary } from './types'
import { normalizeSkillName } from './skill-creator'

const DEFAULT_STORAGE_DIR = 'data/generated-skills'
const MAX_SKILL_BYTES = 1_000_000
const MAX_EVALS_BYTES = 1_000_000

export class SkillInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillInputError'
  }
}

export class SkillConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillConflictError'
  }
}

type PreparedSkill = {
  name: string
  skillMarkdown: string
  evalsJson: string | null
}

type SkillMetadata = {
  frontmatterName: string
  title: string
  description: string
}

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.SKILL_STUDIO_STORAGE_DIR || DEFAULT_STORAGE_DIR)
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

function assertStoredSkillName(skillName: string): string {
  if (!isStoredSkillName(skillName)) {
    throw new SkillInputError('Skill name must be a lowercase slug containing only letters, numbers, and hyphens')
  }

  return skillName
}

function isStoredSkillName(skillName: string): boolean {
  // New names are capped at 64 characters, while reads keep compatibility
  // with the previous 80-character normalizer.
  return /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(skillName)
}

function storedSkillDirectory(skillName: string): string {
  return path.join(storageRoot(), assertStoredSkillName(skillName))
}

export function skillDirectory(skillName: string): string {
  return storedSkillDirectory(normalizeSkillName(skillName))
}

function displayPath(skillName: string): string {
  const configuredRoot = process.env.SKILL_STUDIO_STORAGE_DIR || DEFAULT_STORAGE_DIR
  const rootLabel = path.isAbsolute(configuredRoot) ? '[external-skill-store]' : configuredRoot
  return path.join(rootLabel, skillName).split(path.sep).join('/')
}

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function parseSkillMetadata(markdown: string, fallbackName: string): SkillMetadata {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || ''
  const field = (name: string) => {
    const match = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))
    return match?.[1] ? unquoteYamlValue(match[1]) : ''
  }
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()

  return {
    frontmatterName: field('name'),
    title: heading || fallbackName,
    description: field('description')
  }
}

function validateSkillInput(input: SkillSaveRequest, expectedName?: string): PreparedSkill {
  if (!input.skillName?.trim()) {
    throw new SkillInputError('Skill name is required')
  }

  const name = normalizeSkillName(input.skillName)
  if (expectedName && name !== assertStoredSkillName(expectedName)) {
    throw new SkillInputError('The skill name in the request does not match the stored skill')
  }

  const skillMarkdown = input.skillMarkdown?.trim()
  if (!skillMarkdown) {
    throw new SkillInputError('SKILL.md content is required')
  }
  if (Buffer.byteLength(skillMarkdown, 'utf8') > MAX_SKILL_BYTES) {
    throw new SkillInputError('SKILL.md must be smaller than 1 MB')
  }

  const metadata = parseSkillMetadata(skillMarkdown, name)
  if (!metadata.frontmatterName || !metadata.description) {
    throw new SkillInputError('SKILL.md must start with YAML frontmatter containing name and description')
  }
  if (metadata.frontmatterName !== name) {
    throw new SkillInputError(`SKILL.md frontmatter name must match "${name}"`)
  }

  const evalsJson = input.evalsJson?.trim() || null
  if (evalsJson) {
    if (Buffer.byteLength(evalsJson, 'utf8') > MAX_EVALS_BYTES) {
      throw new SkillInputError('evals/evals.json must be smaller than 1 MB')
    }
    try {
      JSON.parse(evalsJson)
    } catch {
      throw new SkillInputError('evals/evals.json must contain valid JSON')
    }
  }

  return {
    name,
    skillMarkdown: `${skillMarkdown}\n`,
    evalsJson: evalsJson ? `${evalsJson}\n` : null
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, filePath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function removeEvalsFile(skillDir: string): Promise<void> {
  const evalDir = path.join(skillDir, 'evals')
  const evalDirStats = await optionalLstat(evalDir)
  if (!evalDirStats) return
  if (!evalDirStats.isDirectory() || evalDirStats.isSymbolicLink()) {
    throw new SkillInputError('The managed evals entry is not a safe directory')
  }

  const evalFileStats = await optionalLstat(path.join(evalDir, 'evals.json'))
  if (evalFileStats?.isSymbolicLink()) {
    throw new SkillInputError('The managed evals file must not be a symbolic link')
  }
  await rm(path.join(evalDir, 'evals.json'), { force: true })
  await rmdir(evalDir).catch((error: unknown) => {
    if (!isNodeError(error, 'ENOENT') && !isNodeError(error, 'ENOTEMPTY') && !isNodeError(error, 'EEXIST')) throw error
  })
}

async function optionalLstat(filePath: string) {
  try {
    return await lstat(filePath)
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return null
    throw error
  }
}

async function ensureSafeDirectory(dir: string, label: string): Promise<void> {
  const existing = await optionalLstat(dir)
  if (!existing) {
    await mkdir(dir)
    return
  }
  if (!existing.isDirectory() || existing.isSymbolicLink()) {
    throw new SkillInputError(`${label} is not a safe directory`)
  }
}

function saveSkillEffect(prepared: PreparedSkill, overwrite: boolean) {
  return Effect.gen(function* () {
    const root = storageRoot()
    const dir = storedSkillDirectory(prepared.name)

    yield* tryPromiseEffect('Create skill storage root', () => mkdir(root, { recursive: true }))
    yield* tryPromiseEffect('Prepare skill directory', async () => {
      if (overwrite) {
        try {
          const existing = await lstat(dir)
          if (!existing.isDirectory() || existing.isSymbolicLink()) {
            throw new SkillInputError(`The storage entry for "${prepared.name}" is not a safe directory`)
          }
        } catch (error) {
          if (isNodeError(error, 'ENOENT')) {
            await mkdir(dir)
            return
          }
          throw error
        }
        return
      }

      try {
        await mkdir(dir)
      } catch (error) {
        if (isNodeError(error, 'EEXIST')) {
          throw new SkillConflictError(`A skill named "${prepared.name}" already exists`)
        }
        throw error
      }
    })

    yield* tryPromiseEffect('Write SKILL.md', () => atomicWrite(path.join(dir, 'SKILL.md'), prepared.skillMarkdown))

    if (prepared.evalsJson) {
      const evalDir = path.join(dir, 'evals')
      yield* tryPromiseEffect('Create evals directory', () => ensureSafeDirectory(evalDir, 'The managed evals entry'))
      yield* tryPromiseEffect('Write evals.json', () => atomicWrite(path.join(evalDir, 'evals.json'), prepared.evalsJson!))
    } else {
      yield* tryPromiseEffect('Remove stale evals.json', () => removeEvalsFile(dir))
    }

    const detail = yield* tryPromiseEffect('Read saved skill', () => readStoredSkill(prepared.name))
    if (!detail) throw new AppError('The skill was saved but could not be read back')
    return detail
  })
}

async function readStoredSkill(skillName: string): Promise<StoredSkillDetail | null> {
  const name = assertStoredSkillName(skillName)
  const dir = storedSkillDirectory(name)
  const skillPath = path.join(dir, 'SKILL.md')
  const dirStats = await optionalLstat(dir)
  if (!dirStats) return null
  if (!dirStats.isDirectory() || dirStats.isSymbolicLink()) {
    throw new SkillInputError(`The storage entry for "${name}" is not a safe directory`)
  }

  const skillStats = await optionalLstat(skillPath)
  if (!skillStats) return null
  if (!skillStats.isFile() || skillStats.isSymbolicLink()) {
    throw new SkillInputError(`The SKILL.md entry for "${name}" is not a safe file`)
  }

  const evalDir = path.join(dir, 'evals')
  const evalDirStats = await optionalLstat(evalDir)
  if (evalDirStats && (!evalDirStats.isDirectory() || evalDirStats.isSymbolicLink())) {
    throw new SkillInputError(`The evals entry for "${name}" is not a safe directory`)
  }

  const evalPath = path.join(evalDir, 'evals.json')
  const evalStats = evalDirStats ? await optionalLstat(evalPath) : null
  if (evalStats && (!evalStats.isFile() || evalStats.isSymbolicLink())) {
    throw new SkillInputError(`The evals.json entry for "${name}" is not a safe file`)
  }

  const [skillMarkdown, evalsJson] = await Promise.all([
    readFile(skillPath, 'utf8'),
    evalStats ? readFile(evalPath, 'utf8') : Promise.resolve(null)
  ])

  if (!skillMarkdown) return null

  const metadata = parseSkillMetadata(skillMarkdown, name)
  return {
    name,
    title: metadata.title,
    description: metadata.description || '暂无描述',
    path: displayPath(name),
    updatedAt: new Date(Math.max(skillStats.mtimeMs, evalStats?.mtimeMs || 0)).toISOString(),
    sizeBytes: skillStats.size + (evalStats?.size || 0),
    hasEvals: Boolean(evalsJson),
    skillMarkdown,
    evalsJson
  }
}

function listSkillsEffect() {
  return Effect.gen(function* () {
    const root = storageRoot()
    yield* tryPromiseEffect('Create skill storage root', () => mkdir(root, { recursive: true }))

    const entries = yield* tryPromiseEffect('Read skill storage root', () => readdir(root, { withFileTypes: true }))
    const details = yield* tryPromiseEffect('Read local skill metadata', () => Promise.all(entries
      .filter((entry) => entry.isDirectory() && isStoredSkillName(entry.name))
      .map((entry) => readStoredSkill(entry.name))))

    return details
      .filter((detail): detail is StoredSkillDetail => detail !== null)
      .map(({ skillMarkdown: _skillMarkdown, evalsJson: _evalsJson, ...summary }): StoredSkillSummary => summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

function readSkillDetailEffect(skillName: string) {
  return tryPromiseEffect('Read local skill', () => readStoredSkill(skillName))
}

function deleteSkillEffect(skillName: string) {
  return tryPromiseEffect('Delete local skill', async () => {
    const dir = storedSkillDirectory(skillName)
    try {
      const stats = await lstat(dir)
      if (!stats.isDirectory() || stats.isSymbolicLink()) return false
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return false
      throw error
    }

    await rm(dir, { recursive: true })
    return true
  })
}

export async function saveSkill(input: SkillSaveRequest, options: { overwrite?: boolean } = {}): Promise<StoredSkillDetail> {
  const prepared = validateSkillInput(input)
  return runAppEffect(saveSkillEffect(prepared, options.overwrite ?? true))
}

export async function updateSkill(skillName: string, input: Omit<SkillSaveRequest, 'skillName'>): Promise<StoredSkillDetail | null> {
  const name = assertStoredSkillName(skillName)
  const existing = await readSkillDetail(name)
  if (!existing) return null

  const prepared = validateSkillInput({ ...input, skillName: name }, name)
  return runAppEffect(saveSkillEffect(prepared, true))
}

export async function listSkills(): Promise<StoredSkillSummary[]> {
  return runAppEffect(listSkillsEffect())
}

export async function readSkillDetail(skillName: string): Promise<StoredSkillDetail | null> {
  return runAppEffect(readSkillDetailEffect(assertStoredSkillName(skillName)))
}

export async function readSkill(skillName: string): Promise<string | null> {
  return (await readSkillDetail(skillName))?.skillMarkdown || null
}

export async function deleteSkill(skillName: string): Promise<boolean> {
  return runAppEffect(deleteSkillEffect(assertStoredSkillName(skillName)))
}

export function skillStoreHttpError(error: unknown): { status: number; message: string } {
  let current: unknown = error

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof SkillInputError) return { status: 400, message: current.message }
    if (current instanceof SkillConflictError) return { status: 409, message: current.message }
    current = current instanceof Error && 'cause' in current ? current.cause : null
  }

  console.error('Skill store request failed', error)
  return { status: 500, message: 'Skill store operation failed' }
}
