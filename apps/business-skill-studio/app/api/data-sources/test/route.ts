import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  CompanySettingsValidationError,
  testSavedCustomerDataSource,
  testUnsavedCustomerDataSource
} from '@/lib/company-settings'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const result = typeof body?.dataSourceId === 'string' && body.dataSourceId.trim()
      ? await testSavedCustomerDataSource(body.dataSourceId)
      : await testUnsavedCustomerDataSource({
          kind: body?.kind,
          host: body?.host,
          port: body?.port,
          username: body?.username,
          password: body?.password,
          databaseName: body?.databaseName,
          charset: body?.charset,
          sslMode: body?.sslMode
        })

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof CompanySettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Failed to test customer data source', error)
    return NextResponse.json({ error: 'Unable to run the database connection test.' }, { status: 503 })
  }
}
