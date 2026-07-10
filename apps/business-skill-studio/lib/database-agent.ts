import 'server-only'

import { runAgentPrompt, type AgentSdkResult } from './agent-sdk'
import {
  findRelevantDatabaseTables,
  getDatabaseMetadata
} from './database-schema'
import type { DatabaseChatRequest, DatabaseTableDetail } from './database-types'

export type DatabaseAgentResult = AgentSdkResult & {
  groundedTables: string[]
  snapshotDate: string
}

function conversationPrompt(input: DatabaseChatRequest): string {
  return input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n')
}

function latestQuestion(input: DatabaseChatRequest): string {
  return [...input.messages].reverse().find((message) => message.role === 'user')?.content || ''
}

function compactColumns(table: DatabaseTableDetail, question: string): DatabaseTableDetail['columns'] {
  if (table.columns.length <= 80) return table.columns

  const matches = question.toLocaleLowerCase().match(/[a-z0-9_]{2,}|[\u3400-\u9fff]{2,}/g) || []
  const tokens = matches.flatMap((match) => {
    if (!/^[\u3400-\u9fff]+$/.test(match) || match.length <= 3) return [match]
    return [match, ...Array.from({ length: match.length - 1 }, (_, index) => match.slice(index, index + 2))]
  })
  const prioritized = table.columns.filter((column) => {
    const value = `${column.columnName} ${column.comment}`.toLocaleLowerCase()
    return column.columnKey === 'PRI' || tokens.some((token) => value.includes(token))
  })

  return Array.from(new Map(
    [...prioritized, ...table.columns].map((column) => [column.columnName, column])
  ).values()).slice(0, 80)
}

function schemaContext(tables: DatabaseTableDetail[], question: string): string {
  return tables.map((table, index) => {
    const columns = compactColumns(table, question)
    return [
      `TABLE ${index + 1}: ${table.tableName}`,
      `comment: ${table.comment || '(none)'}`,
      `estimated_rows: ${table.rowsEstimate ?? 'unknown'}`,
      `primary_key: ${table.primaryKey.join(', ') || '(not declared)'}`,
      `columns (${columns.length}/${table.columnCount} shown):`,
      ...columns.map((column) =>
        `- ${column.columnName} ${column.columnType}${column.nullable ? ' NULL' : ' NOT NULL'}${column.columnKey ? ` key=${column.columnKey}` : ''}${column.comment ? ` — ${column.comment}` : ''}`
      )
    ].join('\n')
  }).join('\n\n')
}

function databaseSystemPrompt(snapshotDate: string, context: string): string {
  return [
    'You are WinBrain Database Analyst, a dedicated Claude Agent SDK agent for exploring and explaining database metadata and drafting safe analytical SQL.',
    'Apply the Anthropic data plugin workflows: understand table grain and keys first, classify columns, check data-quality risks, write dialect-correct SQL, validate joins and denominators, and lead with the answer.',
    `The only grounded source in this turn is a metadata-only OceanBase/MySQL-compatible schema snapshot generated on ${snapshotDate}. It contains no business rows.`,
    'Never claim that a query was executed or that values, distributions, null rates, freshness, or relationships were observed unless the supplied metadata proves it.',
    'Clearly label estimated row counts, inferred relationships, inferred business meanings, and suggested profiling checks.',
    'SQL safety is mandatory: generate only SELECT, WITH, SHOW, DESCRIBE, or EXPLAIN statements. Never generate or recommend INSERT, UPDATE, DELETE, MERGE, REPLACE, ALTER, DROP, TRUNCATE, CREATE, GRANT, REVOKE, CALL, or multi-statement SQL.',
    'Use backticks for identifiers when helpful and target OceanBase/MySQL 5.7 compatibility. Add LIMIT 100 to preview queries unless an aggregate necessarily returns fewer rows.',
    'Before proposing a join, state the candidate keys and warn when no declared foreign key proves the relationship. Avoid SELECT * for wide tables.',
    'Reply in the language used by the user. Cite exact table and column names with backticks.',
    '',
    'RELEVANT SCHEMA CONTEXT',
    context || '(No matching table metadata found.)'
  ].join('\n')
}

function fallbackAnswer(question: string, tables: DatabaseTableDetail[], snapshotDate: string): string {
  if (!tables.length) {
    return `当前只能访问 ${snapshotDate} 的只读元数据快照，但没有找到与“${question || '当前问题'}”匹配的表。请换一个业务关键词、表名或字段名。`
  }

  const [primary, ...related] = tables
  const columns = compactColumns(primary, question).slice(0, 12)
  return [
    `当前基于 ${snapshotDate} 的只读元数据快照。Claude Agent SDK 暂未返回实时回答，下面是可验证的结构信息。`,
    `最相关表：\`${primary.tableName}\`${primary.comment ? `（${primary.comment}）` : ''}，约 ${primary.rowsEstimate?.toLocaleString() || '未知'} 行、${primary.columnCount} 列，主键为 ${primary.primaryKey.length ? primary.primaryKey.map((key) => `\`${key}\``).join('、') : '未声明'}。`,
    `可优先查看字段：${columns.map((column) => `\`${column.columnName}\`${column.comment ? `（${column.comment}）` : ''}`).join('、')}。`,
    related.length ? `可能相关的表：${related.map((table) => `\`${table.tableName}\``).join('、')}。这些关系仅由名称与注释推断，需要用业务口径或键值验证。` : '',
    `预览结构可使用只读 SQL：\n\n\`\`\`sql\nSELECT ${columns.slice(0, 6).map((column) => `\`${column.columnName}\``).join(',\n       ')}\nFROM \`${primary.tableName}\`\nLIMIT 100;\n\`\`\``
  ].filter(Boolean).join('\n\n')
}

export async function runDatabaseAgent(input: DatabaseChatRequest): Promise<DatabaseAgentResult> {
  const question = latestQuestion(input)
  const [metadata, tables] = await Promise.all([
    getDatabaseMetadata(),
    findRelevantDatabaseTables(question, input.selectedTable)
  ])
  const groundedTables = tables.map((table) => table.tableName)
  const result = await runAgentPrompt({
    prompt: conversationPrompt(input),
    systemPrompt: databaseSystemPrompt(metadata.generated_at, schemaContext(tables, question)),
    fallbackText: fallbackAnswer(question, tables, metadata.generated_at)
  })

  return {
    ...result,
    groundedTables,
    snapshotDate: metadata.generated_at
  }
}
