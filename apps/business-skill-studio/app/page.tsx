"use client"

import { FormEvent, useState } from 'react'
import type { ChatResponse, StudioChatMessage } from '@/lib/types'

function newMessage(role: 'user' | 'assistant', content: string): StudioChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString()
  }
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
  const [savedPath, setSavedPath] = useState('')

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
          businessContext,
          activeSkillDraft: draft
        })
      })

      if (!response.ok) {
        throw await readError(response)
      }

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
    setSavedPath('')

    try {
      const response = await fetch('/api/skills/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: businessGoal,
          expertRole,
          businessGoal,
          transcript: messages
        })
      })

      if (!response.ok) {
        throw await readError(response)
      }

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
    setSavedPath('')

    const skillMarkdown = extractCodeBlock(draft, '## SKILL.md') || draft
    const evalsJson = extractCodeBlock(draft, '## evals/evals.json')

    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: businessGoal,
          skillMarkdown,
          evalsJson
        })
      })

      if (!response.ok) {
        throw await readError(response)
      }

      const data = await response.json() as { skill?: { path: string } }
      if (!data.skill?.path) {
        throw new Error('Save response did not include a skill path')
      }
      setSavedPath(data.skill.path)
    } catch (error) {
      setWarnings([`保存失败：${error instanceof Error ? error.message : String(error)}`])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>WinBrain Business Skill Studio</h1>
          <p>
            业务专家只需要聊天说明自己的流程、判断标准和例外情况。应用使用 Claude Agent SDK 风格的服务端代理，按 Anthropic skill-creator 流程生成可复用的 SKILL.md 与 evals。
          </p>
        </div>
        <span className="badge">.agents primary · .codex mirror</span>
      </section>

      <section className="grid">
        <div className="card">
          <div className="card-header">
            <h2>1. 跟业务专家访谈</h2>
            <p>通过一问一答捕获 intent、输入、输出、质量标准和边界情况。</p>
          </div>

          <div className="form">
            <div className="field">
              <label>专家角色</label>
              <input value={expertRole} onChange={(event) => setExpertRole(event.target.value)} />
            </div>
            <div className="field">
              <label>业务目标 / skill 名称线索</label>
              <input value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} />
            </div>
            <div className="field">
              <label>业务上下文</label>
              <textarea value={businessContext} onChange={(event) => setBusinessContext(event.target.value)} />
            </div>
          </div>

          <div className="chat-log" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.content}
              </div>
            ))}
          </div>

          <form className="form" onSubmit={sendMessage}>
            <div className="field">
              <label>下一条消息</label>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="描述流程、例外、输出要求或给一个真实案例" />
            </div>
            <div className="actions">
              <button className="primary" disabled={busy} type="submit">发送给 AI</button>
              <button className="secondary" disabled={busy || messages.length < 2} type="button" onClick={generateDraft}>生成 Skill 草稿</button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>2. 生成并保存 skill</h2>
            <p>草稿遵循 skill-creator 的 SKILL.md + evals/evals.json 输出结构。</p>
          </div>
          <textarea className="draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="生成的 SKILL.md 与 evals 会显示在这里" />
          <div className="form">
            <div className="actions">
              <button className="primary" disabled={busy || !draft.trim()} type="button" onClick={saveDraft}>保存到本地 skill store</button>
              <button className="secondary" disabled={busy} type="button" onClick={() => setDraft('')}>清空草稿</button>
            </div>
            {savedPath ? <p className="warning">已保存：{savedPath}</p> : null}
          </div>
          {warnings.length ? <p className="warning">{warnings.join(' · ')}</p> : null}
        </div>
      </section>
    </main>
  )
}
