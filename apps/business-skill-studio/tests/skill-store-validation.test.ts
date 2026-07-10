import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeSkillSaveRequest,
  SkillStoreValidationError
} from '../lib/skill-store'

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
