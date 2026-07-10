import type { SkillSaveRequest, StoredSkillSummary } from '../types'

export interface SkillRepository {
  save(input: SkillSaveRequest): Promise<StoredSkillSummary>
  list(): Promise<StoredSkillSummary[]>
  read(skillName: string): Promise<string | null>
}
