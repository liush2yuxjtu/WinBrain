import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { runDatabaseAgent } from '@/lib/database-agent'
import type { DatabaseChatRequest } from '@/lib/database-types'
import type { StudioChatMessage } from '@/lib/types'

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
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<DatabaseChatRequest>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length > 40) {
    return NextResponse.json({ error: 'messages must be an array with at most 40 items' }, { status: 400 })
  }

  const messages = body.messages.filter((message) =>
    message &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    message.content.length <= 6_000
  ).slice(-16)

  if (!messages.some((message) => message.role === 'user')) {
    return NextResponse.json({ error: 'At least one user message is required' }, { status: 400 })
  }

  try {
    const result = await runDatabaseAgent({
      messages,
      selectedTable: typeof body.selectedTable === 'string' ? body.selectedTable : undefined
    })

    return NextResponse.json({
      message: assistantMessage(result.text),
      usedLiveModel: result.usedLiveModel,
      usedAgentSdk: result.usedAgentSdk,
      provider: result.provider,
      credentialSlot: result.credentialSlot,
      warnings: result.warnings,
      groundedTables: result.groundedTables,
      snapshotDate: result.snapshotDate
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Database agent failed'
    }, { status: 500 })
  }
}
