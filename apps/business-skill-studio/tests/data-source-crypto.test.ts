import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptDataSourcePassword, encryptDataSourcePassword } from '../lib/data-source-crypto'

const originalKey = process.env.DATA_SOURCE_ENCRYPTION_KEY
process.env.DATA_SOURCE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

test.after(() => {
  if (originalKey === undefined) delete process.env.DATA_SOURCE_ENCRYPTION_KEY
  else process.env.DATA_SOURCE_ENCRYPTION_KEY = originalKey
})

test('encrypts customer database passwords with authenticated encryption', () => {
  const password = 'local-test-password'
  const encrypted = encryptDataSourcePassword(password)

  assert.match(encrypted, /^v1\./)
  assert.equal(encrypted.includes(password), false)
  assert.equal(decryptDataSourcePassword(encrypted), password)
})

test('rejects a malformed encrypted password', () => {
  assert.throws(() => decryptDataSourcePassword('not-an-encrypted-password'))
})
