import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { cleanupBroadcastDefaults } from '@/server/broadcasts/admin'
import { serializeError } from '@/server/match-detail-cache'

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

function readBoolean(value: string | null, fallback = true) {
  if (value === null) return fallback

  return ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase())
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
    const supabase = getSupabaseAdminClient()
    const result = await cleanupBroadcastDefaults(supabase, {
      dryRun: readBoolean(searchParams.get('dryRun'), true),
      broadcasterName: searchParams.get('broadcasterName'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      leagueExternalId: searchParams.get('leagueExternalId'),
      limit: readNumber(searchParams.get('limit')),
    })

    return jsonNoStore({
      endpoint: 'cleanup-broadcast-defaults',
      ...result,
    })
  } catch (error) {
    const serialized = serializeError(error, 'supabase')
    console.error('[cleanup-broadcast-defaults] Error completo', serialized)

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
