import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isRestrictedNetworkAddress,
  normalizeCustomerDataSourceConnection,
  resolveCustomerDataSourceHost
} from '../lib/data-source-security'

const baseInput = {
  kind: 'MYSQL' as const,
  host: 'db.example.com',
  port: 3306,
  username: 'readonly',
  password: 'secret',
  databaseName: 'analytics',
  charset: 'utf8mb4',
  sslMode: 'REQUIRED' as const
}

test('normalizes safe MySQL connection settings', () => {
  assert.deepEqual(normalizeCustomerDataSourceConnection({ ...baseInput, host: ' DB.EXAMPLE.COM ' }), baseInput)
})

test('rejects URLs and invalid ports', () => {
  assert.throws(() => normalizeCustomerDataSourceConnection({ ...baseInput, host: 'https://db.example.com' }))
  assert.throws(() => normalizeCustomerDataSourceConnection({ ...baseInput, port: 70000 }))
})

test('identifies private, loopback, documentation, and public addresses', () => {
  assert.equal(isRestrictedNetworkAddress('127.0.0.1'), true)
  assert.equal(isRestrictedNetworkAddress('10.2.3.4'), true)
  assert.equal(isRestrictedNetworkAddress('192.168.1.10'), true)
  assert.equal(isRestrictedNetworkAddress('203.0.113.8'), true)
  assert.equal(isRestrictedNetworkAddress('8.8.8.8'), false)
  assert.equal(isRestrictedNetworkAddress('::1'), true)
})

test('blocks private database targets in production unless explicitly enabled', async () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAllowPrivate = process.env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS
  const originalSuffixes = process.env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES
  process.env.NODE_ENV = 'production'
  delete process.env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS
  delete process.env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES

  try {
    await assert.rejects(() => resolveCustomerDataSourceHost('127.0.0.1'))
    process.env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS = 'true'
    assert.equal((await resolveCustomerDataSourceHost('127.0.0.1')).address, '127.0.0.1')
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalAllowPrivate === undefined) delete process.env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS
    else process.env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS = originalAllowPrivate
    if (originalSuffixes === undefined) delete process.env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES
    else process.env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES = originalSuffixes
  }
})
