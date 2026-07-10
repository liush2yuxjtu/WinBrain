import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, readdir, rename, rm, rmdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runAppEffect, tryPromiseEffect } from '../effect-runtime'
import { storedSkillDetail, storedSkillSummary } from '../skill-metadata'
import type { SkillSaveRequest, StoredSkillDetail, StoredSkillSummary } from '../types'
import {
  SkillRepositoryConflictError,
  SkillRepositoryInputError,
  type SkillRepository,
  type SkillRepositorySaveOptions
} from './skill-repository'
import { isReadableSkillStoreSlug, legacyHashedSkillSlug, skillStoreSlug, skillStoreSlugCandidates } from './skill-slug'

const DEFAULT_STORAGE_DIR = 'data/generated-skills'
const METADATA_FILE = '.skill-store.json'
const SUMMARY_READ_BYTES = 64 * 1024
const skillSaveLocks = new Map<string, Promise<void>>()

type StoredIdentity = Pick<
  StoredSkillSummary,
  'id' | 'name' | 'slug' | 'version' | 'updatedAt' | 'organizationId' | 'expertId'
>

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function optionalLstat(filePath: string) {
  try {
    return await lstat(filePath)
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return null
    throw error
  }
}

async function ensureSafeDirectory(directory: string, label: string): Promise<void> {
  const stats = await optionalLstat(directory)
  if (!stats) {
    try {
      await mkdir(directory)
      return
    } catch (error) {
      if (!isNodeError(error, 'EEXIST')) throw error
    }
  }
  const currentStats = stats || await lstat(directory)
  if (!currentStats.isDirectory() || currentStats.isSymbolicLink()) {
    throw new SkillRepositoryInputError(`${label} is not a safe directory`)
  }
}

async function assertSafeDirectory(directory: string, label: string): Promise<void> {
  const stats = await optionalLstat(directory)
  if (!stats) throw new SkillRepositoryConflictError(`${label} changed while it was being saved; reload and retry`)
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new SkillRepositoryInputError(`${label} is not a safe directory`)
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

async function atomicWriteIfChanged(filePath: string, content: string, label: string): Promise<void> {
  const stats = await optionalLstat(filePath)
  if (stats) {
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new SkillRepositoryInputError(`${label} is not a safe file`)
    }
    if (await readFile(filePath, 'utf8') === content) return
  }
  await atomicWrite(filePath, content)
}

async function readFilePrefix(filePath: string): Promise<string> {
  const handle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(SUMMARY_READ_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function withSkillSaveLock<A>(key: string, run: () => Promise<A>): Promise<A> {
  const previous = skillSaveLocks.get(key) || Promise.resolve()
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => gate)
  skillSaveLocks.set(key, queued)
  await previous
  try {
    return await run()
  } finally {
    release()
    if (skillSaveLocks.get(key) === queued) skillSaveLocks.delete(key)
  }
}

export class FileSystemSkillRepository implements SkillRepository {
  private readonly root: string

  constructor(storageDirectory = process.env.SKILL_STUDIO_STORAGE_DIR || DEFAULT_STORAGE_DIR) {
    this.root = path.resolve(process.cwd(), storageDirectory)
  }

  private validatedOrganizationId(organizationId?: string): string | undefined {
    if (!organizationId) return undefined
    if (organizationId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(organizationId)) {
      throw new SkillRepositoryInputError('Invalid organizationId')
    }
    return organizationId
  }

  private scopeRoot(organizationId?: string): string {
    const validatedOrganizationId = this.validatedOrganizationId(organizationId)
    return validatedOrganizationId
      ? path.join(this.root, 'organizations', validatedOrganizationId)
      : this.root
  }

  private directory(slug: string, organizationId?: string): string {
    if (!isReadableSkillStoreSlug(slug) || (!organizationId && slug === 'organizations')) {
      throw new SkillRepositoryInputError('Invalid Skill slug')
    }
    return path.join(this.scopeRoot(organizationId), slug)
  }

  private lockKey(slug: string, organizationId?: string): string {
    const scopeHash = createHash('sha256')
      .update(organizationId || 'global')
      .digest('hex')
      .slice(0, 16)
    return `${scopeHash}-${slug}`
  }

  private async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    const stats = await lstat(this.root)
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new SkillRepositoryInputError('The Skill Store root is not a safe directory')
    }
  }

  private async ensureScopeRoot(organizationId?: string): Promise<void> {
    await this.ensureRoot()
    const validatedOrganizationId = this.validatedOrganizationId(organizationId)
    if (!validatedOrganizationId) return
    const organizationsDirectory = path.join(this.root, 'organizations')
    await ensureSafeDirectory(organizationsDirectory, 'The organizations Skill Store entry')
    await ensureSafeDirectory(
      path.join(organizationsDirectory, validatedOrganizationId),
      'The organization Skill Store entry'
    )
  }

  private async acquireFileSaveLock(slug: string): Promise<() => Promise<void>> {
    const locksDirectory = path.join(this.root, '.save-locks')
    await ensureSafeDirectory(locksDirectory, 'The Skill save lock entry')
    const lockDirectory = path.join(locksDirectory, `${slug}.lock`)
    const recoveryDirectory = path.join(locksDirectory, `${slug}.recovering`)
    const cleanupDirectory = path.join(locksDirectory, `${slug}.recovery-cleanup`)
    const deadline = Date.now() + 10_000

    const readOwner = async (directory: string): Promise<string | null> => {
      const ownerPath = path.join(directory, 'owner')
      const ownerStats = await optionalLstat(ownerPath)
      if (!ownerStats) return null
      if (!ownerStats.isFile() || ownerStats.isSymbolicLink()) {
        throw new SkillRepositoryInputError('The Skill save lock owner is not a safe file')
      }
      return (await readFile(ownerPath, 'utf8')).trim() || null
    }

    while (true) {
      const cleanupStats = await optionalLstat(cleanupDirectory)
      if (cleanupStats) {
        if (!cleanupStats.isDirectory() || cleanupStats.isSymbolicLink()) {
          throw new SkillRepositoryInputError('The Skill save lock cleanup entry is not a safe directory')
        }
        if (Date.now() - cleanupStats.mtimeMs > 30_000) {
          await rm(cleanupDirectory, { recursive: true, force: true })
          continue
        }
        if (Date.now() >= deadline) {
          throw new SkillRepositoryConflictError('The Skill save lock cleanup is still running; retry the request')
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
        continue
      }

      const recoveryStats = await optionalLstat(recoveryDirectory)
      if (recoveryStats) {
        if (!recoveryStats.isDirectory() || recoveryStats.isSymbolicLink()) {
          throw new SkillRepositoryInputError('The Skill save lock recovery entry is not a safe directory')
        }
        if (Date.now() - recoveryStats.mtimeMs > 30_000) {
          try {
            await rename(recoveryDirectory, cleanupDirectory)
          } catch (error) {
            if (isNodeError(error, 'ENOENT') || isNodeError(error, 'EEXIST') || isNodeError(error, 'ENOTEMPTY')) continue
            throw error
          }
          await rm(cleanupDirectory, { recursive: true, force: true })
          continue
        }
        if (Date.now() >= deadline) {
          throw new SkillRepositoryConflictError('The Skill save lock is recovering; retry the request')
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
        continue
      }

      try {
        await mkdir(lockDirectory)
        const owner = randomUUID()
        await atomicWrite(path.join(lockDirectory, 'owner'), `${owner}\n`)
        if (await optionalLstat(recoveryDirectory) || await optionalLstat(cleanupDirectory)) {
          if (await readOwner(lockDirectory) === owner) {
            await rm(lockDirectory, { recursive: true, force: true })
          }
          continue
        }
        const heartbeat = setInterval(() => {
          const now = new Date()
          void utimes(lockDirectory, now, now).catch(() => undefined)
        }, 5_000)
        heartbeat.unref()
        return async () => {
          clearInterval(heartbeat)
          if (await readOwner(lockDirectory) === owner) {
            await rm(lockDirectory, { recursive: true, force: true })
          }
        }
      } catch (error) {
        if (!isNodeError(error, 'EEXIST')) throw error
      }

      const stats = await optionalLstat(lockDirectory)
      if (!stats) continue
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new SkillRepositoryInputError('The Skill save lock is not a safe directory')
      }
      if (Date.now() - stats.mtimeMs > 30_000) {
        try {
          await rename(lockDirectory, recoveryDirectory)
        } catch (error) {
          if (isNodeError(error, 'ENOENT') || isNodeError(error, 'EEXIST') || isNodeError(error, 'ENOTEMPTY')) continue
          throw error
        }
        await rm(recoveryDirectory, { recursive: true, force: true })
        continue
      }
      if (Date.now() >= deadline) {
        throw new SkillRepositoryConflictError('The Skill is busy; retry the request')
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  private async readMetadata(
    directory: string,
    expectedSlug: string,
    expectedOrganizationId?: string
  ): Promise<StoredIdentity | null> {
    const metadataPath = path.join(directory, METADATA_FILE)
    const stats = await optionalLstat(metadataPath)
    if (!stats) return null
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new SkillRepositoryInputError('The Skill metadata entry is not a safe file')
    }

    let metadata: Partial<StoredIdentity>
    try {
      metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Partial<StoredIdentity>
    } catch (error) {
      throw new SkillRepositoryInputError(`The Skill metadata for "${expectedSlug}" is invalid: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (
      typeof metadata.id !== 'string' || !metadata.id
      || typeof metadata.name !== 'string' || !metadata.name.trim()
      || metadata.slug !== expectedSlug || !isReadableSkillStoreSlug(metadata.slug)
      || !Number.isSafeInteger(metadata.version) || Number(metadata.version) < 1
      || typeof metadata.updatedAt !== 'string' || !Number.isFinite(Date.parse(metadata.updatedAt))
      || (metadata.organizationId !== undefined && (
        typeof metadata.organizationId !== 'string'
        || this.validatedOrganizationId(metadata.organizationId) !== expectedOrganizationId
      ))
      || (metadata.expertId !== undefined && (
        typeof metadata.expertId !== 'string'
        || metadata.expertId.length > 128
        || !/^[a-zA-Z0-9_-]+$/.test(metadata.expertId)
      ))
    ) {
      throw new SkillRepositoryInputError(`The Skill metadata for "${expectedSlug}" is invalid`)
    }
    return {
      id: metadata.id,
      name: metadata.name,
      slug: metadata.slug,
      version: Number(metadata.version),
      updatedAt: metadata.updatedAt,
      organizationId: expectedOrganizationId,
      expertId: metadata.expertId
    }
  }

  private async latestRevisionVersion(revisionsDirectory: string, committedThrough = 0): Promise<number> {
    const stats = await optionalLstat(revisionsDirectory)
    if (!stats) return 0
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new SkillRepositoryInputError('The Skill revisions entry is not a safe directory')
    }

    let latest = 0
    for (const entry of await readdir(revisionsDirectory, { withFileTypes: true })) {
      if (!/^\d+$/.test(entry.name)) continue
      const version = Number(entry.name)
      if (!Number.isSafeInteger(version) || version < 1 || !entry.isDirectory() || entry.isSymbolicLink()) {
        throw new SkillRepositoryInputError('The Skill revisions entry contains an invalid version')
      }
      if (version > committedThrough) {
        const markerStats = await optionalLstat(path.join(revisionsDirectory, entry.name, '.committed'))
        if (!markerStats) continue
        if (!markerStats.isFile() || markerStats.isSymbolicLink()) {
          throw new SkillRepositoryInputError('The Skill revision commit marker is not a safe file')
        }
      }
      latest = Math.max(latest, version)
    }
    return latest
  }

  private async prepareRevision(
    revisionsDirectory: string,
    version: number,
    skillMarkdown: string,
    evalsJson: string | null | undefined
  ): Promise<{ temporaryDirectory: string; revisionDirectory: string }> {
    const temporaryDirectory = path.join(revisionsDirectory, `.revision-${version}-${randomUUID()}.tmp`)
    const revisionDirectory = path.join(revisionsDirectory, String(version))
    const existingRevisionStats = await optionalLstat(revisionDirectory)
    if (existingRevisionStats) {
      if (!existingRevisionStats.isDirectory() || existingRevisionStats.isSymbolicLink()) {
        throw new SkillRepositoryInputError('The Skill revision entry is not a safe directory')
      }
      const markerStats = await optionalLstat(path.join(revisionDirectory, '.committed'))
      if (markerStats) {
        throw new SkillRepositoryConflictError('The Skill revision changed while it was being saved; reload and retry')
      }
      await rm(revisionDirectory, { recursive: true })
    }
    await mkdir(temporaryDirectory)
    try {
      await atomicWrite(path.join(temporaryDirectory, 'SKILL.md'), skillMarkdown)
      if (evalsJson) await atomicWrite(path.join(temporaryDirectory, 'evals.json'), evalsJson)
      await atomicWrite(path.join(temporaryDirectory, '.committed'), 'committed\n')
      return { temporaryDirectory, revisionDirectory }
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
  }

  private async commitPreparedRevision(prepared: { temporaryDirectory: string; revisionDirectory: string }): Promise<void> {
    try {
      await rename(prepared.temporaryDirectory, prepared.revisionDirectory)
    } catch (error) {
      await rm(prepared.temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
      if (isNodeError(error, 'EEXIST') || isNodeError(error, 'ENOTEMPTY')) {
        throw new SkillRepositoryConflictError('The Skill revision changed while it was being saved; reload and retry')
      }
      throw error
    }
  }

  private async inspect(slug: string, organizationId?: string) {
    const directory = this.directory(slug, organizationId)
    const directoryStats = await optionalLstat(directory)
    if (!directoryStats) return null
    if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
      throw new SkillRepositoryInputError(`The storage entry for "${slug}" is not a safe directory`)
    }

    const skillPath = path.join(directory, 'SKILL.md')
    const skillStats = await optionalLstat(skillPath)
    if (skillStats && (!skillStats.isFile() || skillStats.isSymbolicLink())) {
      throw new SkillRepositoryInputError(`The SKILL.md entry for "${slug}" is not a safe file`)
    }

    const evalDirectory = path.join(directory, 'evals')
    const evalDirectoryStats = await optionalLstat(evalDirectory)
    if (evalDirectoryStats && (!evalDirectoryStats.isDirectory() || evalDirectoryStats.isSymbolicLink())) {
      throw new SkillRepositoryInputError(`The evals entry for "${slug}" is not a safe directory`)
    }
    const evalPath = path.join(evalDirectory, 'evals.json')
    const evalStats = evalDirectoryStats ? await optionalLstat(evalPath) : null
    if (evalStats && (!evalStats.isFile() || evalStats.isSymbolicLink())) {
      throw new SkillRepositoryInputError(`The evals.json entry for "${slug}" is not a safe file`)
    }

    const metadata = await this.readMetadata(directory, slug, organizationId)
    const revisionsDirectory = path.join(directory, 'revisions')
    const latestRevision = await this.latestRevisionVersion(revisionsDirectory, metadata?.version || 0)
    if (metadata && latestRevision > 0 && metadata.version > latestRevision) {
      throw new SkillRepositoryInputError(`The Skill revision metadata for "${slug}" is inconsistent`)
    }

    let managedSkillPath = skillPath
    let managedSkillStats = skillStats
    let managedEvalPath = evalPath
    let managedEvalStats = evalStats
    const version = Math.max(metadata?.version || 0, latestRevision, 1)
    if (latestRevision > 0) {
      const revisionDirectory = path.join(revisionsDirectory, String(version))
      const revisionStats = await optionalLstat(revisionDirectory)
      if (!revisionStats?.isDirectory() || revisionStats.isSymbolicLink()) {
        throw new SkillRepositoryInputError(`The revision entry for "${slug}" is not a safe directory`)
      }
      managedSkillPath = path.join(revisionDirectory, 'SKILL.md')
      managedSkillStats = await lstat(managedSkillPath)
      if (!managedSkillStats.isFile() || managedSkillStats.isSymbolicLink()) {
        throw new SkillRepositoryInputError(`The revision SKILL.md for "${slug}" is not a safe file`)
      }
      managedEvalPath = path.join(revisionDirectory, 'evals.json')
      managedEvalStats = await optionalLstat(managedEvalPath)
      if (managedEvalStats && (!managedEvalStats.isFile() || managedEvalStats.isSymbolicLink())) {
        throw new SkillRepositoryInputError(`The revision evals.json for "${slug}" is not a safe file`)
      }
    }
    if (!managedSkillStats) return null
    const identity: StoredIdentity = {
      id: metadata?.id || `filesystem:${organizationId || 'global'}:${slug}`,
      name: metadata?.name || slug,
      slug,
      version,
      updatedAt: new Date(Math.max(
        metadata ? Date.parse(metadata.updatedAt) : 0,
        managedSkillStats.mtimeMs,
        managedEvalStats?.mtimeMs || 0
      )).toISOString(),
      organizationId,
      expertId: metadata?.expertId
    }
    return {
      directory,
      skillPath: managedSkillPath,
      skillStats: managedSkillStats,
      evalPath: managedEvalPath,
      evalStats: managedEvalStats,
      identity
    }
  }

  private async existingSlug(input: string, organizationId?: string): Promise<string | null> {
    for (const slug of skillStoreSlugCandidates(input)) {
      const stats = await optionalLstat(this.directory(slug, organizationId))
      if (!stats) continue
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new SkillRepositoryInputError(`The storage entry for "${slug}" is not a safe directory`)
      }
      return slug
    }
    return null
  }

  private async isRecoverableProvisionalDirectory(directory: string): Promise<boolean> {
    const entries = await readdir(directory, { withFileTypes: true })
    if (entries.length === 0) return true
    if (entries.length !== 1 || entries[0]?.name !== 'revisions' || !entries[0].isDirectory() || entries[0].isSymbolicLink()) {
      return false
    }
    const revisionsDirectory = path.join(directory, 'revisions')
    const revisionEntries = await readdir(revisionsDirectory, { withFileTypes: true })
    return revisionEntries.every((entry) => (
      /^\.revision-\d+-[a-f0-9-]+\.tmp$/.test(entry.name)
      && entry.isDirectory()
      && !entry.isSymbolicLink()
    ))
  }

  private async existingSlugForSave(input: string, organizationId?: string): Promise<string | null> {
    const canonicalSlug = skillStoreSlug(input)
    const uniqueLegacySlug = legacyHashedSkillSlug(input)
    for (const slug of skillStoreSlugCandidates(input)) {
      const directory = this.directory(slug, organizationId)
      const stats = await optionalLstat(directory)
      if (!stats) continue
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new SkillRepositoryInputError(`The storage entry for "${slug}" is not a safe directory`)
      }
      const detail = await this.inspect(slug, organizationId)
      if (!detail) {
        if (await this.isRecoverableProvisionalDirectory(directory)) continue
        throw new SkillRepositoryInputError(`The storage entry for "${slug}" is incomplete and cannot be managed safely`)
      }
      if (slug === canonicalSlug || slug === uniqueLegacySlug) return slug
      const metadata = await this.readMetadata(directory, slug, organizationId)
      if (metadata?.name.trim() === input.trim()) return slug
    }
    return null
  }

  private async readDetailBySlug(slug: string, organizationId?: string): Promise<StoredSkillDetail | null> {
    const files = await this.inspect(slug, organizationId)
    if (!files) return null
    const [skillMarkdown, evalsJson] = await Promise.all([
      readFile(files.skillPath, 'utf8'),
      files.evalStats ? readFile(files.evalPath, 'utf8') : Promise.resolve(null)
    ])
    await this.materializeCurrent(files.directory, skillMarkdown, evalsJson)
    return storedSkillDetail(files.identity, skillMarkdown, evalsJson)
  }

  private async materializeCurrent(directory: string, skillMarkdown: string, evalsJson: string | null): Promise<void> {
    await assertSafeDirectory(directory, 'The Skill storage entry')
    if (evalsJson) {
      const evalDirectory = path.join(directory, 'evals')
      await ensureSafeDirectory(evalDirectory, 'The managed evals entry')
      await atomicWriteIfChanged(path.join(evalDirectory, 'evals.json'), evalsJson, 'The managed evals file')
    } else {
      await this.removeCurrentEvals(directory)
    }
    await atomicWriteIfChanged(path.join(directory, 'SKILL.md'), skillMarkdown, 'The managed SKILL.md file')
  }

  private async removeCurrentEvals(directory: string): Promise<void> {
    const evalDirectory = path.join(directory, 'evals')
    const directoryStats = await optionalLstat(evalDirectory)
    if (!directoryStats) return
    if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
      throw new SkillRepositoryInputError('The managed evals entry is not a safe directory')
    }
    const evalPath = path.join(evalDirectory, 'evals.json')
    const evalStats = await optionalLstat(evalPath)
    if (evalStats?.isSymbolicLink()) {
      throw new SkillRepositoryInputError('The managed evals file must not be a symbolic link')
    }
    await rm(evalPath, { force: true })
    await rmdir(evalDirectory).catch((error: unknown) => {
      if (!isNodeError(error, 'ENOENT') && !isNodeError(error, 'ENOTEMPTY') && !isNodeError(error, 'EEXIST')) throw error
    })
  }

  private async cleanupDeletionTombstones(organizationId?: string): Promise<void> {
    const root = this.scopeRoot(organizationId)
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!/^\.deleted-[a-z0-9-]+-[a-f0-9-]+\.tmp$/.test(entry.name)) continue
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new SkillRepositoryInputError('The deleted Skill entry is not a safe directory')
      }
      await rm(path.join(root, entry.name), { recursive: true, force: true })
    }
  }

  async resolveSlug(skillName: string, organizationId?: string): Promise<string | null> {
    return runAppEffect(tryPromiseEffect('Resolve local skill', async () => {
      await this.ensureScopeRoot(organizationId)
      await this.cleanupDeletionTombstones(organizationId)
      return this.existingSlugForSave(skillName, organizationId)
    }))
  }

  async save(input: SkillSaveRequest, options: SkillRepositorySaveOptions = {}): Promise<StoredSkillSummary> {
    return runAppEffect(tryPromiseEffect('Save local skill', async () => {
      const organizationId = this.validatedOrganizationId(input.organizationId)
      await this.ensureScopeRoot(organizationId)
      await this.cleanupDeletionTombstones(organizationId)
      const canonicalSlug = skillStoreSlug(input.skillName)
      const compatibleSlug = options.targetSlug
        ? null
        : await this.existingSlugForSave(input.skillName, organizationId)
      const requestedSlug = options.targetSlug || compatibleSlug || canonicalSlug
      if (!isReadableSkillStoreSlug(requestedSlug)) throw new SkillRepositoryInputError('Invalid target Skill slug')
      const lockKey = this.lockKey(requestedSlug, organizationId)

      return withSkillSaveLock(lockKey, async () => {
        const releaseFileLock = await this.acquireFileSaveLock(lockKey)
        try {
          const requestedDirectory = this.directory(requestedSlug, organizationId)
          let requestedStats = await optionalLstat(requestedDirectory)
          if (requestedStats && (!requestedStats.isDirectory() || requestedStats.isSymbolicLink())) {
            throw new SkillRepositoryInputError(`The storage entry for "${requestedSlug}" is not a safe directory`)
          }
          if (requestedStats && await this.isRecoverableProvisionalDirectory(requestedDirectory)) {
            await rm(requestedDirectory, { recursive: true })
            requestedStats = null
          }
          const foundSlug = requestedStats ? requestedSlug : null
          if (options.targetSlug && !foundSlug) {
            throw new SkillRepositoryConflictError('The Skill changed while it was being saved; reload and retry')
          }
          if (options.createOnly && foundSlug) {
            throw new SkillRepositoryConflictError(`A skill named "${input.skillName.trim()}" already exists`)
          }

          const slug = foundSlug || requestedSlug
          const directory = this.directory(slug, organizationId)
          if (!foundSlug) {
            try {
              await mkdir(directory)
            } catch (error) {
              if (isNodeError(error, 'EEXIST')) {
                throw new SkillRepositoryConflictError(`A skill named "${input.skillName.trim()}" already exists`)
              }
              throw error
            }
          } else {
            await assertSafeDirectory(directory, 'The Skill storage entry')
          }

          const existingFiles = await this.inspect(slug, organizationId)
          const existingMetadata = await this.readMetadata(directory, slug, organizationId)
          const revisionsDirectory = path.join(directory, 'revisions')
          await ensureSafeDirectory(revisionsDirectory, 'The Skill revisions entry')

          let latestRevision = await this.latestRevisionVersion(revisionsDirectory, existingMetadata?.version || 0)
          if (!existingMetadata && existingFiles && latestRevision === 0) {
            const [legacyMarkdown, legacyEvals] = await Promise.all([
              readFile(existingFiles.skillPath, 'utf8'),
              existingFiles.evalStats ? readFile(existingFiles.evalPath, 'utf8') : Promise.resolve(null)
            ])
            const legacyRevision = await this.prepareRevision(revisionsDirectory, 1, legacyMarkdown, legacyEvals)
            await this.commitPreparedRevision(legacyRevision)
            latestRevision = 1
          }

          const currentVersion = Math.max(existingMetadata?.version || 0, latestRevision)
          if (options.expectedVersion !== undefined && currentVersion !== options.expectedVersion) {
            throw new SkillRepositoryConflictError('This Skill has a newer version; reload it before saving')
          }

          const version = currentVersion + 1
          const preparedRevision = await this.prepareRevision(
            revisionsDirectory,
            version,
            input.skillMarkdown,
            input.evalsJson
          )
          await this.commitPreparedRevision(preparedRevision)

          const identity: StoredIdentity = {
            id: existingMetadata?.id || `filesystem:${organizationId || 'global'}:${slug}`,
            name: input.skillName.trim(),
            slug,
            version,
            updatedAt: new Date().toISOString(),
            organizationId,
            expertId: input.expertId
          }
          await atomicWrite(path.join(directory, METADATA_FILE), `${JSON.stringify(identity, null, 2)}\n`)
          await this.materializeCurrent(directory, input.skillMarkdown, input.evalsJson || null)

          const detail = await this.readDetailBySlug(slug, organizationId)
          if (!detail) throw new Error('The Skill was saved but could not be read back')
          return detail
        } finally {
          await releaseFileLock()
        }
      })
    }))
  }

  async list(organizationId?: string): Promise<StoredSkillSummary[]> {
    return runAppEffect(tryPromiseEffect('List local skills', async () => {
      await this.ensureScopeRoot(organizationId)
      await this.cleanupDeletionTombstones(organizationId)
      const root = this.scopeRoot(organizationId)
      const entries = await readdir(root, { withFileTypes: true })
      const summaries = await Promise.all(entries
        .filter((entry) => (
          entry.isDirectory()
          && !entry.isSymbolicLink()
          && isReadableSkillStoreSlug(entry.name)
          && (organizationId !== undefined || entry.name !== 'organizations')
        ))
        .map(async (entry): Promise<StoredSkillSummary | null> => {
          const files = await this.inspect(entry.name, organizationId)
          if (!files) return null
          const markdownPreview = await readFilePrefix(files.skillPath)
          return storedSkillSummary(files.identity, markdownPreview, {
            sizeBytes: files.skillStats.size + (files.evalStats?.size || 0),
            hasEvals: Boolean(files.evalStats?.size)
          })
        }))

      return summaries
        .filter((summary): summary is StoredSkillSummary => summary !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    }))
  }

  async read(skillName: string, organizationId?: string): Promise<string | null> {
    return (await this.readDetail(skillName, organizationId))?.skillMarkdown || null
  }

  async readDetail(skillName: string, organizationId?: string): Promise<StoredSkillDetail | null> {
    return runAppEffect(tryPromiseEffect('Read local skill', async () => {
      await this.ensureScopeRoot(organizationId)
      await this.cleanupDeletionTombstones(organizationId)
      const candidates = isReadableSkillStoreSlug(skillName.trim())
        ? [skillName.trim()]
        : skillStoreSlugCandidates(skillName)
      for (const slug of candidates) {
        const lockKey = this.lockKey(slug, organizationId)
        const detail = await withSkillSaveLock(lockKey, async () => {
          const releaseFileLock = await this.acquireFileSaveLock(lockKey)
          try {
            return await this.readDetailBySlug(slug, organizationId)
          } finally {
            await releaseFileLock()
          }
        })
        if (detail) return detail
      }
      return null
    }))
  }

  async delete(skillName: string, organizationId?: string): Promise<boolean> {
    return runAppEffect(tryPromiseEffect('Delete local skill', async () => {
      await this.ensureScopeRoot(organizationId)
      await this.cleanupDeletionTombstones(organizationId)
      const slug = isReadableSkillStoreSlug(skillName.trim())
        ? skillName.trim()
        : await this.existingSlug(skillName, organizationId)
      if (!slug) return false
      const lockKey = this.lockKey(slug, organizationId)
      return withSkillSaveLock(lockKey, async () => {
        const releaseFileLock = await this.acquireFileSaveLock(lockKey)
        try {
          const directory = this.directory(slug, organizationId)
          const stats = await optionalLstat(directory)
          if (!stats) return false
          if (!stats.isDirectory() || stats.isSymbolicLink()) {
            throw new SkillRepositoryInputError(`The storage entry for "${slug}" is not a safe directory`)
          }
          const tombstone = path.join(
            this.scopeRoot(organizationId),
            `.deleted-${slug}-${randomUUID()}.tmp`
          )
          await rename(directory, tombstone)
          await rm(tombstone, { recursive: true, force: true }).catch(() => undefined)
          return true
        } finally {
          await releaseFileLock()
        }
      })
    }))
  }
}
