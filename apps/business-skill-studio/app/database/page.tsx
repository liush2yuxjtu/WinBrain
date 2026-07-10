"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type {
  DatabaseCatalogResponse,
  DatabaseChatResponse,
  DatabaseTableDetail,
  DatabaseTableResponse,
  DatabaseTableSummary
} from '@/lib/database-types'
import type { StudioChatMessage } from '@/lib/types'

type DetailTab = 'columns' | 'indexes' | 'ddl'

function newMessage(role: 'user' | 'assistant', content: string): StudioChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() }
}

function formatCount(value: number | null): string {
  return value === null ? '未知' : new Intl.NumberFormat('zh-CN', { notation: value > 9_999_999 ? 'compact' : 'standard' }).format(value)
}

async function readError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return new Error(body?.error || `Server returned status ${response.status}`)
}

function includesSearch(table: DatabaseTableSummary, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true
  return [table.tableName, table.comment, ...table.headers]
    .join(' ')
    .toLocaleLowerCase()
    .includes(normalized)
}

const starterPrompts = [
  '这张表的粒度、主键和关键业务字段是什么？',
  '帮我写一个安全的 100 行预览 SQL，不要 SELECT *。',
  '这张表可能有哪些数据质量风险？给出只读检查 SQL。'
]

export default function DatabasePage() {
  const [catalog, setCatalog] = useState<DatabaseCatalogResponse | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [search, setSearch] = useState('')
  const [showBackups, setShowBackups] = useState(false)
  const [selectedTable, setSelectedTable] = useState('')
  const [detail, setDetail] = useState<DatabaseTableDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('columns')
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatWarnings, setChatWarnings] = useState<string[]>([])
  const [groundedTables, setGroundedTables] = useState<string[]>([])
  const [messages, setMessages] = useState<StudioChatMessage[]>([
    newMessage('assistant', '我是 WinBrain 数据库分析 Agent。选择一张表，或直接用业务关键词问我；我会基于 2026-07-09 的 OceanBase/MySQL 元数据快照回答，并把推断与事实分开。')
  ])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/database/schema?limit=500', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw await readError(response)
        return response.json() as Promise<DatabaseCatalogResponse>
      })
      .then((data) => {
        setCatalog(data)
        const preferred = data.tables.find((table) => table.tableName === 'tb_oi_all_sales_order_daily_flat')
          || data.tables.find((table) => !table.isBackup)
          || data.tables[0]
        if (preferred) setSelectedTable(preferred.tableName)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCatalogError(error instanceof Error ? error.message : String(error))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedTable) return
    const controller = new AbortController()
    setDetailBusy(true)
    setDetail(null)
    fetch(`/api/database/schema?table=${encodeURIComponent(selectedTable)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw await readError(response)
        return response.json() as Promise<DatabaseTableResponse>
      })
      .then((data) => setDetail(data.table))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCatalogError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => setDetailBusy(false))
    return () => controller.abort()
  }, [selectedTable])

  const visibleTables = useMemo(() => {
    return (catalog?.tables || []).filter((table) =>
      (showBackups || !table.isBackup) && includesSearch(table, search)
    )
  }, [catalog, search, showBackups])

  async function sendMessage(event?: FormEvent, suggestedPrompt?: string) {
    event?.preventDefault()
    const content = (suggestedPrompt || chatInput).trim()
    if (!content || chatBusy) return

    const nextMessages = [...messages, newMessage('user', content)]
    setMessages(nextMessages)
    setChatInput('')
    setChatBusy(true)
    setChatWarnings([])

    try {
      const response = await fetch('/api/database/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, selectedTable })
      })
      if (!response.ok) throw await readError(response)

      const data = await response.json() as DatabaseChatResponse
      setMessages((current) => [...current, data.message])
      setGroundedTables(data.groundedTables || [])
      setChatWarnings(data.warnings || [])
    } catch (error) {
      setMessages((current) => [...current, newMessage('assistant', `请求失败：${error instanceof Error ? error.message : String(error)}`)])
    } finally {
      setChatBusy(false)
    }
  }

  const metadata = catalog?.metadata

  return (
    <main className="database-stage">
      <header className="studio-topbar database-topbar">
        <div className="topbar-inner">
          <div className="breadcrumb"><span>WinBrain</span><span>/</span><b>Database Explorer</b></div>
          <div className="title-row">
            <div>
              <h1>数据库探索与对话</h1>
              <p>查看 OceanBase 元数据、理解表结构，并让专用 Claude Agent SDK 生成安全的分析建议与只读 SQL。</p>
            </div>
            <div className="status-cluster">
              <span className="status-pill"><i />只读元数据</span>
              <span className="technology-pill">Claude Agent SDK</span>
            </div>
          </div>
        </div>
      </header>

      <div className="database-content">
        <section className="database-metrics" aria-label="数据库快照概览">
          <div><span>数据库</span><strong>{metadata?.database || '—'}</strong><small>{metadata?.source || '正在加载快照'}</small></div>
          <div><span>数据表</span><strong>{metadata?.counts.tables ?? '—'}</strong><small>{visibleTables.length} 张当前可见</small></div>
          <div><span>字段</span><strong>{metadata ? formatCount(metadata.counts.columns) : '—'}</strong><small>{metadata?.counts.indexes ?? '—'} 个索引</small></div>
          <div><span>快照时间</span><strong>{metadata?.generated_at || '—'}</strong><small>不包含业务数据行</small></div>
        </section>

        {catalogError ? <div className="database-alert" role="alert">{catalogError}</div> : null}

        <section className="database-workspace">
          <aside className="table-browser" aria-label="数据表列表">
            <div className="panel-title">
              <div><span className="step-label">SCHEMA</span><h2>数据表</h2></div>
              <span>{visibleTables.length}</span>
            </div>
            <label className="table-search">
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索表名、注释或字段" />
            </label>
            <label className="backup-toggle">
              <input type="checkbox" checked={showBackups} onChange={(event) => setShowBackups(event.target.checked)} />
              显示历史备份表
            </label>
            <div className="table-list">
              {!catalog ? <div className="panel-empty">正在加载表目录…</div> : null}
              {catalog && !visibleTables.length ? <div className="panel-empty">没有匹配的数据表</div> : null}
              {visibleTables.map((table) => (
                <button
                  className={`table-list-item${selectedTable === table.tableName ? ' active' : ''}`}
                  key={table.tableName}
                  type="button"
                  onClick={() => { setSelectedTable(table.tableName); setDetailTab('columns') }}
                >
                  <span className="table-glyph" aria-hidden="true">▤</span>
                  <span className="table-list-copy">
                    <strong>{table.tableName}</strong>
                    <small>{table.comment || `${table.columnCount} 个字段`}</small>
                  </span>
                  <span className="table-row-count">{formatCount(table.rowsEstimate)}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="schema-inspector" aria-label="表结构查看器">
            {detailBusy ? <div className="panel-empty large">正在加载表结构…</div> : null}
            {!detailBusy && !detail ? <div className="panel-empty large">从左侧选择一张表查看结构</div> : null}
            {detail ? (
              <>
                <header className="schema-header">
                  <div>
                    <span className="step-label">TABLE DETAIL</span>
                    <h2>{detail.tableName}</h2>
                    <p>{detail.comment || '暂无表注释'}</p>
                  </div>
                  {detail.isBackup ? <span className="schema-badge warning-badge">备份表</span> : <span className="schema-badge">当前表</span>}
                </header>
                <div className="schema-facts">
                  <span><b>{formatCount(detail.rowsEstimate)}</b> 估算行</span>
                  <span><b>{detail.columnCount}</b> 字段</span>
                  <span><b>{detail.primaryKey.length || 0}</b> 主键字段</span>
                  <span><b>{detail.engine}</b> 引擎</span>
                </div>
                <div className="schema-tabs" role="tablist" aria-label="表详情">
                  <button className={detailTab === 'columns' ? 'active' : ''} onClick={() => setDetailTab('columns')} type="button">字段 <span>{detail.columns.length}</span></button>
                  <button className={detailTab === 'indexes' ? 'active' : ''} onClick={() => setDetailTab('indexes')} type="button">索引与约束 <span>{detail.indexes.length}</span></button>
                  <button className={detailTab === 'ddl' ? 'active' : ''} onClick={() => setDetailTab('ddl')} type="button">DDL</button>
                </div>

                <div className="schema-tab-body">
                  {detailTab === 'columns' ? (
                    <div className="column-table-wrap">
                      <table className="column-table">
                        <thead><tr><th>#</th><th>字段</th><th>类型</th><th>空值</th><th>键</th><th>注释</th></tr></thead>
                        <tbody>
                          {detail.columns.map((column) => (
                            <tr key={column.columnName}>
                              <td>{column.ordinalPosition}</td>
                              <td><code>{column.columnName}</code></td>
                              <td>{column.columnType}</td>
                              <td>{column.nullable ? 'YES' : 'NO'}</td>
                              <td>{column.columnKey ? <span className="key-chip">{column.columnKey}</span> : '—'}</td>
                              <td>{column.comment || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {detailTab === 'indexes' ? (
                    <div className="index-list">
                      <h3>索引</h3>
                      {detail.indexes.length ? detail.indexes.map((index, position) => (
                        <div className="index-row" key={`${index.name}-${index.columnName}-${position}`}>
                          <span className="key-chip">{index.unique ? 'UNIQUE' : index.type}</span>
                          <strong>{index.name}</strong>
                          <code>{index.columnName}</code>
                          <small>顺序 {index.sequence}</small>
                        </div>
                      )) : <div className="panel-empty">快照中没有索引记录</div>}
                      <h3>约束</h3>
                      {detail.constraints.length ? detail.constraints.map((constraint, position) => (
                        <div className="index-row" key={`${constraint.name}-${position}`}><span className="key-chip">{constraint.type}</span><strong>{constraint.name}</strong></div>
                      )) : <div className="panel-empty">快照中没有约束记录</div>}
                    </div>
                  ) : null}
                  {detailTab === 'ddl' ? <pre className="ddl-view"><code>{detail.ddl || '-- 快照中没有 DDL'}</code></pre> : null}
                </div>
              </>
            ) : null}
          </section>

          <aside className="database-chat" aria-label="数据库 AI 对话">
            <div className="chat-agent-header">
              <div className="agent-orb" aria-hidden="true">AI</div>
              <div><span className="step-label">DATABASE AGENT</span><h2>问数据库</h2><p>结构探索 · SQL · 数据质量</p></div>
              <span className="agent-online" title="Agent 已就绪" />
            </div>
            <div className="chat-context-strip">
              <span>当前上下文</span>
              <strong title={selectedTable}>{selectedTable || '全库目录'}</strong>
            </div>
            <div className="database-chat-log" aria-live="polite" aria-busy={chatBusy}>
              {messages.map((message) => (
                <div className={`db-message ${message.role}`} key={message.id}>
                  <span>{message.role === 'assistant' ? 'AI' : '我'}</span>
                  <div>{message.content}</div>
                </div>
              ))}
              {chatBusy ? <div className="thinking"><span /><span /><span /> 正在检索相关表并分析</div> : null}
            </div>
            <div className="starter-prompts">
              {starterPrompts.map((prompt) => <button type="button" disabled={chatBusy} key={prompt} onClick={() => void sendMessage(undefined, prompt)}>{prompt}</button>)}
            </div>
            <form className="database-composer" onSubmit={(event) => void sendMessage(event)}>
              <label className="sr-only" htmlFor="database-question">向数据库 Agent 提问</label>
              <textarea
                id="database-question"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder="例如：订单表如何按月统计销量？"
              />
              <button type="submit" disabled={chatBusy || !chatInput.trim()} aria-label="发送问题">↑</button>
            </form>
            {groundedTables.length ? <div className="grounded-tables"><span>本轮参考：</span>{groundedTables.slice(0, 3).map((table) => <code key={table}>{table}</code>)}</div> : null}
            {chatWarnings.length ? <div className="database-chat-warning">{chatWarnings.join(' · ')}</div> : null}
          </aside>
        </section>
      </div>
    </main>
  )
}
