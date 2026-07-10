import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, rename, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import { AppError } from '../lib/effect-runtime'
import { FileSystemSkillRepository } from '../lib/repositories/filesystem-skill-repository'
import { SkillRepositoryConflictError, SkillRepositoryInputError } from '../lib/repositories/skill-repository'
import { legacyHashedSkillSlug, skillStoreSlug } from '../lib/repositories/skill-slug'

async function createRepository(t: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'winbrain-skill-store-'))
  t.after(async () => {
    await rm(directory, { recursive: true, force: true })
  })
  return { directory, repository: new FileSystemSkillRepository(directory) }
}

test('filesystem repository keeps current content and numbered revisions', async (t) => {
  const { directory, repository } = await createRepository(t)

  const first = await repository.save({
    skillName: 'Renewal Review',
    skillMarkdown: '# Version 1',
    evalsJson: '{"cases":[]}'
  })
  const second = await repository.save({
    skillName: 'Renewal Review',
    skillMarkdown: '# Version 2'
  })

  assert.equal(first.version, 1)
  assert.equal(second.version, 2)
  assert.equal(await repository.read('Renewal Review'), '# Version 2')
  assert.equal((await repository.readDetail(second.slug))?.evalsJson, null)
  assert.equal(
    await readFile(path.join(directory, second.slug, 'revisions', '1', 'SKILL.md'), 'utf8'),
    '# Version 1'
  )
  assert.equal(
    await readFile(path.join(directory, second.slug, 'revisions', '2', 'SKILL.md'), 'utf8'),
    '# Version 2'
  )

  const listed = await repository.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.version, 2)

  assert.equal(await repository.delete(second.slug), true)
  assert.equal(await repository.delete(second.slug), false)
  assert.equal(await repository.read(second.slug), null)
})

test('filesystem repository rejects duplicate create-only writes', async (t) => {
  const { repository } = await createRepository(t)
  const input = { skillName: 'Renewal Review', skillMarkdown: '# Version 1' }

  await repository.save(input, { createOnly: true })
  await assert.rejects(repository.save(input, { createOnly: true }), (error: unknown) => (
    error instanceof AppError && error.cause instanceof SkillRepositoryConflictError
  ))
})

test('filesystem repository reclaims an abandoned provisional create', async (t) => {
  const { directory, repository } = await createRepository(t)
  const name = 'Abandoned Skill'
  const slug = skillStoreSlug(name)
  const temporaryRevision = path.join(directory, slug, 'revisions', '.revision-1-deadbeef.tmp')
  await mkdir(temporaryRevision, { recursive: true })
  await writeFile(path.join(temporaryRevision, 'SKILL.md'), '# Incomplete', 'utf8')

  assert.equal(await repository.resolveSlug(name), null)
  const saved = await repository.save({ skillName: name, skillMarkdown: '# Complete' }, { createOnly: true })
  assert.equal(saved.version, 1)
  assert.equal((await repository.readDetail(slug))?.skillMarkdown, '# Complete')
})

test('filesystem item lookups never fall back from one readable slug to another', async (t) => {
  const { repository } = await createRepository(t)
  await repository.save({ skillName: 'foo', skillMarkdown: '# Foo' })

  assert.equal(await repository.readDetail('foo-'), null)
  assert.equal(await repository.delete('foo-'), false)
  assert.equal((await repository.readDetail('foo'))?.skillMarkdown, '# Foo')
})

test('filesystem repository detects legacy duplicates and keeps canonical Unicode slugs distinct', async (t) => {
  const { directory, repository } = await createRepository(t)
  const legacyName = '客户续约风险评审'
  const legacySlug = legacyHashedSkillSlug(legacyName)
  await mkdir(path.join(directory, legacySlug))
  await writeFile(path.join(directory, legacySlug, 'SKILL.md'), '# Legacy Skill', 'utf8')
  assert.equal(await repository.resolveSlug(legacyName), legacySlug)

  await assert.rejects(repository.save({
    skillName: legacyName,
    skillMarkdown: '# Duplicate'
  }, { createOnly: true }), (error: unknown) => (
    error instanceof AppError && error.cause instanceof SkillRepositoryConflictError
  ))
  await assert.rejects(access(path.join(directory, skillStoreSlug(legacyName))))

  const first = await repository.save({ skillName: '客户 CRM 评分', skillMarkdown: '# CRM score' })
  const second = await repository.save({ skillName: '销售 CRM 复盘', skillMarkdown: '# CRM review' })
  assert.notEqual(first.slug, second.slug)
  assert.match(first.slug, /^crm-[a-f0-9]{12}$/)
})

test('filesystem repository rejects malformed metadata without writing outside the store', async (t) => {
  const { directory, repository } = await createRepository(t)
  const skillDirectory = path.join(directory, 'unsafe-skill')
  await mkdir(skillDirectory)
  await writeFile(path.join(skillDirectory, 'SKILL.md'), '# Unsafe', 'utf8')
  await writeFile(path.join(skillDirectory, '.skill-store.json'), JSON.stringify({
    id: 'filesystem:unsafe-skill',
    name: 'unsafe-skill',
    slug: 'unsafe-skill',
    version: '../../../tmp/escape',
    updatedAt: new Date().toISOString()
  }), 'utf8')

  await assert.rejects(repository.save({
    skillName: 'unsafe-skill',
    skillMarkdown: '# Updated'
  }), (error: unknown) => error instanceof AppError && error.cause instanceof SkillRepositoryInputError)
})

test('filesystem repository enforces expected versions and does not recreate a deleted target', async (t) => {
  const { repository } = await createRepository(t)
  const first = await repository.save({ skillName: 'Versioned Skill', skillMarkdown: '# Version 1' })
  const second = await repository.save({
    skillName: 'Versioned Skill',
    skillMarkdown: '# Version 2'
  }, { targetSlug: first.slug, expectedVersion: 1 })
  assert.equal(second.version, 2)

  await assert.rejects(repository.save({
    skillName: 'Versioned Skill',
    skillMarkdown: '# Stale'
  }, { targetSlug: first.slug, expectedVersion: 1 }), (error: unknown) => (
    error instanceof AppError && error.cause instanceof SkillRepositoryConflictError
  ))
  assert.equal((await repository.readDetail(first.slug))?.version, 2)

  await repository.delete(first.slug)
  await assert.rejects(repository.save({
    skillName: 'Versioned Skill',
    skillMarkdown: '# Resurrected'
  }, { targetSlug: first.slug, expectedVersion: 2 }), (error: unknown) => (
    error instanceof AppError && error.cause instanceof SkillRepositoryConflictError
  ))
  assert.equal(await repository.readDetail(first.slug), null)
})

test('filesystem repository serializes concurrent updates without diverging current content', async (t) => {
  const { directory, repository } = await createRepository(t)
  const first = await repository.save({ skillName: 'Concurrent Skill', skillMarkdown: '# Version 1' })
  const results = await Promise.allSettled([
    repository.save({ skillName: 'Concurrent Skill', skillMarkdown: '# Update A' }, {
      targetSlug: first.slug,
      expectedVersion: 1
    }),
    repository.save({ skillName: 'Concurrent Skill', skillMarkdown: '# Update B' }, {
      targetSlug: first.slug,
      expectedVersion: 1
    })
  ])

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  const detail = await repository.readDetail(first.slug)
  assert.equal(detail?.version, 2)
  assert.equal(
    await readFile(path.join(directory, first.slug, 'SKILL.md'), 'utf8'),
    detail?.skillMarkdown
  )
})

test('filesystem repository serializes delete against an in-flight update', async (t) => {
  const { repository } = await createRepository(t)
  const first = await repository.save({ skillName: 'Delete Race', skillMarkdown: '# Version 1' })

  await Promise.allSettled([
    repository.save({ skillName: 'Delete Race', skillMarkdown: '# Version 2' }, {
      targetSlug: first.slug,
      expectedVersion: 1
    }),
    repository.delete(first.slug)
  ])

  assert.equal(await repository.readDetail(first.slug), null)
})

test('filesystem repository safely recovers an abandoned save lock', async (t) => {
  const { directory, repository } = await createRepository(t)
  const first = await repository.save({ skillName: 'Locked Skill', skillMarkdown: '# Version 1' })
  const scopeHash = createHash('sha256').update('global').digest('hex').slice(0, 16)
  const lockName = `${scopeHash}-${first.slug}`
  const lockDirectory = path.join(directory, '.save-locks', `${lockName}.lock`)
  await mkdir(lockDirectory)
  const staleTime = new Date(Date.now() - 60_000)
  await utimes(lockDirectory, staleTime, staleTime)

  const saved = await repository.save({
    skillName: 'Locked Skill',
    skillMarkdown: '# Version 2'
  }, { targetSlug: first.slug, expectedVersion: 1 })
  assert.equal(saved.version, 2)
  await assert.rejects(access(lockDirectory))

  const recoveryDirectory = path.join(directory, '.save-locks', `${lockName}.recovering`)
  await mkdir(recoveryDirectory)
  await utimes(recoveryDirectory, staleTime, staleTime)
  const recovered = await repository.save({
    skillName: 'Locked Skill',
    skillMarkdown: '# Version 3'
  }, { targetSlug: first.slug, expectedVersion: 2 })
  assert.equal(recovered.version, 3)
  await assert.rejects(access(recoveryDirectory))
})

test('filesystem repository recovers when a finalized revision is ahead of metadata', async (t) => {
  const { directory, repository } = await createRepository(t)
  const first = await repository.save({ skillName: 'Recoverable Skill', skillMarkdown: '# Version 1' })
  const revisionDirectory = path.join(directory, first.slug, 'revisions', '2')
  await mkdir(revisionDirectory)
  await writeFile(path.join(revisionDirectory, 'SKILL.md'), '# Recovered version', 'utf8')
  await writeFile(path.join(revisionDirectory, '.committed'), 'committed\n', 'utf8')

  const recovered = await repository.readDetail(first.slug)
  assert.equal(recovered?.version, 2)
  assert.equal(recovered?.skillMarkdown, '# Recovered version')
  assert.equal(
    await readFile(path.join(directory, first.slug, 'SKILL.md'), 'utf8'),
    '# Recovered version'
  )

  const saved = await repository.save({
    skillName: 'Recoverable Skill',
    skillMarkdown: '# Version 3'
  }, { targetSlug: first.slug, expectedVersion: 2 })
  assert.equal(saved.version, 3)
})

test('filesystem repository replaces an uncommitted legacy partial revision', async (t) => {
  const { directory, repository } = await createRepository(t)
  const first = await repository.save({ skillName: 'Partial Skill', skillMarkdown: '# Version 1' })
  const partialDirectory = path.join(directory, first.slug, 'revisions', '2')
  await mkdir(partialDirectory)
  await writeFile(path.join(partialDirectory, 'SKILL.md'), '# Partial write', 'utf8')

  assert.equal((await repository.readDetail(first.slug))?.version, 1)
  const saved = await repository.save({
    skillName: 'Partial Skill',
    skillMarkdown: '# Version 2'
  }, { targetSlug: first.slug, expectedVersion: 1 })
  assert.equal(saved.version, 2)
  assert.equal((await repository.readDetail(first.slug))?.skillMarkdown, '# Version 2')
})

test('filesystem repository archives legacy content before the first managed update', async (t) => {
  const { directory, repository } = await createRepository(t)
  const legacyDirectory = path.join(directory, 'legacy-skill')
  await mkdir(legacyDirectory)
  await writeFile(path.join(legacyDirectory, 'SKILL.md'), '# Legacy version', 'utf8')

  const updated = await repository.save({
    skillName: 'legacy-skill',
    skillMarkdown: '# Managed version'
  })

  assert.equal(updated.version, 2)
  assert.equal(
    await readFile(path.join(legacyDirectory, 'revisions', '1', 'SKILL.md'), 'utf8'),
    '# Legacy version'
  )
  assert.equal(
    await readFile(path.join(legacyDirectory, 'revisions', '2', 'SKILL.md'), 'utf8'),
    '# Managed version'
  )
})

test('filesystem repository creates distinct stable slugs for non-Latin names', async (t) => {
  const { repository } = await createRepository(t)

  const first = await repository.save({ skillName: '客户续约评审', skillMarkdown: '# Renewal' })
  const second = await repository.save({ skillName: '销售线索评分', skillMarkdown: '# Lead scoring' })

  assert.notEqual(first.slug, second.slug)
  assert.match(first.slug, /^business-skill-[a-f0-9]{12}$/)
  assert.equal((await repository.list()).length, 2)
})

test('filesystem repository isolates the same skill name by organization', async (t) => {
  const { repository } = await createRepository(t)

  const first = await repository.save({
    organizationId: 'company-a',
    expertId: 'expert-a',
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Company A'
  }, { createOnly: true })
  const second = await repository.save({
    organizationId: 'company-b',
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Company B'
  })

  assert.notEqual(first.id, second.id)
  assert.equal(first.organizationId, 'company-a')
  assert.equal(first.expertId, 'expert-a')
  await assert.rejects(repository.save({
    organizationId: 'company-a',
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Duplicate'
  }, { createOnly: true }), (error: unknown) => (
    error instanceof AppError && error.cause instanceof SkillRepositoryConflictError
  ))
  assert.equal(await repository.read('Weekly Sales Review', 'company-a'), '# Company A')
  assert.equal(await repository.read('Weekly Sales Review', 'company-b'), '# Company B')
  assert.equal((await repository.list('company-a')).length, 1)
  assert.equal((await repository.list('company-b')).length, 1)
  assert.equal((await repository.list()).length, 0)

  const updated = await repository.save({
    organizationId: 'company-a',
    expertId: 'expert-a',
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Company A v2'
  }, { targetSlug: first.slug, expectedVersion: 1 })
  assert.equal(updated.version, 2)
  assert.equal(await repository.read(first.slug, 'company-a'), '# Company A v2')
  assert.equal(await repository.read(second.slug, 'company-b'), '# Company B')

  await assert.rejects(repository.save({
    organizationId: 'company-a',
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Stale'
  }, { targetSlug: first.slug, expectedVersion: 1 }), (error: unknown) => (
    error instanceof AppError && error.cause instanceof SkillRepositoryConflictError
  ))
  assert.equal(await repository.delete(first.slug, 'company-b'), true)
  assert.equal(await repository.read(first.slug, 'company-a'), '# Company A v2')
  assert.equal(await repository.read(second.slug, 'company-b'), null)
})

test('filesystem repository recovers a crash-committed deletion before recreating a name', async (t) => {
  const { directory, repository } = await createRepository(t)
  const saved = await repository.save({ skillName: 'Deleted Skill', skillMarkdown: '# Old' })
  const tombstone = path.join(directory, `.deleted-${saved.slug}-00000000-0000-4000-8000-000000000000.tmp`)
  await rename(path.join(directory, saved.slug), tombstone)

  const recreated = await repository.save({
    skillName: 'Deleted Skill',
    skillMarkdown: '# New'
  }, { createOnly: true })

  assert.equal(recreated.version, 1)
  assert.equal(await repository.read(recreated.slug), '# New')
  await assert.rejects(access(tombstone))
})
