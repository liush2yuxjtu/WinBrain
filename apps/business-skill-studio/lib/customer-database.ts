import { createConnection, type Connection, type ConnectionOptions, type RowDataPacket } from 'mysql2/promise'
import {
  normalizeCustomerDataSourceConnection,
  resolveCustomerDataSourceHost
} from './data-source-security'
import type {
  CustomerDatabaseColumn,
  CustomerDatabaseTable,
  CustomerDatabaseTestResult,
  CustomerDatabaseTestStep,
  CustomerDataSourceConnectionInput
} from './types'

const CONNECT_TIMEOUT_MS = 8_000
const QUERY_TIMEOUT_MS = 8_000
const MAX_TABLES = 100
const MAX_COLUMNS = 1_000

interface ServerRow extends RowDataPacket {
  serverVersion: string
  currentDatabase: string
  connectionCharset: string
}

interface TableRow extends RowDataPacket {
  tableName: string
  tableType: string
  estimatedRows: number | null
}

interface ColumnRow extends RowDataPacket {
  tableName: string
  columnName: string
  dataType: string
  nullable: 'YES' | 'NO'
  columnKey: string
}

function sanitizedError(error: unknown, secret?: string): string {
  const message = error instanceof Error ? error.message : String(error)
  const withoutSecret = secret ? message.split(secret).join('[REDACTED]') : message
  return withoutSecret.slice(0, 1_000)
}

async function queryRows<T extends RowDataPacket[]>(connection: Connection, sql: string, values: unknown[] = []): Promise<T> {
  const [rows] = await connection.query<T>({ sql, values, timeout: QUERY_TIMEOUT_MS })
  return rows
}

function grantsFromRows(rows: RowDataPacket[]): string[] {
  return rows
    .map((row) => Object.values(row)[0])
    .filter((value): value is string => typeof value === 'string')
}

function inferReadOnly(grants: string[]): boolean {
  const writePrivileges = /\b(ALL PRIVILEGES|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRIGGER|EVENT|EXECUTE|FILE|RELOAD|SHUTDOWN|SUPER)\b/i
  return grants.length > 0 && grants.every((grant) => !writePrivileges.test(grant))
}

function groupSchema(tableRows: TableRow[], columnRows: ColumnRow[]): CustomerDatabaseTable[] {
  const columnsByTable = new Map<string, CustomerDatabaseColumn[]>()
  for (const column of columnRows) {
    const columns = columnsByTable.get(column.tableName) || []
    columns.push({
      name: column.columnName,
      dataType: column.dataType,
      nullable: column.nullable === 'YES',
      key: column.columnKey || undefined
    })
    columnsByTable.set(column.tableName, columns)
  }

  return tableRows.map((table) => ({
    name: table.tableName,
    type: table.tableType,
    estimatedRows: table.estimatedRows === null ? undefined : Number(table.estimatedRows),
    columns: columnsByTable.get(table.tableName) || []
  }))
}

function verifiedSslOptions(hostname: string): NonNullable<ConnectionOptions['ssl']> {
  // mysql2 forwards TLS connection options at runtime, but its SslOptions type omits `servername`.
  // Keep SNI/certificate hostname validation while connecting to the IP already approved by DNS policy.
  return {
    rejectUnauthorized: true,
    servername: hostname
  } as unknown as NonNullable<ConnectionOptions['ssl']>
}

export async function testCustomerDatabaseConnection(input: CustomerDataSourceConnectionInput): Promise<CustomerDatabaseTestResult> {
  const steps: CustomerDatabaseTestStep[] = []
  const warnings: string[] = []
  let connection: Connection | undefined
  let password = typeof input.password === 'string' ? input.password : ''
  let currentStep: CustomerDatabaseTestStep['key'] = 'validate'
  let currentLabel = '校验连接参数'

  try {
    const normalized = normalizeCustomerDataSourceConnection(input)
    password = normalized.password
    steps.push({ key: 'validate', label: currentLabel, status: 'passed', detail: '主机、端口、账号、数据库名和字符集格式有效。' })

    currentStep = 'resolve'
    currentLabel = '解析并检查目标地址'
    const resolved = await resolveCustomerDataSourceHost(normalized.host)
    steps.push({
      key: 'resolve',
      label: currentLabel,
      status: 'passed',
      detail: `解析为 ${resolved.allAddresses.join(', ')}；连接固定到 ${resolved.address}。`
    })

    currentStep = 'connect'
    currentLabel = '建立数据库连接'
    const options: ConnectionOptions = {
      host: resolved.address,
      port: normalized.port,
      user: normalized.username,
      password: normalized.password,
      database: normalized.databaseName,
      charset: normalized.charset,
      connectTimeout: CONNECT_TIMEOUT_MS,
      multipleStatements: false,
      enableKeepAlive: false
    }
    if (normalized.sslMode === 'REQUIRED') {
      options.ssl = verifiedSslOptions(normalized.host)
    }

    const startedAt = Date.now()
    connection = await createConnection(options)
    steps.push({ key: 'connect', label: currentLabel, status: 'passed', detail: 'TCP、认证和数据库选择成功。' })

    currentStep = 'ping'
    currentLabel = '执行只读健康检查'
    await queryRows<RowDataPacket[]>(connection, 'SELECT 1 AS ok')
    const serverRows = await queryRows<ServerRow[]>(connection,
      'SELECT VERSION() AS serverVersion, DATABASE() AS currentDatabase, @@character_set_connection AS connectionCharset')
    const latencyMs = Date.now() - startedAt
    const server = serverRows[0]
    steps.push({
      key: 'ping',
      label: currentLabel,
      status: 'passed',
      detail: `SELECT 1 成功，往返约 ${latencyMs}ms，连接字符集 ${server?.connectionCharset || normalized.charset}。`
    })

    currentStep = 'permissions'
    currentLabel = '检查只读权限'
    const grantRows = await queryRows<RowDataPacket[]>(connection, 'SHOW GRANTS FOR CURRENT_USER')
    const grants = grantsFromRows(grantRows)
    const readOnlyInferred = inferReadOnly(grants)
    if (readOnlyInferred) {
      steps.push({ key: 'permissions', label: currentLabel, status: 'passed', detail: '授权中未发现写入、DDL 或高权限操作。' })
    } else {
      const detail = grants.length
        ? '检测到可能包含写入或管理权限的授权。生产环境应使用仅 SELECT/SHOW VIEW 的专用账号。'
        : '无法读取当前账号授权；未能确认账号为只读。'
      warnings.push(detail)
      steps.push({ key: 'permissions', label: currentLabel, status: 'warning', detail })
    }

    currentStep = 'schema'
    currentLabel = '读取 schema 元数据'
    const tableRows = await queryRows<TableRow[]>(connection, `
      SELECT TABLE_NAME AS tableName, TABLE_TYPE AS tableType, TABLE_ROWS AS estimatedRows
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
      LIMIT ${MAX_TABLES}
    `, [normalized.databaseName])
    const columnRows = await queryRows<ColumnRow[]>(connection, `
      SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType,
             IS_NULLABLE AS nullable, COLUMN_KEY AS columnKey
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION
      LIMIT ${MAX_COLUMNS}
    `, [normalized.databaseName])
    const tables = groupSchema(tableRows, columnRows)
    steps.push({
      key: 'schema',
      label: currentLabel,
      status: 'passed',
      detail: `读取到 ${tables.length} 个表或视图、${columnRows.length} 个字段。`
    })

    return {
      status: warnings.length ? 'WARNING' : 'HEALTHY',
      latencyMs,
      serverVersion: server?.serverVersion,
      currentDatabase: server?.currentDatabase,
      tableCount: tables.length,
      readOnlyInferred,
      warnings,
      resolvedAddress: resolved.address,
      grants,
      tables,
      steps
    }
  } catch (error) {
    const message = sanitizedError(error, password)
    steps.push({ key: currentStep, label: currentLabel, status: 'failed', detail: message })
    return {
      status: 'FAILED',
      readOnlyInferred: false,
      warnings,
      error: message,
      grants: [],
      tables: [],
      steps
    }
  } finally {
    await connection?.end().catch(() => undefined)
  }
}
