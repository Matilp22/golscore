import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getAvailableLeagues,
  syncHomeScoreboardMatches,
  syncProdeMatches,
} from '@/server/prode/sync-matches'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    if (!cronSecret) {
      console.info('[sync-matches] Ejecucion local autorizada sin CRON_SECRET.')
    }

    return true
  }

  if (!cronSecret) {
    console.warn('[sync-matches] Rechazado: CRON_SECRET no esta configurado en produccion.')
    return false
  }

  const authorized = request.headers.get('x-cron-secret') === cronSecret

  if (!authorized) {
    console.warn('[sync-matches] Rechazado: x-cron-secret faltante o invalido.')
  }

  return authorized
}

function isCompetitionNotFound(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.startsWith('Competencia no encontrada') ||
      error.message.startsWith('Torneo no permitido'))
  )
}

async function getSyncOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const competition =
    searchParams.get('competition') ??
    (typeof body?.competition === 'string' ? body.competition : null)
  const debugValue = searchParams.get('debug') ?? body?.debug
  const date = searchParams.get('date') ?? (typeof body?.date === 'string' ? body.date : null)
  const dateFrom =
    searchParams.get('dateFrom') ??
    (typeof body?.dateFrom === 'string' ? body.dateFrom : null)
  const dateTo =
    searchParams.get('dateTo') ??
    (typeof body?.dateTo === 'string' ? body.dateTo : null)
  const leagueExternalId =
    searchParams.get('leagueExternalId') ??
    (typeof body?.leagueExternalId === 'string' || typeof body?.leagueExternalId === 'number'
      ? body.leagueExternalId
      : null)
  const limitValue = searchParams.get('limit') ?? body?.limit
  const offsetValue = searchParams.get('offset') ?? searchParams.get('cursor') ?? body?.offset ?? body?.cursor
  const onlyEventsValue = searchParams.get('onlyEvents') ?? body?.onlyEvents

  return {
    competition,
    debug: debugValue === true || debugValue === 'true' || debugValue === '1',
    date,
    dateFrom,
    dateTo,
    leagueExternalId,
    limit: Number.isFinite(Number(limitValue)) ? Number(limitValue) : null,
    offset: Number.isFinite(Number(offsetValue)) ? Number(offsetValue) : null,
    onlyEvents:
      onlyEventsValue === true || onlyEventsValue === 'true' || onlyEventsValue === '1',
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const options = await getSyncOptions(request)

    if (!options.competition) {
      if (options.date || options.dateFrom || options.dateTo || options.leagueExternalId) {
        const homeScoreboard = await syncHomeScoreboardMatches(supabase, {
          date: options.date,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          leagueExternalId: options.leagueExternalId,
          debug: options.debug,
          limit: options.limit,
          offset: options.offset,
        })

        return NextResponse.json({
          ok: true,
          mode: 'home-scoreboard',
          homeScoreboard,
        })
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'Debe indicar competition para evitar timeout',
        },
        { status: 400 }
      )
    }

    const result = await syncProdeMatches(supabase, options)

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[sync-matches] Error completo', error)

    if (isCompetitionNotFound(error)) {
      const supabase = getSupabaseAdminClient()
      const availableLeagues = await getAvailableLeagues(supabase).catch((lookupError) => {
        console.warn('[sync-matches] No se pudieron listar ligas disponibles.', lookupError)
        return []
      })

      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Competencia no encontrada.',
          availableLeagues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo sincronizar partidos.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
