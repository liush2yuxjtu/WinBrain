import 'server-only'

import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  DatabaseCatalogResponse,
  DatabaseColumn,
  DatabaseConstraint,
  DatabaseIndex,
  DatabaseMetadata,
  DatabaseTableDetail,
  DatabaseTableSummary
} from './database-types'

const SCHEMA_FILENAME = 'win-brain-oceanbase-schema-2026-07-09.json'
const SCHEMA_RELATIVE_PATH = path.join(
  'user_upload',
  'win_brain_db_schema_export_2026-07-09',
  SCHEMA_FILENAME
)

type RawRecord = Record<string, unknown>

type RawSchema = {
  metadata: DatabaseMetadata
  table_summaries: RawRecord[]
  columns: RawRecord[]
  indexes: RawRecord[]
  constraints: RawRecord[]
  ddl_by_table: Record<string, string>
}

type SchemaIndex = {
  raw: RawSchema
  summaries: DatabaseTableSummary[]
  summariesByName: Map<string, DatabaseTableSummary>
  columnsByTable: Map<string, DatabaseColumn[]>
  indexesByTable: Map<string, DatabaseIndex[]>
  constraintsByTable: Map<string, DatabaseConstraint[]>
}

let schemaIndexPromise: Promise<SchemaIndex> | undefined

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function schemaCandidates(): string[] {
  const configured = process.env.WINBRAIN_SCHEMA_PATH?.trim()
  return [
    configured ? path.resolve(process.cwd(), configured) : '',
    path.resolve(process.cwd(), SCHEMA_RELATIVE_PATH),
    path.resolve(process.cwd(), '..', '..', SCHEMA_RELATIVE_PATH),
    path.resolve(process.cwd(), '..', SCHEMA_RELATIVE_PATH)
  ].filter(Boolean)
}

async function resolveSchemaPath(): Promise<string> {
  for (const candidate of schemaCandidates()) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next repository-aware candidate.
    }
  }

  throw new Error(`WinBrain schema snapshot not found (${SCHEMA_FILENAME})`)
}

function pushGrouped<T>(map: Map<string, T[]>, key: string, value: T): void {
  const current = map.get(key)
  if (current) current.push(value)
  else map.set(key, [value])
}

function buildIndex(raw: RawSchema): SchemaIndex {
  const summaries = raw.table_summaries.map((item): DatabaseTableSummary => {
    const tableName = text(item.table_name)
    return {
      tableName,
      tableType: text(item.table_type),
      engine: text(item.engine),
      rowsEstimate: numberOrNull(item.rows_estimate),
      columnCount: numberOrNull(item.column_count) || 0,
      primaryKey: Array.isArray(item.primary_key)
        ? item.primary_key.filter((value): value is string => typeof value === 'string')
        : [],
      headers: Array.isArray(item.headers)
        ? item.headers.filter((value): value is string => typeof value === 'string')
        : [],
      comment: text(item.comment),
      isBackup: /(?:^|_)bak\d{6,}|backup|_bak(?:_|$)/i.test(tableName)
    }
  })

  const columnsByTable = new Map<string, DatabaseColumn[]>()
  for (const item of raw.columns) {
    const tableName = text(item.TABLE_NAME)
    pushGrouped(columnsByTable, tableName, {
      tableName,
      ordinalPosition: numberOrNull(item.ORDINAL_POSITION) || 0,
      columnName: text(item.COLUMN_NAME),
      columnType: text(item.COLUMN_TYPE),
      dataType: text(item.DATA_TYPE),
      nullable: text(item.IS_NULLABLE) === 'YES',
      columnKey: text(item.COLUMN_KEY),
      defaultValue: item.COLUMN_DEFAULT ?? null,
      extra: text(item.EXTRA),
      comment: text(item.COLUMN_COMMENT)
    })
  }

  const indexesByTable = new Map<string, DatabaseIndex[]>()
  for (const item of raw.indexes) {
    pushGrouped(indexesByTable, text(item.TABLE_NAME), {
      name: text(item.INDEX_NAME),
      columnName: text(item.COLUMN_NAME),
      sequence: numberOrNull(item.SEQ_IN_INDEX) || 0,
      unique: Number(item.NON_UNIQUE) === 0,
      type: text(item.INDEX_TYPE)
    })
  }

  const constraintsByTable = new Map<string, DatabaseConstraint[]>()
  for (const item of raw.constraints) {
    pushGrouped(constraintsByTable, text(item.TABLE_NAME), {
      name: text(item.CONSTRAINT_NAME),
      type: text(item.CONSTRAINT_TYPE)
    })
  }

  return {
    raw,
    summaries,
    summariesByName: new Map(summaries.map((summary) => [summary.tableName, summary])),
    columnsByTable,
    indexesByTable,
    constraintsByTable
  }
}

async function loadSchemaIndex(): Promise<SchemaIndex> {
  if (!schemaIndexPromise) {
    schemaIndexPromise = (async () => {
      const schemaPath = await resolveSchemaPath()
      const source = await readFile(schemaPath, 'utf8')
      return buildIndex(JSON.parse(source) as RawSchema)
    })().catch((error) => {
      schemaIndexPromise = undefined
      throw error
    })
  }

  return schemaIndexPromise
}

function searchableText(index: SchemaIndex, table: DatabaseTableSummary): string {
  const columns = index.columnsByTable.get(table.tableName) || []
  return [
    table.tableName,
    table.comment,
    ...columns.flatMap((column) => [column.columnName, column.comment])
  ].join(' ').toLocaleLowerCase()
}

function searchTokens(query: string): string[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []

  const matches = normalized.match(/[a-z0-9_]{2,}|[\u3400-\u9fff]{2,}/g) || []
  const hanNgrams = matches.flatMap((match) => {
    if (!/^[\u3400-\u9fff]+$/.test(match) || match.length <= 3) return []
    const grams: string[] = []
    for (let index = 0; index < match.length - 1; index += 1) {
      grams.push(match.slice(index, index + 2))
      if (index < match.length - 2) grams.push(match.slice(index, index + 3))
    }
    return grams
  })

  return Array.from(new Set([normalized, ...matches, ...hanNgrams])).slice(0, 32)
}

function scoreTable(index: SchemaIndex, table: DatabaseTableSummary, query: string, tokens: string[]): number {
  if (!tokens.length) return table.isBackup ? -20 : 1

  const name = table.tableName.toLocaleLowerCase()
  const comment = table.comment.toLocaleLowerCase()
  const haystack = searchableText(index, table)
  let score = 0

  for (const token of tokens) {
    if (name === token) score += 120
    else if (name.includes(token)) score += 38
    if (comment.includes(token)) score += 24
    if (haystack.includes(token)) score += 8
  }

  if (table.isBackup && !/(?:bak|backup|备份)/i.test(query)) score -= 18
  return score
}

export async function getDatabaseCatalog(query = '', limit = 500): Promise<DatabaseCatalogResponse> {
  const index = await loadSchemaIndex()
  const tokens = searchTokens(query)
  const scored = index.summaries
    .map((table, position) => ({ table, position, score: scoreTable(index, table, query, tokens) }))
    .filter((entry) => !tokens.length || entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.table.isBackup) - Number(b.table.isBackup) || a.position - b.position)

  const safeLimit = Math.min(Math.max(limit, 1), 500)
  return {
    metadata: index.raw.metadata,
    tables: scored.slice(0, safeLimit).map((entry) => entry.table),
    total: scored.length,
    snapshotReadOnly: true
  }
}

export async function getDatabaseTable(tableName: string): Promise<DatabaseTableDetail | null> {
  const index = await loadSchemaIndex()
  const summary = index.summariesByName.get(tableName)
  if (!summary) return null

  return {
    ...summary,
    columns: index.columnsByTable.get(tableName) || [],
    indexes: index.indexesByTable.get(tableName) || [],
    constraints: index.constraintsByTable.get(tableName) || [],
    ddl: index.raw.ddl_by_table[tableName] || ''
  }
}

export async function findRelevantDatabaseTables(
  query: string,
  selectedTable?: string,
  limit = 6
): Promise<DatabaseTableDetail[]> {
  const catalog = await getDatabaseCatalog(query, Math.max(limit * 3, 12))
  const names = [selectedTable, ...catalog.tables.map((table) => table.tableName)]
    .filter((value): value is string => Boolean(value))
  const uniqueNames = Array.from(new Set(names)).slice(0, limit)
  const details = await Promise.all(uniqueNames.map((name) => getDatabaseTable(name)))
  return details.filter((detail): detail is DatabaseTableDetail => Boolean(detail))
}

export async function getDatabaseMetadata(): Promise<DatabaseMetadata> {
  return (await loadSchemaIndex()).raw.metadata
}
