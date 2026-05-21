import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  auditMatchDetailCache,
  auditMatchDetailsGeneral,
} from '@/server/match-detail-cache'

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

function readStatuses(value: string | null) {
  return (value ?? '')
    .split(',')
    .map((status) => status.trim().toUpperCase())
    .filter(Boolean)
}

function readBoolean(value: string | null) {
  return ['1', 'true', 'yes', 'si', 'sí'].includes((value ?? '').trim().toLowerCase())
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const supabase = getSupabaseAdminClient()
    const fixtureExternalId = readNumber(searchParams.get('fixture'))
    const matchId = searchParams.get('matchId')

    if (fixtureExternalId || matchId) {
      const audit = await auditMatchDetailCache(supabase, {
        fixtureExternalId,
        matchId,
      })

      return jsonNoStore({
        ok: true,
        endpoint: 'match-detail-audit',
        mode: 'single',
        ...audit,
      })
    }

    const audit = await auditMatchDetailsGeneral(supabase, {
      limit: readNumber(searchParams.get('limit')),
      leagueExternalId: readNumber(searchParams.get('leagueExternalId')),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      statuses: readStatuses(searchParams.get('statuses')),
      missingOnly: readBoolean(searchParams.get('missingOnly')),
    })

    return jsonNoStore({
      ok: true,
      endpoint: 'match-detail-audit',
      mode: 'general',
      ...audit,
    })
  } catch (error) {
    console.error('[match-detail-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar el detalle del partido.',
      },
      { status: 500 }
    )
  }
}
