import type { SkillSaveRequest, StoredSkillSummary } from '../types'

export interface SkillRepository {
  save(input: SkillSaveRequest): Promise<StoredSkillSummary>
  list(organizationId?: string): Promise<StoredSkillSummary[]>
  read(skillName: string, organizationId?: string): Promise<string | null>
}
