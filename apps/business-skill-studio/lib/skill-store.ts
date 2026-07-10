import { getPrismaClient } from './db'
import { FileSystemSkillRepository } from './repositories/filesystem-skill-repository'
import { PrismaSkillRepository } from './repositories/prisma-skill-repository'
import {
  SkillRepositoryConflictError,
  SkillRepositoryInputError,
  type SkillRepository
} from './repositories/skill-repository'
import { isReadableSkillStoreSlug, skillStoreSlug } from './repositories/skill-slug'
import { parseSkillMetadata } from './skill-metadata'
import type { SkillSaveRequest, StoredSkillDetail, StoredSkillSummary } from './types'

const MAX_SKILL_BYTES = 1_000_000
const MAX_EVALS_BYTES = 1_000_000

export class SkillStoreValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillStoreValidationError'
  }
}

export class SkillInputError extends SkillStoreValidationError {
  constructor(message: string) {
    super(message)
    this.name = 'SkillInputError'
  }
}

let cachedRepository: { driver: string; repository: SkillRepository } | null = null

function configuredDriver(): string {
  return process.env.SKILL_STORE_DRIVER?.trim().toLowerCase() || 'filesystem'
}

function repository(): SkillRepository {
  const driver = configuredDriver()
  if (cachedRepository?.driver === driver) return cachedRepository.repository

  let selected: SkillRepository
  if (driver === 'filesystem') {
    selected = new FileSystemSkillRepository()
  } else if (driver === 'database') {
    selected = new PrismaSkillRepository(getPrismaClient())
  } else {
    throw new Error(`Unsupported SKILL_STORE_DRIVER: ${driver}`)
  }

  cachedRepository = { driver, repository: selected }
  return selected
}

function optionalIdentifier(value: string | undefined, field: string): string | undefined {
  if (!value?.trim()) return undefined
  const cleaned = value.trim()
  if (cleaned.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    throw new SkillStoreValidationError(`${field} is invalid`)
  }
  return cleaned
}

export function normalizeSkillSaveRequest(input: SkillSaveRequest): SkillSaveRequest {
  const skillName = input.skillName?.trim()
  const skillMarkdown = input.skillMarkdown

  if (!skillName) throw new SkillStoreValidationError('skillName is required')
  if (!skillMarkdown?.trim()) throw new SkillStoreValidationError('skillMarkdown is required')
  if (Buffer.byteLength(skillMarkdown, 'utf8') > MAX_SKILL_BYTES) {
    throw new SkillStoreValidationError('SKILL.md must be smaller than 1 MB')
  }

  const rawEvalsJson = input.evalsJson?.trim()
  let evalsJson: string | undefined
  if (rawEvalsJson) {
    if (Buffer.byteLength(rawEvalsJson, 'utf8') > MAX_EVALS_BYTES) {
      throw new SkillStoreValidationError('evals/evals.json must be smaller than 1 MB')
    }
    let parsedEvals: unknown
    try {
      parsedEvals = JSON.parse(rawEvalsJson)
    } catch {
      throw new SkillStoreValidationError('evals/evals.json must contain valid JSON')
    }
    evalsJson = `${JSON.stringify(parsedEvals, null, 2)}\n`
    if (Buffer.byteLength(evalsJson, 'utf8') > MAX_EVALS_BYTES) {
      throw new SkillStoreValidationError('evals/evals.json must be smaller than 1 MB after formatting')
    }
  }

  return {
    skillName,
    skillMarkdown,
    evalsJson,
    organizationId: optionalIdentifier(input.organizationId, 'organizationId'),
    expertId: optionalIdentifier(input.expertId, 'expertId')
  }
}

function normalizeManagedSkillRequest(
  input: SkillSaveRequest,
  options: { requireFrontmatter: boolean; expectedFrontmatterName?: string }
): SkillSaveRequest {
  const normalized = normalizeSkillSaveRequest(input)
  const metadata = parseSkillMetadata(normalized.skillMarkdown, normalized.skillName)

  if (options.requireFrontmatter && (!metadata.frontmatterName || !metadata.description)) {
    throw new SkillInputError('SKILL.md must start with YAML frontmatter containing name and description')
  }
  if (options.expectedFrontmatterName && metadata.frontmatterName !== options.expectedFrontmatterName) {
    throw new SkillInputError(`SKILL.md frontmatter name must remain "${options.expectedFrontmatterName}"`)
  }
  if (options.expectedFrontmatterName && normalized.evalsJson) {
    const evals = JSON.parse(normalized.evalsJson) as unknown
    if (
      evals && typeof evals === 'object' && !Array.isArray(evals)
      && 'skill_name' in evals
      && (evals as { skill_name?: unknown }).skill_name !== options.expectedFrontmatterName
    ) {
      throw new SkillInputError(`evals/evals.json skill_name must match "${options.expectedFrontmatterName}"`)
    }
  }
  return normalized
}

function canonicalizeSkillIdentity(input: SkillSaveRequest, canonicalName: string): SkillSaveRequest {
  const match = input.skillMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  let skillMarkdown = input.skillMarkdown
  if (match) {
    const namePattern = /^name:\s*.*$/mi
    const frontmatter = namePattern.test(match[1])
      ? match[1].replace(namePattern, `name: ${canonicalName}`)
      : `name: ${canonicalName}\n${match[1]}`
    skillMarkdown = `---\n${frontmatter}\n---${input.skillMarkdown.slice(match[0].length)}`
  }

  let evalsJson = input.evalsJson
  if (evalsJson?.trim()) {
    try {
      const evals = JSON.parse(evalsJson) as unknown
      if (evals && typeof evals === 'object' && !Array.isArray(evals)) {
        evalsJson = JSON.stringify({ ...evals, skill_name: canonicalName })
      }
    } catch {
      // Validation below returns the user-facing malformed JSON error.
    }
  }
  return {
    ...input,
    skillMarkdown,
    evalsJson,
    organizationId: optionalIdentifier(input.organizationId, 'organizationId'),
    expertId: optionalIdentifier(input.expertId, 'expertId')
  }
}

export async function saveSkill(
  input: SkillSaveRequest,
  options: { overwrite?: boolean } = {}
): Promise<StoredSkillDetail> {
  const createOnly = options.overwrite === false
  const selectedRepository = repository()
  const normalizedInput = normalizeSkillSaveRequest(input)
  const existingSlug = await selectedRepository.resolveSlug(
    normalizedInput.skillName,
    normalizedInput.organizationId
  )
  if (createOnly && existingSlug) {
    throw new SkillRepositoryConflictError(`A skill named "${normalizedInput.skillName}" already exists`)
  }
  const resolvedSlug = existingSlug || skillStoreSlug(normalizedInput.skillName)
  const canonicalInput = canonicalizeSkillIdentity(normalizedInput, resolvedSlug)
  const normalized = createOnly
    ? normalizeManagedSkillRequest(canonicalInput, {
        requireFrontmatter: true,
        expectedFrontmatterName: resolvedSlug
      })
    : normalizeSkillSaveRequest(canonicalInput)
  const saved = await selectedRepository.save(normalized, {
    createOnly,
    targetSlug: existingSlug || undefined
  })
  const detail = await selectedRepository.readDetail(saved.slug, normalized.organizationId)
  if (!detail) throw new Error('The Skill was saved but could not be read back')
  return detail
}

export async function updateSkill(
  skillName: string,
  input: Omit<SkillSaveRequest, 'skillName'> & { expectedVersion?: number },
  organizationId?: string
): Promise<StoredSkillDetail | null> {
  const normalizedOrganizationId = optionalIdentifier(organizationId, 'organizationId')
  const existing = await readSkillDetail(skillName, normalizedOrganizationId)
  if (!existing) return null
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    throw new SkillRepositoryConflictError('This Skill has a newer version; reload it before saving')
  }

  if (input.organizationId !== undefined && optionalIdentifier(input.organizationId, 'organizationId') !== normalizedOrganizationId) {
    throw new SkillInputError('organizationId cannot be changed while updating a Skill')
  }

  const currentMetadata = parseSkillMetadata(existing.skillMarkdown, existing.slug)
  const normalized = normalizeManagedSkillRequest({
    skillMarkdown: input.skillMarkdown,
    evalsJson: input.evalsJson,
    skillName: existing.name,
    organizationId: normalizedOrganizationId,
    expertId: input.expertId === undefined ? existing.expertId : input.expertId
  }, {
    requireFrontmatter: Boolean(currentMetadata.frontmatterName || currentMetadata.description),
    expectedFrontmatterName: currentMetadata.frontmatterName || undefined
  })
  const saved = await repository().save(normalized, {
    targetSlug: existing.slug,
    expectedVersion: input.expectedVersion
  })
  return repository().readDetail(saved.slug, normalizedOrganizationId)
}

export async function listSkills(organizationId?: string): Promise<StoredSkillSummary[]> {
  return repository().list(optionalIdentifier(organizationId, 'organizationId'))
}

export async function readSkillDetail(
  skillName: string,
  organizationId?: string
): Promise<StoredSkillDetail | null> {
  const normalizedName = skillName.trim()
  if (!normalizedName) return null
  if (!isReadableSkillStoreSlug(normalizedName)) throw new SkillInputError('Invalid Skill slug')
  return repository().readDetail(
    normalizedName,
    optionalIdentifier(organizationId, 'organizationId')
  )
}

export async function readSkill(skillName: string, organizationId?: string): Promise<string | null> {
  const normalizedName = skillName.trim()
  if (!normalizedName) return null
  return repository().read(normalizedName, optionalIdentifier(organizationId, 'organizationId'))
}

export async function deleteSkill(skillName: string, organizationId?: string): Promise<boolean> {
  const normalizedName = skillName.trim()
  if (!normalizedName) return false
  if (!isReadableSkillStoreSlug(normalizedName)) throw new SkillInputError('Invalid Skill slug')
  return repository().delete(
    normalizedName,
    optionalIdentifier(organizationId, 'organizationId')
  )
}

export function skillStoreHttpError(error: unknown): { status: number; message: string } {
  let current: unknown = error

  for (let depth = 0; depth < 8 && current; depth += 1) {
    if (current instanceof SkillStoreValidationError || current instanceof SkillRepositoryInputError) {
      return { status: 400, message: current.message }
    }
    if (current instanceof SkillRepositoryConflictError) {
      return { status: 409, message: current.message }
    }
    current = current instanceof Error && 'cause' in current ? current.cause : null
  }

  console.error('Skill store request failed', error)
  return {
    status: 503,
    message: 'Skill store is unavailable. Check the server logs and storage configuration.'
  }
}
