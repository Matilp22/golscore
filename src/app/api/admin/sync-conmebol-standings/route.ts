import { NextResponse } from 'next/server'

import {
  getDefaultConmebolLeagueExternalId,
  parseConmebolCompetition,
  syncConmebolStandings,
} from '@/server/conmebol-bracket'

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
  if (value === null || value.trim() === '') return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const competition = parseConmebolCompetition(searchParams.get('competition'))

    if (!competition) {
      return jsonNoStore(
        { ok: false, error: 'competition debe ser libertadores o sudamericana.' },
        { status: 400 }
      )
    }

    const leagueExternalId =
      readNumber(searchParams.get('leagueExternalId')) ??
      getDefaultConmebolLeagueExternalId(competition)
    const result = await syncConmebolStandings({
      competition,
      leagueExternalId,
      season: readNumber(searchParams.get('season')) ?? 2026,
    })

    return jsonNoStore(result)
  } catch (error) {
    console.error('[sync-conmebol-standings] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudieron sincronizar standings Conmebol.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
