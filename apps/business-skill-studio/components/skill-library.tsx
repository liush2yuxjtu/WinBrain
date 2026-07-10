"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type {
  CompanySetupPayload,
  ExpertSummary,
  OrganizationSummary,
  StoredSkillDetail,
  StoredSkillSummary
} from '@/lib/types'

type LibraryFilter = 'all' | 'with-evals' | 'without-evals'
type LibrarySort = 'updated-desc' | 'name-asc'
type EditorTab = 'skill' | 'evals'
type Notice = { type: 'success' | 'error'; message: string } | null

const GLOBAL_SCOPE = 'global'

function scopeKey(organizationId: string): string {
  return organizationId ? `organization:${organizationId}` : GLOBAL_SCOPE
}

function skillIdentity(organizationId: string, slug: string): string {
  return `${scopeKey(organizationId)}::${slug}`
}

function slugFromIdentity(identity: string, organizationId: string): string {
  const prefix = `${scopeKey(organizationId)}::`
  return identity.startsWith(prefix) ? identity.slice(prefix.length) : ''
}

function collectionUrl(organizationId: string): string {
  if (!organizationId) return '/api/skills'
  return `/api/skills?${new URLSearchParams({ organizationId }).toString()}`
}

function itemUrl(slug: string, organizationId: string): string {
  const base = `/api/skills/${encodeURIComponent(slug)}`
  if (!organizationId) return base
  return `${base}?${new URLSearchParams({ organizationId }).toString()}`
}

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
  const searchParams = useSearchParams()
  const [scopeOrganizationId, setScopeOrganizationId] = useState(() => searchParams.get('organizationId') || '')
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [experts, setExperts] = useState<ExpertSummary[]>([])
  const [setupError, setSetupError] = useState('')
  const [skills, setSkills] = useState<StoredSkillSummary[]>([])
  const [selectedIdentity, setSelectedIdentity] = useState('')
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
  const [staleConflict, setStaleConflict] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createExpertId, setCreateExpertId] = useState('')
  const [importedMarkdown, setImportedMarkdown] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const requestSequence = useRef(0)
  const listRequestSequence = useRef(0)
  const selectedIdentityRef = useRef('')
  const importInput = useRef<HTMLInputElement>(null)
  const createNameInput = useRef<HTMLInputElement>(null)
  const deleteCancelButton = useRef<HTMLButtonElement>(null)
  const dialogReturnFocus = useRef<HTMLElement | null>(null)

  const selectedSlug = slugFromIdentity(selectedIdentity, scopeOrganizationId)
  const selectedOrganization = organizations.find((organization) => organization.id === scopeOrganizationId)
  const availableExperts = useMemo(
    () => experts.filter((expert) => expert.organizationId === scopeOrganizationId && expert.isActive),
    [experts, scopeOrganizationId]
  )
  const selectedScopeLabel = scopeOrganizationId
    ? selectedOrganization?.name || scopeOrganizationId
    : '全局 Skill'
  const dirty = Boolean(detail) && (skillMarkdown !== detail?.skillMarkdown || evalsJson !== (detail?.evalsJson || ''))

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/api/setup', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw await responseError(response)
        const setup = await response.json() as CompanySetupPayload
        setOrganizations(setup.organizations)
        setExperts(setup.experts)
        setSetupError('')
      } catch (error) {
        if (controller.signal.aborted) return
        setSetupError(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => controller.abort()
  }, [])

  const loadSkills = useCallback(async (preferredSlug?: string) => {
    const sequence = ++listRequestSequence.current
    setLoadingList(true)
    setListError('')

    try {
      const response = await fetch(collectionUrl(scopeOrganizationId), { cache: 'no-store' })
      if (!response.ok) throw await responseError(response)
      const data = await response.json() as { skills: StoredSkillSummary[] }
      if (sequence !== listRequestSequence.current) return
      setSkills(data.skills)
      setSelectedIdentity((current) => {
        const currentSlug = slugFromIdentity(current, scopeOrganizationId)
        const nextSlug = preferredSlug && data.skills.some((skill) => skill.slug === preferredSlug)
          ? preferredSlug
          : currentSlug && data.skills.some((skill) => skill.slug === currentSlug)
            ? currentSlug
            : data.skills[0]?.slug || ''
        const nextIdentity = nextSlug ? skillIdentity(scopeOrganizationId, nextSlug) : ''
        selectedIdentityRef.current = nextIdentity
        return nextIdentity
      })
    } catch (error) {
      if (sequence !== listRequestSequence.current) return
      setListError(error instanceof Error ? error.message : String(error))
    } finally {
      if (sequence === listRequestSequence.current) setLoadingList(false)
    }
  }, [scopeOrganizationId])

  const preferredSlug = searchParams.get('selected') || undefined

  useEffect(() => {
    void loadSkills(preferredSlug)
  }, [loadSkills, preferredSlug])

  useEffect(() => {
    selectedIdentityRef.current = selectedIdentity
  }, [selectedIdentity])

  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null)
      setSkillMarkdown('')
      setEvalsJson('')
      setLoadingDetail(false)
      return
    }

    const sequence = ++requestSequence.current
    const controller = new AbortController()
    setLoadingDetail(true)
    setDetailError('')

    void (async () => {
      try {
        const response = await fetch(itemUrl(selectedSlug, scopeOrganizationId), {
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
  }, [detailReloadToken, scopeOrganizationId, selectedSlug])

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

    const sidebar = document.querySelector<HTMLElement>('.studio-sidebar')
    const topbar = document.querySelector<HTMLElement>('.studio-topbar')
    const mobileMenuButton = document.querySelector<HTMLElement>('.mobile-menu-button')
    const sidebarWasInert = sidebar?.hasAttribute('inert') || false
    sidebar?.setAttribute('inert', '')
    topbar?.setAttribute('inert', '')
    mobileMenuButton?.setAttribute('inert', '')

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating && !deleting) {
        if (createOpen) resetCreateDialog()
        if (deleteOpen) {
          setDeleteOpen(false)
          window.requestAnimationFrame(() => dialogReturnFocus.current?.focus())
        }
        return
      }
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('.library-dialog[role="dialog"], .library-dialog[role="alertdialog"]')
      const focusable = dialog
        ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')]
        : []
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      if (!sidebarWasInert) sidebar?.removeAttribute('inert')
      topbar?.removeAttribute('inert')
      mobileMenuButton?.removeAttribute('inert')
      window.removeEventListener('keydown', handleDialogKeyDown)
    }
  }, [createOpen, creating, deleteOpen, deleting])

  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return skills
      .filter((skill) => {
        if (filter === 'with-evals' && !skill.hasEvals) return false
        if (filter === 'without-evals' && skill.hasEvals) return false
        if (!normalizedQuery) return true
        return [skill.name, skill.slug, skill.title, skill.description]
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
      })
      .sort((a, b) => sort === 'name-asc'
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt))
  }, [filter, query, skills, sort])

  function changeScope(nextOrganizationId: string) {
    if (nextOrganizationId === scopeOrganizationId) return
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并切换组织作用域吗？')) return
    setScopeOrganizationId(nextOrganizationId)
    setSkills([])
    setSelectedIdentity('')
    selectedIdentityRef.current = ''
    setDetail(null)
    setSkillMarkdown('')
    setEvalsJson('')
    setCreateExpertId('')
    setNotice(null)
    setStaleConflict(false)
    setDetailError('')
  }

  function selectSkill(skill: StoredSkillSummary) {
    const identity = skillIdentity(skill.organizationId || scopeOrganizationId, skill.slug)
    if (identity === selectedIdentity) return
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并切换 Skill 吗？')) return
    setNotice(null)
    setStaleConflict(false)
    selectedIdentityRef.current = identity
    setSelectedIdentity(identity)
  }

  function resetCreateDialog() {
    setCreateOpen(false)
    setCreateName('')
    setCreateDescription('')
    setCreateExpertId('')
    setImportedMarkdown('')
    setCreateError('')
    window.requestAnimationFrame(() => dialogReturnFocus.current?.focus())
  }

  function openCreateDialog() {
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并创建新的 Skill 吗？')) return
    dialogReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCreateName('')
    setCreateDescription('')
    setCreateExpertId('')
    setImportedMarkdown('')
    setCreateError('')
    setCreateOpen(true)
  }

  function openImportPicker() {
    if (dirty && !window.confirm('当前修改尚未保存。确定要放弃修改并导入另一个 Skill 吗？')) return
    dialogReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCreateExpertId('')
    importInput.current?.click()
  }

  function openDeleteDialog() {
    if (saving) return
    dialogReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDeleteOpen(true)
  }

  async function createSkill(event: FormEvent) {
    event.preventDefault()
    if (!createName.trim() || !createDescription.trim() || creating) return

    setCreating(true)
    setCreateError('')
    const frontmatterName = 'pending-skill-name'
    const markdown = importedMarkdown
      ? prepareImportedMarkdown(importedMarkdown, frontmatterName, createDescription)
      : buildSkillMarkdown(createName, frontmatterName, createDescription)

    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: createName.trim(),
          skillMarkdown: markdown,
          evalsJson: '',
          overwrite: false,
          organizationId: scopeOrganizationId || undefined,
          expertId: scopeOrganizationId && createExpertId ? createExpertId : undefined
        })
      })
      if (!response.ok) throw await responseError(response)
      const data = await response.json() as { skill: StoredSkillDetail }

      resetCreateDialog()
      await loadSkills(data.skill.slug)
      setNotice({ type: 'success', message: `已创建 ${data.skill.title}` })
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

    try {
      const markdown = await file.text()
      const frontmatterName = readFrontmatterField(markdown, 'name')
      const description = readFrontmatterField(markdown, 'description')
      setCreateName(frontmatterName || file.name.replace(/\.(md|markdown)$/i, ''))
      setCreateDescription(description)
      setImportedMarkdown(markdown)
      setCreateError('')
      setCreateOpen(true)
    } catch {
      setNotice({ type: 'error', message: '读取或解析 SKILL.md 失败，请重试' })
    }
  }

  async function saveChanges() {
    if (!detail || !dirty || saving) return
    const savingOrganizationId = detail.organizationId || scopeOrganizationId
    const savingIdentity = skillIdentity(savingOrganizationId, detail.slug)
    setSaving(true)
    setNotice(null)
    setStaleConflict(false)

    try {
      const response = await fetch(itemUrl(detail.slug, savingOrganizationId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillMarkdown,
          evalsJson,
          expectedVersion: detail.version
        })
      })
      if (!response.ok) {
        if (response.status === 409) setStaleConflict(true)
        throw await responseError(response)
      }
      const data = await response.json() as { skill: StoredSkillDetail }

      setSkills((current) => current.map((skill) => (
        skillIdentity(skill.organizationId || scopeOrganizationId, skill.slug) === savingIdentity
      )
        ? data.skill
        : skill))
      if (selectedIdentityRef.current === savingIdentity) {
        setDetail(data.skill)
        setSkillMarkdown(data.skill.skillMarkdown)
        setEvalsJson(data.skill.evalsJson || '')
        setNotice({ type: 'success', message: '修改已保存' })
        setStaleConflict(false)
      }
    } catch (error) {
      if (selectedIdentityRef.current === savingIdentity) {
        setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelectedSkill() {
    if (!detail || deleting || saving) return
    const deletedTitle = detail.title
    const deletedOrganizationId = detail.organizationId || scopeOrganizationId
    setDeleting(true)

    try {
      const response = await fetch(itemUrl(detail.slug, deletedOrganizationId), { method: 'DELETE' })
      if (!response.ok) throw await responseError(response)
      setDeleteOpen(false)
      setDetail(null)
      setSelectedIdentity('')
      selectedIdentityRef.current = ''
      await loadSkills()
      setNotice({ type: 'success', message: `已删除 ${deletedTitle} 及全部历史版本` })
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.skill-list-item, .library-overview-actions .primary')?.focus()
      })
    } catch (error) {
      setDeleteOpen(false)
      setNotice({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      window.requestAnimationFrame(() => dialogReturnFocus.current?.focus())
    } finally {
      setDeleting(false)
    }
  }

  function reloadLatestDetail() {
    if (dirty && !window.confirm('这会放弃当前未保存的修改并加载最新版本。是否继续？')) return
    setNotice(null)
    setStaleConflict(false)
    setDetailReloadToken((value) => value + 1)
  }

  function exportBackup() {
    if (!detail) return
    const payload = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      name: detail.name,
      slug: detail.slug,
      organizationId: detail.organizationId || null,
      organizationName: detail.organizationId
        ? organizations.find((organization) => organization.id === detail.organizationId)?.name || null
        : null,
      expertId: detail.expertId || null,
      expertName: detail.expertId
        ? experts.find((expert) => expert.id === detail.expertId)?.name || null
        : null,
      revision: detail.version,
      skillMarkdown,
      evalsJson: evalsJson || null
    }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${detail.organizationId ? `${detail.organizationId}-` : ''}${detail.slug}.winbrain-skill.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const evalCount = skills.filter((skill) => skill.hasEvals).length

  return (
    <div className="library-content">
      <section className="library-overview" aria-label="Skill 库概览" inert={createOpen || deleteOpen}>
        <div className="library-stat"><span>全部 Skill</span><strong>{skills.length}</strong><small>版本化 Skill Store</small></div>
        <div className="library-stat"><span>已配置 Evals</span><strong>{evalCount}</strong><small>{skills.length ? `${Math.round(evalCount / skills.length * 100)}% 覆盖率` : '等待创建'}</small></div>
        <div className="library-stat library-stat-wide">
          <span>当前作用域</span><strong>{selectedScopeLabel}</strong><small>维护 SKILL.md 与 evals/evals.json，不修改项目安装的 Agent Skills</small>
        </div>
        <div className="library-overview-actions">
          <input ref={importInput} type="file" accept=".md,.markdown,text/markdown" hidden onChange={importSkillFile} />
          <button className="button secondary" type="button" onClick={openImportPicker}>导入 SKILL.md</button>
          <button className="button primary" type="button" onClick={openCreateDialog}>＋ 新建 Skill</button>
        </div>
      </section>

      {notice ? (
        <div className={`library-notice library-global-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.type === 'success' ? '✓' : '!'} {notice.message}</span>
          {staleConflict ? <button type="button" onClick={reloadLatestDetail}>加载最新版</button> : null}
        </div>
      ) : null}

      <section className="library-workspace" inert={createOpen || deleteOpen}>
        <aside className="skill-list-panel" aria-label="Skill 列表">
          <div className="library-toolbar">
            <div className="library-selects">
              <label className="full-field">
                <span className="sr-only">组织作用域</span>
                <select
                  aria-label="组织作用域"
                  value={scopeOrganizationId}
                  onChange={(event) => changeScope(event.target.value)}
                  disabled={saving || creating || deleting}
                >
                  <option value="">全局 Skill</option>
                  {scopeOrganizationId && !organizations.some((organization) => organization.id === scopeOrganizationId)
                    ? <option value={scopeOrganizationId}>{scopeOrganizationId}</option>
                    : null}
                  {organizations.map((organization) => (
                    <option value={organization.id} key={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {setupError ? <small role="status">组织与专家列表暂不可用；仍可管理全局 Skill。</small> : null}
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
            <button type="button" onClick={() => { void loadSkills(selectedSlug); reloadLatestDetail() }} disabled={loadingList}>↻ 刷新</button>
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
            ) : visibleSkills.map((skill) => {
              const identity = skillIdentity(skill.organizationId || scopeOrganizationId, skill.slug)
              return (
                <button
                  className={`skill-list-item${selectedIdentity === identity ? ' active' : ''}`}
                  type="button"
                  key={identity}
                  onClick={() => selectSkill(skill)}
                  aria-pressed={selectedIdentity === identity}
                >
                <span className="skill-list-icon" aria-hidden="true">S</span>
                <span className="skill-list-copy">
                  <span className="skill-item-title"><strong>{skill.title}</strong>{skill.hasEvals ? <i>Evals</i> : null}</span>
                  <code>{skill.slug}</code>
                  <small>{skill.description}</small>
                  <span className="skill-item-meta">{formatDate(skill.updatedAt)} · {formatBytes(skill.sizeBytes)}</span>
                </span>
                <span className="skill-list-chevron" aria-hidden="true">›</span>
                </button>
              )
            })}
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
                    <code>{detail.slug}</code>
                    <p>{detail.description}</p>
                    <small>作用域：{selectedScopeLabel}{detail.expertId ? ` · 专家：${experts.find((expert) => expert.id === detail.expertId)?.name || detail.expertId}` : ''}</small>
                  </div>
                </div>
                <div className="skill-detail-actions">
                  <button className="button secondary" type="button" onClick={exportBackup}>导出备份</button>
                  <button className="button danger" type="button" onClick={openDeleteDialog} disabled={saving}>删除</button>
                </div>
              </div>

              <div className="skill-file-meta">
                <span>版本 v{detail.version}</span><i />
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
                  <textarea className="library-editor" aria-label="编辑 SKILL.md" value={skillMarkdown} onChange={(event) => { setSkillMarkdown(event.target.value); setNotice((current) => current?.type === 'success' ? null : current) }} spellCheck={false} />
                ) : (
                  <textarea className="library-editor" aria-label="编辑 evals/evals.json" value={evalsJson} onChange={(event) => { setEvalsJson(event.target.value); setNotice((current) => current?.type === 'success' ? null : current) }} placeholder={'{\n  "skill_name": "...",\n  "evals": []\n}'} spellCheck={false} />
                )}
                <div className="skill-editor-footer">
                  <span>{tab === 'evals' ? '留空并保存会移除当前版本的 evals' : '保存修改会创建一个新的不可变版本'}</span>
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
                <small>存储标识与 SKILL.md name 将在创建时自动生成</small>
              </label>
              <label className="field">
                <span>触发描述</span>
                <textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="说明什么时候应该使用这个 Skill、它能解决什么问题" required />
              </label>
              <label className="field">
                <span>组织作用域</span>
                <input value={selectedScopeLabel} readOnly disabled />
                <small>新 Skill 将保存在当前选择的作用域中</small>
              </label>
              <label className="field">
                <span>关联专家（可选）</span>
                <select
                  aria-label="关联专家"
                  value={createExpertId}
                  onChange={(event) => setCreateExpertId(event.target.value)}
                  disabled={!scopeOrganizationId || !availableExperts.length}
                >
                  <option value="">不关联专家</option>
                  {availableExperts.map((expert) => (
                    <option value={expert.id} key={expert.id}>{expert.name} · {expert.role}</option>
                  ))}
                </select>
                <small>{scopeOrganizationId ? '只显示当前组织的启用专家' : '全局 Skill 不关联组织专家'}</small>
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
            <p id="delete-skill-description">这会从“{selectedScopeLabel}”永久删除 <code>{detail.slug}</code> 及全部历史版本，且无法撤销。</p>
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
