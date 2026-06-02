import { NextResponse } from 'next/server'

import { buildScorerRulesAudit } from '@/server/scorer-rules-audit'

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
  if (!value) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const audit = await buildScorerRulesAudit({
      leagueExternalId: url.searchParams.get('leagueExternalId'),
      season: readNumber(url.searchParams.get('season')),
      date: url.searchParams.get('date'),
      dateFrom: url.searchParams.get('dateFrom'),
      dateTo: url.searchParams.get('dateTo'),
      status: url.searchParams.get('status'),
      limit: readNumber(url.searchParams.get('limit')),
    })

    return jsonNoStore({
      endpoint: 'scorer-rules-audit',
      ...audit,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar reglas de goleadores.',
      },
      { status: 500 }
    )
  }
}
