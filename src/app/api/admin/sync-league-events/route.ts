import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAvailableLeagues, syncLeagueEvents } from '@/server/prode/sync-matches'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    if (!cronSecret) {
      console.info('[sync-league-events] Ejecucion local autorizada sin CRON_SECRET.')
    }

    return true
  }

  if (!cronSecret) {
    console.warn('[sync-league-events] Rechazado: CRON_SECRET no esta configurado en produccion.')
    return false
  }

  const authorized = request.headers.get('x-cron-secret') === cronSecret

  if (!authorized) {
    console.warn('[sync-league-events] Rechazado: x-cron-secret faltante o invalido.')
  }

  return authorized
}

function isCompetitionNotFound(error: unknown) {
  return error instanceof Error && error.message.startsWith('Competencia no encontrada')
}

async function getSyncOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const competition =
    searchParams.get('competition') ??
    (typeof body?.competition === 'string' ? body.competition : null)
  const date = searchParams.get('date') ?? (typeof body?.date === 'string' ? body.date : null)
  const debugValue = searchParams.get('debug') ?? body?.debug
  const limitValue = searchParams.get('limit') ?? body?.limit
  const offsetValue =
    searchParams.get('offset') ?? searchParams.get('cursor') ?? body?.offset ?? body?.cursor
  const onlyEventsValue = searchParams.get('onlyEvents') ?? body?.onlyEvents

  return {
    competition,
    date,
    debug: debugValue === true || debugValue === 'true' || debugValue === '1',
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
      return NextResponse.json(
        {
          ok: false,
          error: 'Debe indicar competition para evitar timeout',
        },
        { status: 400 }
      )
    }

    const result = await syncLeagueEvents(supabase, {
      competition: options.competition,
      date: options.date,
      debug: options.debug,
      limit: options.limit,
      offset: options.offset,
      onlyEvents: options.onlyEvents,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[sync-league-events] Error completo', error)

    if (isCompetitionNotFound(error)) {
      const supabase = getSupabaseAdminClient()
      const availableLeagues = await getAvailableLeagues(supabase).catch((lookupError) => {
        console.warn('[sync-league-events] No se pudieron listar ligas disponibles.', lookupError)
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
        error:
          error instanceof Error ? error.message : 'No se pudieron sincronizar eventos de liga.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
