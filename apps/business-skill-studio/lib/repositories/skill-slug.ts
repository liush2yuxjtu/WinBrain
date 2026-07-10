import { createHash } from 'node:crypto'
import { normalizeSkillName } from '../skill-creator'

export function skillStoreSlug(input: string): string {
  const trimmed = input.trim()
  const normalized = normalizeSkillName(trimmed)

  if (normalized !== 'business-skill' || /[a-z0-9]/i.test(trimmed)) {
    return normalized
  }

  const suffix = createHash('sha256').update(trimmed).digest('hex').slice(0, 12)
  return `business-skill-${suffix}`
}
