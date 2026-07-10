import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listCompanySetup } from '@/lib/company-settings'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json(await listCompanySetup())
  } catch (error) {
    console.error('Failed to load company setup', error)
    return NextResponse.json({
      error: 'Company settings are unavailable. Configure DATABASE_URL and apply the latest migrations.'
    }, { status: 503 })
  }
}
