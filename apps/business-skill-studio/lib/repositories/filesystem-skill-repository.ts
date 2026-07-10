import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runAppEffect, tryPromiseEffect } from '../effect-runtime'
import { normalizeSkillName } from '../skill-creator'
import type { SkillSaveRequest, StoredSkillSummary } from '../types'
import type { SkillRepository } from './skill-repository'
import { skillStoreSlug } from './skill-slug'

const DEFAULT_STORAGE_DIR = 'data/generated-skills'
const METADATA_FILE = '.skill-store.json'

type FileSkillMetadata = StoredSkillSummary

async function readMetadata(directory: string): Promise<FileSkillMetadata | null> {
  try {
    const content = await readFile(path.join(directory, METADATA_FILE), 'utf8')
    return JSON.parse(content) as FileSkillMetadata
  } catch {
    return null
  }
}

export class FileSystemSkillRepository implements SkillRepository {
  private readonly root: string

  constructor(storageDirectory = process.env.SKILL_STUDIO_STORAGE_DIR || DEFAULT_STORAGE_DIR) {
    this.root = path.resolve(process.cwd(), storageDirectory)
  }

  private scopeRoot(organizationId?: string): string {
    return organizationId ? path.join(this.root, 'organizations', organizationId) : this.root
  }

  private directory(slug: string, organizationId?: string): string {
    return path.join(this.scopeRoot(organizationId), slug)
  }

  async save(input: SkillSaveRequest): Promise<StoredSkillSummary> {
    return runAppEffect(tryPromiseEffect('Save local skill', async () => {
      const slug = skillStoreSlug(input.skillName)
      const directory = this.directory(slug, input.organizationId)
      const currentMetadata = await readMetadata(directory)
      const version = (currentMetadata?.version || 0) + 1
      const updatedAt = new Date().toISOString()
      const scopeKey = input.organizationId || 'global'
      const summary: StoredSkillSummary = {
        id: currentMetadata?.id || `filesystem:${scopeKey}:${slug}`,
        name: input.skillName,
        slug,
        version,
        updatedAt,
        organizationId: input.organizationId,
        expertId: input.expertId
      }

      const revisionDirectory = path.join(directory, 'revisions', String(version))
      await mkdir(revisionDirectory, { recursive: true })
      await writeFile(path.join(directory, 'SKILL.md'), input.skillMarkdown, 'utf8')
      await writeFile(path.join(revisionDirectory, 'SKILL.md'), input.skillMarkdown, 'utf8')

      const currentEvalDirectory = path.join(directory, 'evals')
      if (input.evalsJson) {
        await mkdir(currentEvalDirectory, { recursive: true })
        await writeFile(path.join(currentEvalDirectory, 'evals.json'), input.evalsJson, 'utf8')
        await writeFile(path.join(revisionDirectory, 'evals.json'), input.evalsJson, 'utf8')
      } else {
        await rm(path.join(currentEvalDirectory, 'evals.json'), { force: true })
      }

      await writeFile(path.join(directory, METADATA_FILE), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
      return summary
    }))
  }

  async list(organizationId?: string): Promise<StoredSkillSummary[]> {
    return runAppEffect(tryPromiseEffect('List local skills', async () => {
      const root = this.scopeRoot(organizationId)
      await mkdir(root, { recursive: true })
      const entries = await readdir(root, { withFileTypes: true })
      const summaries = await Promise.all(entries
        .filter((entry) => entry.isDirectory() && (organizationId || entry.name !== 'organizations'))
        .map(async (entry): Promise<StoredSkillSummary | null> => {
          const directory = this.directory(entry.name, organizationId)
          const skillPath = path.join(directory, 'SKILL.md')
          const skillStats = await stat(skillPath).catch(() => null)
          if (!skillStats) return null

          const metadata = await readMetadata(directory)
          return metadata || {
            id: `filesystem:${organizationId || 'global'}:${entry.name}`,
            name: entry.name,
            slug: entry.name,
            version: 1,
            updatedAt: skillStats.mtime.toISOString(),
            organizationId
          }
        }))

      return summaries
        .filter((summary): summary is StoredSkillSummary => summary !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    }))
  }

  async read(skillName: string, organizationId?: string): Promise<string | null> {
    return runAppEffect(tryPromiseEffect('Read local skill', async () => {
      const candidateSlugs = [...new Set([
        skillStoreSlug(skillName),
        normalizeSkillName(skillName)
      ])]

      for (const slug of candidateSlugs) {
        const content = await readFile(path.join(this.directory(slug, organizationId), 'SKILL.md'), 'utf8').catch(() => null)
        if (content !== null) return content
      }

      return null
    }))
  }
}
