import type { SkillSaveRequest, StoredSkillDetail, StoredSkillSummary } from '../types'

export type SkillRepositorySaveOptions = {
  createOnly?: boolean
  targetSlug?: string
  expectedVersion?: number
}

export class SkillRepositoryConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillRepositoryConflictError'
  }
}

export class SkillRepositoryInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillRepositoryInputError'
  }
}

export interface SkillRepository {
  resolveSlug(skillName: string, organizationId?: string): Promise<string | null>
  save(input: SkillSaveRequest, options?: SkillRepositorySaveOptions): Promise<StoredSkillSummary>
  list(organizationId?: string): Promise<StoredSkillSummary[]>
  read(skillName: string, organizationId?: string): Promise<string | null>
  readDetail(skillName: string, organizationId?: string): Promise<StoredSkillDetail | null>
  delete(skillName: string, organizationId?: string): Promise<boolean>
}
