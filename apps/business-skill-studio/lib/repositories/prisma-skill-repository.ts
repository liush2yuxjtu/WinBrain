import type { PrismaClient } from '../../generated/prisma/client'
import type { SkillSaveRequest, StoredSkillSummary } from '../types'
import type { SkillRepository } from './skill-repository'
import { skillStoreSlug } from './skill-slug'

const MAX_TRANSACTION_ATTEMPTS = 5

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  const code = String(error.code)
  return code === 'P2002' || code === 'P2034'
}

export class PrismaSkillRepository implements SkillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(input: SkillSaveRequest): Promise<StoredSkillSummary> {
    const slug = skillStoreSlug(input.skillName)

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (transaction) => {
          const existing = await transaction.skill.findUnique({
            where: { slug },
            select: { id: true }
          })

          const skill = existing
            ? await transaction.skill.update({
                where: { id: existing.id },
                data: { name: input.skillName }
              })
            : await transaction.skill.create({
                data: {
                  slug,
                  name: input.skillName
                }
              })

          const latestRevision = await transaction.skillRevision.aggregate({
            where: { skillId: skill.id },
            _max: { version: true }
          })
          const version = (latestRevision._max.version || 0) + 1

          await transaction.skillRevision.create({
            data: {
              skillId: skill.id,
              version,
              skillMarkdown: input.skillMarkdown,
              evalsJson: input.evalsJson || null
            }
          })

          return {
            id: skill.id,
            name: skill.name,
            slug: skill.slug,
            version,
            updatedAt: skill.updatedAt.toISOString()
          }
        }, {
          isolationLevel: 'Serializable'
        })
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryableTransactionError(error)) {
          continue
        }

        throw error
      }
    }

    throw new Error('Unable to save skill after retrying the database transaction')
  }

  async list(): Promise<StoredSkillSummary[]> {
    const skills = await this.prisma.skill.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true }
        }
      }
    })

    return skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      version: skill.revisions[0]?.version || 0,
      updatedAt: skill.updatedAt.toISOString()
    }))
  }

  async read(skillName: string): Promise<string | null> {
    const skill = await this.prisma.skill.findUnique({
      where: { slug: skillStoreSlug(skillName) },
      select: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { skillMarkdown: true }
        }
      }
    })

    return skill?.revisions[0]?.skillMarkdown || null
  }
}
