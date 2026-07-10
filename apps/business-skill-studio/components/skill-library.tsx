"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StoredSkillDetail, StoredSkillSummary } from '@/lib/types'

type LibraryFilter = 'all' | 'with-evals' | 'without-evals'
type LibrarySort = 'updated-desc' | 'name-asc'
type EditorTab = 'skill' | 'evals'
type Notice = { type: 'success' | 'error'; message: string } | null

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 10_240 ? 1 : 0)} KB`
}

function shortStableHash(input: string): string {
  let hash = 2166136261
  for (const character of input) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(0, 6)
}

function normalizeProposedName(input: string): string {
  const trimmed = input.trim()
  const asciiName = trimmed
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const baseName = asciiName || 'business-skill'
  const suffix = /[^\u0000-\u007f]/.test(trimmed) ? `-${shortStableHash(trimmed)}` : ''
  return `${baseName.slice(0, 64 - suffix.length).replace(/-+$/g, '')}${suffix}`
}

function yamlString(value: string): string {
  return JSON.stringify(value.trim())
}

function buildSkillMarkdown(title: string, name: string, description: string): string {
  return `---
name: ${name}
description: ${yamlString(description)}
---

# ${title.trim() || name}

## Purpose

说明这个 Skill 帮助用户完成什么目标。

## When to use

- 描述应该触发这个 Skill 的典型场景。

## Inputs to gather

- 列出执行前需要收集的信息。

## Workflow

1. 确认目标和上下文。
2. 按团队流程完成任务。
3. 根据质量标准检查输出。

## Output format

说明最终输出的结构和格式。

## Quality bar

列出可验证的完成标准。
`
}

function readFrontmatterField(markdown: string, field: string): string {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || ''
  const value = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'mi'))?.[1]?.trim() || ''
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1)
  }
  return value
}

function prepareImportedMarkdown(markdown: string, name: string, description: string): string {
  const trimmed = markdown.trim()
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  if (!match) {
    return `---\nname: ${name}\ndescription: ${yamlString(description)}\n---\n\n${trimmed}\n`
  }

  let frontmatter = match[1]
  const replaceField = (field: string, value: string) => {
    const pattern = new RegExp(`^${field}:\\s*.*$`, 'mi')
    frontmatter = pattern.test(frontmatter)
      ? frontmatter.replace(pattern, `${field}: ${value}`)
      : `${frontmatter}\n${field}: ${value}`
  }

  replaceField('name', name)
  replaceField('description', yamlString(description))
  return `---\n${frontmatter}\n---${trimmed.slice(match[0].length)}\n`
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return new Error(body?.error || `Server returned status ${response.status}`)
}

export function SkillLibrary() {
  const [skills, setSkills] = useState<StoredSkillSummary[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [detail, setDetail] = useState<StoredSkillDetail | null>(null)
  const [skillMarkdown, setSkillMarkdown] = useState('')
  const [evalsJson, setEvalsJson] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [sort, setSort] = useState<LibrarySort>('updated-desc')
  const [tab, setTab] = useState<EditorTab>('skill')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [detailReloadToken, setDetailReloadToken] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [importedMarkdown, setImportedMarkdown] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const requestSequence = useRef(0)
  const listRequestSequence = useRef(0)
  const selectedNameRef = useRef('')
  const importInput = useRef<HTMLInputElement>(null)
  const createNameInput = useRef<HTMLInputElement>(null)
  const deleteCancelButton = useRef<HTMLButtonElement>(null)
  const dialogReturnFocus = useRef<HTMLElement | null>(null)

  const dirty = Boolean(detail) && (skillMarkdown !== detail?.skillMarkdown || evalsJson !== (detail?.evalsJson || ''))

  const loadSkills = useCallback(async (preferredName?: string) => {
    const sequence = ++listRequestSequence.current
    setLoadingList(true)
    setListError('')

    try {
      const response = await fetch('/api/skills', { cache: 'no-store' })
      if (!response.ok) throw await responseError(response)
      const data = await response.json() as { skills: StoredSkillSummary[] }
      if (sequence !== listRequestSequence.current) return
      setSkills(data.skills)
      setSelectedName((current) => {
        const nextName = preferredName && data.skills.some((skill) => skill.name === preferredName)
          ? preferredName
          : current && data.skills.some((skill) => skill.name === current)
            ? current
            : data.skills[0]?.name || ''
        selectedNameRef.current = nextName
        return nextName
      })
    } catch (error) {
      if (sequence !== listRequestSequence.current) return
      setListError(error instanceof Error ? error.message : String(error))
    } finally {
      if (sequence === listRequestSequence.current) setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    const preferredName = new URLSearchParams(window.location.search).get('selected') || undefined
    void loadSkills(preferredName)
  }, [loadSkills])

  useEffect(() => {
    selectedNameRef.current = selectedName
  }, [selectedName])

  useEffect(() => {
    if (!selectedName) {
      setDetail(null)
      setSkillMarkdown('')
      setEvalsJson('')
      return
    }

    const sequence = ++requestSequence.current
    const controller = new AbortController()
    setLoadingDetail(true)
    setDetailError('')
    setNotice(null)

    void (async () => {
      try {
        const response = await fetch(`/api/skills/${encodeURIComponent(selectedName)}`, {
          cache: 'no-store',
          signal: controller.signal
        })
        if (!response.ok) throw await responseError(response)
        const data = await response.json() as { skill: StoredSkillDetail }
        if (sequence !== requestSequence.current) return

        setDetail(data.skill)
        setSkillMarkdown(data.skill.skillMarkdown)
        setEvalsJson(data.skill.evalsJson || '')
        setTab('skill')
      } catch (error) {
        if (controller.signal.aborted || sequence !== requestSequence.current) return
        setDetail(null)
        setDetailError(error instanceof Error ? error.message : String(error))
      } finally {
        if (sequence === requestSequence.current) setLoadingDetail(false)
      }
    })()

    return () => controller.abort()
  }, [detailReloadToken, selectedName])

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (createOpen) createNameInput.current?.focus()
  }, [createOpen])

  useEffect(() => {
    if (deleteOpen) deleteCancelButton.current?.focus()
  }, [deleteOpen])

  useEffect(() => {
    if (!createOpen && !deleteOpen) return

    const closeDialogOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || creating || deleting) return
      if (createOpen) resetCreateDialog()
      if (deleteOpen) {
        setDeleteOpen(false)
        window.requestAnimationFrame(() => dialogReturnFocus.current?.focus())
      }
    }
    window.addEventListener('keydown', closeDialogOnEscape)
    return () => window.removeEventListener('keydown', closeDialogOnEscape)
  }, [createOpen, creating, deleteOpen, deleting])

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return skills
      .filter((skill) => {
        if (filter === 'with-evals' && !skill.hasEvals) return false
        if (filter === 'without-evals' && skill.hasEvals) return false
        if (!normalizedQuery) return true
        return [skill.name, skill.title, skill.description]
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
      })
      .sort((a, b) => sort === 'name-asc'
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt))
  }, [filter, query, skills, sort])

  function selectSkill(name: string) {
    if (name === selectedName) return
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并切换 Skill 吗？')) return
    selectedNameRef.current = name
    setSelectedName(name)
  }

  function resetCreateDialog() {
    setCreateOpen(false)
    setCreateName('')
    setCreateDescription('')
    setImportedMarkdown('')
    setCreateError('')
    window.requestAnimationFrame(() => dialogReturnFocus.current?.focus())
  }

  function openCreateDialog() {
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并创建新的 Skill 吗？')) return
    dialogReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCreateName('')
    setCreateDescription('')
    setImportedMarkdown('')
    setCreateError('')
    setCreateOpen(true)
  }

  function openImportPicker() {
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并导入另一个 Skill 吗？')) return
    dialogReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    importInput.current?.click()
  }

  function openDeleteDialog() {
    dialogReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDeleteOpen(true)
  }

  async function createSkill(event: FormEvent) {
    event.preventDefault()
    if (!createName.trim() || !createDescription.trim() || creating) return

    setCreating(true)
    setCreateError('')
    const name = normalizeProposedName(createName)
    const markdown = importedMarkdown
      ? prepareImportedMarkdown(importedMarkdown, name, createDescription)
      : buildSkillMarkdown(createName, name, createDescription)

    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: name, skillMarkdown: markdown, evalsJson: '', overwrite: false })
      })
      if (!response.ok) throw await responseError(response)

      resetCreateDialog()
      await loadSkills(name)
      setNotice({ type: 'success', message: `已创建 ${name}` })
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error))
    } finally {
      setCreating(false)
    }
  }

  async function importSkillFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 1_000_000) {
      setNotice({ type: 'error', message: 'SKILL.md 必须小于 1 MB' })
      return
    }

    const markdown = await file.text()
    const frontmatterName = readFrontmatterField(markdown, 'name')
    const description = readFrontmatterField(markdown, 'description')
    setCreateName(frontmatterName || file.name.replace(/\.(md|markdown)$/i, ''))
    setCreateDescription(description)
    setImportedMarkdown(markdown)
    setCreateError('')
    setCreateOpen(true)
  }

  async function saveChanges() {
    if (!detail || !dirty || saving) return
    const savingName = detail.name
    setSaving(true)
    setNotice(null)

    try {
      const response = await fetch(`/api/skills/${encodeURIComponent(detail.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillMarkdown, evalsJson })
      })
      if (!response.ok) throw await responseError(response)
      const data = await response.json() as { skill: StoredSkillDetail }

      setSkills((current) => current.map((skill) => skill.name === data.skill.name
        ? {
            name: data.skill.name,
            title: data.skill.title,
            description: data.skill.description,
            path: data.skill.path,
            updatedAt: data.skill.updatedAt,
            sizeBytes: data.skill.sizeBytes,
            hasEvals: data.skill.hasEvals
          }
        : skill))
      if (selectedNameRef.current === data.skill.name) {
        setDetail(data.skill)
        setSkillMarkdown(data.skill.skillMarkdown)
        setEvalsJson(data.skill.evalsJson || '')
        setNotice({ type: 'success', message: '修改已保存' })
      }
    } catch (error) {
      if (selectedNameRef.current === savingName) {
        setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelectedSkill() {
    if (!detail || deleting) return
    setDeleting(true)

    try {
      const response = await fetch(`/api/skills/${encodeURIComponent(detail.name)}`, { method: 'DELETE' })
      if (!response.ok) throw await responseError(response)
      setDeleteOpen(false)
      setDetail(null)
      setSelectedName('')
      await loadSkills()
    } catch (error) {
      setDeleteOpen(false)
      setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setDeleting(false)
    }
  }

  function exportBackup() {
    if (!detail) return
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      name: detail.name,
      skillMarkdown,
      evalsJson: evalsJson || null
    }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${detail.name}.winbrain-skill.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const proposedName = createName.trim() ? normalizeProposedName(createName) : 'skill-name'
  const evalCount = skills.filter((skill) => skill.hasEvals).length

  return (
    <div className="library-content">
      <section className="library-overview" aria-label="Skill 库概览" inert={createOpen || deleteOpen}>
        <div className="library-stat"><span>全部 Skill</span><strong>{skills.length}</strong><small>本地生成库</small></div>
        <div className="library-stat"><span>已配置 Evals</span><strong>{evalCount}</strong><small>{skills.length ? `${Math.round(evalCount / skills.length * 100)}% 覆盖率` : '等待创建'}</small></div>
        <div className="library-stat library-stat-wide">
          <span>管理范围</span><strong>SKILL.md</strong><small>同时维护 evals/evals.json，不修改项目安装的 Agent Skills</small>
        </div>
        <div className="library-overview-actions">
          <input ref={importInput} type="file" accept=".md,.markdown,text/markdown" hidden onChange={importSkillFile} />
          <button className="button secondary" type="button" onClick={openImportPicker}>导入 SKILL.md</button>
          <button className="button primary" type="button" onClick={openCreateDialog}>＋ 新建 Skill</button>
        </div>
      </section>

      <section className="library-workspace" inert={createOpen || deleteOpen}>
        <aside className="skill-list-panel" aria-label="Skill 列表">
          <div className="library-toolbar">
            <label className="library-search">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">搜索 Skill</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或描述" />
              {query ? <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}>×</button> : null}
            </label>
            <div className="library-selects">
              <label>
                <span className="sr-only">筛选 Skill</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value as LibraryFilter)}>
                  <option value="all">全部</option>
                  <option value="with-evals">有 Evals</option>
                  <option value="without-evals">无 Evals</option>
                </select>
              </label>
              <label>
                <span className="sr-only">排序 Skill</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}>
                  <option value="updated-desc">最近更新</option>
                  <option value="name-asc">名称 A–Z</option>
                </select>
              </label>
            </div>
          </div>

          <div className="skill-list-heading">
            <span>{visibleSkills.length} 个结果</span>
            <button type="button" onClick={() => void loadSkills(selectedName)} disabled={loadingList}>↻ 刷新</button>
          </div>

          <div className="skill-list" aria-live="polite" aria-busy={loadingList}>
            {loadingList ? (
              <div className="library-state compact"><span className="library-spinner" /><p>正在读取 Skill 库…</p></div>
            ) : listError ? (
              <div className="library-state compact error-state"><b>读取失败</b><p>{listError}</p><button className="button secondary" type="button" onClick={() => void loadSkills()}>重试</button></div>
            ) : !skills.length ? (
              <div className="library-state compact"><span className="state-icon">◇</span><b>库里还没有 Skill</b><p>从工作台保存草稿，或在这里创建第一个 Skill。</p><button className="button primary" type="button" onClick={openCreateDialog}>创建 Skill</button></div>
            ) : !visibleSkills.length ? (
              <div className="library-state compact"><span className="state-icon">⌕</span><b>没有匹配结果</b><p>试试其他关键词，或清除当前筛选。</p><button className="button secondary" type="button" onClick={() => { setQuery(''); setFilter('all') }}>清除筛选</button></div>
            ) : visibleSkills.map((skill) => (
              <button
                className={`skill-list-item${selectedName === skill.name ? ' active' : ''}`}
                type="button"
                key={skill.name}
                onClick={() => selectSkill(skill.name)}
                aria-pressed={selectedName === skill.name}
              >
                <span className="skill-list-icon" aria-hidden="true">S</span>
                <span className="skill-list-copy">
                  <span className="skill-item-title"><strong>{skill.title}</strong>{skill.hasEvals ? <i>Evals</i> : null}</span>
                  <code>{skill.name}</code>
                  <small>{skill.description}</small>
                  <span className="skill-item-meta">{formatDate(skill.updatedAt)} · {formatBytes(skill.sizeBytes)}</span>
                </span>
                <span className="skill-list-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </aside>

        <article className="skill-detail-panel" aria-live="polite" aria-busy={loadingDetail}>
          {loadingDetail ? (
            <div className="library-state"><span className="library-spinner" /><b>正在加载 Skill</b><p>读取 SKILL.md 与 evals/evals.json…</p></div>
          ) : detailError ? (
            <div className="library-state error-state"><span className="state-icon">!</span><b>无法打开 Skill</b><p>{detailError}</p><button className="button secondary" type="button" onClick={() => setDetailReloadToken((value) => value + 1)}>重试</button></div>
          ) : !detail ? (
            <div className="library-state"><span className="state-icon">▦</span><b>选择一个 Skill 开始管理</b><p>可以查看内容、校准评测、导出备份或安全删除。</p><a className="button secondary" href="/#expert-interview">返回工作台创建</a></div>
          ) : (
            <>
              <div className="skill-detail-header">
                <div className="skill-detail-identity">
                  <span className="skill-detail-icon" aria-hidden="true">S</span>
                  <div>
                    <div className="skill-detail-title"><h2>{detail.title}</h2><span className={detail.hasEvals ? 'eval-badge ready' : 'eval-badge'}>{detail.hasEvals ? 'Evals 已配置' : '暂无 Evals'}</span></div>
                    <code>{detail.name}</code>
                    <p>{detail.description}</p>
                  </div>
                </div>
                <div className="skill-detail-actions">
                  <button className="button secondary" type="button" onClick={exportBackup}>导出备份</button>
                  <button className="button danger" type="button" onClick={openDeleteDialog}>删除</button>
                </div>
              </div>

              {notice ? <div className={`library-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.type === 'success' ? '✓' : '!'} {notice.message}</div> : null}

              <div className="skill-file-meta">
                <span>更新于 {formatDate(detail.updatedAt)}</span><i />
                <span>{formatBytes(detail.sizeBytes)}</span><i />
                <span>{dirty ? '有未保存修改' : '内容已同步'}</span>
              </div>

              <div className="skill-editor-shell">
                <div className="skill-editor-tabs" role="tablist" aria-label="Skill 文件">
                  <button type="button" role="tab" aria-selected={tab === 'skill'} className={tab === 'skill' ? 'active' : ''} onClick={() => setTab('skill')}>
                    <span>◇</span> SKILL.md <small>{skillMarkdown.length.toLocaleString()} 字符</small>
                  </button>
                  <button type="button" role="tab" aria-selected={tab === 'evals'} className={tab === 'evals' ? 'active' : ''} onClick={() => setTab('evals')}>
                    <span>{'{ }'}</span> evals/evals.json <small>{evalsJson ? `${evalsJson.length.toLocaleString()} 字符` : '可选'}</small>
                  </button>
                </div>
                {tab === 'skill' ? (
                  <textarea className="library-editor" aria-label="编辑 SKILL.md" value={skillMarkdown} onChange={(event) => setSkillMarkdown(event.target.value)} spellCheck={false} />
                ) : (
                  <textarea className="library-editor" aria-label="编辑 evals/evals.json" value={evalsJson} onChange={(event) => setEvalsJson(event.target.value)} placeholder={'{\n  "skill_name": "...",\n  "evals": []\n}'} spellCheck={false} />
                )}
                <div className="skill-editor-footer">
                  <span>{tab === 'evals' ? '留空并保存会移除现有 evals 文件' : 'frontmatter 中的 name 必须与 Skill 标识一致'}</span>
                  <div>
                    <button className="button secondary" type="button" disabled={!dirty || saving} onClick={() => { setSkillMarkdown(detail.skillMarkdown); setEvalsJson(detail.evalsJson || ''); setNotice(null) }}>放弃修改</button>
                    <button className="button primary" type="button" disabled={!dirty || saving} onClick={saveChanges}>{saving ? '保存中…' : '保存修改'}</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      {createOpen ? (
        <div className="library-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) resetCreateDialog() }}>
          <div className="library-dialog" role="dialog" aria-modal="true" aria-labelledby="create-skill-title">
            <div className="dialog-heading">
              <div><span className="heading-icon">＋</span><div><h2 id="create-skill-title">{importedMarkdown ? '导入 SKILL.md' : '新建 Skill'}</h2><p>先定义名称和触发描述，再进入编辑器完善流程。</p></div></div>
              <button type="button" aria-label="关闭新建窗口" onClick={resetCreateDialog} disabled={creating}>×</button>
            </div>
            <form className="dialog-form" onSubmit={createSkill}>
              <label className="field">
                <span>显示名称</span>
                <input ref={createNameInput} value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="例如：客户续约风险评审" required />
                <small>技术标识：<code>{proposedName}</code></small>
              </label>
              <label className="field">
                <span>触发描述</span>
                <textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="说明什么时候应该使用这个 Skill、它能解决什么问题" required />
              </label>
              {importedMarkdown ? <div className="import-summary"><span>✓</span><div><b>已读取 SKILL.md</b><small>{importedMarkdown.length.toLocaleString()} 字符；创建后可继续编辑</small></div></div> : null}
              {createError ? <div className="library-notice error" role="alert">! {createError}</div> : null}
              <div className="dialog-actions">
                <button className="button secondary" type="button" onClick={resetCreateDialog} disabled={creating}>取消</button>
                <button className="button primary" type="submit" disabled={creating || !createName.trim() || !createDescription.trim()}>{creating ? '创建中…' : importedMarkdown ? '导入并创建' : '创建 Skill'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteOpen && detail ? (
        <div className="library-dialog-backdrop" role="presentation">
          <div className="library-dialog compact-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-skill-title" aria-describedby="delete-skill-description">
            <div className="danger-dialog-icon" aria-hidden="true">!</div>
            <h2 id="delete-skill-title">删除 {detail.title}？</h2>
            <p id="delete-skill-description">这会永久删除 <code>{detail.name}</code> 的 SKILL.md 和 evals，且无法撤销。</p>
            <div className="dialog-actions">
              <button ref={deleteCancelButton} className="button secondary" type="button" onClick={() => { setDeleteOpen(false); window.requestAnimationFrame(() => dialogReturnFocus.current?.focus()) }} disabled={deleting}>取消</button>
              <button className="button danger solid" type="button" onClick={deleteSelectedSkill} disabled={deleting}>{deleting ? '删除中…' : '确认删除'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
