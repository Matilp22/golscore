import { NextResponse } from 'next/server'

import {
  createHeadToHeadCacheKey,
  resolveHeadToHeadTeams,
  syncHeadToHeadCache,
} from '@/server/head-to-head'

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
  return ['1', 'true', 'yes', 'si', 'sí'].includes((value ?? '').trim().toLowerCase())
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401, headers: JSON_HEADERS })
  }

  try {
    const { searchParams } = new URL(request.url)
    const resolved = await resolveHeadToHeadTeams({
      matchId: searchParams.get('matchId'),
      fixture: searchParams.get('fixture'),
      homeTeamExternalId: searchParams.get('homeTeamExternalId'),
      awayTeamExternalId: searchParams.get('awayTeamExternalId'),
    })

    if (!resolved) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No se pudo resolver el partido o los equipos.',
        },
        { status: 404, headers: JSON_HEADERS }
      )
    }

    const cacheKey =
      resolved.homeTeam.externalId && resolved.awayTeam.externalId
        ? createHeadToHeadCacheKey(resolved.homeTeam.externalId, resolved.awayTeam.externalId)
        : null
    const result = await syncHeadToHeadCache({
      resolved,
      force: readBoolean(searchParams.get('force')),
    })

    return NextResponse.json(
      {
        ok: result.ok,
        cacheHit: result.cacheHit,
        cacheKey: result.cacheKey ?? cacheKey,
        homeTeam: resolved.homeTeam,
        awayTeam: resolved.awayTeam,
        rawMatchesCount: result.rawMatchesCount,
        normalizedMatchesCount: result.normalizedMatchesCount,
        synced: result.synced,
        renderReadiness: result.viewModel.renderReadiness,
        summary: result.viewModel.summary,
        warnings: result.warnings,
        errors: result.errors,
      },
      { headers: JSON_HEADERS }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo sincronizar historial.',
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

