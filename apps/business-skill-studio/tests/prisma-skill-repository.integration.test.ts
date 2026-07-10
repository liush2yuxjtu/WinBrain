import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createPrismaClient } from '../lib/db'
import { PrismaSkillRepository } from '../lib/repositories/prisma-skill-repository'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for database integration tests')
}

const prisma = createPrismaClient(databaseUrl)
const repository = new PrismaSkillRepository(prisma)

before(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.skill.deleteMany()
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
})

test('serializes concurrent saves into unique version numbers', async () => {
  const saved = await Promise.all([
    repository.save({
      skillName: 'Concurrent Review',
      skillMarkdown: '# First concurrent save'
    }),
    repository.save({
      skillName: 'Concurrent Review',
      skillMarkdown: '# Second concurrent save'
    })
  ])

  assert.deepEqual(saved.map((skill) => skill.version).sort((left, right) => left - right), [1, 2])

  const revisions = await prisma.skillRevision.findMany({
    where: { skillId: saved[0]!.id },
    orderBy: { version: 'asc' }
  })
  assert.deepEqual(revisions.map((revision) => revision.version), [1, 2])
})

test('stores different non-Latin names as separate skills', async () => {
  const first = await repository.save({
    skillName: '客户续约评审',
    skillMarkdown: '# Renewal'
  })
  const second = await repository.save({
    skillName: '销售线索评分',
    skillMarkdown: '# Lead scoring'
  })

  assert.notEqual(first.slug, second.slug)
  assert.equal((await repository.list()).length, 2)
})
