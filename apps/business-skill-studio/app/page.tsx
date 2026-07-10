"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type {
  ChatResponse,
  CompanySetupPayload,
  ExpertSummary,
  StoredSkillSummary,
  StudioChatMessage
} from '@/lib/types'

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
    setMessages(nextMessages)
    setInput('')
    setBusy(true)
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
      if (!response.ok) throw await readError(response)

      const data = (await response.json()) as ChatResponse
      setMessages((current) => [...current, data.message])
      setWarnings(data.warnings || [])
    } catch (error) {
      setMessages((current) => [...current, newMessage('assistant', `请求失败：${error instanceof Error ? error.message : String(error)}`)])
    } finally {
      setBusy(false)
    }
  }

  async function generateDraft() {
    setBusy(true)
    setWarnings([])
    setSavedSkill(null)

    try {
      const response = await fetch('/api/skills/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillName: businessGoal, expertRole, businessGoal, transcript: messages })
      })
      if (!response.ok) throw await readError(response)

      const data = await response.json() as { text: string; warnings?: string[] }
      setDraft(data.text)
      setWarnings(data.warnings || [])
    } catch (error) {
      setDraft(`生成失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
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
    <main className="studio-stage" id="studio-home">
      <header className="studio-topbar">
        <div className="topbar-inner">
          <div className="breadcrumb"><span>WinBrain</span><span>/</span><b>Business Skill Studio</b></div>
          <div className="title-row">
            <div>
              <h1>WinBrain Business Skill Studio</h1>
              <p>把不同公司的业务专家经验，转化为独立、可复用、可评估的 Skill。</p>
            </div>
            <div className="status-cluster">
              <span className="status-pill"><i />{selectedOrganization?.name || '工作台已就绪'}</span>
              <span className="technology-pill">Skill Creator</span>
            </div>
          </div>
        </div>
      </header>

      <div className="studio-content">
        <section className="intro-banner" aria-label="工作流说明">
          <div>
            <span className="eyebrow">EXPERT-TO-SKILL WORKFLOW</span>
            <h2>从一次业务访谈，到一个公司可复用的 Skill</h2>
            <p>先选择公司和专家，再让 AI 追问判断标准、例外和输出格式；Skill 会保存在对应公司作用域。</p>
          </div>
          <div className="workflow-summary" aria-label="三步工作流">
            <span><b>01</b> 访谈</span><i />
            <span><b>02</b> 生成</span><i />
            <span><b>03</b> 保存</span>
          </div>
        </section>

        {setupError ? <div className="warning setup-warning">公司配置未加载：{setupError}。<a href="/settings">前往设置</a></div> : null}
        {!setupError && !setup.organizations.length ? <div className="warning setup-warning">尚未配置公司和专家。<a href="/settings">打开设置向导</a></div> : null}

        <section className="workflow-grid">
          <article className="studio-card interview-card" id="expert-interview">
            <div className="card-heading">
              <div className="heading-icon">⌁</div>
              <div>
                <span className="step-label">STEP 01</span>
                <h2>跟业务专家访谈</h2>
                <p>捕获目标、输入、输出、质量标准与边界情况。</p>
              </div>
            </div>

            <div className="context-form">
              <div className="field compact-field">
                <label htmlFor="organization">公司</label>
                <select id="organization" value={selectedOrganizationId} onChange={(event) => selectOrganization(event.target.value)}>
                  <option value="">未选择公司</option>
                  {setup.organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}
                </select>
              </div>
              <div className="field compact-field">
                <label htmlFor="expert">专家</label>
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
                <label htmlFor="business-goal">业务目标 / Skill 名称线索</label>
                <input id="business-goal" value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} />
              </div>
              <div className="field full-field">
                <label htmlFor="business-context">业务上下文</label>
                <textarea id="business-context" value={businessContext} onChange={(event) => setBusinessContext(event.target.value)} />
              </div>
            </div>

            <div className="chat-heading">
              <div><span className="live-dot" />访谈记录</div>
              <span>{messages.length} 条消息</span>
            </div>
            <div className="chat-log" aria-live="polite" aria-busy={busy}>
              {messages.map((message) => (
                <div key={message.id} className={`message-row ${message.role}`}>
                  <div className="message-avatar" aria-hidden="true">{message.role === 'assistant' ? 'AI' : '我'}</div>
                  <div className="message">{message.content}</div>
                </div>
              ))}
              {busy ? <div className="thinking"><span /><span /><span /> AI 正在整理业务信息</div> : null}
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="next-message">下一条消息</label>
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
              <div className="composer-actions">
                <span>Enter 发送 · Shift+Enter 换行</span>
                <div>
                  <button className="button secondary" disabled={busy || messages.length < 2} type="button" onClick={generateDraft}>生成 Skill 草稿</button>
                  <button className="button primary" disabled={busy} type="submit">发送给 AI <span aria-hidden="true">↑</span></button>
                </div>
              </div>
            </form>
          </article>

          <article className="studio-card draft-card" id="skill-draft">
            <div className="card-heading">
              <div className="heading-icon green">◇</div>
              <div>
                <span className="step-label">STEP 02–03</span>
                <h2>生成并保存 Skill</h2>
                <p>校准 SKILL.md 与 evals/evals.json，再保存到公司 Skill Store。</p>
              </div>
              <span className={`draft-status${draft ? ' ready' : ''}`}>{draft ? '草稿已生成' : '等待生成'}</span>
            </div>

            <div className="editor-toolbar">
              <div className="editor-tabs"><span className="active">SKILL.md</span><span>evals/evals.json</span></div>
              <span>{draft.length.toLocaleString()} 字符</span>
            </div>
            <textarea aria-label="Skill 草稿编辑器" className="draft-editor" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="生成的 SKILL.md 与 evals 会显示在这里" spellCheck={false} />
            <div className="draft-footer">
              <div className="save-feedback" aria-live="polite">
                {savedSkill
                  ? <span className="success-message">✓ 已保存：{savedSkill.name} · v{savedSkill.version}{selectedOrganization ? ` · ${selectedOrganization.name}` : ''}</span>
                  : <span>草稿仅在当前会话中保留</span>}
              </div>
              <div className="draft-actions">
                <button className="button secondary" disabled={busy || !draft} type="button" onClick={() => setDraft('')}>清空草稿</button>
                <button className="button primary" disabled={busy || !draft.trim()} type="button" onClick={saveDraft}>保存到 Skill Store</button>
              </div>
            </div>
            {warnings.length ? <div className="warning" role="status">{warnings.join(' · ')}</div> : null}
          </article>
        </section>
      </div>
    </main>
  )
}
