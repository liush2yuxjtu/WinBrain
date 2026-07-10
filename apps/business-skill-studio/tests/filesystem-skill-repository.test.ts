import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import { FileSystemSkillRepository } from '../lib/repositories/filesystem-skill-repository'

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
})

test('filesystem repository creates distinct stable slugs for non-Latin names', async (t) => {
  const { repository } = await createRepository(t)

  const first = await repository.save({
    skillName: '客户续约评审',
    skillMarkdown: '# Renewal'
  })
  const second = await repository.save({
    skillName: '销售线索评分',
    skillMarkdown: '# Lead scoring'
  })

  assert.notEqual(first.slug, second.slug)
  assert.match(first.slug, /^business-skill-[a-f0-9]{12}$/)
  assert.equal((await repository.list()).length, 2)
})
