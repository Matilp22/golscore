import { NextResponse } from 'next/server'

import {
  auditHeadToHeadCache,
  createHeadToHeadCacheKey,
  createEmptyHeadToHeadViewModel,
  resolveHeadToHeadTeams,
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
          match: null,
          hasExternalIds: false,
          renderReadiness: 'render_blocked',
          warnings: ['match_not_found'],
          errors: [],
        },
        { status: 404, headers: JSON_HEADERS }
      )
    }

    const hasHomeExternalId = Boolean(resolved.homeTeam.externalId)
    const hasAwayExternalId = Boolean(resolved.awayTeam.externalId)
    const cacheKey =
      resolved.homeTeam.externalId && resolved.awayTeam.externalId
        ? createHeadToHeadCacheKey(resolved.homeTeam.externalId, resolved.awayTeam.externalId)
        : null
    const result = hasHomeExternalId && hasAwayExternalId
      ? await auditHeadToHeadCache(resolved)
      : {
          ok: false,
          cacheKey,
          cacheExists: false,
          rawMatchesCount: 0,
          normalizedMatchesCount: 0,
          viewModel: createEmptyHeadToHeadViewModel(
            hasHomeExternalId ? 'missing_away_external_id' : 'missing_home_external_id',
            { cacheKey }
          ),
          warnings: [],
          errors: [],
        }

    return NextResponse.json(
      {
        ok: true,
        match: resolved.match
          ? {
              id: resolved.match.id,
              fixtureExternalId: resolved.match.external_id,
              matchDate: resolved.match.match_date,
              status: resolved.match.status,
              league: resolved.league?.name ?? null,
            }
          : null,
        homeTeam: resolved.homeTeam,
        awayTeam: resolved.awayTeam,
        hasExternalIds: hasHomeExternalId && hasAwayExternalId,
        cacheKey,
        cacheExists: result.cacheExists || result.viewModel.cacheExists,
        cacheLastSyncedAt: result.viewModel.cacheLastSyncedAt,
        rawMatchesCount: result.rawMatchesCount,
        normalizedMatchesCount: result.normalizedMatchesCount,
        summary: result.viewModel.summary,
        renderReadiness: result.viewModel.renderReadiness === 'render_ready'
          ? 'render_ready'
          : 'render_blocked',
        reason: result.viewModel.renderReadiness,
        warnings: [...result.viewModel.warnings, ...result.warnings],
        errors: [...result.viewModel.errors, ...result.errors],
      },
      { headers: JSON_HEADERS }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar historial.',
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
