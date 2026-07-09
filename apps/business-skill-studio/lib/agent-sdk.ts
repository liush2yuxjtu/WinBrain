import { Effect } from 'effect'
import { runAppEffect, toErrorMessage, tryPromiseEffect } from './effect-runtime'
import type { ChatRequest, SkillDraftRequest } from './types'
import {
  buildBusinessChatSystemPrompt,
  buildSkillCreatorSystemPrompt,
  buildSkillDraftPrompt,
  fallbackSkillDraft
} from './skill-creator'

function extractTextFromSdkMessage(message: unknown): string {
  if (typeof message === 'string') return message
  if (!message || typeof message !== 'object') return ''

  const record = message as Record<string, unknown>

  if (typeof record.text === 'string') return record.text
  if (typeof record.content === 'string') return record.content

  if (Array.isArray(record.content)) {
    return record.content
      .map((part) => {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const partRecord = part as Record<string, unknown>
        return typeof partRecord.text === 'string' ? partRecord.text : ''
      })
      .filter(Boolean)
      .join('')
  }

  if (typeof record.result === 'string') return record.result
  if (typeof record.message === 'string') return record.message

  return ''
}

async function collectAgentSdkOutput(result: unknown): Promise<string> {
  if (!result) return ''

  const resolved = await Promise.resolve(result)
  if (!resolved) return ''

  const maybeAsync = resolved as AsyncIterable<unknown>
  if (typeof maybeAsync[Symbol.asyncIterator] === 'function') {
    const chunks: string[] = []
    for await (const message of maybeAsync) {
      chunks.push(extractTextFromSdkMessage(message))
    }
    return chunks.join('').trim()
  }

  if (Array.isArray(resolved)) {
    return resolved.map(extractTextFromSdkMessage).join('').trim()
  }

  return extractTextFromSdkMessage(resolved).trim()
}

function buildPrompt(input: ChatRequest): string {
  return input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n\n')
}

function localChatFallback(input: ChatRequest) {
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === 'user')

  return {
    usedAgentSdk: false,
    warnings: ['ANTHROPIC_API_KEY is not set. Returned local fallback guidance instead of calling the Agent SDK.'],
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

function agentChatEffect(input: ChatRequest) {
  return Effect.gen(function* () {
    const sdk = yield* tryPromiseEffect('Import Claude Agent SDK', () => import('@anthropic-ai/claude-agent-sdk'))
    const result = yield* tryPromiseEffect('Call Claude Agent SDK chat query', async () => sdk.query({
      prompt: buildPrompt(input),
      options: {
        systemPrompt: buildBusinessChatSystemPrompt(input.expertRole, input.businessContext, input.activeSkillDraft),
        maxTurns: 4
      }
    }))
    const text = yield* tryPromiseEffect('Collect Claude Agent SDK chat output', () => collectAgentSdkOutput(result))

    return {
      usedAgentSdk: true,
      warnings: text ? [] : ['Agent SDK returned no text content.'],
      text: text || '我没有收到可显示的 Agent SDK 输出。请检查 SDK 版本和运行时配置。'
    }
  })
}

function draftSkillEffect(input: SkillDraftRequest) {
  return Effect.gen(function* () {
    const sdk = yield* tryPromiseEffect('Import Claude Agent SDK', () => import('@anthropic-ai/claude-agent-sdk'))
    const result = yield* tryPromiseEffect('Call Claude Agent SDK skill draft query', async () => sdk.query({
      prompt: buildSkillDraftPrompt(input),
      options: {
        systemPrompt: buildSkillCreatorSystemPrompt(),
        maxTurns: 5
      }
    }))
    const text = yield* tryPromiseEffect('Collect Claude Agent SDK skill draft output', () => collectAgentSdkOutput(result))

    return {
      usedAgentSdk: true,
      warnings: text ? [] : ['Agent SDK returned no skill draft text.'],
      text: text || fallbackSkillDraft(input)
    }
  })
}

export async function runAgentChat(input: ChatRequest): Promise<{ text: string; usedAgentSdk: boolean; warnings: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) return localChatFallback(input)

  return runAppEffect(agentChatEffect(input)).catch((error) => ({
    usedAgentSdk: false,
    warnings: [`Agent SDK call failed: ${toErrorMessage(error)}`],
    text: 'Agent SDK 调用失败。我已保留本轮上下文；请检查 ANTHROPIC_API_KEY、SDK 版本和服务端日志后重试。'
  }))
}

export async function draftSkillWithAgent(input: SkillDraftRequest): Promise<{ text: string; usedAgentSdk: boolean; warnings: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      usedAgentSdk: false,
      warnings: ['ANTHROPIC_API_KEY is not set. Returned deterministic fallback skill draft.'],
      text: fallbackSkillDraft(input)
    }
  }

  return runAppEffect(draftSkillEffect(input)).catch((error) => ({
    usedAgentSdk: false,
    warnings: [`Agent SDK skill drafting failed: ${toErrorMessage(error)}`],
    text: fallbackSkillDraft(input)
  }))
}
