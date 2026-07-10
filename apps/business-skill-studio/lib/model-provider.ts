import type { ChatRequest, SkillDraftRequest } from './types'
import {
  buildBusinessChatSystemPrompt,
  buildSkillCreatorSystemPrompt,
  buildSkillDraftPrompt,
  fallbackSkillDraft
} from './skill-creator'

export type LiveModelProvider = 'minimax-anthropic-messages' | 'deterministic-fallback'

export type LiveModelResult = {
  text: string
  usedLiveModel: boolean
  usedAgentSdk: false
  provider: LiveModelProvider
  warnings: string[]
}

type AnthropicTextBlock = {
  type?: string
  text?: string
}

type AnthropicMessagesResponse = {
  content?: AnthropicTextBlock[]
  error?: {
    type?: string
    message?: string
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 180_000

function requestTimeoutMs(): number {
  const configured = Number(process.env.MODEL_API_TIMEOUT_MS || process.env.API_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_REQUEST_TIMEOUT_MS
}

function requiredProviderConfig(): {
  apiKey: string
  baseUrl: string
  model: string
} | null {
  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)?.trim()
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, '')
  const model = process.env.ANTHROPIC_MODEL?.trim()

  if (!apiKey || !baseUrl || !model) return null
  return { apiKey, baseUrl, model }
}

function transcriptPrompt(input: ChatRequest): string {
  return input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n\n')
}

function responseText(payload: AnthropicMessagesResponse): string {
  return (payload.content || [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text || '')
    .join('')
    .trim()
}

function safeProviderError(status: number, payload: AnthropicMessagesResponse): string {
  const type = payload.error?.type ? ` ${payload.error.type}` : ''
  const message = payload.error?.message ? `: ${payload.error.message}` : ''
  return `MiniMax Anthropic Messages API returned HTTP ${status}${type}${message}`
}

async function callMiniMaxMessages(input: {
  system: string
  prompt: string
  maxTokens: number
}): Promise<string> {
  const config = requiredProviderConfig()
  if (!config) {
    throw new Error('ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, and ANTHROPIC_MODEL must be configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs())

  try {
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': config.apiKey
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: input.prompt }]
          }
        ],
        thinking: { type: 'disabled' },
        temperature: 1
      }),
      signal: controller.signal
    })

    const payload = await response.json().catch(() => ({})) as AnthropicMessagesResponse
    if (!response.ok) throw new Error(safeProviderError(response.status, payload))

    const text = responseText(payload)
    if (!text) throw new Error('MiniMax Anthropic Messages API returned no text content')
    return text
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`MiniMax Anthropic Messages API timed out after ${requestTimeoutMs()}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function localChatFallback(input: ChatRequest): LiveModelResult {
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === 'user')

  return {
    usedLiveModel: false,
    usedAgentSdk: false,
    provider: 'deterministic-fallback',
    warnings: ['Live model configuration is incomplete. Returned deterministic local guidance.'],
    text: [
      '我先按 skill-creator 的方式帮你收集信息。',
      '',
      latestUserMessage?.content
        ? `你刚才提到：${latestUserMessage.content}`
        : '请先描述一个你经常处理、希望 AI 稳定复用的业务流程。',
      '',
      '为了把它沉淀成 skill，我需要先确认：这个流程最终要产出什么业务结果？'
    ].join('\n')
  }
}

export async function runAgentChat(input: ChatRequest): Promise<LiveModelResult> {
  if (!requiredProviderConfig()) return localChatFallback(input)

  try {
    const text = await callMiniMaxMessages({
      system: buildBusinessChatSystemPrompt(input.expertRole, input.businessContext, input.activeSkillDraft),
      prompt: transcriptPrompt(input),
      maxTokens: 1600
    })

    return {
      text,
      usedLiveModel: true,
      usedAgentSdk: false,
      provider: 'minimax-anthropic-messages',
      warnings: []
    }
  } catch (error) {
    return {
      text: '实时模型调用失败。我已保留本轮上下文；请检查 MiniMax API 配置和服务端日志后重试。',
      usedLiveModel: false,
      usedAgentSdk: false,
      provider: 'minimax-anthropic-messages',
      warnings: [`Live model call failed: ${error instanceof Error ? error.message : String(error)}`]
    }
  }
}

export async function draftSkillWithAgent(input: SkillDraftRequest): Promise<LiveModelResult> {
  if (!requiredProviderConfig()) {
    return {
      text: fallbackSkillDraft(input),
      usedLiveModel: false,
      usedAgentSdk: false,
      provider: 'deterministic-fallback',
      warnings: ['Live model configuration is incomplete. Returned deterministic fallback skill draft.']
    }
  }

  try {
    const text = await callMiniMaxMessages({
      system: buildSkillCreatorSystemPrompt(),
      prompt: buildSkillDraftPrompt(input),
      maxTokens: 6000
    })

    return {
      text,
      usedLiveModel: true,
      usedAgentSdk: false,
      provider: 'minimax-anthropic-messages',
      warnings: []
    }
  } catch (error) {
    return {
      text: fallbackSkillDraft(input),
      usedLiveModel: false,
      usedAgentSdk: false,
      provider: 'minimax-anthropic-messages',
      warnings: [`Live model skill drafting failed: ${error instanceof Error ? error.message : String(error)}`]
    }
  }
}
