import { NextResponse } from 'next/server'
import { listSkills, saveSkill } from '@/lib/skill-store'
import type { SkillSaveRequest } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  const skills = await listSkills()
  return NextResponse.json({ skills })
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<SkillSaveRequest>

  if (!body.skillName || !body.skillMarkdown) {
    return NextResponse.json({ error: 'skillName and skillMarkdown are required' }, { status: 400 })
  }

  const skill = await saveSkill({
    skillName: body.skillName,
    skillMarkdown: body.skillMarkdown,
    evalsJson: body.evalsJson
  })

  return NextResponse.json({ skill }, { status: 201 })
}
