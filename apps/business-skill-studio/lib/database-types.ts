import type { StudioChatMessage } from './types'

export interface DatabaseMetadata {
  project: string
  source: string
  database: string
  server_version: string
  generated_at: string
  scope: string
  redacted_host: string
  counts: {
    tables: number
    columns: number
    indexes: number
    constraints: number
  }
}

export interface DatabaseTableSummary {
  tableName: string
  tableType: string
  engine: string
  rowsEstimate: number | null
  columnCount: number
  primaryKey: string[]
  headers: string[]
  comment: string
  isBackup: boolean
}

export interface DatabaseColumn {
  tableName: string
  ordinalPosition: number
  columnName: string
  columnType: string
  dataType: string
  nullable: boolean
  columnKey: string
  defaultValue: unknown
  extra: string
  comment: string
}

export interface DatabaseIndex {
  name: string
  columnName: string
  sequence: number
  unique: boolean
  type: string
}

export interface DatabaseConstraint {
  name: string
  type: string
}

export interface DatabaseTableDetail extends DatabaseTableSummary {
  columns: DatabaseColumn[]
  indexes: DatabaseIndex[]
  constraints: DatabaseConstraint[]
  ddl: string
}

export interface DatabaseCatalogResponse {
  metadata: DatabaseMetadata
  tables: DatabaseTableSummary[]
  total: number
  snapshotReadOnly: true
}

export interface DatabaseTableResponse {
  metadata: DatabaseMetadata
  table: DatabaseTableDetail
  snapshotReadOnly: true
}

export interface DatabaseChatRequest {
  messages: StudioChatMessage[]
  selectedTable?: string
}

export interface DatabaseChatResponse {
  message: StudioChatMessage
  usedLiveModel: boolean
  usedAgentSdk: boolean
  provider: string
  credentialSlot?: 'primary' | 'fallback' | 'legacy'
  warnings: string[]
  groundedTables: string[]
  snapshotDate: string
}
