import type { PrismaClient } from '../../generated/prisma/client'
import { storedSkillDetail, storedSkillSummary } from '../skill-metadata'
import type { SkillSaveRequest, StoredSkillDetail, StoredSkillSummary } from '../types'
import {
  SkillRepositoryConflictError,
  SkillRepositoryInputError,
  type SkillRepository,
  type SkillRepositorySaveOptions
} from './skill-repository'
import { isReadableSkillStoreSlug, legacyHashedSkillSlug, skillStoreSlug, skillStoreSlugCandidates } from './skill-slug'

const MAX_TRANSACTION_ATTEMPTS = 5

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  const code = String(error.code)
  return code === 'P2002' || code === 'P2034'
}

function optionalIdentifier(value: string | undefined, field: string): string | undefined {
  if (!value) return undefined
  if (value.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new SkillRepositoryInputError(`Invalid ${field}`)
  }
  return value
}

function chooseBySlug<T extends { slug: string }>(skills: T[], candidates: string[]): T | null {
  for (const slug of candidates) {
    const skill = skills.find((candidate) => candidate.slug === slug)
    if (skill) return skill
  }
  return null
}

export class PrismaSkillRepository implements SkillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private scope(organizationId?: string) {
    const validatedOrganizationId = optionalIdentifier(organizationId, 'organizationId')
    return {
      organizationId: validatedOrganizationId,
      scopeKey: validatedOrganizationId || 'global',
      where: validatedOrganizationId
        ? { scopeKey: validatedOrganizationId, organizationId: validatedOrganizationId }
        : { scopeKey: 'global', organizationId: null }
    }
  }

  async resolveSlug(skillName: string, organizationId?: string): Promise<string | null> {
    const { where } = this.scope(organizationId)
    const canonicalSlug = skillStoreSlug(skillName)
    const uniqueLegacySlug = legacyHashedSkillSlug(skillName)
    const matches = await this.prisma.skill.findMany({
      where: { ...where, slug: { in: skillStoreSlugCandidates(skillName) } },
      select: { slug: true, name: true }
    })
    return matches.find((skill) => skill.slug === canonicalSlug)?.slug
      || matches.find((skill) => skill.slug === uniqueLegacySlug)?.slug
      || matches.find((skill) => skill.name.trim() === skillName.trim())?.slug
      || null
  }

  async save(input: SkillSaveRequest, options: SkillRepositorySaveOptions = {}): Promise<StoredSkillSummary> {
    const { organizationId, scopeKey, where } = this.scope(input.organizationId)
    const expertId = optionalIdentifier(input.expertId, 'expertId')
    const canonicalSlug = skillStoreSlug(input.skillName)
    const uniqueLegacySlug = legacyHashedSkillSlug(input.skillName)
    const candidates = options.targetSlug ? [options.targetSlug] : skillStoreSlugCandidates(input.skillName)
    const targetSlug = options.targetSlug || canonicalSlug
    if (!isReadableSkillStoreSlug(targetSlug)) throw new SkillRepositoryInputError('Invalid target Skill slug')

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          if (organizationId) {
            const organization = await transaction.organization.findUnique({
              where: { id: organizationId },
              select: { id: true }
            })
            if (!organization) throw new SkillRepositoryInputError('Selected organization does not exist')
          }

          if (expertId) {
            const expert = await transaction.expert.findUnique({
              where: { id: expertId },
              select: { organizationId: true }
            })
            if (!expert || expert.organizationId !== organizationId) {
              throw new SkillRepositoryInputError('Selected expert does not belong to the selected organization')
            }
          }

          const matches = await transaction.skill.findMany({
            where: { ...where, slug: { in: candidates } },
            select: { id: true, slug: true, name: true }
          })
          const existing = options.targetSlug
            ? matches[0] || null
            : matches.find((skill) => skill.slug === canonicalSlug)
              || matches.find((skill) => skill.slug === uniqueLegacySlug)
              || matches.find((skill) => skill.name.trim() === input.skillName.trim())
              || null

          if (options.targetSlug && !existing) {
            throw new SkillRepositoryConflictError('The Skill changed while it was being saved; reload and retry')
          }
          if (existing && options.createOnly) {
            throw new SkillRepositoryConflictError(`A skill named "${input.skillName.trim()}" already exists`)
          }

          const skill = existing
            ? await transaction.skill.update({
                where: { id: existing.id },
                data: { name: input.skillName.trim(), expertId }
              })
            : await transaction.skill.create({
                data: {
                  scopeKey,
                  organizationId,
                  expertId,
                  slug: targetSlug,
                  name: input.skillName.trim()
                }
              })

          const latestRevision = await transaction.skillRevision.aggregate({
            where: { skillId: skill.id },
            _max: { version: true }
          })
          if (options.expectedVersion !== undefined && latestRevision._max.version !== options.expectedVersion) {
            throw new SkillRepositoryConflictError('This Skill has a newer version; reload it before saving')
          }
          const version = (latestRevision._max.version || 0) + 1

          await transaction.skillRevision.create({
            data: {
              skillId: skill.id,
              version,
              skillMarkdown: input.skillMarkdown,
              evalsJson: input.evalsJson || null
            }
          })

          return storedSkillSummary({
            id: skill.id,
            name: skill.name,
            slug: skill.slug,
            version,
            updatedAt: skill.updatedAt.toISOString(),
            organizationId: skill.organizationId || undefined,
            expertId: skill.expertId || undefined
          }, input.skillMarkdown, {
            sizeBytes: Buffer.byteLength(input.skillMarkdown, 'utf8') + Buffer.byteLength(input.evalsJson || '', 'utf8'),
            hasEvals: Boolean(input.evalsJson)
          })
        }, {
          isolationLevel: 'Serializable'
        })
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryableTransactionError(error)) continue
        throw error
      }
    }

    throw new Error('Unable to save skill after retrying the database transaction')
  }

  async list(organizationId?: string): Promise<StoredSkillSummary[]> {
    const { where } = this.scope(organizationId)
    const skills = await this.prisma.skill.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true, skillMarkdown: true, evalsJson: true }
        }
      }
    })

    return skills.map((skill) => {
      const revision = skill.revisions[0]
      const skillMarkdown = revision?.skillMarkdown || ''
      const evalsJson = revision?.evalsJson || null
      return storedSkillSummary({
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        version: revision?.version || 0,
        updatedAt: skill.updatedAt.toISOString(),
        organizationId: skill.organizationId || undefined,
        expertId: skill.expertId || undefined
      }, skillMarkdown, {
        sizeBytes: Buffer.byteLength(skillMarkdown, 'utf8') + Buffer.byteLength(evalsJson || '', 'utf8'),
        hasEvals: Boolean(evalsJson)
      })
    })
  }

  async read(skillName: string, organizationId?: string): Promise<string | null> {
    return (await this.readDetail(skillName, organizationId))?.skillMarkdown || null
  }

  async readDetail(skillName: string, organizationId?: string): Promise<StoredSkillDetail | null> {
    const { where } = this.scope(organizationId)
    const normalizedName = skillName.trim()
    const candidates = isReadableSkillStoreSlug(normalizedName)
      ? [normalizedName]
      : skillStoreSlugCandidates(normalizedName)
    const matches = await this.prisma.skill.findMany({
      where: { ...where, slug: { in: candidates } },
      include: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true, skillMarkdown: true, evalsJson: true }
        }
      }
    })
    const skill = chooseBySlug(matches, candidates)
    const revision = skill?.revisions[0]
    if (!skill || !revision) return null

    return storedSkillDetail({
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      version: revision.version,
      updatedAt: skill.updatedAt.toISOString(),
      organizationId: skill.organizationId || undefined,
      expertId: skill.expertId || undefined
    }, revision.skillMarkdown, revision.evalsJson)
  }

  async delete(skillName: string, organizationId?: string): Promise<boolean> {
    const { where } = this.scope(organizationId)
    const normalizedName = skillName.trim()
    const candidates = isReadableSkillStoreSlug(normalizedName)
      ? [normalizedName]
      : skillStoreSlugCandidates(normalizedName)
    const matches = await this.prisma.skill.findMany({
      where: { ...where, slug: { in: candidates } },
      select: { id: true, slug: true }
    })
    const skill = chooseBySlug(matches, candidates)
    if (!skill) return false
    await this.prisma.skill.delete({ where: { id: skill.id } })
    return true
  }
}
