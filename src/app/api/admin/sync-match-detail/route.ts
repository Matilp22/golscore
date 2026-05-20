import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncMatchDetail } from '@/server/match-detail-cache'

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
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)
  const token = bearerMatch?.[1] ?? request.headers.get('x-cron-secret')

  if (!isProduction && !cronSecret) return true

  return Boolean(cronSecret && token === cronSecret)
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
    const result = await syncMatchDetail(supabase, {
      fixtureExternalId: readNumber(searchParams.get('fixture')),
      matchId: searchParams.get('matchId'),
    })

    return jsonNoStore({
      ok: result.errors.length === 0,
      mode: 'match-detail',
      match: result.match,
      eventsBefore: result.before.eventsCount,
      eventsAfter: result.after.eventsCount,
      lineupsBefore:
        result.before.lineupsHomeCount +
        result.before.lineupsAwayCount +
        result.before.substitutesHomeCount +
        result.before.substitutesAwayCount,
      lineupsAfter:
        result.after.lineupsHomeCount +
        result.after.lineupsAwayCount +
        result.after.substitutesHomeCount +
        result.after.substitutesAwayCount,
      statisticsBefore: result.before.statisticsCount,
      statisticsAfter: result.after.statisticsCount,
      missingSections: result.after.missingSections,
      warnings: result.warnings,
      result,
    })
  } catch (error) {
    console.error('[sync-match-detail] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo sincronizar el detalle del partido.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
