import { NextResponse } from 'next/server'

import { getLeagueEventStatsAudit } from '@/server/match-event-stats'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function parseOptionalSeason(value: string | null) {
  const season = Number(value)

  return Number.isFinite(season) && season > 0 ? Math.floor(season) : undefined
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const leagueExternalId = searchParams.get('leagueExternalId')
  const season = parseOptionalSeason(searchParams.get('season'))

  if (!leagueExternalId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'leagueExternalId es requerido. Ejemplo: /api/admin/event-stats-audit?leagueExternalId=130',
      },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json(await getLeagueEventStatsAudit(leagueExternalId, season))
  } catch (error) {
    console.error('[event-stats-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudieron auditar las estadisticas por eventos.',
      },
      { status: 500 }
    )
  }
}
