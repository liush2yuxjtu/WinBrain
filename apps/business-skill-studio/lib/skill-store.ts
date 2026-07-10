import { getPrismaClient } from './db'
import { FileSystemSkillRepository } from './repositories/filesystem-skill-repository'
import { PrismaSkillRepository } from './repositories/prisma-skill-repository'
import type { SkillRepository } from './repositories/skill-repository'
import type { SkillSaveRequest, StoredSkillSummary } from './types'

export class SkillStoreValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillStoreValidationError'
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

export function normalizeSkillSaveRequest(input: SkillSaveRequest): SkillSaveRequest {
  const skillName = input.skillName?.trim()
  const skillMarkdown = input.skillMarkdown

  if (!skillName) {
    throw new SkillStoreValidationError('skillName is required')
  }

  if (!skillMarkdown?.trim()) {
    throw new SkillStoreValidationError('skillMarkdown is required')
  }

  const rawEvalsJson = input.evalsJson?.trim()
  let evalsJson: string | undefined

  if (rawEvalsJson) {
    try {
      evalsJson = `${JSON.stringify(JSON.parse(rawEvalsJson), null, 2)}\n`
    } catch {
      throw new SkillStoreValidationError('evalsJson must be valid JSON')
    }
  }

  return {
    skillName,
    skillMarkdown,
    evalsJson
  }
}

export async function saveSkill(input: SkillSaveRequest): Promise<StoredSkillSummary> {
  return repository().save(normalizeSkillSaveRequest(input))
}

export async function listSkills(): Promise<StoredSkillSummary[]> {
  return repository().list()
}

export async function readSkill(skillName: string): Promise<string | null> {
  const normalizedName = skillName.trim()
  if (!normalizedName) return null
  return repository().read(normalizedName)
}
