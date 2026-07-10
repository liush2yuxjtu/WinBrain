import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { deleteSkill, readSkillDetail, skillStoreHttpError, updateSkill } from '@/lib/skill-store'
import type { SkillSaveRequest } from '@/lib/types'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ name: string }>
}

async function authorized() {
  const session = await auth()
  return Boolean(session?.user)
}

export async function GET(_request: Request, context: RouteContext) {
  if (!await authorized()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await context.params
    const skill = await readSkillDetail(name)
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    return NextResponse.json({ skill }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!await authorized()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<SkillSaveRequest>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body.skillMarkdown !== 'string') {
    return NextResponse.json({ error: 'skillMarkdown is required' }, { status: 400 })
  }
  if (body.evalsJson !== undefined && typeof body.evalsJson !== 'string') {
    return NextResponse.json({ error: 'evalsJson must be a string when provided' }, { status: 400 })
  }

  try {
    const { name } = await context.params
    const skill = await updateSkill(name, {
      skillMarkdown: body.skillMarkdown,
      evalsJson: body.evalsJson
    })
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    return NextResponse.json({ skill })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!await authorized()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await context.params
    const deleted = await deleteSkill(name)
    if (!deleted) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
  }
}
