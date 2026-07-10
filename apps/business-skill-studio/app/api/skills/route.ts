import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listSkills, saveSkill } from '@/lib/skill-store'
import type { SkillSaveRequest } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const skills = await listSkills()
  return NextResponse.json({ skills })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<SkillSaveRequest>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || !body.skillName || !body.skillMarkdown) {
    return NextResponse.json({ error: 'skillName and skillMarkdown are required' }, { status: 400 })
  }

  const skill = await saveSkill({
    skillName: body.skillName,
    skillMarkdown: body.skillMarkdown,
    evalsJson: body.evalsJson
  })

  return NextResponse.json({ skill }, { status: 201 })
}
