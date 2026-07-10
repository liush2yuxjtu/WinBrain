import pg from 'pg'
import mysql from 'mysql2/promise'

const { Client } = pg

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const databaseUrl = required('DATABASE_URL')
const mysqlHost = process.env.UAT_MYSQL_HOST?.trim() || '127.0.0.1'
const mysqlPort = Number(required('UAT_MYSQL_PORT'))
const mysqlDatabase = required('UAT_MYSQL_DATABASE')
const mysqlUser = required('UAT_MYSQL_READONLY_USER')
const mysqlPassword = required('UAT_MYSQL_READONLY_PASSWORD')

if (!Number.isInteger(mysqlPort) || mysqlPort <= 0 || mysqlPort > 65535) {
  throw new Error('UAT_MYSQL_PORT must be a valid TCP port')
}

const postgres = new Client({ connectionString: databaseUrl })
let customerDb

try {
  await postgres.connect()

  const migrationResult = await postgres.query('SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL')
  const organizationResult = await postgres.query("SELECT id, slug FROM organizations WHERE slug = 'uat-fmcg'")
  const expertResult = await postgres.query("SELECT id FROM experts WHERE email = 'uat-supply@example.com'")
  const skillResult = await postgres.query("SELECT s.id, COUNT(r.id)::int AS revisions FROM skills s JOIN skill_revisions r ON r.skill_id = s.id WHERE s.slug = 'uat-inventory-exception-response' GROUP BY s.id")

  if (migrationResult.rows[0].count < 1) throw new Error('No completed Prisma migrations were found')
  if (organizationResult.rowCount !== 1) throw new Error('UAT organization seed is missing')
  if (expertResult.rowCount !== 1) throw new Error('UAT expert seed is missing')
  if (skillResult.rowCount !== 1 || skillResult.rows[0].revisions < 1) throw new Error('UAT Skill seed or revision is missing')

  customerDb = await mysql.createConnection({
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPassword,
    database: mysqlDatabase,
    charset: 'utf8mb4',
    connectTimeout: 10_000
  })

  const [tableRows] = await customerDb.query(`
    SELECT COUNT(*) AS table_count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
  `, [mysqlDatabase])
  const [productRows] = await customerDb.query('SELECT COUNT(*) AS product_count FROM dim_product')
  const [salesRows] = await customerDb.query('SELECT COUNT(*) AS sales_count FROM fact_sales_daily')
  const [grantRows] = await customerDb.query('SHOW GRANTS FOR CURRENT_USER')

  const tableCount = Number(tableRows[0].table_count)
  const productCount = Number(productRows[0].product_count)
  const salesCount = Number(salesRows[0].sales_count)
  const grants = grantRows.map((row) => Object.values(row).join(' ')).join('\n').toUpperCase()

  if (tableCount < 5) throw new Error(`Expected at least 5 UAT customer tables, found ${tableCount}`)
  if (productCount < 3) throw new Error(`Expected at least 3 UAT products, found ${productCount}`)
  if (salesCount < 3) throw new Error(`Expected at least 3 UAT sales rows, found ${salesCount}`)
  if (!grants.includes('SELECT') || !grants.includes('SHOW VIEW')) throw new Error('UAT customer account is missing read-only grants')
  if (grants.includes('INSERT') || grants.includes('UPDATE') || grants.includes('DELETE') || grants.includes('ALL PRIVILEGES')) {
    throw new Error('UAT customer account has write privileges')
  }

  console.log(JSON.stringify({
    verified: true,
    postgres: {
      completedMigrations: migrationResult.rows[0].count,
      organizationSlug: organizationResult.rows[0].slug,
      skillRevisions: skillResult.rows[0].revisions
    },
    customerDatabase: {
      database: mysqlDatabase,
      tableCount,
      productCount,
      salesCount,
      readOnly: true
    }
  }, null, 2))
} finally {
  await customerDb?.end().catch(() => undefined)
  await postgres.end().catch(() => undefined)
}
