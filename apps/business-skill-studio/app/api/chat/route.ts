import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  AgentSdkConfigurationError,
  assertAgentSdkConfigured,
  streamAgentChat,
  type AgentSdkStreamEvent
} from '@/lib/agent-sdk'
import { progressiveJsonResponse } from '@/lib/stream-response'
import type { ChatRequest, StudioChatMessage } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function assistantMessage(content: string): StudioChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    createdAt: new Date().toISOString()
  }
}

async function* chatEvents(input: ChatRequest): AsyncGenerator<Record<string, unknown>> {
  for await (const event of streamAgentChat(input)) {
    if (event.type === 'result') {
      yield {
        ...event,
        message: assistantMessage(event.text)
      }
      continue
    }

    yield event satisfies AgentSdkStreamEvent
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<ChatRequest>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'messages must be an array' }, { status: 400 })
  }

  try {
    assertAgentSdkConfigured()
  } catch (error) {
    if (error instanceof AgentSdkConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    throw error
  }

  return progressiveJsonResponse(chatEvents({
    messages: body.messages,
    expertRole: body.expertRole,
    businessContext: body.businessContext,
    activeSkillDraft: body.activeSkillDraft
  }))
}
