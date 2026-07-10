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

test('identifies private, loopback, documentation, benchmark, and public addresses', () => {
  assert.equal(isRestrictedNetworkAddress('127.0.0.1'), true)
  assert.equal(isRestrictedNetworkAddress('10.2.3.4'), true)
  assert.equal(isRestrictedNetworkAddress('192.168.1.10'), true)
  assert.equal(isRestrictedNetworkAddress('192.0.0.8'), true)
  assert.equal(isRestrictedNetworkAddress('192.0.2.8'), true)
  assert.equal(isRestrictedNetworkAddress('198.18.0.1'), true)
  assert.equal(isRestrictedNetworkAddress('198.51.100.8'), true)
  assert.equal(isRestrictedNetworkAddress('203.0.113.8'), true)
  assert.equal(isRestrictedNetworkAddress('192.0.1.8'), false)
  assert.equal(isRestrictedNetworkAddress('198.51.1.8'), false)
  assert.equal(isRestrictedNetworkAddress('8.8.8.8'), false)
  assert.equal(isRestrictedNetworkAddress('::1'), true)
})

test('blocks private database targets in production unless explicitly enabled', async () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalAllowPrivate = env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS
  const originalSuffixes = env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES
  env.NODE_ENV = 'production'
  delete env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS
  delete env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES

  try {
    await assert.rejects(() => resolveCustomerDataSourceHost('127.0.0.1'))
    env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS = 'true'
    assert.equal((await resolveCustomerDataSourceHost('127.0.0.1')).address, '127.0.0.1')
  } finally {
    if (originalNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = originalNodeEnv
    if (originalAllowPrivate === undefined) delete env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS
    else env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS = originalAllowPrivate
    if (originalSuffixes === undefined) delete env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES
    else env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES = originalSuffixes
  }
})
