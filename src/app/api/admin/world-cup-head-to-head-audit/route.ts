import { NextResponse } from 'next/server'

import {
  auditWorldCupHeadToHeadCache,
  enrichWorldCupHeadToHeadWithInternationalResults,
  syncWorldCupHeadToHeadCache,
} from '@/server/world-cup-head-to-head'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
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
  if (!value) return undefined

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401, headers: JSON_HEADERS })
  }

  try {
    const { searchParams } = new URL(request.url)
    const options = {
      season: readNumber(searchParams.get('season')),
      staleAfterHours: readNumber(searchParams.get('staleAfterHours')),
      limit: readNumber(searchParams.get('limit')),
      force: readBoolean(searchParams.get('force')),
    }
    const result = readBoolean(searchParams.get('historical'))
      ? await enrichWorldCupHeadToHeadWithInternationalResults({
          season: options.season,
          staleAfterHours: options.staleAfterHours,
        })
      : readBoolean(searchParams.get('sync'))
        ? await syncWorldCupHeadToHeadCache(options)
        : await auditWorldCupHeadToHeadCache({
            season: options.season,
            staleAfterHours: options.staleAfterHours,
          })

    return NextResponse.json(result, { headers: JSON_HEADERS })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar historial del Mundial.',
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
