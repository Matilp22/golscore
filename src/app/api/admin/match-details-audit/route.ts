import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { auditMatchDetailsGeneral, serializeError } from '@/server/match-detail-cache'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'

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

function readBoolean(value: string | null) {
  return ['1', 'true', 'yes', 'si'].includes((value ?? '').trim().toLowerCase())
}

function readDateRange(searchParams: URLSearchParams) {
  const date = searchParams.get('date')
  if (date) {
    const range = getArgentinaDayUtcRange(date)
    return {
      dateFrom: range.startUtc,
      dateTo: range.endUtc,
    }
  }

  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  return {
    dateFrom: dateFrom ? getArgentinaDayUtcRange(dateFrom).startUtc : null,
    dateTo: dateTo ? getArgentinaDayUtcRange(dateTo).endUtc : null,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const supabase = getSupabaseAdminClient()
    const range = readDateRange(searchParams)
    const audit = await auditMatchDetailsGeneral(supabase, {
      limit: readNumber(searchParams.get('limit')),
      leagueExternalId: readNumber(searchParams.get('leagueExternalId')),
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      missingOnly: readBoolean(searchParams.get('onlyProblems')),
      includeProvider: readBoolean(searchParams.get('includeProvider')),
    })

    return jsonNoStore({
      ok: true,
      endpoint: 'match-details-audit',
      ...audit,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-details-audit] Error completo', serialized)

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
