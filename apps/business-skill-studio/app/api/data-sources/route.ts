import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { CompanySettingsValidationError, createCustomerDataSource } from '@/lib/company-settings'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const dataSource = await createCustomerDataSource({
      organizationId: body?.organizationId,
      expertId: body?.expertId,
      name: body?.name,
      kind: body?.kind,
      host: body?.host,
      port: body?.port,
      username: body?.username,
      password: body?.password,
      databaseName: body?.databaseName,
      charset: body?.charset,
      sslMode: body?.sslMode
    })
    return NextResponse.json({ dataSource }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof CompanySettingsValidationError || (error instanceof Error && error.name === 'CustomerDataSourceValidationError')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && String(error.code) === 'P2002') {
      return NextResponse.json({ error: 'A data source with this name already exists in the selected organization.' }, { status: 409 })
    }
    console.error('Failed to create customer data source', error)
    return NextResponse.json({
      error: 'Unable to save data source. Check DATABASE_URL and DATA_SOURCE_ENCRYPTION_KEY.'
    }, { status: 503 })
  }
}
