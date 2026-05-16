import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateLigaProfesionalPlayoffs } from '@/server/liga-profesional/playoffs'
import { syncHomeScoreboardMatches } from '@/server/prode/sync-matches'
import { getAllowedTournamentByExternalId } from '@/shared/config/prode-leagues'
import { LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID } from '@/shared/utils/league-rounds'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  return response
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) {
    if (!isProduction) return true

    console.warn('[sync-fixtures] Rechazado: CRON_SECRET no esta configurado.')
    return false
  }

  return getAuthorizationToken(request) === cronSecret
}

function parseBoolean(value: string | null) {
  if (value === null) return false

  return ['1', 'true', 'yes', 'si', 'sí'].includes(value.toLowerCase())
}

async function getSyncOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const limitValue = searchParams.get('limit') ?? body?.limit
  const leagueExternalId =
    searchParams.get('leagueExternalId') ??
    (typeof body?.leagueExternalId === 'string' || typeof body?.leagueExternalId === 'number'
      ? body.leagueExternalId
      : null)

  return {
    date: searchParams.get('date') ?? (typeof body?.date === 'string' ? body.date : null),
    dateFrom:
      searchParams.get('dateFrom') ?? (typeof body?.dateFrom === 'string' ? body.dateFrom : null),
    dateTo:
      searchParams.get('dateTo') ?? (typeof body?.dateTo === 'string' ? body.dateTo : null),
    leagueExternalId,
    limit: Number.isFinite(Number(limitValue)) && Number(limitValue) > 0 ? Number(limitValue) : null,
    debug: parseBoolean(
      searchParams.get('debug') ??
        (typeof body?.debug === 'string'
          ? body.debug
          : body?.debug === true
            ? 'true'
            : null)
    ),
  }
}

function shouldGenerateLigaProfesionalPlayoffs(leagueExternalId: string | number | null) {
  if (leagueExternalId === null || leagueExternalId === undefined || leagueExternalId === '') {
    return true
  }

  return Number(leagueExternalId) === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const options = await getSyncOptions(request)
    const homeScoreboard = await syncHomeScoreboardMatches(supabase, options)
    let ligaProfesionalPlayoffs: Awaited<ReturnType<typeof generateLigaProfesionalPlayoffs>> | null = null

    if (shouldGenerateLigaProfesionalPlayoffs(options.leagueExternalId)) {
      const tournament = getAllowedTournamentByExternalId(LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID)

      ligaProfesionalPlayoffs = await generateLigaProfesionalPlayoffs(supabase, {
        leagueExternalId: LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
        season: tournament?.season ?? null,
        dryRun: false,
      })
    }

    return jsonNoStore({
      ok: true,
      checked: homeScoreboard.selected,
      synced: homeScoreboard.processed,
      cached: homeScoreboard.cached,
      errors: homeScoreboard.sampleErrors,
      dates: homeScoreboard.dates,
      homeScoreboard,
      ligaProfesionalPlayoffs,
    })
  } catch (error) {
    console.error('[sync-fixtures] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo sincronizar fixtures.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
