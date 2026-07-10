import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { CompanySettingsValidationError, createExpert } from '@/lib/company-settings'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const expert = await createExpert({
      organizationId: body?.organizationId,
      name: body?.name,
      email: body?.email,
      role: body?.role,
      department: body?.department,
      expertise: body?.expertise,
      businessContext: body?.businessContext
    })
    return NextResponse.json({ expert }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof CompanySettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && String(error.code) === 'P2002') {
      return NextResponse.json({ error: 'This expert email already exists in the selected organization.' }, { status: 409 })
    }
    console.error('Failed to create expert', error)
    return NextResponse.json({ error: 'Unable to create expert.' }, { status: 503 })
  }
}
