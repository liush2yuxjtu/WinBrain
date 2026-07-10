import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  AgentSdkConfigurationError,
  assertAgentSdkConfigured,
  streamSkillDraft,
  type AgentSdkStreamEvent
} from '@/lib/agent-sdk'
import { progressiveJsonResponse } from '@/lib/stream-response'
import type { SkillDraftRequest } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function* draftEvents(input: SkillDraftRequest): AsyncGenerator<Record<string, unknown>> {
  for await (const event of streamSkillDraft(input)) {
    yield event satisfies AgentSdkStreamEvent
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<SkillDraftRequest>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || !body.skillName || !body.expertRole || !body.businessGoal || !Array.isArray(body.transcript)) {
    return NextResponse.json({ error: 'skillName, expertRole, businessGoal, and transcript are required' }, { status: 400 })
  }

  try {
    assertAgentSdkConfigured()
  } catch (error) {
    if (error instanceof AgentSdkConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    throw error
  }

  return progressiveJsonResponse(draftEvents({
    skillName: body.skillName,
    expertRole: body.expertRole,
    businessGoal: body.businessGoal,
    transcript: body.transcript
  }))
}
