"use client"

import { FormEvent, useState } from 'react'
import type { StoredSkillSummary, StudioChatMessage } from '@/lib/types'

type ProgressiveEvent = {
  type?: 'status' | 'text' | 'result' | 'error'
  message?: string | StudioChatMessage
  delta?: string
  text?: string
  error?: string
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
    if (result.error) throw new Error(result.error)
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
    if (event.type === 'error') {
      throw new Error(event.error || 'Agent SDK stream failed')
    }

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
        body: JSON.stringify({ messages: nextMessages, expertRole, businessContext, activeSkillDraft: draft })
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
        throw new Error(result.warnings?.join(' | ') || 'Claude Agent SDK 未成功返回实时模型结果')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setMessages((current) => current.map((item) =>
        item.id === assistantId
          ? { ...item, content: `请求失败：${message}` }
          : item
      ))
      setWarnings([`请求失败：${message}`])
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
        throw new Error(result.warnings?.join(' | ') || 'Claude Agent SDK 未成功生成实时草稿')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setDraft('')
      setWarnings([`生成失败：${message}`])
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
        body: JSON.stringify({ skillName: businessGoal, skillMarkdown, evalsJson })
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
              <p>把业务专家的隐性经验，转化为可复用、可评估的 Claude Skill。</p>
            </div>
            <div className="status-cluster">
              <span className="status-pill"><i />工作台已就绪</span>
              <span className="technology-pill">Skill Creator</span>
            </div>
          </div>
        </div>
      </header>

      <div className="studio-content">
        <section className="intro-banner" aria-label="工作流说明">
          <div>
            <span className="eyebrow">EXPERT-TO-SKILL WORKFLOW</span>
            <h2>从一次业务访谈，到一个团队可复用的 Skill</h2>
            <p>AI 会持续追问判断标准、例外和输出格式；你只需校准业务内容，不需要手写 Markdown 或 YAML。</p>
          </div>
          <div className="workflow-summary" aria-label="三步工作流">
            <span><b>01</b> 访谈</span><i />
            <span><b>02</b> 生成</span><i />
            <span><b>03</b> 保存</span>
          </div>
        </section>

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
                  <div className="message">{message.content || (busy && message.role === 'assistant' ? '…' : '')}</div>
                </div>
              ))}
              {busy ? <div className="thinking"><span /><span /><span /> {streamStatus || 'AI 正在整理业务信息'}</div> : null}
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
                <p>校准 SKILL.md 与 evals/evals.json，再保存到 Skill Store。</p>
              </div>
              <span className={`draft-status${draft ? ' ready' : ''}`}>{draft ? '草稿已生成' : '等待生成'}</span>
            </div>

            <div className="editor-toolbar">
              <div className="editor-tabs"><span className="active">SKILL.md</span><span>evals/evals.json</span></div>
              <span>{draft.length.toLocaleString()} 字符</span>
            </div>
            <textarea
              aria-label="Skill 草稿编辑器"
              className="draft-editor"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="生成的 SKILL.md 与 evals 会显示在这里"
              spellCheck={false}
            />
            <div className="draft-footer">
              <div className="save-feedback" aria-live="polite">
                {savedSkill
                  ? <span className="success-message">✓ 已保存：{savedSkill.name} · v{savedSkill.version}</span>
                  : <span>{busy && streamStatus ? streamStatus : '草稿仅在当前会话中保留'}</span>}
              </div>
              <div className="draft-actions">
                <button className="button secondary" disabled={busy || !draft} type="button" onClick={() => setDraft('')}>清空草稿</button>
                <button className="button primary" disabled={busy || !draft.trim()} type="button" onClick={saveDraft}>保存到 Skill Store</button>
              </div>
            </div>
            {warnings.length ? <div className="warning" role="alert">{warnings.join(' · ')}</div> : null}
          </article>
        </section>
      </div>
    </main>
  )
}
