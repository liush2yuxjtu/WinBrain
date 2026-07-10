import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  listSkills,
  saveSkill,
  SkillStoreValidationError
} from '@/lib/skill-store'
import type { SkillSaveRequest } from '@/lib/types'

export const runtime = 'nodejs'

function unavailableResponse() {
  return NextResponse.json({
    error: 'Skill store is unavailable. Check the server logs and storage configuration.'
  }, { status: 503 })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const organizationId = new URL(request.url).searchParams.get('organizationId') || undefined
    const skills = await listSkills(organizationId)
    return NextResponse.json({ skills })
  } catch (error) {
    if (error instanceof SkillStoreValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Failed to list skills', error)
    return unavailableResponse()
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<SkillSaveRequest>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body.skillName !== 'string' || typeof body.skillMarkdown !== 'string') {
    return NextResponse.json({ error: 'skillName and skillMarkdown are required' }, { status: 400 })
  }

  try {
    const skill = await saveSkill({
      skillName: body.skillName,
      skillMarkdown: body.skillMarkdown,
      evalsJson: typeof body.evalsJson === 'string' ? body.evalsJson : undefined,
      organizationId: typeof body.organizationId === 'string' ? body.organizationId : undefined,
      expertId: typeof body.expertId === 'string' ? body.expertId : undefined
    })
    return NextResponse.json({ skill }, { status: 201 })
  } catch (error) {
    if (error instanceof SkillStoreValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Failed to save skill', error)
    return unavailableResponse()
  }
}
