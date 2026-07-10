import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { draftSkillWithAgent } from '@/lib/model-provider'
import type { SkillDraftRequest } from '@/lib/types'

export const runtime = 'nodejs'

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

  const result = await draftSkillWithAgent({
    skillName: body.skillName,
    expertRole: body.expertRole,
    businessGoal: body.businessGoal,
    transcript: body.transcript
  })

  return NextResponse.json(result)
}
