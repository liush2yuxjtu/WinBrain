"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type {
  CompanySetupPayload,
  ExpertSummary,
  StoredSkillSummary,
  StudioChatMessage
} from '@/lib/types'

type ProgressiveEvent = {
  type?: 'status' | 'text' | 'result'
  message?: string | StudioChatMessage
  delta?: string
  text?: string
  warnings?: string[]
  usedAgentSdk?: boolean
  provider?: string
  credentialSlot?: string
}

function newMessage(role: 'user' | 'assistant', content: string): StudioChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() }
}

function extractCodeBlock(source: string, fenceLabel: string): string {
  const sectionIndex = source.indexOf(fenceLabel)
  const searchable = sectionIndex >= 0 ? source.slice(sectionIndex) : source
  const match = searchable.match(/```(?:markdown|json)?\n([\s\S]*?)```/)
  return match?.[1]?.trim() || ''
}

async function readError(response: Response): Promise<Error> {
  const errorBody = await response.json().catch(() => null) as { error?: string } | null
  return new Error(errorBody?.error || `Server returned status ${response.status}`)
}

async function consumeProgressiveResponse(
  response: Response,
  onEvent: (event: ProgressiveEvent) => void
): Promise<ProgressiveEvent> {
  if (!response.ok) throw await readError(response)

  if (!response.body) {
    const result = await response.json() as ProgressiveEvent
    const event = { ...result, type: 'result' as const }
    onEvent(event)
    return event
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalEvent: ProgressiveEvent | undefined

  const processLine = (line: string) => {
    let value = line.trim()
    if (!value || value === '{"events":[' || value.startsWith('],')) return
    if (value.startsWith(',')) value = value.slice(1)

    const event = JSON.parse(value) as ProgressiveEvent
    onEvent(event)
    if (event.type === 'result') finalEvent = event
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) processLine(line)
    if (done) break
  }

  if (buffer.trim()) processLine(buffer)
  if (!finalEvent) throw new Error('Agent SDK stream ended without a final result')
  return finalEvent
}

function expertContext(expert: ExpertSummary): string {
  return [
    expert.department ? `部门：${expert.department}` : '',
    expert.expertise ? `专业领域：${expert.expertise}` : '',
    expert.businessContext || ''
  ].filter(Boolean).join('\n')
}

export default function Home() {
  const [expertRole, setExpertRole] = useState('销售运营专家')
  const [businessGoal, setBusinessGoal] = useState('把客户续约风险评审流程沉淀成可复用的 skill')
  const [businessContext, setBusinessContext] = useState('面向业务专家，不要求他们会写 Markdown 或 YAML。AI 通过追问收集流程、例外、输出模板和质量标准。')
  const [input, setInput] = useState('我们每周都要看客户健康度，判断哪些账号需要 CSM 介入，但每个人判断口径不一致。')
  const [messages, setMessages] = useState<StudioChatMessage[]>([
    newMessage('assistant', '请描述一个你经常处理、希望 AI 稳定复用的业务流程。我会按 skill-creator 的方式追问，然后帮你生成 SKILL.md 和 evals。')
  ])
  const [draft, setDraft] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [streamStatus, setStreamStatus] = useState('')
  const [savedSkill, setSavedSkill] = useState<StoredSkillSummary | null>(null)
  const [setup, setSetup] = useState<CompanySetupPayload>({ organizations: [], experts: [], dataSources: [] })
  const [setupError, setSetupError] = useState('')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [selectedExpertId, setSelectedExpertId] = useState('')

  const availableExperts = useMemo(
    () => setup.experts.filter((expert) => expert.organizationId === selectedOrganizationId && expert.isActive),
    [setup.experts, selectedOrganizationId]
  )
  const selectedOrganization = setup.organizations.find((organization) => organization.id === selectedOrganizationId)

  useEffect(() => {
    let cancelled = false
    fetch('/api/setup')
      .then(async (response) => {
        if (!response.ok) throw await readError(response)
        return response.json() as Promise<CompanySetupPayload>
      })
      .then((payload) => {
        if (cancelled) return
        setSetup(payload)
        const organizationId = payload.organizations[0]?.id || ''
        const expert = payload.experts.find((candidate) => candidate.organizationId === organizationId && candidate.isActive)
        setSelectedOrganizationId(organizationId)
        if (expert) {
          setSelectedExpertId(expert.id)
          setExpertRole(expert.role)
          setBusinessContext(expertContext(expert))
        }
      })
      .catch((error) => {
        if (!cancelled) setSetupError(error instanceof Error ? error.message : String(error))
      })
    return () => { cancelled = true }
  }, [])

  function selectExpert(expertId: string, experts = availableExperts) {
    setSelectedExpertId(expertId)
    const expert = experts.find((candidate) => candidate.id === expertId)
    if (!expert) return
    setExpertRole(expert.role)
    setBusinessContext(expertContext(expert))
  }

  function selectOrganization(organizationId: string) {
    setSelectedOrganizationId(organizationId)
    const experts = setup.experts.filter((expert) => expert.organizationId === organizationId && expert.isActive)
    selectExpert(experts[0]?.id || '', experts)
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    if (!input.trim() || busy) return

    const nextMessages = [...messages, newMessage('user', input.trim())]
    const assistantId = crypto.randomUUID()
    const assistantPlaceholder: StudioChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    }

    setMessages([...nextMessages, assistantPlaceholder])
    setInput('')
    setBusy(true)
    setStreamStatus('正在连接 Claude Agent SDK')
    setWarnings([])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          expertRole,
          businessContext: [selectedOrganization?.description, businessContext].filter(Boolean).join('\n\n'),
          activeSkillDraft: draft
        })
      })

      const result = await consumeProgressiveResponse(response, (streamEvent) => {
        if (streamEvent.type === 'status' && typeof streamEvent.message === 'string') {
          setStreamStatus(streamEvent.message)
        }
        if (streamEvent.type === 'text' && typeof streamEvent.text === 'string') {
          setMessages((current) => current.map((message) =>
            message.id === assistantId ? { ...message, content: streamEvent.text || '' } : message
          ))
        }
        if (streamEvent.type === 'result') {
          const finalText = typeof streamEvent.message === 'object'
            ? streamEvent.message.content
            : streamEvent.text || ''
          setMessages((current) => current.map((message) =>
            message.id === assistantId ? { ...message, content: finalText } : message
          ))
          setWarnings(streamEvent.warnings || [])
        }
      })

      if (result.usedAgentSdk !== true) {
        setWarnings(result.warnings || ['Claude Agent SDK 未成功返回实时模型结果'])
      }
    } catch (error) {
      setMessages((current) => current.map((message) =>
        message.id === assistantId
          ? { ...message, content: `请求失败：${error instanceof Error ? error.message : String(error)}` }
          : message
      ))
    } finally {
      setBusy(false)
      setStreamStatus('')
    }
  }

  async function generateDraft() {
    setBusy(true)
    setStreamStatus('正在启动 Claude Agent SDK 生成 Skill 草稿')
    setWarnings([])
    setSavedSkill(null)
    setDraft('')

    try {
      const response = await fetch('/api/skills/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: businessGoal, expertRole, businessGoal, transcript: messages })
      })

      const result = await consumeProgressiveResponse(response, (streamEvent) => {
        if (streamEvent.type === 'status' && typeof streamEvent.message === 'string') {
          setStreamStatus(streamEvent.message)
        }
        if (streamEvent.type === 'text' && typeof streamEvent.text === 'string') {
          setDraft(streamEvent.text)
        }
        if (streamEvent.type === 'result') {
          setDraft(streamEvent.text || '')
          setWarnings(streamEvent.warnings || [])
        }
      })

      if (result.usedAgentSdk !== true) {
        setWarnings(result.warnings || ['Claude Agent SDK 未成功生成实时草稿'])
      }
    } catch (error) {
      setDraft(`生成失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
      setStreamStatus('')
    }
  }

  async function saveDraft() {
    if (!draft.trim() || busy) return
    setBusy(true)
    setSavedSkill(null)

    const skillMarkdown = extractCodeBlock(draft, '## SKILL.md') || draft
    const evalsJson = extractCodeBlock(draft, '## evals/evals.json')

    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: businessGoal,
          skillMarkdown,
          evalsJson,
          organizationId: selectedOrganizationId || undefined,
          expertId: selectedExpertId || undefined
        })
      })
      if (!response.ok) throw await readError(response)

      const data = await response.json() as { skill?: StoredSkillSummary }
      if (!data.skill) throw new Error('Save response did not include skill metadata')
      setSavedSkill(data.skill)
    } catch (error) {
      setWarnings([`保存失败：${error instanceof Error ? error.message : String(error)}`])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="workbench" id="studio-home">
      <header className="workbench-topbar">
        <div className="workbench-title">
          <div className="workbench-breadcrumb"><span>WinBrain Business Skill Studio</span><span>/</span><b>Skill Studio</b></div>
          <h1>业务 Skill 工作台</h1>
        </div>
        <div className="workbench-tools">
          <button className="command-button" type="button" aria-label="打开命令面板" disabled>
            <span>⌕</span><span>搜索或运行命令</span><kbd>⌘ K</kbd>
          </button>
          <span className="workspace-state"><i />{selectedOrganization?.name || '工作区已就绪'}</span>
        </div>
      </header>

      <div className="workbench-body">
        <section className="workbench-canvas" aria-label="Skill 工作区">
          <div className="canvas-scroll">
            <section className="workbench-hero">
              <div>
                <span className="section-kicker">EXPERT KNOWLEDGE → REUSABLE SKILL</span>
                <h2>把业务经验转成可执行、可评估的 AI 能力</h2>
                <p>配置业务上下文，和右侧 AI 访谈，再生成并发布 Skill。整个流程保留在同一工作台。</p>
              </div>
              <button
                className="button primary hero-action"
                disabled={busy || messages.length < 2}
                type="button"
                onClick={() => {
                  if (draft.trim() && !window.confirm('重新生成将覆盖您当前在编辑器中的修改，确定要重新生成吗？')) return
                  void generateDraft()
                }}
              >
                <span>✦</span> 生成 Skill 草稿
              </button>
            </section>

            <section className="metric-grid" aria-label="工作区概览">
              <article className="metric-card">
                <span className="metric-icon">◎</span>
                <div><b>{availableExperts.length || '—'}</b><span>当前可用专家</span></div>
              </article>
              <article className="metric-card">
                <span className="metric-icon">⌁</span>
                <div><b>{setup.dataSources.length || '—'}</b><span>已连接数据源</span></div>
              </article>
              <article className="metric-card">
                <span className="metric-icon">◇</span>
                <div><b>{draft ? '可评审' : '待生成'}</b><span>当前 Skill 状态</span></div>
              </article>
            </section>

            {setupError ? <div className="warning setup-warning">公司配置未加载：{setupError}。<a href="/settings">前往设置</a></div> : null}
            {!setupError && !setup.organizations.length ? <div className="warning setup-warning">尚未配置公司和专家。<a href="/settings">打开设置向导</a></div> : null}

            <section className="workbench-panel" id="expert-interview">
              <div className="panel-titlebar">
                <div>
                  <span className="section-kicker">01 · CONTEXT</span>
                  <h2>定义业务场景</h2>
                  <p>这些信息会作为 AI 访谈和 Skill 生成的持续上下文。</p>
                </div>
                <span className="panel-status">自动保存</span>
              </div>

              <div className="context-form saas-form">
                <div className="field compact-field">
                  <label htmlFor="organization">工作区</label>
                  <select id="organization" value={selectedOrganizationId} onChange={(event) => selectOrganization(event.target.value)}>
                    <option value="">未选择公司</option>
                    {setup.organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}
                  </select>
                </div>
                <div className="field compact-field">
                  <label htmlFor="expert">业务专家</label>
                  <select id="expert" value={selectedExpertId} onChange={(event) => selectExpert(event.target.value)} disabled={!selectedOrganizationId}>
                    <option value="">手动输入专家信息</option>
                    {availableExperts.map((expert) => <option value={expert.id} key={expert.id}>{expert.name} · {expert.role}</option>)}
                  </select>
                </div>
                <div className="field compact-field">
                  <label htmlFor="expert-role">专家角色</label>
                  <input id="expert-role" value={expertRole} onChange={(event) => setExpertRole(event.target.value)} />
                </div>
                <div className="field compact-field">
                  <label htmlFor="business-goal">Skill 目标</label>
                  <input id="business-goal" value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} />
                </div>
                <div className="field full-field">
                  <label htmlFor="business-context">业务上下文</label>
                  <textarea id="business-context" value={businessContext} onChange={(event) => setBusinessContext(event.target.value)} />
                </div>
              </div>
            </section>

            <section className="workbench-panel skill-editor" id="skill-draft">
              <div className="panel-titlebar editor-titlebar">
                <div>
                  <span className="section-kicker">02 · REVIEW & PUBLISH</span>
                  <h2>Skill 草稿</h2>
                  <p>检查指令与评估集，然后发布到公司 Skill Store。</p>
                </div>
                <span className={`draft-status${draft ? ' ready' : ''}`}>{draft ? '草稿已生成' : '等待 AI 生成'}</span>
              </div>

              <div className="editor-toolbar">
                <div className="editor-tabs"><span className="active">SKILL.md</span><span>evals/evals.json</span></div>
                <span>{draft.length.toLocaleString()} 字符</span>
              </div>
              <textarea aria-label="Skill 草稿编辑器" className="draft-editor" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="AI 生成的 SKILL.md 与 evals 会显示在这里。你也可以直接编辑。" spellCheck={false} />
              <div className="draft-footer">
                <div className="save-feedback" aria-live="polite">
                  {savedSkill
                    ? <span className="success-message">✓ 已发布：{savedSkill.name} · v{savedSkill.version}{selectedOrganization ? ` · ${selectedOrganization.name}` : ''}</span>
                    : <span>{busy && streamStatus ? streamStatus : '草稿仅在当前会话中保留'}</span>}
                </div>
                <div className="draft-actions">
                  <button
                    className="button secondary"
                    disabled={busy || !draft}
                    type="button"
                    onClick={() => {
                      if (window.confirm('确定要清空当前生成的草稿吗？此操作不可撤销。')) setDraft('')
                    }}
                  >
                    清空
                  </button>
                  <button className="button primary" disabled={busy || !draft.trim()} type="button" onClick={saveDraft}>发布到 Skill Store</button>
                </div>
              </div>
              {warnings.length ? <div className="warning" role="status">{warnings.join(' · ')}</div> : null}
            </section>
          </div>
        </section>

        <aside className="assistant-panel" aria-label="WinBrain AI 助手">
          <div className="assistant-header">
            <div className="assistant-identity">
              <span className="assistant-mark">✦</span>
              <div><strong>WinBrain Copilot</strong><span><i /> 正在读取当前工作区</span></div>
            </div>
            <button type="button" className="icon-button" aria-label="AI 助手菜单" disabled>•••</button>
          </div>

          <div className="assistant-context">
            <span>上下文</span>
            <div className="context-chips">
              <span className="context-chip">@ {selectedOrganization?.name || '当前公司'}</span>
              {expertRole.trim() ? <span className="context-chip"># {expertRole}</span> : null}
              {draft ? <span className="context-chip">◇ SKILL.md</span> : null}
            </div>
          </div>

          <div className="assistant-suggestions" aria-label="快捷提示">
            <button type="button" onClick={() => setInput('请帮我找出这个流程中仍然缺失的判断标准和边界情况。')}>找出缺失的判断标准</button>
            <button type="button" onClick={() => setInput('请把当前业务目标拆成输入、步骤、输出和验收标准。')}>拆解为标准流程</button>
          </div>

          <div className="assistant-thread" aria-live="polite" aria-busy={busy}>
            {messages.map((message) => (
              <div key={message.id} className={`assistant-message ${message.role}`}>
                <div className="assistant-avatar" aria-hidden="true">{message.role === 'assistant' ? '✦' : '你'}</div>
                <div className="assistant-bubble">{message.content || (busy && message.role === 'assistant' ? '…' : '')}</div>
              </div>
            ))}
            {busy ? <div className="assistant-thinking"><span /><span /><span /> {streamStatus || '正在整理业务信息'}</div> : null}
          </div>

          <form className="assistant-composer" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="next-message">向 AI 发送消息</label>
            <textarea
              id="next-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="描述流程、例外、输出要求或给一个真实案例"
            />
            <div className="assistant-composer-footer">
              <div className="composer-tools"><button type="button" aria-label="添加上下文" disabled>＋</button><span>Agent</span></div>
              <button className="assistant-send" disabled={busy || !input.trim()} type="submit" aria-label="发送给 AI">↑</button>
            </div>
          </form>
        </aside>
      </div>
    </main>
  )
}
