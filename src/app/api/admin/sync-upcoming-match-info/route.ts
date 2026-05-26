import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { serializeError } from '@/server/match-detail-cache'
import { syncUpcomingMatchInfo } from '@/server/match-info-sync'

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

function readBoolean(value: string | null) {
  return ['1', 'true', 'yes', 'si'].includes((value ?? '').trim().toLowerCase())
}

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

async function readOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const get = (key: string) => {
    const fromQuery = searchParams.get(key)
    if (fromQuery !== null) return fromQuery
    const fromBody = body?.[key]

    if (typeof fromBody === 'string' || typeof fromBody === 'number') return String(fromBody)
    if (typeof fromBody === 'boolean') return fromBody ? 'true' : 'false'

    return null
  }

  return {
    date: get('date'),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
    leagueExternalId: readNumber(get('leagueExternalId')),
    futureDays: readNumber(get('futureDays')),
    limit: readNumber(get('limit')),
    force: readBoolean(get('force')),
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const result = await syncUpcomingMatchInfo(supabase, await readOptions(request))

    return jsonNoStore({
      endpoint: 'sync-upcoming-match-info',
      ...result,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[sync-upcoming-match-info] Error completo', serialized)

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

export async function POST(request: Request) {
  return GET(request)
}
