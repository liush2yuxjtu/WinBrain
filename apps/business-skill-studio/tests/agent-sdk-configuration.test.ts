import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AgentSdkConfigurationError,
  assertAgentSdkConfigured
} from '../lib/agent-sdk'

const credentialKeys = [
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

function preserveCredentials(): () => void {
  const previous = new Map<string, string | undefined>()
  for (const key of credentialKeys) {
    previous.set(key, process.env[key])
    delete process.env[key]
  }

  return () => {
    for (const key of credentialKeys) {
      const value = previous.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('assertAgentSdkConfigured throws when no real credential exists', () => {
  const restore = preserveCredentials()
  try {
    assert.throws(
      () => assertAgentSdkConfigured(),
      (error: unknown) => error instanceof AgentSdkConfigurationError
    )
  } finally {
    restore()
  }
})

test('assertAgentSdkConfigured accepts a configured credential', () => {
  const restore = preserveCredentials()
  try {
    process.env.ANTHROPIC_API_KEY_PRIMARY = 'test-key'
    assert.doesNotThrow(() => assertAgentSdkConfigured())
  } finally {
    restore()
  }
})
