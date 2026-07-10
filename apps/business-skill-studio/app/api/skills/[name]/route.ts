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

function requestOrganizationId(request: Request): string | undefined {
  return new URL(request.url).searchParams.get('organizationId') || undefined
}

export async function GET(request: Request, context: RouteContext) {
  if (!await authorized()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await context.params
    const skill = await readSkillDetail(name, requestOrganizationId(request))
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

  let body: Partial<SkillSaveRequest> & { expectedVersion?: number }
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
  if (body.organizationId !== undefined) {
    return NextResponse.json({ error: 'organizationId must be provided as a query parameter' }, { status: 400 })
  }
  if (body.expertId !== undefined && typeof body.expertId !== 'string') {
    return NextResponse.json({ error: 'expertId must be a string when provided' }, { status: 400 })
  }
  if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) {
    return NextResponse.json({ error: 'expectedVersion must be a positive integer' }, { status: 400 })
  }

  try {
    const { name } = await context.params
    const skill = await updateSkill(name, {
      skillMarkdown: body.skillMarkdown,
      evalsJson: body.evalsJson,
      expertId: body.expertId,
      expectedVersion: body.expectedVersion
    }, requestOrganizationId(request))
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    return NextResponse.json({ skill })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!await authorized()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = await context.params
    const deleted = await deleteSkill(name, requestOrganizationId(request))
    if (!deleted) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    const responseError = skillStoreHttpError(error)
    return NextResponse.json({ error: responseError.message }, { status: responseError.status })
  }
}
