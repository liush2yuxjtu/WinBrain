import { NextResponse } from 'next/server'
import { runAgentChat } from '@/lib/agent-sdk'
import type { ChatRequest, StudioChatMessage } from '@/lib/types'

export const runtime = 'nodejs'

function assistantMessage(content: string): StudioChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    createdAt: new Date().toISOString()
  }
}

export async function POST(request: Request) {
  let body: Partial<ChatRequest>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'messages must be an array' }, { status: 400 })
  }

  const result = await runAgentChat({
    messages: body.messages,
    expertRole: body.expertRole,
    businessContext: body.businessContext,
    activeSkillDraft: body.activeSkillDraft
  })

  return NextResponse.json({
    message: assistantMessage(result.text),
    usedAgentSdk: result.usedAgentSdk,
    warnings: result.warnings
  })
}
