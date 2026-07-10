import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listSkills, saveSkill, skillStoreHttpError } from '@/lib/skill-store'
import type { SkillSaveRequest } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const organizationId = new URL(request.url).searchParams.get('organizationId') || undefined
    const skills = await listSkills(organizationId)
    return NextResponse.json({ skills }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
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
  if (body.evalsJson !== undefined && typeof body.evalsJson !== 'string') {
    return NextResponse.json({ error: 'evalsJson must be a string when provided' }, { status: 400 })
  }

  try {
    const skill = await saveSkill({
      skillName: body.skillName,
      skillMarkdown: body.skillMarkdown,
      evalsJson: body.evalsJson,
      organizationId: typeof body.organizationId === 'string' ? body.organizationId : undefined,
      expertId: typeof body.expertId === 'string' ? body.expertId : undefined
    }, { overwrite: body.overwrite === false ? false : true })

    return NextResponse.json({ skill }, { status: 201 })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
  }
}
