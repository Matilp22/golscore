import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncMatchHighlights, serializeHighlightError } from '@/server/match-highlights'
import { addDaysToISO, getArgentinaTodayISO } from '@/shared/utils/argentina-time'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const DEFAULT_LOOKBACK_DAYS = 3
const DEFAULT_LIMIT = 20

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

    console.warn('[cron-sync-match-highlights] Rechazado: CRON_SECRET no esta configurado.')
    return false
  }

  return getAuthorizationToken(request) === cronSecret
}

function readPositiveNumber(value: string | null, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback

  return Math.min(max, Math.floor(parsed))
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const lookbackDays = readPositiveNumber(searchParams.get('lookbackDays'), DEFAULT_LOOKBACK_DAYS, 14)
  const limit = readPositiveNumber(searchParams.get('limit'), DEFAULT_LIMIT, 50)
  const today = getArgentinaTodayISO()
  const dateFrom = searchParams.get('dateFrom') ?? addDaysToISO(today, -lookbackDays)
  const dateTo = searchParams.get('dateTo') ?? today

  try {
    const supabase = getSupabaseAdminClient()
    const result = await syncMatchHighlights(supabase, {
      dateFrom,
      dateTo,
      limit,
      force: false,
    })

    return jsonNoStore({
      ...result,
      automation: {
        dateFrom,
        dateTo,
        lookbackDays,
        limit,
        force: false,
      },
    })
  } catch (error) {
    const serialized = serializeHighlightError(error, 'unknown')

    console.error('[cron-sync-match-highlights] Error completo', serialized)

    return jsonNoStore(
      {
        ok: false,
        error: serialized.code,
        message: serialized.message,
        detail: serialized.detail,
        source: serialized.source,
        missingColumns: serialized.missingColumns,
      },
      { status: serialized.status ?? 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
