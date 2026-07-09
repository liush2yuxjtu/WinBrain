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

  const maybeAsync = result as AsyncIterable<unknown>
  if (typeof maybeAsync[Symbol.asyncIterator] === 'function') {
    const chunks: string[] = []
    for await (const message of maybeAsync) {
      chunks.push(extractTextFromSdkMessage(message))
    }
    return chunks.join('').trim()
  }

  const maybeArray = await Promise.resolve(result)
  if (Array.isArray(maybeArray)) {
    return maybeArray.map(extractTextFromSdkMessage).join('').trim()
  }

  return extractTextFromSdkMessage(maybeArray).trim()
}

export async function runAgentChat(input: ChatRequest): Promise<{ text: string; usedAgentSdk: boolean; warnings: string[] }> {
  const latestUserMessage = [...input.messages].reverse().find((message) => message.role === 'user')
  const prompt = input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n\n')

  if (!process.env.ANTHROPIC_API_KEY) {
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

  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk')
    const result = await sdk.query({
      prompt,
      options: {
        systemPrompt: buildBusinessChatSystemPrompt(input.expertRole, input.businessContext, input.activeSkillDraft),
        maxTurns: 4
      }
    })
    const text = await collectAgentSdkOutput(result)

    return {
      usedAgentSdk: true,
      warnings: text ? [] : ['Agent SDK returned no text content.'],
      text: text || '我没有收到可显示的 Agent SDK 输出。请检查 SDK 版本和运行时配置。'
    }
  } catch (error) {
    return {
      usedAgentSdk: false,
      warnings: [`Agent SDK call failed: ${error instanceof Error ? error.message : String(error)}`],
      text: 'Agent SDK 调用失败。我已保留本轮上下文；请检查 ANTHROPIC_API_KEY、SDK 版本和服务端日志后重试。'
    }
  }
}

export async function draftSkillWithAgent(input: SkillDraftRequest): Promise<{ text: string; usedAgentSdk: boolean; warnings: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      usedAgentSdk: false,
      warnings: ['ANTHROPIC_API_KEY is not set. Returned deterministic fallback skill draft.'],
      text: fallbackSkillDraft(input)
    }
  }

  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk')
    const result = await sdk.query({
      prompt: buildSkillDraftPrompt(input),
      options: {
        systemPrompt: buildSkillCreatorSystemPrompt(),
        maxTurns: 5
      }
    })
    const text = await collectAgentSdkOutput(result)

    return {
      usedAgentSdk: true,
      warnings: text ? [] : ['Agent SDK returned no skill draft text.'],
      text: text || fallbackSkillDraft(input)
    }
  } catch (error) {
    return {
      usedAgentSdk: false,
      warnings: [`Agent SDK skill drafting failed: ${error instanceof Error ? error.message : String(error)}`],
      text: fallbackSkillDraft(input)
    }
  }
}
