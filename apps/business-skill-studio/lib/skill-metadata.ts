import type { StoredSkillDetail, StoredSkillSummary } from './types'

type StoredSkillIdentity = Pick<
  StoredSkillSummary,
  'id' | 'name' | 'slug' | 'version' | 'updatedAt' | 'organizationId' | 'expertId'
>

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function parseSkillMetadata(markdown: string, fallbackName: string) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || ''
  const field = (name: string) => {
    const match = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))
    return match?.[1] ? unquoteYamlValue(match[1]) : ''
  }
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()

  return {
    frontmatterName: field('name'),
    title: heading || fallbackName,
    description: field('description')
  }
}

export function storedSkillSummary(
  identity: StoredSkillIdentity,
  markdownPreview: string,
  options: { sizeBytes: number; hasEvals: boolean }
): StoredSkillSummary {
  const metadata = parseSkillMetadata(markdownPreview, identity.slug)
  return {
    ...identity,
    title: metadata.title,
    description: metadata.description || '暂无描述',
    sizeBytes: options.sizeBytes,
    hasEvals: options.hasEvals
  }
}

export function storedSkillDetail(
  identity: StoredSkillIdentity,
  skillMarkdown: string,
  evalsJson: string | null
): StoredSkillDetail {
  return {
    ...storedSkillSummary(identity, skillMarkdown, {
      sizeBytes: Buffer.byteLength(skillMarkdown, 'utf8') + Buffer.byteLength(evalsJson || '', 'utf8'),
      hasEvals: Boolean(evalsJson)
    }),
    skillMarkdown,
    evalsJson
  }
}
