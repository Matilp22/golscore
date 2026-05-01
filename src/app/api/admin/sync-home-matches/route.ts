import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncHomeScoreboardMatches } from '@/server/prode/sync-matches'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    if (!cronSecret) {
      console.info('[sync-home-matches] Ejecucion local autorizada sin CRON_SECRET.')
    }

    return true
  }

  if (!cronSecret) {
    console.warn('[sync-home-matches] Rechazado: CRON_SECRET no esta configurado en produccion.')
    return false
  }

  const authorized = request.headers.get('x-cron-secret') === cronSecret

  if (!authorized) {
    console.warn('[sync-home-matches] Rechazado: x-cron-secret faltante o invalido.')
  }

  return authorized
}

async function getSyncOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const date = searchParams.get('date') ?? (typeof body?.date === 'string' ? body.date : null)
  const debugValue = searchParams.get('debug') ?? body?.debug
  const liveOnlyValue = searchParams.get('liveOnly') ?? body?.liveOnly
  const limitValue = searchParams.get('limit') ?? body?.limit
  const offsetValue =
    searchParams.get('offset') ?? searchParams.get('cursor') ?? body?.offset ?? body?.cursor

  return {
    date,
    debug: debugValue === true || debugValue === 'true' || debugValue === '1',
    liveOnly: liveOnlyValue === true || liveOnlyValue === 'true' || liveOnlyValue === '1',
    limit: Number.isFinite(Number(limitValue)) ? Number(limitValue) : null,
    offset: Number.isFinite(Number(offsetValue)) ? Number(offsetValue) : null,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const result = await syncHomeScoreboardMatches(supabase, await getSyncOptions(request))

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[sync-home-matches] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron sincronizar partidos del Home.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
