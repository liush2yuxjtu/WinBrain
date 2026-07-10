import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

export type AgentSdkProfileMode = 'off' | 'summary' | 'verbose'
export type AgentSdkProfileOperation = 'chat' | 'skill-draft' | 'database-prompt'
export type AgentSdkProfileOutcome = 'success' | 'fallback' | 'error' | 'cancelled'
export type AgentSdkAttemptOutcome = 'success' | 'error' | 'cancelled'

export type AgentSdkProfileLogEntry = {
  schemaVersion: 1
  component: 'claude-agent-sdk'
  event: 'trace.start' | 'attempt.start' | 'attempt.milestone' | 'attempt.summary' | 'trace.summary'
  timestamp: string
  traceId: string
  operation: AgentSdkProfileOperation
  [key: string]: unknown
}

export type AgentSdkProfileSink = (entry: AgentSdkProfileLogEntry) => void

export type AgentSdkProfileDependencies = {
  mode?: AgentSdkProfileMode
  now?: () => number
  timestamp?: () => string
  createTraceId?: () => string
  sink?: AgentSdkProfileSink
}

export type AgentSdkProfileContext = {
  operation: AgentSdkProfileOperation
  promptChars: number
  systemPromptChars: number
}

export type AgentSdkAttemptSummary = {
  attempt: number
  credentialSlot: string
  outcome: AgentSdkAttemptOutcome
  durationMs: number
  querySetupMs?: number
  timeToFirstMessageMs?: number
  timeToInitMs?: number
  timeToFirstTextMs?: number
  timeToFirstAssistantMs?: number
  timeToResultMs?: number
  cleanupMs: number
  messageCount: number
  messageTypes: Record<string, number>
  textDeltaCount: number
  emittedTextChars: number
  outputChars: number
  heartbeatCount: number
  sdkDurationMs?: number
  sdkApiDurationMs?: number
  sdkNumTurns?: number
  errorName?: string
  errorKind?: 'timeout' | 'aborted' | 'sdk' | 'unknown'
  cleanupErrorName?: string
  cleanupErrorKind?: 'timeout' | 'aborted' | 'sdk' | 'unknown'
}

export type AgentSdkAttemptFinish = {
  outcome: AgentSdkAttemptOutcome
  outputChars: number
  error?: unknown
  cleanupError?: unknown
}

export type AgentSdkTraceFinish = {
  outcome: AgentSdkProfileOutcome
  credentialSlot?: string
  outputChars: number
  candidateCount: number
  fallbackReason?: 'credentials_unconfigured' | 'all_attempts_failed'
}

const LOG_PREFIX = '[claude-agent-sdk-profile]'

function defaultSink(entry: AgentSdkProfileLogEntry): void {
  console.info(`${LOG_PREFIX} ${JSON.stringify(entry)}`)
}

function normalizeMode(value: string | undefined): AgentSdkProfileMode | undefined {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return undefined
  if (['0', 'false', 'off', 'disabled', 'none'].includes(normalized)) return 'off'
  if (['verbose', 'debug', 'milestones'].includes(normalized)) return 'verbose'
  if (['1', 'true', 'on', 'enabled', 'summary'].includes(normalized)) return 'summary'
  return undefined
}

export function resolveAgentSdkProfileMode(
  env: { AGENT_SDK_PROFILE_LOGGING?: string; NODE_ENV?: string } = process.env
): AgentSdkProfileMode {
  const configured = normalizeMode(env.AGENT_SDK_PROFILE_LOGGING)
  if (configured) return configured
  return env.NODE_ENV === 'development' ? 'summary' : 'off'
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function finiteInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function roundedMs(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100
}

function errorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name
  return typeof error === 'string' ? 'Error' : 'UnknownError'
}

function errorKind(error: unknown): 'timeout' | 'aborted' | 'sdk' | 'unknown' {
  if (error instanceof Error) {
    const value = `${error.name} ${error.message}`.toLowerCase()
    if (value.includes('timeout') || value.includes('timed out')) return 'timeout'
    if (value.includes('abort') || value.includes('cancel')) return 'aborted'
    return 'sdk'
  }
  return typeof error === 'string' ? 'sdk' : 'unknown'
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] || 0) + 1
}

export class AgentSdkAttemptProfiler {
  private readonly enabled: boolean
  private readonly startedAt: number
  private readonly messageTypes: Record<string, number> = {}
  private finished = false
  private messageCount = 0
  private textDeltaCount = 0
  private emittedTextChars = 0
  private heartbeatCount = 0
  private querySetupMs?: number
  private timeToFirstMessageMs?: number
  private timeToInitMs?: number
  private timeToFirstTextMs?: number
  private timeToFirstAssistantMs?: number
  private timeToResultMs?: number
  private sdkDurationMs?: number
  private sdkApiDurationMs?: number
  private sdkNumTurns?: number
  private cleanupStartedAt?: number

  constructor(
    private readonly trace: AgentSdkProfiler,
    readonly attempt: number,
    readonly credentialSlot: string,
    private readonly now: () => number
  ) {
    this.enabled = trace.isEnabled()
    this.startedAt = this.enabled ? now() : 0
    if (!this.enabled) return
    this.trace.logVerbose('attempt.start', {
      attempt,
      credentialSlot,
      elapsedMs: this.trace.elapsedMs()
    })
  }

  markQueryReady(): void {
    if (!this.enabled) return
    this.markOnce('query.ready', 'querySetupMs')
  }

  observeMessage(message: Record<string, unknown>): void {
    if (!this.enabled) return
    const elapsedMs = this.elapsedMs()
    const type = typeof message.type === 'string' && message.type ? message.type : 'unknown'
    const subtype = typeof message.subtype === 'string' && message.subtype ? message.subtype : undefined
    const sdkEvent = message.event && typeof message.event === 'object'
      ? message.event as Record<string, unknown>
      : undefined
    const sdkEventType = typeof sdkEvent?.type === 'string' && sdkEvent.type ? sdkEvent.type : undefined

    this.messageCount += 1
    const messageTypeKey = subtype
      ? `${type}:${subtype}`
      : sdkEventType
        ? `${type}:${sdkEventType}`
        : type
    incrementCount(this.messageTypes, messageTypeKey)

    if (this.timeToFirstMessageMs === undefined) {
      this.timeToFirstMessageMs = elapsedMs
      this.logMilestone('first.message', elapsedMs, {
        messageType: type,
        messageSubtype: subtype,
        sdkEventType
      })
    }

    if (type === 'system' && subtype === 'init' && this.timeToInitMs === undefined) {
      this.timeToInitMs = elapsedMs
      this.logMilestone('sdk.init', elapsedMs)
    }

    if (type === 'assistant' && this.timeToFirstAssistantMs === undefined) {
      this.timeToFirstAssistantMs = elapsedMs
      this.logMilestone('first.assistant', elapsedMs)
    }

    if (type === 'result') {
      if (this.timeToResultMs === undefined) {
        this.timeToResultMs = elapsedMs
        this.logMilestone('result', elapsedMs, { resultSubtype: subtype })
      }
      this.sdkDurationMs = finiteNonNegative(message.duration_ms) ?? this.sdkDurationMs
      this.sdkApiDurationMs = finiteNonNegative(message.duration_api_ms) ?? this.sdkApiDurationMs
      this.sdkNumTurns = finiteInteger(message.num_turns) ?? this.sdkNumTurns
    }
  }

  markTextAvailable(): void {
    if (!this.enabled) return
    if (this.timeToFirstTextMs !== undefined) return
    const elapsedMs = this.elapsedMs()
    this.timeToFirstTextMs = elapsedMs
    this.logMilestone('first.text', elapsedMs)
  }

  recordTextDelta(charCount: number): void {
    if (!this.enabled) return
    if (!Number.isFinite(charCount) || charCount <= 0) return
    this.markTextAvailable()
    this.textDeltaCount += 1
    this.emittedTextChars += Math.floor(charCount)
  }

  recordHeartbeat(): void {
    if (!this.enabled) return
    this.heartbeatCount += 1
  }

  beginCleanup(): void {
    if (!this.enabled) return
    if (this.cleanupStartedAt === undefined) this.cleanupStartedAt = this.now()
  }

  finish(input: AgentSdkAttemptFinish): void {
    if (this.finished) return
    this.finished = true
    if (!this.enabled) return

    const finishedAt = this.now()
    const summary: AgentSdkAttemptSummary = {
      attempt: this.attempt,
      credentialSlot: this.credentialSlot,
      outcome: input.outcome,
      durationMs: roundedMs(finishedAt - this.startedAt),
      querySetupMs: this.querySetupMs,
      timeToFirstMessageMs: this.timeToFirstMessageMs,
      timeToInitMs: this.timeToInitMs,
      timeToFirstTextMs: this.timeToFirstTextMs,
      timeToFirstAssistantMs: this.timeToFirstAssistantMs,
      timeToResultMs: this.timeToResultMs,
      cleanupMs: this.cleanupStartedAt === undefined
        ? 0
        : roundedMs(finishedAt - this.cleanupStartedAt),
      messageCount: this.messageCount,
      messageTypes: { ...this.messageTypes },
      textDeltaCount: this.textDeltaCount,
      emittedTextChars: this.emittedTextChars,
      outputChars: Math.max(0, Math.floor(input.outputChars)),
      heartbeatCount: this.heartbeatCount,
      sdkDurationMs: this.sdkDurationMs,
      sdkApiDurationMs: this.sdkApiDurationMs,
      sdkNumTurns: this.sdkNumTurns,
      errorName: input.error === undefined ? undefined : errorName(input.error),
      errorKind: input.error === undefined ? undefined : errorKind(input.error),
      cleanupErrorName: input.cleanupError === undefined ? undefined : errorName(input.cleanupError),
      cleanupErrorKind: input.cleanupError === undefined ? undefined : errorKind(input.cleanupError)
    }

    this.trace.recordAttempt(summary)
    this.trace.log('attempt.summary', summary)
  }

  private elapsedMs(): number {
    return roundedMs(this.now() - this.startedAt)
  }

  private markOnce(milestone: string, field: 'querySetupMs'): void {
    if (this[field] !== undefined) return
    const elapsedMs = this.elapsedMs()
    this[field] = elapsedMs
    this.logMilestone(milestone, elapsedMs)
  }

  private logMilestone(milestone: string, elapsedMs: number, fields: Record<string, unknown> = {}): void {
    this.trace.logVerbose('attempt.milestone', {
      attempt: this.attempt,
      credentialSlot: this.credentialSlot,
      milestone,
      elapsedMs,
      ...fields
    })
  }
}

export class AgentSdkProfiler {
  readonly traceId: string
  private readonly startedAt: number
  private readonly attempts: AgentSdkAttemptSummary[] = []
  private readonly enabled: boolean
  private readonly mode: AgentSdkProfileMode
  private readonly now: () => number
  private readonly timestamp: () => string
  private readonly sink: AgentSdkProfileSink
  private attemptsStarted = 0
  private finished = false

  constructor(
    private readonly context: AgentSdkProfileContext,
    dependencies: AgentSdkProfileDependencies = {}
  ) {
    this.mode = dependencies.mode ?? resolveAgentSdkProfileMode()
    this.enabled = this.mode !== 'off'
    this.now = dependencies.now ?? (() => performance.now())
    this.timestamp = dependencies.timestamp ?? (() => new Date().toISOString())
    this.sink = dependencies.sink ?? defaultSink
    this.traceId = this.enabled ? (dependencies.createTraceId ?? randomUUID)() : 'disabled'
    this.startedAt = this.enabled ? this.now() : 0

    this.logVerbose('trace.start', {
      promptChars: context.promptChars,
      systemPromptChars: context.systemPromptChars
    })
  }

  startAttempt(credentialSlot: string): AgentSdkAttemptProfiler {
    this.attemptsStarted += 1
    return new AgentSdkAttemptProfiler(this, this.attemptsStarted, credentialSlot, this.now)
  }

  finish(input: AgentSdkTraceFinish): void {
    if (this.finished) return
    this.finished = true
    if (!this.enabled) return

    const attemptDurationMs = roundedMs(this.attempts.reduce((total, attempt) => total + attempt.durationMs, 0))
    const durationMs = this.elapsedMs()

    this.log('trace.summary', {
      outcome: input.outcome,
      credentialSlot: input.credentialSlot,
      fallbackReason: input.fallbackReason,
      durationMs,
      attemptDurationMs,
      overheadMs: roundedMs(durationMs - attemptDurationMs),
      failoverCount: Math.max(0, this.attempts.length - 1),
      candidateCount: input.candidateCount,
      attemptCount: this.attempts.length,
      promptChars: this.context.promptChars,
      systemPromptChars: this.context.systemPromptChars,
      outputChars: Math.max(0, Math.floor(input.outputChars)),
      attempts: this.attempts
    })
  }

  elapsedMs(): number {
    return this.enabled ? roundedMs(this.now() - this.startedAt) : 0
  }

  isEnabled(): boolean {
    return this.enabled
  }

  recordAttempt(summary: AgentSdkAttemptSummary): void {
    if (!this.enabled) return
    this.attempts.push(summary)
  }

  log(event: AgentSdkProfileLogEntry['event'], fields: Record<string, unknown>): void {
    if (this.mode === 'off') return
    this.sink({
      schemaVersion: 1,
      component: 'claude-agent-sdk',
      event,
      timestamp: this.timestamp(),
      traceId: this.traceId,
      operation: this.context.operation,
      ...fields
    })
  }

  logVerbose(event: AgentSdkProfileLogEntry['event'], fields: Record<string, unknown>): void {
    if (this.mode !== 'verbose') return
    this.log(event, fields)
  }
}

export function createAgentSdkProfiler(
  context: AgentSdkProfileContext,
  dependencies: AgentSdkProfileDependencies = {}
): AgentSdkProfiler {
  return new AgentSdkProfiler(context, dependencies)
}
