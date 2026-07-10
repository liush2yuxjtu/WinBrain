import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { CompanySettingsValidationError, createOrganization } from '@/lib/company-settings'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const organization = await createOrganization({
      name: body?.name,
      industry: body?.industry,
      description: body?.description
    })
    return NextResponse.json({ organization }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof CompanySettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && String(error.code) === 'P2002') {
      return NextResponse.json({ error: 'An organization with this name already exists.' }, { status: 409 })
    }
    console.error('Failed to create organization', error)
    return NextResponse.json({ error: 'Unable to create organization.' }, { status: 503 })
  }
}
