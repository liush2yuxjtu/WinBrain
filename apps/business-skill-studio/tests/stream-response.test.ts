import assert from 'node:assert/strict'
import test from 'node:test'
import { progressiveJsonResponse } from '../lib/stream-response'

test('progressiveJsonResponse preserves a real result', async () => {
  async function* events() {
    yield { type: 'status', message: 'working' }
    yield {
      type: 'result',
      text: 'real model output',
      usedLiveModel: true,
      usedAgentSdk: true,
      provider: 'claude-agent-sdk',
      warnings: []
    }
  }

  const response = progressiveJsonResponse(events())
  const payload = await response.json() as {
    ok: boolean
    text: string
    events: Array<{ type: string }>
  }

  assert.equal(payload.ok, true)
  assert.equal(payload.text, 'real model output')
  assert.equal(payload.events.at(-1)?.type, 'result')
})

test('progressiveJsonResponse reports thrown failures as errors, not results', async () => {
  async function* events() {
    yield { type: 'status', message: 'working' }
    throw new Error('upstream unavailable')
  }

  const response = progressiveJsonResponse(events())
  const payload = await response.json() as {
    ok: boolean
    error: string
    events: Array<{ type: string; error?: string }>
  }

  assert.equal(payload.ok, false)
  assert.match(payload.error, /upstream unavailable/)
  assert.equal(payload.events.at(-1)?.type, 'error')
  assert.equal(payload.events.some((event) => event.type === 'result'), false)
})

test('progressiveJsonResponse rejects streams that end without a result', async () => {
  async function* events() {
    yield { type: 'status', message: 'working' }
  }

  const response = progressiveJsonResponse(events())
  const payload = await response.json() as {
    ok: boolean
    error: string
    events: Array<{ type: string }>
  }

  assert.equal(payload.ok, false)
  assert.match(payload.error, /without a final result/)
  assert.equal(payload.events.at(-1)?.type, 'error')
})
