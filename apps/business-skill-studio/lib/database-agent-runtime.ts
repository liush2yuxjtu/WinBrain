import { query } from '@anthropic-ai/claude-agent-sdk'
import {
  createAgentSdkProfiler,
  type AgentSdkAttemptProfiler
} from './agent-sdk-profiler'
import type { AgentCredentialSlot, AgentSdkResult } from './agent-sdk'

type DatabasePromptRequest = {
  prompt: string
  systemPrompt: string
  fallbackText: string
}

type CredentialCandidate = {
  slot: AgentCredentialSlot
  key: string
}

type QueryHandle = AsyncIterable<unknown> & {
  close(): void
}

const MINIMUM_ATTEMPT_TIMEOUT_MS = 600_000
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
  return candidates.flatMap(([slot, rawKey]) => {
    const key = rawKey?.trim()
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ slot, key }]
  })
}

function attemptTimeoutMs(): number {
  const configured = Number(process.env.AGENT_SDK_ATTEMPT_TIMEOUT_MS || process.env.API_TIMEOUT_MS)
  if (!Number.isFinite(configured) || configured <= 0) return MINIMUM_ATTEMPT_TIMEOUT_MS
  return Math.max(configured, MINIMUM_ATTEMPT_TIMEOUT_MS)
}

function kimiThinkingTokens(): string {
  const configured = Number(process.env.KIMI_THINKING_TOKENS || process.env.MAX_THINKING_TOKENS)
  if (!Number.isFinite(configured) || configured <= 0) return String(KIMI_CODE_THINKING_TOKENS)
  return String(Math.min(Math.floor(configured), KIMI_CODE_THINKING_TOKENS))
}

function sdkEnvironment(key: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const envKey of [...MODEL_OVERRIDE_ENV_KEYS, ...CREDENTIAL_ENV_KEYS]) delete env[envKey]
  delete env.CLAUDE_CODE_DISABLE_THINKING
  delete env.KIMI_BASE_URL
  delete env.KIMI_THINKING_TOKENS

  return {
    ...env,
    ANTHROPIC_BASE_URL: process.env.KIMI_BASE_URL?.trim() || KIMI_CODE_BASE_URL,
    ANTHROPIC_API_KEY: key,
    ANTHROPIC_AUTH_TOKEN: key,
    MAX_THINKING_TOKENS: kimiThinkingTokens(),
    CLAUDE_CODE_AUTO_COMPACT_WINDOW:
      process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW?.trim() || KIMI_CODE_CONTEXT_WINDOW,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:
      process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || '1'
  }
}

function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>
  if (typeof record.result === 'string') return record.result.trim()
  if (typeof record.text === 'string') return record.text.trim()

  const candidates = [record.message, record]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const content = (candidate as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    const text = content.map((part) => {
      if (!part || typeof part !== 'object') return ''
      const value = part as Record<string, unknown>
      return value.type === 'text' && typeof value.text === 'string' ? value.text : ''
    }).filter(Boolean).join('').trim()
    if (text) return text
  }
  return ''
}

async function runWithCredential(
  candidate: CredentialCandidate,
  input: DatabasePromptRequest,
  profile: AgentSdkAttemptProfiler
): Promise<string> {
  const abortController = new AbortController()
  let handle: QueryHandle | undefined
  let fullText = ''
  let outcome: 'success' | 'error' | 'cancelled' = 'cancelled'
  let failure: unknown

  try {
    handle = query({
      prompt: input.prompt,
      options: {
        abortController,
        env: sdkEnvironment(candidate.key),
        systemPrompt: input.systemPrompt,
        maxTurns: 1,
        tools: [],
        permissionMode: 'dontAsk',
        persistSession: false
      }
    }) as QueryHandle

    const iterator = handle[Symbol.asyncIterator]()
    profile.markQueryReady()
    const deadlineAt = Date.now() + attemptTimeoutMs()

    while (true) {
      const remainingMs = deadlineAt - Date.now()
      if (remainingMs <= 0) throw new Error(`Claude Agent SDK attempt timed out after ${attemptTimeoutMs()}ms`)
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined
      let next: IteratorResult<unknown>

      try {
        next = await Promise.race([
          iterator.next(),
          new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(
              () => reject(new Error(`Claude Agent SDK attempt timed out after ${attemptTimeoutMs()}ms`)),
              remainingMs
            )
          })
        ])
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer)
      }
      if (next.done) break
      const message = next.value
      if (!message || typeof message !== 'object') continue
      const record = message as Record<string, unknown>
      profile.observeMessage(record)
      const type = typeof record.type === 'string' ? record.type : ''
      const text = extractText(record)
      if (text) {
        fullText = text
        profile.markTextAvailable()
      }
      if (type === 'result') {
        if (record.subtype !== 'success' || record.is_error === true) {
          const errors = Array.isArray(record.errors)
            ? record.errors.filter((item): item is string => typeof item === 'string')
            : []
          throw new Error(errors.join('; ') || `Claude Agent SDK returned ${String(record.subtype || 'error')}`)
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
    try {
      handle?.close()
    } catch (error) {
      outcome = 'error'
      failure = error
      throw error
    } finally {
      profile.finish({ outcome, outputChars: fullText.length, error: failure })
    }
  }
}

export async function runDatabasePrompt(input: DatabasePromptRequest): Promise<AgentSdkResult> {
  const candidates = credentialCandidates()
  const profile = createAgentSdkProfiler({
    operation: 'database-prompt',
    promptChars: input.prompt.length,
    systemPromptChars: input.systemPrompt.length
  })

  if (!candidates.length) {
    profile.finish({
      outcome: 'fallback',
      fallbackReason: 'credentials_unconfigured',
      outputChars: input.fallbackText.length,
      candidateCount: 0
    })
    return {
      text: input.fallbackText,
      usedLiveModel: false,
      usedAgentSdk: false,
      provider: 'deterministic-fallback',
      warnings: ['No Kimi Code credential is configured.']
    }
  }

  const failures: string[] = []
  for (const candidate of candidates) {
    try {
      const text = await runWithCredential(candidate, input, profile.startAttempt(candidate.slot))
      profile.finish({
        outcome: 'success',
        credentialSlot: candidate.slot,
        outputChars: text.length,
        candidateCount: candidates.length
      })
      return {
        text,
        usedLiveModel: true,
        usedAgentSdk: true,
        provider: 'claude-agent-sdk',
        credentialSlot: candidate.slot,
        warnings: failures.length ? [`Kimi Code switched credentials after: ${failures.join(' | ')}`] : []
      }
    } catch (error) {
      failures.push(`${candidate.slot}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  profile.finish({
    outcome: 'fallback',
    fallbackReason: 'all_attempts_failed',
    outputChars: input.fallbackText.length,
    candidateCount: candidates.length
  })
  return {
    text: input.fallbackText,
    usedLiveModel: false,
    usedAgentSdk: false,
    provider: 'claude-agent-sdk',
    warnings: [`All Kimi Code credentials failed: ${failures.join(' | ')}`]
  }
}
