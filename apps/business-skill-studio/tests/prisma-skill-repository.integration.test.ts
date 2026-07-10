import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createPrismaClient } from '../lib/db'
import { PrismaSkillRepository } from '../lib/repositories/prisma-skill-repository'
import { SkillRepositoryConflictError, SkillRepositoryInputError } from '../lib/repositories/skill-repository'
import { legacyHashedSkillSlug } from '../lib/repositories/skill-slug'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for database integration tests')

const prisma = createPrismaClient(databaseUrl)
const repository = new PrismaSkillRepository(prisma)

before(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.dataSource.deleteMany()
  await prisma.skillRevision.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.expert.deleteMany()
  await prisma.organization.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('creates immutable revisions and returns the latest skill content', async () => {
  const first = await repository.save({
    skillName: '客户续约评审',
    skillMarkdown: '# Version 1',
    evalsJson: '{"cases":[]}'
  })
  const second = await repository.save({
    skillName: '客户续约评审',
    skillMarkdown: '# Version 2'
  })

  assert.equal(first.id, second.id)
  assert.equal(first.version, 1)
  assert.equal(second.version, 2)
  assert.equal(await repository.read('客户续约评审'), '# Version 2')
  assert.equal((await repository.readDetail(second.slug))?.evalsJson, null)

  const revisions = await prisma.skillRevision.findMany({
    where: { skillId: first.id },
    orderBy: { version: 'asc' }
  })
  assert.deepEqual(revisions.map((revision) => revision.version), [1, 2])
  assert.equal(revisions[0]?.skillMarkdown, '# Version 1')
  assert.equal(revisions[1]?.skillMarkdown, '# Version 2')

  const listed = await repository.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.version, 2)

  assert.equal(await repository.delete(second.slug), true)
  assert.equal(await repository.delete(second.slug), false)
  assert.equal(await prisma.skillRevision.count({ where: { skillId: first.id } }), 0)
})

test('rejects duplicate create-only writes without adding a revision', async () => {
  const input = { skillName: 'Renewal Review', skillMarkdown: '# Version 1' }
  const created = await repository.save(input, { createOnly: true })

  await assert.rejects(repository.save(input, { createOnly: true }), SkillRepositoryConflictError)
  assert.equal(await prisma.skillRevision.count({ where: { skillId: created.id } }), 1)
})

test('item lookups never fall back from one readable slug to another', async () => {
  await repository.save({ skillName: 'foo', skillMarkdown: '# Foo' })

  assert.equal(await repository.readDetail('foo-'), null)
  assert.equal(await repository.delete('foo-'), false)
  assert.equal((await repository.readDetail('foo'))?.skillMarkdown, '# Foo')
})

test('detects a legacy slug as a duplicate of the same display name', async () => {
  const name = '客户续约风险评审'
  const legacy = await prisma.skill.create({
    data: {
      name,
      slug: legacyHashedSkillSlug(name),
      revisions: { create: { version: 1, skillMarkdown: '# Legacy' } }
    }
  })
  assert.equal(await repository.resolveSlug(name), legacy.slug)

  await assert.rejects(repository.save({
    skillName: name,
    skillMarkdown: '# Duplicate'
  }, { createOnly: true }), SkillRepositoryConflictError)
  assert.equal(await prisma.skill.count(), 1)
  assert.equal(await prisma.skillRevision.count({ where: { skillId: legacy.id } }), 1)
})

test('enforces expected versions and does not recreate a deleted target', async () => {
  const first = await repository.save({ skillName: 'Versioned Skill', skillMarkdown: '# Version 1' })
  const second = await repository.save({
    skillName: 'Versioned Skill',
    skillMarkdown: '# Version 2'
  }, { targetSlug: first.slug, expectedVersion: 1 })
  assert.equal(second.version, 2)

  await assert.rejects(repository.save({
    skillName: 'Versioned Skill',
    skillMarkdown: '# Stale'
  }, { targetSlug: first.slug, expectedVersion: 1 }), SkillRepositoryConflictError)
  assert.equal(await prisma.skillRevision.count({ where: { skillId: first.id } }), 2)

  await repository.delete(first.slug)
  await assert.rejects(repository.save({
    skillName: 'Versioned Skill',
    skillMarkdown: '# Resurrected'
  }, { targetSlug: first.slug, expectedVersion: 2 }), SkillRepositoryConflictError)
  assert.equal(await prisma.skill.count(), 0)
})

test('serializes concurrent saves into unique version numbers', async () => {
  const saved = await Promise.all([
    repository.save({ skillName: 'Concurrent Review', skillMarkdown: '# First concurrent save' }),
    repository.save({ skillName: 'Concurrent Review', skillMarkdown: '# Second concurrent save' })
  ])

  assert.deepEqual(saved.map((skill) => skill.version).sort((left, right) => left - right), [1, 2])
  const revisions = await prisma.skillRevision.findMany({
    where: { skillId: saved[0]!.id },
    orderBy: { version: 'asc' }
  })
  assert.deepEqual(revisions.map((revision) => revision.version), [1, 2])
})

test('stores different non-Latin names as separate skills', async () => {
  const first = await repository.save({ skillName: '客户续约评审', skillMarkdown: '# Renewal' })
  const second = await repository.save({ skillName: '销售线索评分', skillMarkdown: '# Lead scoring' })

  assert.notEqual(first.slug, second.slug)
  assert.equal((await repository.list()).length, 2)
})

test('keeps mixed Unicode names with the same ASCII fragment distinct', async () => {
  const first = await repository.save({ skillName: '客户 CRM 评分', skillMarkdown: '# CRM score' })
  const second = await repository.save({ skillName: '销售 CRM 复盘', skillMarkdown: '# CRM review' })

  assert.notEqual(first.slug, second.slug)
  assert.match(first.slug, /^crm-[a-f0-9]{12}$/)
  assert.equal((await repository.list()).length, 2)
})

test('allows the same skill name in different organizations without data leakage', async () => {
  const firstOrganization = await prisma.organization.create({ data: { name: 'Company A', slug: 'company-a' } })
  const secondOrganization = await prisma.organization.create({ data: { name: 'Company B', slug: 'company-b' } })
  const firstExpert = await prisma.expert.create({
    data: { organizationId: firstOrganization.id, name: 'Expert A', role: 'Sales' }
  })
  const secondExpert = await prisma.expert.create({
    data: { organizationId: secondOrganization.id, name: 'Expert B', role: 'Sales' }
  })

  const first = await repository.save({
    organizationId: firstOrganization.id,
    expertId: firstExpert.id,
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Company A workflow'
  }, { createOnly: true })
  const second = await repository.save({
    organizationId: secondOrganization.id,
    expertId: secondExpert.id,
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Company B workflow'
  }, { createOnly: true })

  assert.notEqual(first.id, second.id)
  assert.equal(first.expertId, firstExpert.id)
  assert.equal((await repository.list()).length, 0)
  assert.equal(await repository.read('Weekly Sales Review', firstOrganization.id), '# Company A workflow')
  assert.equal(await repository.read('Weekly Sales Review', secondOrganization.id), '# Company B workflow')
  assert.equal((await repository.list(firstOrganization.id)).length, 1)
  assert.equal((await repository.list(secondOrganization.id)).length, 1)

  await assert.rejects(repository.save({
    organizationId: firstOrganization.id,
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Duplicate'
  }, { createOnly: true }), SkillRepositoryConflictError)
  await assert.rejects(repository.save({
    organizationId: firstOrganization.id,
    expertId: secondExpert.id,
    skillName: 'Other Skill',
    skillMarkdown: '# Wrong expert'
  }), SkillRepositoryInputError)

  const updated = await repository.save({
    organizationId: firstOrganization.id,
    expertId: firstExpert.id,
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Company A v2'
  }, { targetSlug: first.slug, expectedVersion: 1 })
  assert.equal(updated.version, 2)
  await assert.rejects(repository.save({
    organizationId: firstOrganization.id,
    expertId: firstExpert.id,
    skillName: 'Weekly Sales Review',
    skillMarkdown: '# Stale'
  }, { targetSlug: first.slug, expectedVersion: 1 }), SkillRepositoryConflictError)

  assert.equal(await repository.delete(first.slug, secondOrganization.id), true)
  assert.equal(await repository.read(first.slug, firstOrganization.id), '# Company A v2')
  assert.equal(await repository.read(second.slug, secondOrganization.id), null)
})
