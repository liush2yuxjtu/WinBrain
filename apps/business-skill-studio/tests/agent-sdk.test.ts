import assert from 'node:assert/strict'
import test from 'node:test'
import type { AgentSdkStreamEvent } from '../lib/agent-sdk'
import type { ChatRequest, SkillDraftRequest } from '../lib/types'
import { fallbackSkillDraft } from '../lib/skill-creator'

type CapturedQueryCall = {
  prompt: string
  options: {
    env: NodeJS.ProcessEnv
    [key: string]: unknown
  }
}

type FakeQueryHandle = AsyncIterable<unknown> & { close: () => void }

function createFakeHandle(messages: unknown[]): FakeQueryHandle {
  let index = 0
  return {
    close: () => {},
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        if (index < messages.length) {
          return { done: false as const, value: messages[index++] }
        }
        return { done: true as const, value: undefined }
      }
    })
  }
}

let capturedCalls: CapturedQueryCall[] = []
let queryImpl: (call: CapturedQueryCall) => FakeQueryHandle = () => {
  throw new Error('queryImpl was not configured for this test')
}

const {
  streamAgentChat,
  streamSkillDraft,
  runAgentChat,
  setAgentSdkQueryForTesting
} = await import('../lib/agent-sdk')

setAgentSdkQueryForTesting((call: CapturedQueryCall) => {
  capturedCalls.push(call)
  return queryImpl(call)
})

test.after(() => setAgentSdkQueryForTesting(undefined))

const MANAGED_ENV_KEYS = [
  'KIMI_API_KEY_PRIMARY', 'KIMI_API_KEY_FALLBACK', 'KIMI_API_KEY',
  'ANTHROPIC_API_KEY_PRIMARY', 'ANTHROPIC_AUTH_TOKEN_PRIMARY',
  'ANTHROPIC_API_KEY_FALLBACK', 'ANTHROPIC_AUTH_TOKEN_FALLBACK',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN',
  'KIMI_BASE_URL', 'KIMI_THINKING_TOKENS', 'MAX_THINKING_TOKENS',
  'CLAUDE_CODE_AUTO_COMPACT_WINDOW', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'CLAUDE_CODE_DISABLE_THINKING',
  'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL',
  'ANTHROPIC_CUSTOM_MODEL_OPTION',
  'ANTHROPIC_DEFAULT_FABLE_MODEL', 'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME',
  'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
  'AGENT_SDK_ATTEMPT_TIMEOUT_MS', 'API_TIMEOUT_MS'
] as const

async function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  capturedCalls.length = 0
  const originals = new Map<string, string | undefined>()
  for (const key of MANAGED_ENV_KEYS) {
    originals.set(key, process.env[key])
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    return await fn()
  } finally {
    for (const [key, original] of originals) {
      if (original === undefined) delete process.env[key]
      else process.env[key] = original
    }
  }
}

async function collectEvents(stream: AsyncGenerator<AgentSdkStreamEvent, void, void>): Promise<AgentSdkStreamEvent[]> {
  const events: AgentSdkStreamEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

function isResultEvent(event: AgentSdkStreamEvent): event is Extract<AgentSdkStreamEvent, { type: 'result' }> {
  return event.type === 'result'
}

function findResult(events: AgentSdkStreamEvent[]): Extract<AgentSdkStreamEvent, { type: 'result' }> {
  const event = events.find(isResultEvent)
  assert.ok(event, 'expected a result event in the stream')
  return event
}

function statusMessages(events: AgentSdkStreamEvent[]): string[] {
  return events
    .filter((event): event is Extract<AgentSdkStreamEvent, { type: 'status' }> => event.type === 'status')
    .map((event) => event.message)
}

function buildChatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [
      { id: 'm1', role: 'user', content: 'Hello, can you help me?', createdAt: '2026-01-01T00:00:00.000Z' }
    ],
    ...overrides
  }
}

function buildSkillDraftRequest(): SkillDraftRequest {
  return {
    skillName: 'Renewal Review',
    expertRole: 'Account Manager',
    businessGoal: 'Improve renewal review efficiency',
    transcript: [
      { id: 't1', role: 'user', content: 'We need help drafting a skill.', createdAt: '2026-01-01T00:00:00.000Z' }
    ]
  }
}

const CHAT_FALLBACK_TEXT =
  'Kimi Code 调用失败。\n\n已保留本轮输入：Hello, can you help me?\n\n请检查主备 Kimi Key 的有效性、会员权益、额度和 Agent SDK 服务端日志。'

test('routes through Kimi Code via the primary credential and configures the Kimi-specific SDK environment', async () => {
  await withEnv({ KIMI_API_KEY_PRIMARY: 'primary-kimi-key' }, async () => {
    queryImpl = () => createFakeHandle([
      { type: 'system', subtype: 'init' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello world' }] } },
      { type: 'result', subtype: 'success', result: 'Hello world' }
    ])

    const events = await collectEvents(streamAgentChat(buildChatRequest()))
    const result = findResult(events)

    assert.equal(result.text, 'Hello world')
    assert.equal(result.usedLiveModel, true)
    assert.equal(result.usedAgentSdk, true)
    assert.equal(result.provider, 'claude-agent-sdk')
    assert.equal(result.credentialSlot, 'primary')
    assert.deepEqual(result.warnings, [])

    const messages = statusMessages(events)
    assert.ok(messages.some((message) => message.includes('正在使用 primary Kimi Key 启动 K2.7 Code')))
    assert.ok(messages.some((message) => message.includes('Kimi Code 已通过 Claude Agent SDK 初始化')))

    assert.equal(capturedCalls.length, 1)
    const [call] = capturedCalls
    assert.equal(call.options.env.ANTHROPIC_BASE_URL, 'https://api.kimi.com/coding/')
    assert.equal(call.options.env.ANTHROPIC_API_KEY, 'primary-kimi-key')
    assert.equal(call.options.env.ANTHROPIC_AUTH_TOKEN, 'primary-kimi-key')
    assert.equal(call.options.env.MAX_THINKING_TOKENS, '32768')
    assert.equal(call.options.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW, '262144')
    assert.equal(call.options.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, '1')
    assert.equal(Object.prototype.hasOwnProperty.call(call.options, 'model'), false)
  })
})

test('prefers KIMI_API_KEY_PRIMARY over legacy Anthropic primary variables', async () => {
  await withEnv({
    KIMI_API_KEY_PRIMARY: 'kimi-key',
    ANTHROPIC_API_KEY_PRIMARY: 'anthropic-key',
    ANTHROPIC_AUTH_TOKEN_PRIMARY: 'anthropic-token'
  }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'ok' }])
    await collectEvents(streamAgentChat(buildChatRequest()))
    assert.equal(capturedCalls[0]?.options.env.ANTHROPIC_API_KEY, 'kimi-key')
  })
})

test('ignores a blank KIMI_API_KEY_PRIMARY value and falls through to the Anthropic primary variable', async () => {
  await withEnv({
    KIMI_API_KEY_PRIMARY: '   ',
    ANTHROPIC_API_KEY_PRIMARY: 'anthropic-primary-key'
  }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'ok' }])
    await collectEvents(streamAgentChat(buildChatRequest()))
    assert.equal(capturedCalls[0]?.options.env.ANTHROPIC_API_KEY, 'anthropic-primary-key')
  })
})

test('deduplicates identical credential values so a repeated key is not retried under a different slot', async () => {
  await withEnv({
    KIMI_API_KEY_PRIMARY: 'shared-key',
    KIMI_API_KEY_FALLBACK: 'shared-key'
  }, async () => {
    queryImpl = () => { throw new Error('sdk unavailable') }
    const events = await collectEvents(streamAgentChat(buildChatRequest()))

    assert.equal(capturedCalls.length, 1)
    const result = findResult(events)
    assert.equal(result.usedLiveModel, false)
    assert.deepEqual(result.warnings, ['All Kimi Code credentials failed: primary: sdk unavailable'])
  })
})

test('returns a deterministic fallback with a Kimi-specific warning when no credential is configured', async () => {
  await withEnv({}, async () => {
    const events = await collectEvents(streamAgentChat(buildChatRequest()))

    assert.equal(events.length, 1)
    const result = findResult(events)
    assert.equal(result.provider, 'deterministic-fallback')
    assert.equal(result.usedLiveModel, false)
    assert.equal(result.usedAgentSdk, false)
    assert.deepEqual(result.warnings, ['No Kimi Code credential is configured.'])
    assert.equal(result.text, CHAT_FALLBACK_TEXT)
    assert.equal(capturedCalls.length, 0)
  })
})

test('switches from the primary Kimi Key to the fallback Kimi Key after a failure', async () => {
  await withEnv({
    KIMI_API_KEY_PRIMARY: 'primary-key',
    KIMI_API_KEY_FALLBACK: 'fallback-key'
  }, async () => {
    let attempt = 0
    queryImpl = () => {
      attempt += 1
      if (attempt === 1) throw new Error('primary boom')
      return createFakeHandle([{ type: 'result', subtype: 'success', result: 'from fallback' }])
    }

    const events = await collectEvents(streamAgentChat(buildChatRequest()))
    const messages = statusMessages(events)
    assert.ok(messages.includes('primary Kimi Key 失败：primary boom；正在切换 fallback Key'))

    const result = findResult(events)
    assert.equal(result.credentialSlot, 'fallback')
    assert.equal(result.text, 'from fallback')
    assert.deepEqual(result.warnings, ['Kimi Code switched credentials after: primary: primary boom'])

    assert.equal(capturedCalls.length, 2)
    assert.equal(capturedCalls[1]?.options.env.ANTHROPIC_API_KEY, 'fallback-key')
  })
})

test('falls back to the deterministic chat response after every Kimi credential fails', async () => {
  await withEnv({
    KIMI_API_KEY_PRIMARY: 'primary-key',
    KIMI_API_KEY_FALLBACK: 'fallback-key'
  }, async () => {
    let attempt = 0
    queryImpl = () => {
      attempt += 1
      throw new Error(attempt === 1 ? 'primary boom' : 'fallback boom')
    }

    const events = await collectEvents(streamAgentChat(buildChatRequest()))
    const result = findResult(events)

    assert.equal(result.provider, 'claude-agent-sdk')
    assert.equal(result.usedLiveModel, false)
    assert.equal(result.usedAgentSdk, false)
    assert.deepEqual(result.warnings, [
      'All Kimi Code credentials failed: primary: primary boom | fallback: fallback boom'
    ])
    assert.equal(result.text, CHAT_FALLBACK_TEXT)
  })
})

test('clamps a large KIMI_THINKING_TOKENS override to the Kimi Code thinking budget', async () => {
  await withEnv({ KIMI_API_KEY_PRIMARY: 'primary-key', KIMI_THINKING_TOKENS: '999999' }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'ok' }])
    await collectEvents(streamAgentChat(buildChatRequest()))
    assert.equal(capturedCalls[0]?.options.env.MAX_THINKING_TOKENS, '32768')
  })
})

test('honors a smaller KIMI_THINKING_TOKENS override', async () => {
  await withEnv({ KIMI_API_KEY_PRIMARY: 'primary-key', KIMI_THINKING_TOKENS: '4096' }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'ok' }])
    await collectEvents(streamAgentChat(buildChatRequest()))
    assert.equal(capturedCalls[0]?.options.env.MAX_THINKING_TOKENS, '4096')
  })
})

test('falls back to the default thinking budget for an invalid KIMI_THINKING_TOKENS value', async () => {
  await withEnv({ KIMI_API_KEY_PRIMARY: 'primary-key', KIMI_THINKING_TOKENS: '0' }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'ok' }])
    await collectEvents(streamAgentChat(buildChatRequest()))
    assert.equal(capturedCalls[0]?.options.env.MAX_THINKING_TOKENS, '32768')
  })
})

test('honors KIMI_BASE_URL and CLAUDE_CODE_AUTO_COMPACT_WINDOW overrides while stripping stale model overrides', async () => {
  await withEnv({
    KIMI_API_KEY_PRIMARY: 'primary-key',
    KIMI_BASE_URL: 'https://kimi.example.com/coding/',
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: '131072',
    ANTHROPIC_MODEL: 'kimi-2.7-code',
    ANTHROPIC_SMALL_FAST_MODEL: 'some-small-model',
    CLAUDE_CODE_DISABLE_THINKING: '1',
    ANTHROPIC_API_KEY: 'stale-legacy-key'
  }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'ok' }])
    await collectEvents(streamAgentChat(buildChatRequest()))

    const env = capturedCalls[0]?.options.env ?? {}
    assert.equal(env.ANTHROPIC_BASE_URL, 'https://kimi.example.com/coding/')
    assert.equal(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW, '131072')
    assert.equal(env.ANTHROPIC_MODEL, undefined)
    assert.equal(env.ANTHROPIC_SMALL_FAST_MODEL, undefined)
    assert.equal(env.CLAUDE_CODE_DISABLE_THINKING, undefined)
    assert.equal(env.ANTHROPIC_API_KEY, 'primary-key')
  })
})

test('streamSkillDraft falls back to the deterministic skill draft when no credential is configured', async () => {
  await withEnv({}, async () => {
    const request = buildSkillDraftRequest()
    const events = await collectEvents(streamSkillDraft(request))

    assert.equal(events.length, 1)
    const result = findResult(events)
    assert.equal(result.provider, 'deterministic-fallback')
    assert.equal(result.text, fallbackSkillDraft(request))
    assert.equal(capturedCalls.length, 0)
  })
})

test('runAgentChat resolves with the final result payload for a successful Kimi stream', async () => {
  await withEnv({ KIMI_API_KEY_PRIMARY: 'primary-key' }, async () => {
    queryImpl = () => createFakeHandle([{ type: 'result', subtype: 'success', result: 'Hello world' }])
    const result = await runAgentChat(buildChatRequest())

    assert.equal(result.text, 'Hello world')
    assert.equal(result.provider, 'claude-agent-sdk')
    assert.equal(result.credentialSlot, 'primary')
  })
})