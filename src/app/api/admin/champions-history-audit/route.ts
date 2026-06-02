import { NextResponse } from 'next/server'

import { auditChampionsHistory } from '@/server/champion-identity-audit'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function readBoolean(value: string | null) {
  if (value === null) return false
  return value === 'true' || value === '1'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const audit = await auditChampionsHistory({
      competition: searchParams.get('competition'),
      season: searchParams.get('season'),
      onlyProblems: readBoolean(searchParams.get('onlyProblems')),
    })

    return jsonNoStore({
      endpoint: 'champions-history-audit',
      ...audit,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar historial de campeones.',
      },
      { status: 500 }
    )
  }
}
