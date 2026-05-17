import { NextResponse } from 'next/server'

import { getCompetitionDataAudit } from '@/server/competition-data-audit'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const audit = await getCompetitionDataAudit({
      competition: searchParams.get('competition'),
      leagueExternalId: searchParams.get('leagueExternalId'),
      date: searchParams.get('date'),
    })

    return jsonNoStore({
      ...audit,
      endpoint: 'competition-data-audit',
    })
  } catch (error) {
    console.error('[competition-data-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar la competencia.',
      },
      { status: 500 }
    )
  }
}
