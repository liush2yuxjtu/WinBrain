import { createHash } from 'node:crypto'
import { normalizeSkillName } from '../skill-creator'

export function skillStoreSlug(input: string): string {
  const trimmed = input.trim()
  const normalized = normalizeSkillName(trimmed)

  if (!/[^\u0000-\u007f]/.test(trimmed)) return normalized
  const suffix = createHash('sha256').update(trimmed).digest('hex').slice(0, 12)
  const baseName = normalized.slice(0, 80 - suffix.length - 1).replace(/-+$/g, '') || 'business-skill'
  return `${baseName}-${suffix}`
}

function previousSkillStoreSlug(input: string): string {
  const trimmed = input.trim()
  const normalized = normalizeSkillName(trimmed)
  if (normalized !== 'business-skill' || /[a-z0-9]/i.test(trimmed)) return normalized
  const suffix = createHash('sha256').update(trimmed).digest('hex').slice(0, 12)
  return `business-skill-${suffix}`
}

export function legacyHashedSkillSlug(input: string): string {
  const trimmed = input.trim()
  const asciiName = trimmed
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const baseName = asciiName || 'business-skill'
  let hash = 2166136261
  for (const character of trimmed) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  const suffix = /[^\u0000-\u007f]/.test(trimmed)
    ? `-${(hash >>> 0).toString(36).padStart(6, '0').slice(0, 6)}`
    : ''
  return `${baseName.slice(0, 64 - suffix.length).replace(/-+$/g, '')}${suffix}`
}

export function isSkillStoreSlug(value: string): boolean {
  return /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(value)
}

export function isReadableSkillStoreSlug(value: string): boolean {
  return /^(?!.*--)[a-z0-9][a-z0-9-]{0,79}$/.test(value)
}

export function skillStoreSlugCandidates(input: string): string[] {
  const trimmed = input.trim()
  return [...new Set([
    trimmed,
    skillStoreSlug(trimmed),
    previousSkillStoreSlug(trimmed),
    legacyHashedSkillSlug(trimmed),
    normalizeSkillName(trimmed)
  ].filter(isReadableSkillStoreSlug))]
}
