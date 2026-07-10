import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import type { ChatRequest, SkillDraftRequest } from './types'
import {
  buildBusinessChatSystemPrompt,
  buildSkillCreatorSystemPrompt,
  buildSkillDraftPrompt,
  fallbackSkillDraft
} from './skill-creator'

export type AgentCredentialSlot = 'primary' | 'fallback' | 'legacy'
export type AgentSdkProvider = 'claude-agent-sdk' | 'deterministic-fallback'

export type AgentSdkResult = {
  text: string
  usedLiveModel: boolean
  usedAgentSdk: boolean
  provider: AgentSdkProvider
  credentialSlot?: AgentCredentialSlot
  warnings: string[]
}

type CredentialCandidate = {
  slot: AgentCredentialSlot
  key: string
}

type QueryInput = {
  prompt: string
  systemPrompt: string
}

const DEFAULT_ATTEMPT_TIMEOUT_MS = 60_000

function attemptTimeoutMs(): number {
  const configured = Number(process.env.AGENT_SDK_ATTEMPT_TIMEOUT_MS || process.env.API_TIMEOUT_MS)
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_ATTEMPT_TIMEOUT_MS
  return Math.min(configured, 180_000)
}

function credentialCandidates(): CredentialCandidate[] {
  const candidates: Array<[AgentCredentialSlot, string | undefined]> = [
    ['primary', process.env.ANTHROPIC_API_KEY_PRIMARY || process.env.ANTHROPIC_AUTH_TOKEN_PRIMARY],
    ['fallback', process.env.ANTHROPIC_API_KEY_FALLBACK || process.env.ANTHROPIC_AUTH_TOKEN_FALLBACK],
    ['legacy', process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN]
  ]

  const seen = new Set<string>()
  const result: CredentialCandidate[] = []

  for (const [slot, rawKey] of candidates) {
    const key = rawKey?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ slot, key })
  }

  return result
}

function buildPrompt(input: ChatRequest): string {
  return input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n\n')
}

function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>

  if (typeof record.result === 'string') return record.result.trim()
  if (typeof record.text === 'string') return record.text.trim()

  const sdkMessage = record.message
  if (sdkMessage && typeof sdkMessage === 'object') {
    const content = (sdkMessage as Record<string, unknown>).content
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return ''
          const partRecord = part as Record<string, unknown>
          return partRecord.type === 'text' && typeof partRecord.text === 'string'
            ? partRecord.text
            : ''
        })
        .filter(Boolean)
        .join('')
        .trim()
    }
  }

  const content = record.content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const partRecord = part as Record<string, unknown>
        return partRecord.type === 'text' && typeof partRecord.text === 'string'
          ? partRecord.text
          : ''
      })
      .filter(Boolean)
      .join('')
      .trim()
  }

  return ''
}

function resultError(message: Record<string, unknown>): Error {
  const errors = Array.isArray(message.errors)
    ? message.errors.filter((item): item is string => typeof item === 'string')
    : []
  const subtype = typeof message.subtype === 'string' ? message.subtype : 'unknown_error'
  return new Error(errors.length ? errors.join('; ') : `Claude Agent SDK returned ${subtype}`)
}

async function collectFirstCompleteResponse(handle: Query, abortController: AbortController): Promise<string> {
  const timeoutMs = attemptTimeoutMs()
  let timeout: ReturnType<typeof setTimeout> | undefined

  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      abortController.abort()
      handle.close()
      reject(new Error(`Claude Agent SDK attempt timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  const consume = (async () => {
    for await (const message of handle) {
      if (!message || typeof message !== 'object') continue
      const record = message as unknown as Record<string, unknown>
      const type = typeof record.type === 'string' ? record.type : ''

      if (type === 'result') {
        if (record.subtype !== 'success' || record.is_error === true) {
          throw resultError(record)
        }
        const resultText = extractText(record)
        if (resultText) return resultText
      }

      // MiniMax's Anthropic-compatible endpoint can emit a complete assistant
      // message without the terminal result frame expected by Claude Code.
      // With tools disabled and maxTurns=1, the first assistant message is final.
      if (type === 'assistant') {
        const assistantText = extractText(record)
        if (assistantText) return assistantText
      }
    }

    throw new Error('Claude Agent SDK ended without text output')
  })()

  try {
    return await Promise.race([consume, deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
    handle.close()
  }
}

function sdkEnvironment(key: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ANTHROPIC_API_KEY: key,
    ANTHROPIC_AUTH_TOKEN: key,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:
      process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || '1'
  }
}

async function runWithCredential(candidate: CredentialCandidate, input: QueryInput): Promise<string> {
  const abortController = new AbortController()
  const handle = query({
    prompt: input.prompt,
    options: {
      abortController,
      env: sdkEnvironment(candidate.key),
      model: process.env.ANTHROPIC_MODEL,
      systemPrompt: input.systemPrompt,
      maxTurns: 1,
      tools: [],
      permissionMode: 'dontAsk',
      persistSession: false
    }
  })

  return collectFirstCompleteResponse(handle, abortController)
}

async function runWithFailover(input: QueryInput): Promise<AgentSdkResult> {
  const candidates = credentialCandidates()
  if (!candidates.length) {
    return {
      text: '',
      usedLiveModel: false,
      usedAgentSdk: false,
      provider: 'deterministic-fallback',
      warnings: ['No Claude Agent SDK credential is configured.']
    }
  }

  const failures: string[] = []

  for (const candidate of candidates) {
    try {
      const text = await runWithCredential(candidate, input)
      return {
        text,
        usedLiveModel: true,
        usedAgentSdk: true,
        provider: 'claude-agent-sdk',
        credentialSlot: candidate.slot,
        warnings: failures.length
          ? [`Claude Agent SDK switched credentials after: ${failures.join(' | ')}`]
          : []
      }
    } catch (error) {
      failures.push(`${candidate.slot}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    text: '',
    usedLiveModel: false,
    usedAgentSdk: false,
    provider: 'claude-agent-sdk',
    warnings: [`All Claude Agent SDK credentials failed: ${failures.join(' | ')}`]
  }
}

function localChatFallback(input: ChatRequest): string {
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === 'user')
  return [
    'Claude Agent SDK 调用失败。',
    latestUserMessage?.content ? `已保留本轮输入：${latestUserMessage.content}` : '',
    '请检查主备 MiniMax Key 的额度和 Agent SDK 服务端日志。'
  ].filter(Boolean).join('\n\n')
}

export async function runAgentChat(input: ChatRequest): Promise<AgentSdkResult> {
  const result = await runWithFailover({
    prompt: buildPrompt(input),
    systemPrompt: buildBusinessChatSystemPrompt(
      input.expertRole,
      input.businessContext,
      input.activeSkillDraft
    )
  })

  if (result.text) return result
  return { ...result, text: localChatFallback(input) }
}

export async function draftSkillWithAgent(input: SkillDraftRequest): Promise<AgentSdkResult> {
  const result = await runWithFailover({
    prompt: buildSkillDraftPrompt(input),
    systemPrompt: buildSkillCreatorSystemPrompt()
  })

  if (result.text) return result
  return { ...result, text: fallbackSkillDraft(input) }
}
