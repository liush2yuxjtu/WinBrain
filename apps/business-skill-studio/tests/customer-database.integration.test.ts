import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { createConnection, type Connection } from 'mysql2/promise'
import { testCustomerDatabaseConnection } from '../lib/customer-database'

const host = process.env.TEST_CUSTOMER_DB_HOST || '127.0.0.1'
const port = Number(process.env.TEST_CUSTOMER_DB_PORT || 3307)
const rootPassword = process.env.TEST_CUSTOMER_DB_ROOT_PASSWORD || 'local-root-password'
let rootConnection: Connection | undefined

before(async () => {
  rootConnection = await createConnection({
    host,
    port,
    user: 'root',
    password: rootPassword,
    multipleStatements: true,
    connectTimeout: 10_000
  })
  await rootConnection.query('DROP DATABASE IF EXISTS uat_dws')
  await rootConnection.query("DROP USER IF EXISTS 'fmcg_readonly'@'%'")
  const schema = await readFile(path.resolve('test-db/mysql-init/001-fmcg-schema.sql'), 'utf8')
  await rootConnection.query(schema)
})

after(async () => {
  await rootConnection?.end()
})

test('connects with a readonly account and discovers the FMCG schema', async () => {
  const result = await testCustomerDatabaseConnection({
    kind: 'MYSQL',
    host,
    port,
    username: 'fmcg_readonly',
    password: 'local-fmcg-readonly',
    databaseName: 'uat_dws',
    charset: 'utf8mb4',
    sslMode: 'DISABLED'
  })

  assert.equal(result.status, 'HEALTHY')
  assert.equal(result.readOnlyInferred, true)
  assert.equal(result.currentDatabase, 'uat_dws')
  assert.ok((result.tableCount || 0) >= 6)
  assert.ok(result.tables.some((table) => table.name === 'fact_sales_daily'))
  assert.ok(result.tables.some((table) => table.name === 'vw_brand_sales_summary'))
  assert.equal(result.steps.every((step) => step.status === 'passed'), true)
})

test('returns a failed process without leaking the supplied password', async () => {
  const password = 'definitely-wrong-password'
  const result = await testCustomerDatabaseConnection({
    kind: 'MYSQL',
    host,
    port,
    username: 'fmcg_readonly',
    password,
    databaseName: 'uat_dws',
    charset: 'utf8mb4',
    sslMode: 'DISABLED'
  })

  assert.equal(result.status, 'FAILED')
  assert.equal(result.error?.includes(password), false)
  assert.equal(result.steps.at(-1)?.status, 'failed')
})
