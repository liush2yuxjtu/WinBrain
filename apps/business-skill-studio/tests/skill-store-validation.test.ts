import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeSkillSaveRequest,
  SkillStoreValidationError
} from '../lib/skill-store'
import { normalizeSkillName } from '../lib/skill-creator'
import { isSkillStoreSlug, skillStoreSlug } from '../lib/repositories/skill-slug'

test('normalizes skill names and eval JSON before persistence', () => {
  const normalized = normalizeSkillSaveRequest({
    skillName: '  Renewal Review  ',
    skillMarkdown: '# Skill\n',
    evalsJson: '{"cases":[{"prompt":"example"}]}'
  })

  assert.equal(normalized.skillName, 'Renewal Review')
  assert.equal(normalized.skillMarkdown, '# Skill\n')
  assert.equal(normalized.evalsJson, '{\n  "cases": [\n    {\n      "prompt": "example"\n    }\n  ]\n}\n')
})

test('rejects invalid eval JSON', () => {
  assert.throws(() => normalizeSkillSaveRequest({
    skillName: 'Renewal Review',
    skillMarkdown: '# Skill',
    evalsJson: '{not-json}'
  }), SkillStoreValidationError)
})

test('rejects empty required fields', () => {
  assert.throws(() => normalizeSkillSaveRequest({
    skillName: ' ',
    skillMarkdown: '# Skill'
  }), SkillStoreValidationError)

  assert.throws(() => normalizeSkillSaveRequest({
    skillName: 'Renewal Review',
    skillMarkdown: ' '
  }), SkillStoreValidationError)
})

test('creates safe stable slugs for long and mixed Unicode names', () => {
  const truncated = normalizeSkillName(`${'a'.repeat(79)} separator`)
  assert.equal(isSkillStoreSlug(truncated), true)
  assert.equal(truncated.endsWith('-'), false)

  const first = skillStoreSlug('客户 CRM 评分')
  const second = skillStoreSlug('销售 CRM 复盘')
  assert.match(first, /^crm-[a-f0-9]{12}$/)
  assert.notEqual(first, second)
})
