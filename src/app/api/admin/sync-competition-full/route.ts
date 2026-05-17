import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncCompetitionFull } from '@/server/prode/sync-matches'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction && !cronSecret) return true

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function readBoolean(value: string | null) {
  if (value === null) return undefined

  return value === '1' || value.toLowerCase() === 'true'
}

function readNumber(value: string | null) {
  if (value === null || value.trim() === '') return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const supabase = getSupabaseAdminClient()
    const result = await syncCompetitionFull(supabase, {
      competition: searchParams.get('competition'),
      leagueExternalId: searchParams.get('leagueExternalId'),
      season: readNumber(searchParams.get('season')),
      debug: readBoolean(searchParams.get('debug')) ?? false,
      limit: readNumber(searchParams.get('limit')),
      offset: readNumber(searchParams.get('offset') ?? searchParams.get('cursor')),
      syncEvents: readBoolean(searchParams.get('syncEvents')),
    })

    return jsonNoStore({
      ok: result.errors.length === 0,
      mode: 'competition-full',
      result,
    })
  } catch (error) {
    console.error('[sync-competition-full] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo sincronizar la competencia completa.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
