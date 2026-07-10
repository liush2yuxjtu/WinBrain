import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ChatRequest, SkillDraftRequest } from './types'
import {
  buildBusinessChatSystemPrompt,
  buildSkillCreatorSystemPrompt,
  buildSkillDraftPrompt
} from './skill-creator'

export type AgentCredentialSlot = 'primary' | 'fallback' | 'legacy'
export type AgentSdkProvider = 'claude-agent-sdk'

export type AgentSdkResult = {
  text: string
  usedLiveModel: boolean
  usedAgentSdk: boolean
  provider: AgentSdkProvider
  credentialSlot?: AgentCredentialSlot
  warnings: string[]
}

export type AgentSdkStreamEvent =
  | {
      type: 'status'
      message: string
      credentialSlot?: AgentCredentialSlot
      elapsedMs?: number
    }
  | {
      type: 'text'
      delta: string
      text: string
      credentialSlot: AgentCredentialSlot
    }
  | ({ type: 'result' } & AgentSdkResult)

type CredentialCandidate = {
  slot: AgentCredentialSlot
  key: string
}

type QueryInput = {
  prompt: string
  systemPrompt: string
}

type StreamingQueryHandle = AsyncIterable<unknown> & {
  close(): void
}

const MINIMUM_ATTEMPT_TIMEOUT_MS = 600_000
const HEARTBEAT_INTERVAL_MS = 15_000

export class AgentSdkConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentSdkConfigurationError'
  }
}

function attemptTimeoutMs(): number {
  const configured = Number(process.env.AGENT_SDK_ATTEMPT_TIMEOUT_MS || process.env.API_TIMEOUT_MS)
  if (!Number.isFinite(configured) || configured <= 0) return MINIMUM_ATTEMPT_TIMEOUT_MS
  return Math.max(configured, MINIMUM_ATTEMPT_TIMEOUT_MS)
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

export function assertAgentSdkConfigured(): void {
  if (credentialCandidates().length) return

  throw new AgentSdkConfigurationError(
    'Claude Agent SDK credentials are not configured. Set ANTHROPIC_API_KEY_PRIMARY, ANTHROPIC_API_KEY_FALLBACK, or ANTHROPIC_API_KEY.'
  )
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

function extractSafeStreamDelta(message: Record<string, unknown>): string {
  if (message.type !== 'stream_event') return ''
  const event = message.event
  if (!event || typeof event !== 'object') return ''

  const eventRecord = event as Record<string, unknown>
  if (eventRecord.type !== 'content_block_delta') return ''

  const delta = eventRecord.delta
  if (!delta || typeof delta !== 'object') return ''
  const deltaRecord = delta as Record<string, unknown>

  // Intentionally expose only normal text. Thinking/reasoning deltas are ignored.
  return deltaRecord.type === 'text_delta' && typeof deltaRecord.text === 'string'
    ? deltaRecord.text
    : ''
}

function appendNonDuplicate(current: string, incoming: string): { delta: string; text: string } {
  if (!incoming) return { delta: '', text: current }
  if (!current) return { delta: incoming, text: incoming }
  if (incoming === current || current.endsWith(incoming) || current.startsWith(incoming)) {
    return { delta: '', text: current }
  }
  if (incoming.startsWith(current)) {
    const delta = incoming.slice(current.length)
    return { delta, text: incoming }
  }

  const delta = `\n\n${incoming}`
  return { delta, text: `${current}${delta}` }
}

function resultError(message: Record<string, unknown>): Error {
  const errors = Array.isArray(message.errors)
    ? message.errors.filter((item): item is string => typeof item === 'string')
    : []
  const subtype = typeof message.subtype === 'string' ? message.subtype : 'unknown_error'
  return new Error(errors.length ? errors.join('; ') : `Claude Agent SDK returned ${subtype}`)
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

function statusForSdkMessage(record: Record<string, unknown>): string | null {
  const type = typeof record.type === 'string' ? record.type : ''
  const subtype = typeof record.subtype === 'string' ? record.subtype : ''

  if (type === 'system' && subtype === 'init') return 'Claude Agent SDK 已初始化，等待模型输出'
  if (type === 'assistant') return '已收到模型文本，正在整理最终响应'
  if (type === 'result') return '已收到 Claude Agent SDK 最终结果'
  return null
}

async function* streamWithCredential(
  candidate: CredentialCandidate,
  input: QueryInput
): AsyncGenerator<AgentSdkStreamEvent, string, void> {
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
      persistSession: false,
      includePartialMessages: true
    }
  }) as StreamingQueryHandle

  const iterator = handle[Symbol.asyncIterator]()
  const startedAt = Date.now()
  const deadlineAt = startedAt + attemptTimeoutMs()
  let pendingNext = iterator.next()
  let fullText = ''

  try {
    while (true) {
      const remainingMs = deadlineAt - Date.now()
      if (remainingMs <= 0) {
        throw new Error(`Claude Agent SDK attempt timed out after ${attemptTimeoutMs()}ms`)
      }

      const outcome = await Promise.race([
        pendingNext.then((value) => ({ kind: 'message' as const, value })),
        new Promise<{ kind: 'heartbeat' }>((resolve) => {
          setTimeout(() => resolve({ kind: 'heartbeat' }), Math.min(HEARTBEAT_INTERVAL_MS, remainingMs))
        })
      ])

      if (outcome.kind === 'heartbeat') {
        const elapsedMs = Date.now() - startedAt
        yield {
          type: 'status',
          credentialSlot: candidate.slot,
          elapsedMs,
          message: `正在等待 ${candidate.slot} Key 的模型响应（${Math.floor(elapsedMs / 1000)} 秒）`
        }
        continue
      }

      if (outcome.value.done) break
      pendingNext = iterator.next()

      const message = outcome.value.value
      if (!message || typeof message !== 'object') continue
      const record = message as Record<string, unknown>

      const status = statusForSdkMessage(record)
      if (status) {
        yield { type: 'status', message: status, credentialSlot: candidate.slot }
      }

      const streamDelta = extractSafeStreamDelta(record)
      if (streamDelta) {
        fullText += streamDelta
        yield {
          type: 'text',
          delta: streamDelta,
          text: fullText,
          credentialSlot: candidate.slot
        }
      }

      const type = typeof record.type === 'string' ? record.type : ''
      if (type === 'assistant') {
        const assistantText = extractText(record)
        const appended = appendNonDuplicate(fullText, assistantText)
        if (appended.delta) {
          fullText = appended.text
          yield {
            type: 'text',
            delta: appended.delta,
            text: fullText,
            credentialSlot: candidate.slot
          }
        }
      }

      if (type === 'result') {
        if (record.subtype !== 'success') {
          throw resultError(record)
        }

        const resultText = extractText(record)
        if (!resultText && record.is_error === true) {
          throw resultError(record)
        }

        const appended = appendNonDuplicate(fullText, resultText)
        if (appended.delta) {
          fullText = appended.text
          yield {
            type: 'text',
            delta: appended.delta,
            text: fullText,
            credentialSlot: candidate.slot
          }
        }

        if (fullText) return fullText
      }
    }

    if (fullText) return fullText
    throw new Error('Claude Agent SDK ended without text output')
  } finally {
    abortController.abort()
    handle.close()
  }
}

async function* streamWithFailover(
  input: QueryInput
): AsyncGenerator<AgentSdkStreamEvent, void, void> {
  const candidates = credentialCandidates()
  if (!candidates.length) {
    throw new AgentSdkConfigurationError(
      'Claude Agent SDK credentials are not configured. Set ANTHROPIC_API_KEY_PRIMARY, ANTHROPIC_API_KEY_FALLBACK, or ANTHROPIC_API_KEY.'
    )
  }

  const failures: string[] = []

  for (const [index, candidate] of candidates.entries()) {
    yield {
      type: 'status',
      credentialSlot: candidate.slot,
      message: `正在使用 ${candidate.slot} Key 启动 Claude Agent SDK（单次最长 600 秒）`
    }

    try {
      const stream = streamWithCredential(candidate, input)
      let text = ''

      while (true) {
        const next = await stream.next()
        if (next.done) {
          text = next.value
          break
        }
        yield next.value
      }

      yield {
        type: 'result',
        text,
        usedLiveModel: true,
        usedAgentSdk: true,
        provider: 'claude-agent-sdk',
        credentialSlot: candidate.slot,
        warnings: failures.length
          ? [`Claude Agent SDK switched credentials after: ${failures.join(' | ')}`]
          : []
      }
      return
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(`${candidate.slot}: ${reason}`)
      const nextCandidate = candidates[index + 1]
      yield {
        type: 'status',
        credentialSlot: candidate.slot,
        message: nextCandidate
          ? `${candidate.slot} Key 失败：${reason}；正在切换 ${nextCandidate.slot} Key`
          : `${candidate.slot} Key 失败：${reason}`
      }
    }
  }

  throw new Error(`All Claude Agent SDK credentials failed: ${failures.join(' | ')}`)
}

export function streamAgentChat(input: ChatRequest): AsyncGenerator<AgentSdkStreamEvent, void, void> {
  return streamWithFailover({
    prompt: buildPrompt(input),
    systemPrompt: buildBusinessChatSystemPrompt(
      input.expertRole,
      input.businessContext,
      input.activeSkillDraft
    )
  })
}

export function streamSkillDraft(input: SkillDraftRequest): AsyncGenerator<AgentSdkStreamEvent, void, void> {
  return streamWithFailover({
    prompt: buildSkillDraftPrompt(input),
    systemPrompt: buildSkillCreatorSystemPrompt()
  })
}

async function collectResult(stream: AsyncIterable<AgentSdkStreamEvent>): Promise<AgentSdkResult> {
  let result: AgentSdkResult | undefined
  for await (const event of stream) {
    if (event.type === 'result') {
      const { type: _type, ...value } = event
      result = value
    }
  }

  if (!result) throw new Error('Claude Agent SDK stream ended without a result event')
  return result
}

export function runAgentChat(input: ChatRequest): Promise<AgentSdkResult> {
  return collectResult(streamAgentChat(input))
}

export function draftSkillWithAgent(input: SkillDraftRequest): Promise<AgentSdkResult> {
  return collectResult(streamSkillDraft(input))
}
