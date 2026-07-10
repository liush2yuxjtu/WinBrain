import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDatabaseCatalog, getDatabaseMetadata, getDatabaseTable } from '@/lib/database-schema'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const tableName = url.searchParams.get('table')?.trim()

  try {
    if (tableName) {
      const table = await getDatabaseTable(tableName)
      if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
      return NextResponse.json({
        metadata: await getDatabaseMetadata(),
        table,
        snapshotReadOnly: true
      })
    }

    const query = url.searchParams.get('q') || ''
    const requestedLimit = Number(url.searchParams.get('limit') || 500)
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 500
    return NextResponse.json(await getDatabaseCatalog(query, limit))
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to load database schema'
    }, { status: 500 })
  }
}
