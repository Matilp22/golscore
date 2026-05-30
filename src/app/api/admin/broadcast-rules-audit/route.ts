import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { auditBroadcastRules } from '@/server/broadcasts/admin'
import { serializeError } from '@/server/match-detail-cache'
import { addDaysToISO, getArgentinaDateISO } from '@/shared/utils/argentina-time'

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
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const today = getArgentinaDateISO()
    const date = searchParams.get('date')
    const futureDays = readNumber(searchParams.get('futureDays'))
    const dateFrom = date ?? searchParams.get('dateFrom') ?? today
    const dateTo =
      date ??
      searchParams.get('dateTo') ??
      (futureDays !== null ? addDaysToISO(dateFrom, futureDays) : dateFrom)
    const supabase = getSupabaseAdminClient()
    const result = await auditBroadcastRules(supabase, {
      dateFrom,
      dateTo,
      leagueExternalId: searchParams.get('leagueExternalId'),
      leagueName: searchParams.get('leagueName'),
      limit: readNumber(searchParams.get('limit')),
    })

    return jsonNoStore({
      endpoint: 'broadcast-rules-audit',
      ok: true,
      dateRange: {
        dateFrom,
        dateTo,
      },
      created: result.broadcastsCreated,
      updated: result.broadcastsUpdated,
      ...result,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[broadcast-rules-audit] Error completo', serialized)

    return jsonNoStore(
      {
        ok: false,
        error: serialized.message,
        code: serialized.code,
        detail: serialized.detail,
        hint: serialized.hint,
        source: serialized.source,
      },
      { status: 500 }
    )
  }
}
