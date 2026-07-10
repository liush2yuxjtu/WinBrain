import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAgentSdkProfiler,
  resolveAgentSdkProfileMode,
  type AgentSdkProfileLogEntry
} from '../lib/agent-sdk-profiler'

function findEntry(entries: AgentSdkProfileLogEntry[], event: AgentSdkProfileLogEntry['event']): AgentSdkProfileLogEntry {
  const entry = entries.find((candidate) => candidate.event === event)
  assert.ok(entry, `expected ${event} log entry`)
  return entry!
}

test('resolves explicit profile modes and keeps production opt-in', () => {
  assert.equal(resolveAgentSdkProfileMode({ NODE_ENV: 'development' }), 'summary')
  assert.equal(resolveAgentSdkProfileMode({ NODE_ENV: 'production' }), 'off')
  assert.equal(resolveAgentSdkProfileMode({ NODE_ENV: 'test' }), 'off')
  assert.equal(resolveAgentSdkProfileMode({ AGENT_SDK_PROFILE_LOGGING: 'verbose' }), 'verbose')
  assert.equal(resolveAgentSdkProfileMode({ AGENT_SDK_PROFILE_LOGGING: 'true' }), 'summary')
  assert.equal(resolveAgentSdkProfileMode({ AGENT_SDK_PROFILE_LOGGING: 'off', NODE_ENV: 'development' }), 'off')
})

test('emits correlated milestone, attempt, and trace timing summaries', () => {
  let now = 0
  const entries: AgentSdkProfileLogEntry[] = []
  const profiler = createAgentSdkProfiler({
    operation: 'chat',
    promptChars: 120,
    systemPromptChars: 80
  }, {
    mode: 'verbose',
    now: () => now,
    timestamp: () => '2026-07-10T00:00:00.000Z',
    createTraceId: () => 'trace-1',
    sink: (entry) => entries.push(entry)
  })

  now = 5
  const attempt = profiler.startAttempt('primary')
  now = 8
  attempt.markQueryReady()
  now = 20
  attempt.observeMessage({ type: 'system', subtype: 'init' })
  now = 45
  attempt.observeMessage({ type: 'stream_event' })
  now = 50
  attempt.recordTextDelta(7)
  now = 70
  attempt.observeMessage({ type: 'assistant' })
  attempt.recordTextDelta(5)
  attempt.recordHeartbeat()
  now = 100
  attempt.observeMessage({
    type: 'result',
    subtype: 'success',
    duration_ms: 91,
    duration_api_ms: 76,
    num_turns: 1
  })
  attempt.beginCleanup()
  now = 106
  attempt.finish({ outcome: 'success', outputChars: 12 })
  now = 110
  profiler.finish({
    outcome: 'success',
    credentialSlot: 'primary',
    outputChars: 12,
    candidateCount: 2
  })

  assert.equal(entries[0]?.event, 'trace.start')
  assert.ok(entries.every((entry) => entry.schemaVersion === 1))
  assert.ok(entries.every((entry) => entry.traceId === 'trace-1'))
  assert.ok(entries.every((entry) => entry.operation === 'chat'))

  const attemptSummary = findEntry(entries, 'attempt.summary')
  assert.equal(attemptSummary.attempt, 1)
  assert.equal(attemptSummary.credentialSlot, 'primary')
  assert.equal(attemptSummary.durationMs, 101)
  assert.equal(attemptSummary.querySetupMs, 3)
  assert.equal(attemptSummary.timeToFirstMessageMs, 15)
  assert.equal(attemptSummary.timeToInitMs, 15)
  assert.equal(attemptSummary.timeToFirstTextMs, 45)
  assert.equal(attemptSummary.timeToFirstAssistantMs, 65)
  assert.equal(attemptSummary.timeToResultMs, 95)
  assert.equal(attemptSummary.cleanupMs, 6)
  assert.equal(attemptSummary.messageCount, 4)
  assert.deepEqual(attemptSummary.messageTypes, {
    'system:init': 1,
    stream_event: 1,
    assistant: 1,
    'result:success': 1
  })
  assert.equal(attemptSummary.textDeltaCount, 2)
  assert.equal(attemptSummary.emittedTextChars, 12)
  assert.equal(attemptSummary.heartbeatCount, 1)
  assert.equal(attemptSummary.sdkDurationMs, 91)
  assert.equal(attemptSummary.sdkApiDurationMs, 76)
  assert.equal(attemptSummary.sdkNumTurns, 1)

  const traceSummary = findEntry(entries, 'trace.summary')
  assert.equal(traceSummary.outcome, 'success')
  assert.equal(traceSummary.durationMs, 110)
  assert.equal(traceSummary.candidateCount, 2)
  assert.equal(traceSummary.attemptCount, 1)
  assert.equal(traceSummary.attemptDurationMs, 101)
  assert.equal(traceSummary.overheadMs, 9)
  assert.equal(traceSummary.failoverCount, 0)
  assert.equal(traceSummary.promptChars, 120)
  assert.equal(traceSummary.systemPromptChars, 80)
  assert.equal(traceSummary.outputChars, 12)
  assert.equal(Object.prototype.hasOwnProperty.call(traceSummary, 'prompt'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(traceSummary, 'systemPrompt'), false)
  assert.deepEqual(traceSummary.attempts, [
    Object.fromEntries(Object.entries(attemptSummary).filter(([key]) => ![
      'schemaVersion', 'component', 'event', 'timestamp', 'traceId', 'operation'
    ].includes(key)))
  ])
})

test('summary mode suppresses milestone entries and finish is idempotent', () => {
  let now = 0
  const entries: AgentSdkProfileLogEntry[] = []
  const profiler = createAgentSdkProfiler({
    operation: 'database-prompt',
    promptChars: 10,
    systemPromptChars: 20
  }, {
    mode: 'summary',
    now: () => now,
    timestamp: () => '2026-07-10T00:00:00.000Z',
    createTraceId: () => 'trace-2',
    sink: (entry) => entries.push(entry)
  })

  const attempt = profiler.startAttempt('fallback')
  now = 10
  attempt.finish({ outcome: 'error', outputChars: 0, error: new TypeError('secret detail') })
  attempt.finish({ outcome: 'success', outputChars: 999 })
  now = 12
  profiler.finish({
    outcome: 'fallback',
    fallbackReason: 'all_attempts_failed',
    outputChars: 30,
    candidateCount: 1
  })
  profiler.finish({ outcome: 'success', outputChars: 999, candidateCount: 1 })

  assert.deepEqual(entries.map((entry) => entry.event), ['attempt.summary', 'trace.summary'])
  assert.equal(entries[0]?.outcome, 'error')
  assert.equal(entries[0]?.errorName, 'TypeError')
  assert.equal(entries[0]?.errorKind, 'sdk')
  assert.equal(Object.prototype.hasOwnProperty.call(entries[0], 'errorMessage'), false)
  assert.equal(JSON.stringify(entries).includes('secret detail'), false)
  assert.equal(entries[1]?.fallbackReason, 'all_attempts_failed')
})

test('off mode produces no output and avoids clock or trace-id work', () => {
  const entries: AgentSdkProfileLogEntry[] = []
  let clockCalls = 0
  let traceIdCalls = 0
  const profiler = createAgentSdkProfiler({
    operation: 'skill-draft',
    promptChars: 1,
    systemPromptChars: 1
  }, {
    mode: 'off',
    now: () => {
      clockCalls += 1
      return 0
    },
    createTraceId: () => {
      traceIdCalls += 1
      return 'trace-off'
    },
    sink: (entry) => entries.push(entry)
  })

  const attempt = profiler.startAttempt('legacy')
  attempt.markQueryReady()
  attempt.observeMessage({ type: 'result', subtype: 'success' })
  attempt.recordTextDelta(10)
  attempt.recordHeartbeat()
  attempt.beginCleanup()
  attempt.finish({ outcome: 'cancelled', outputChars: 0 })
  profiler.finish({ outcome: 'cancelled', outputChars: 0, candidateCount: 1 })

  assert.equal(profiler.traceId, 'disabled')
  assert.equal(clockCalls, 0)
  assert.equal(traceIdCalls, 0)
  assert.deepEqual(entries, [])
})
