import path from 'node:path'
import {
  createAgentSdkProfiler,
  type AgentSdkAttemptProfiler,
  type AgentSdkProfileOperation
} from './agent-sdk-profiler'
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

type AgentSdkQuery = (input: {
  prompt: string
  options: {
    abortController: AbortController
    env: NodeJS.ProcessEnv
    systemPrompt: string
    cwd: string
    pathToClaudeCodeExecutable: string
    settingSources: Array<'project'>
    maxTurns: number
    tools: unknown[]
    permissionMode: 'dontAsk'
    persistSession: boolean
    includePartialMessages: boolean
  }
}) => unknown

let queryOverride: AgentSdkQuery | undefined
let queryPromise: Promise<AgentSdkQuery> | undefined

export function setAgentSdkQueryForTesting(query: AgentSdkQuery | undefined): void {
  queryOverride = query
}

async function resolveAgentSdkQuery(): Promise<AgentSdkQuery> {
  if (queryOverride) return queryOverride

  if (!queryPromise) {
    queryPromise = import('@anthropic-ai/claude-agent-sdk')
      .then((sdk) => {
        const record = sdk as unknown as {
          query?: unknown
          default?: { query?: unknown }
        }
        const query = record.query ?? record.default?.query
        if (typeof query !== 'function') {
          throw new Error('Claude Agent SDK does not expose a query function')
        }
        return query as AgentSdkQuery
      })
      .catch((error) => {
        queryPromise = undefined
        throw error
      })
  }

  return queryPromise
}

const MINIMUM_ATTEMPT_TIMEOUT_MS = 600_000
const HEARTBEAT_INTERVAL_MS = 15_000
const KIMI_CODE_BASE_URL = 'https://api.kimi.com/coding/'
const KIMI_CODE_CONTEXT_WINDOW = '262144'
const KIMI_CODE_THINKING_TOKENS = 32_768

const MODEL_OVERRIDE_ENV_KEYS = [
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'ANTHROPIC_CUSTOM_MODEL_OPTION',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME'
] as const

const CREDENTIAL_ENV_KEYS = [
  'KIMI_API_KEY_PRIMARY',
  'KIMI_API_KEY_FALLBACK',
  'KIMI_API_KEY',
  'ANTHROPIC_API_KEY_PRIMARY',
  'ANTHROPIC_AUTH_TOKEN_PRIMARY',
  'ANTHROPIC_API_KEY_FALLBACK',
  'ANTHROPIC_AUTH_TOKEN_FALLBACK',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN'
] as const

function attemptTimeoutMs(): number {
  const configured = Number(process.env.AGENT_SDK_ATTEMPT_TIMEOUT_MS || process.env.API_TIMEOUT_MS)
  if (!Number.isFinite(configured) || configured <= 0) return MINIMUM_ATTEMPT_TIMEOUT_MS
  return Math.max(configured, MINIMUM_ATTEMPT_TIMEOUT_MS)
}

function firstConfigured(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value?.trim())
}

function credentialCandidates(): CredentialCandidate[] {
  const candidates: Array<[AgentCredentialSlot, string | undefined]> = [
    ['primary', firstConfigured(
      process.env.KIMI_API_KEY_PRIMARY,
      process.env.ANTHROPIC_API_KEY_PRIMARY,
      process.env.ANTHROPIC_AUTH_TOKEN_PRIMARY
    )],
    ['fallback', firstConfigured(
      process.env.KIMI_API_KEY_FALLBACK,
      process.env.ANTHROPIC_API_KEY_FALLBACK,
      process.env.ANTHROPIC_AUTH_TOKEN_FALLBACK
    )],
    ['legacy', firstConfigured(
      process.env.KIMI_API_KEY,
      process.env.ANTHROPIC_API_KEY,
      process.env.ANTHROPIC_AUTH_TOKEN
    )]
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

function kimiBaseUrl(): string {
  return process.env.KIMI_BASE_URL?.trim() || KIMI_CODE_BASE_URL
}

function kimiThinkingTokens(): string {
  const configured = Number(process.env.KIMI_THINKING_TOKENS || process.env.MAX_THINKING_TOKENS)
  if (!Number.isFinite(configured) || configured <= 0) return String(KIMI_CODE_THINKING_TOKENS)
  return String(Math.min(Math.floor(configured), KIMI_CODE_THINKING_TOKENS))
}

function sdkEnvironment(key: string): NodeJS.ProcessEnv {
  const env = { ...process.env }

  for (const envKey of [...MODEL_OVERRIDE_ENV_KEYS, ...CREDENTIAL_ENV_KEYS]) {
    delete env[envKey]
  }

  delete env.CLAUDE_CODE_DISABLE_THINKING
  delete env.KIMI_BASE_URL
  delete env.KIMI_THINKING_TOKENS

  return {
    ...env,
    ANTHROPIC_BASE_URL: kimiBaseUrl(),
    ANTHROPIC_API_KEY: key,
    ANTHROPIC_AUTH_TOKEN: key,
    MAX_THINKING_TOKENS: kimiThinkingTokens(),
    CLAUDE_CODE_AUTO_COMPACT_WINDOW:
      process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW?.trim() || KIMI_CODE_CONTEXT_WINDOW,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:
      process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || '1'
  }
}

function businessSkillStudioRoot(): string {
  return process.cwd().endsWith(path.join('apps', 'business-skill-studio'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'apps/business-skill-studio')
}

function claudeCodeExecutable(): string {
  const configured = process.env.CLAUDE_CODE_EXECUTABLE?.trim()
  if (configured) return configured
  return path.join(
    businessSkillStudioRoot(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'claude.cmd' : 'claude'
  )
}

function statusForSdkMessage(record: Record<string, unknown>): string | null {
  const type = typeof record.type === 'string' ? record.type : ''
  const subtype = typeof record.subtype === 'string' ? record.subtype : ''

  if (type === 'system' && subtype === 'init') return 'Kimi Code 已通过 Claude Agent SDK 初始化，等待模型输出'
  if (type === 'assistant') return '已收到 Kimi Code 文本，正在整理最终响应'
  if (type === 'result') return '已收到 Kimi Code 最终结果'
  return null
}

async function* streamWithCredential(
  candidate: CredentialCandidate,
  input: QueryInput,
  profile: AgentSdkAttemptProfiler
): AsyncGenerator<AgentSdkStreamEvent, string, void> {
  const abortController = new AbortController()
  let handle: StreamingQueryHandle | undefined
  let fullText = ''
  let outcome: 'success' | 'error' | 'cancelled' = 'cancelled'
  let failure: unknown

  try {
    const sdkQuery = await resolveAgentSdkQuery()
    handle = sdkQuery({
      prompt: input.prompt,
      options: {
        abortController,
        env: sdkEnvironment(candidate.key),
        systemPrompt: input.systemPrompt,
        cwd: businessSkillStudioRoot(),
        pathToClaudeCodeExecutable: claudeCodeExecutable(),
        settingSources: ['project'],
        maxTurns: 1,
        tools: [],
        permissionMode: 'dontAsk',
        persistSession: false,
        includePartialMessages: true
      }
    }) as StreamingQueryHandle

    const iterator = handle[Symbol.asyncIterator]()
    profile.markQueryReady()
    const startedAt = Date.now()
    const deadlineAt = startedAt + attemptTimeoutMs()
    let pendingNext = iterator.next()

    while (true) {
      const remainingMs = deadlineAt - Date.now()
      if (remainingMs <= 0) {
        throw new Error(`Claude Agent SDK attempt timed out after ${attemptTimeoutMs()}ms`)
      }

      let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
      let raceOutcome: {
        kind: 'message'
        value: IteratorResult<unknown>
      } | { kind: 'heartbeat' }

      try {
        raceOutcome = await Promise.race([
          pendingNext.then((value) => ({ kind: 'message' as const, value })),
          new Promise<{ kind: 'heartbeat' }>((resolve) => {
            heartbeatTimer = setTimeout(
              () => resolve({ kind: 'heartbeat' }),
              Math.min(HEARTBEAT_INTERVAL_MS, remainingMs)
            )
          })
        ])
      } finally {
        if (heartbeatTimer) clearTimeout(heartbeatTimer)
      }

      if (raceOutcome.kind === 'heartbeat') {
        const elapsedMs = Date.now() - startedAt
        profile.recordHeartbeat()
        yield {
          type: 'status',
          credentialSlot: candidate.slot,
          elapsedMs,
          message: `正在等待 ${candidate.slot} Kimi Key 的模型响应（${Math.floor(elapsedMs / 1000)} 秒）`
        }
        continue
      }

      if (raceOutcome.value.done) break
      pendingNext = iterator.next()

      const message = raceOutcome.value.value
      if (!message || typeof message !== 'object') continue
      const record = message as Record<string, unknown>
      profile.observeMessage(record)
      const type = typeof record.type === 'string' ? record.type : ''
      const streamDelta = extractSafeStreamDelta(record)
      const messageText = type === 'assistant' || type === 'result' ? extractText(record) : ''
      if (streamDelta || messageText) profile.markTextAvailable()

      const status = statusForSdkMessage(record)
      if (status) {
        yield { type: 'status', message: status, credentialSlot: candidate.slot }
      }

      if (streamDelta) {
        fullText += streamDelta
        profile.recordTextDelta(streamDelta.length)
        yield {
          type: 'text',
          delta: streamDelta,
          text: fullText,
          credentialSlot: candidate.slot
        }
      }

      if (type === 'assistant') {
        const appended = appendNonDuplicate(fullText, messageText)
        if (appended.delta) {
          fullText = appended.text
          profile.recordTextDelta(appended.delta.length)
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

        const resultText = messageText
        if (!resultText && record.is_error === true) {
          throw resultError(record)
        }

        const appended = appendNonDuplicate(fullText, resultText)
        if (appended.delta) {
          fullText = appended.text
          profile.recordTextDelta(appended.delta.length)
          yield {
            type: 'text',
            delta: appended.delta,
            text: fullText,
            credentialSlot: candidate.slot
          }
        }

        if (fullText) {
          outcome = 'success'
          return fullText
        }
      }
    }

    if (fullText) {
      outcome = 'success'
      return fullText
    }
    throw new Error('Claude Agent SDK ended without text output')
  } catch (error) {
    outcome = 'error'
    failure = error
    throw error
  } finally {
    profile.beginCleanup()
    abortController.abort()
    let cleanupFailure: unknown
    try {
      handle?.close()
    } catch (error) {
      cleanupFailure = error
    } finally {
      profile.finish({
        outcome,
        outputChars: fullText.length,
        error: failure,
        cleanupError: cleanupFailure
      })
    }
  }
}

async function* streamWithFailover(
  input: QueryInput,
  fallbackText: string,
  operation: AgentSdkProfileOperation
): AsyncGenerator<AgentSdkStreamEvent, void, void> {
  const candidates = credentialCandidates()
  const profile = createAgentSdkProfiler({
    operation,
    promptChars: input.prompt.length,
    systemPromptChars: input.systemPrompt.length
  })
  let completed = false
  let latestOutputChars = 0

  try {
    if (!candidates.length) {
      completed = true
      latestOutputChars = fallbackText.length
      profile.finish({
        outcome: 'fallback',
        fallbackReason: 'credentials_unconfigured',
        outputChars: latestOutputChars,
        candidateCount: 0
      })
      yield {
        type: 'result',
        text: fallbackText,
        usedLiveModel: false,
        usedAgentSdk: false,
        provider: 'deterministic-fallback',
        warnings: ['No Kimi Code credential is configured.']
      }
      return
    }

    const failures: string[] = []

    for (const candidate of candidates) {
      yield {
        type: 'status',
        credentialSlot: candidate.slot,
        message: `正在使用 ${candidate.slot} Kimi Key 启动 K2.7 Code（单次最长 600 秒）`
      }

      try {
        const stream = streamWithCredential(candidate, input, profile.startAttempt(candidate.slot))
        let streamCompleted = false
        let text = ''

        try {
          while (true) {
            const next = await stream.next()
            if (next.done) {
              text = next.value
              streamCompleted = true
              break
            }
            if (next.value.type === 'text') latestOutputChars = next.value.text.length
            yield next.value
          }
        } finally {
          if (!streamCompleted) await stream.return('')
        }

        latestOutputChars = text.length
        completed = true
        profile.finish({
          outcome: 'success',
          credentialSlot: candidate.slot,
          outputChars: latestOutputChars,
          candidateCount: candidates.length
        })
        yield {
          type: 'result',
          text,
          usedLiveModel: true,
          usedAgentSdk: true,
          provider: 'claude-agent-sdk',
          credentialSlot: candidate.slot,
          warnings: failures.length
            ? [`Kimi Code switched credentials after: ${failures.join(' | ')}`]
            : []
        }
        return
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        failures.push(`${candidate.slot}: ${reason}`)
        yield {
          type: 'status',
          credentialSlot: candidate.slot,
          message: candidate.slot === 'primary'
            ? `primary Kimi Key 失败：${reason}；正在切换 fallback Key`
            : `${candidate.slot} Kimi Key 失败：${reason}`
        }
      }
    }

    completed = true
    latestOutputChars = fallbackText.length
    profile.finish({
      outcome: 'fallback',
      fallbackReason: 'all_attempts_failed',
      outputChars: latestOutputChars,
      candidateCount: candidates.length
    })
    yield {
      type: 'result',
      text: fallbackText,
      usedLiveModel: false,
      usedAgentSdk: false,
      provider: 'claude-agent-sdk',
      warnings: [`All Kimi Code credentials failed: ${failures.join(' | ')}`]
    }
  } finally {
    if (!completed) {
      profile.finish({
        outcome: 'cancelled',
        outputChars: latestOutputChars,
        candidateCount: candidates.length
      })
    }
  }
}

function localChatFallback(input: ChatRequest): string {
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === 'user')
  return [
    'Kimi Code 调用失败。',
    latestUserMessage?.content ? `已保留本轮输入：${latestUserMessage.content}` : '',
    '请检查主备 Kimi Key 的有效性、会员权益、额度和 Agent SDK 服务端日志。'
  ].filter(Boolean).join('\n\n')
}

export function streamAgentChat(input: ChatRequest): AsyncGenerator<AgentSdkStreamEvent, void, void> {
  return streamWithFailover({
    prompt: buildPrompt(input),
    systemPrompt: buildBusinessChatSystemPrompt(
      input.expertRole,
      input.businessContext,
      input.activeSkillDraft
    )
  }, localChatFallback(input), 'chat')
}

export function streamSkillDraft(input: SkillDraftRequest): AsyncGenerator<AgentSdkStreamEvent, void, void> {
  return streamWithFailover({
    prompt: buildSkillDraftPrompt(input),
    systemPrompt: buildSkillCreatorSystemPrompt()
  }, fallbackSkillDraft(input), 'skill-draft')
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
