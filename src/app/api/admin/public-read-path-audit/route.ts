import { NextResponse } from 'next/server'

import {
  getLeagueFixtures,
  getLeagueLeaders,
  getLeagueStandings,
  getMatchesByDate,
  readCachedHomeMatchesByDate,
  readCachedLeagueFixtures,
  readCachedLeagueLeaders,
  readCachedLeagueStandings,
  withGoalScorers,
} from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getFootballPublicReadMode } from '@/server/football-public-read-mode'
import { runWithFootballApiCallAudit } from '@/server/integrations/football-api-client'
import { buildMatchDetailViewModel } from '@/server/match-detail-view-model'
import { getAllowedProdeLeagueIds } from '@/server/prode/scope'
import { getWorldCupGroupStandings } from '@/server/prode/world-cup-groups'
import { getArgentinaTodayISO } from '@/shared/utils/argentina-time'
import { WORLD_CUP_EXTERNAL_ID } from '@/shared/utils/league-rounds'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type AuditRoute = 'home' | 'league' | 'match-detail' | 'prode'

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

  return Boolean(cronSecret && getAuthorizationToken(request) === cronSecret)
}

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function countStandingRows(groups: Array<{ rows: unknown[] }>) {
  return groups.reduce((sum, group) => sum + group.rows.length, 0)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function auditRead<T>(callback: () => Promise<T>) {
  const startedAt = Date.now()
  const audited = await runWithFootballApiCallAudit(async () => {
    try {
      return {
        value: await callback(),
        error: null as string | null,
      }
    } catch (error) {
      return {
        value: null as T | null,
        error: getErrorMessage(error),
      }
    }
  })

  return {
    value: audited.result.value,
    error: audited.result.error,
    providerCalls: audited.providerCalls,
    durationMs: Date.now() - startedAt,
  }
}

async function auditHome(searchParams: URLSearchParams) {
  const date = searchParams.get('date') || getArgentinaTodayISO()
  const mode = getFootballPublicReadMode('home')
  const loadMatches = mode === 'cache-only' ? readCachedHomeMatchesByDate : getMatchesByDate
  const read = await auditRead(async () => withGoalScorers(await loadMatches(date)))
  const matches = read.value ?? []

  return {
    ok: !read.error,
    route: 'home' as const,
    mode,
    sourceSummary: {
      matches: mode === 'cache-only' ? 'supabase/cache' : 'legacy-loader',
      extras: 'supabase',
    },
    timings: { totalMs: read.durationMs },
    counts: {
      matches: matches.length,
      goalEvents:
        matches.reduce((sum, match) => (
          sum +
          (match.goalScorers?.home.length ?? 0) +
          (match.goalScorers?.away.length ?? 0) +
          (match.goalScorers?.unassigned?.length ?? 0)
        ), 0),
      liveEvents: matches.reduce((sum, match) => sum + (match.liveEvents?.length ?? 0), 0),
      broadcasters: matches.reduce((sum, match) => sum + (match.broadcasters?.length ?? 0), 0),
    },
    providerCallsDuringRead: read.providerCalls.length,
    missingData: matches.length ? [] : ['matches'],
    syncRecommended: matches.length === 0,
    warnings: mode === 'cache-only' && read.providerCalls.length > 0
      ? ['cache-only route called API-Football']
      : [],
    errors: read.error ? [read.error] : [],
  }
}

async function auditLeague(searchParams: URLSearchParams) {
  const mode = getFootballPublicReadMode('league')
  const leagueExternalId = readNumber(searchParams.get('leagueExternalId'))
  const season = readNumber(searchParams.get('season')) ?? new Date().getUTCFullYear()

  if (!leagueExternalId) {
    return {
      ok: false,
      route: 'league' as const,
      mode,
      sourceSummary: {},
      timings: { totalMs: 0 },
      counts: {},
      providerCallsDuringRead: 0,
      missingData: ['leagueExternalId'],
      syncRecommended: false,
      warnings: [],
      errors: ['Informar leagueExternalId para auditar Liga.'],
    }
  }

  const loadFixtures = mode === 'cache-only' ? readCachedLeagueFixtures : getLeagueFixtures
  const loadStandings = mode === 'cache-only' ? readCachedLeagueStandings : getLeagueStandings
  const loadLeaders = mode === 'cache-only' ? readCachedLeagueLeaders : getLeagueLeaders
  const read = await auditRead(async () => {
    const [fixtures, standings, leaders] = await Promise.all([
      loadFixtures(leagueExternalId, season),
      loadStandings(leagueExternalId, season),
      loadLeaders(leagueExternalId, season),
    ])

    return { fixtures, standings, leaders }
  })
  const data = read.value

  return {
    ok: !read.error,
    route: 'league' as const,
    mode,
    sourceSummary: {
      fixtures: 'supabase/football_fixture_cache',
      standings: mode === 'cache-only' ? 'football_standings_cache' : 'legacy-cache-or-provider',
      leaders: 'match_events',
    },
    timings: { totalMs: read.durationMs },
    counts: {
      fixtures: data?.fixtures.length ?? 0,
      standingGroups: data?.standings.length ?? 0,
      standingRows: data ? countStandingRows(data.standings) : 0,
      scorers: data?.leaders.scorers.length ?? 0,
      assists: data?.leaders.assists.length ?? 0,
      yellowCards: data?.leaders.yellowCards.length ?? 0,
      redCards: data?.leaders.redCards.length ?? 0,
    },
    providerCallsDuringRead: read.providerCalls.length,
    missingData: [
      data && !data.fixtures.length ? 'fixtures' : null,
      data && !data.standings.length ? 'standings' : null,
    ].filter((item): item is string => Boolean(item)),
    syncRecommended: Boolean(data && (!data.fixtures.length || !data.standings.length)),
    warnings: mode === 'cache-only' && read.providerCalls.length > 0
      ? ['cache-only route called API-Football']
      : [],
    errors: read.error ? [read.error] : [],
  }
}

async function auditMatchDetail(searchParams: URLSearchParams) {
  const mode = getFootballPublicReadMode('match-detail')
  const fixture = readNumber(searchParams.get('fixture'))

  if (!fixture) {
    return {
      ok: false,
      route: 'match-detail' as const,
      mode,
      sourceSummary: {},
      timings: { totalMs: 0 },
      counts: {},
      providerCallsDuringRead: 0,
      missingData: ['fixture'],
      syncRecommended: false,
      warnings: [],
      errors: ['Informar fixture para auditar Detalle de Partido.'],
    }
  }

  const read = await auditRead(async () =>
    buildMatchDetailViewModel({
      fixtureExternalId: fixture,
      matchId: fixture,
    })
  )
  const data = read.value

  return {
    ok: !read.error && Boolean(data?.fixture),
    route: 'match-detail' as const,
    mode,
    sourceSummary: {
      fixture: data?.fixture ? data.dataSource : 'missing',
      detail: 'matches/football_match_detail_cache/football_fixture_cache/match_events',
    },
    timings: { totalMs: read.durationMs },
    counts: {
      timelineEvents: data?.renderCounts.timelineEvents ?? 0,
      formationPlayers: data?.renderCounts.formationPlayers ?? 0,
      statisticsRows: data?.renderCounts.statisticsRows ?? 0,
      starters: data?.renderCounts.startersCount ?? 0,
      substitutes: data?.renderCounts.substitutesCount ?? 0,
    },
    providerCallsDuringRead: read.providerCalls.length,
    missingData: data?.missingSections ?? ['fixture'],
    syncRecommended: data?.syncRecommended ?? true,
    warnings: [
      ...(data?.warnings ?? []),
      mode === 'cache-only' && read.providerCalls.length > 0
        ? 'cache-only route called API-Football'
        : null,
    ].filter((warning): warning is string => Boolean(warning)),
    errors: [...(read.error ? [read.error] : []), ...(data?.errors ?? [])],
  }
}

async function auditProde() {
  const mode = getFootballPublicReadMode('prode')
  const read = await auditRead(async () => {
    const supabase = getSupabaseAdminClient()
    const allowedLeagueIds = await getAllowedProdeLeagueIds(supabase)
    const matchesResponse = allowedLeagueIds.length
      ? await supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .in('league_id', allowedLeagueIds)
      : { count: 0, error: null }

    if (matchesResponse.error) throw matchesResponse.error

    const groups = await getWorldCupGroupStandings(2026, {
      includeOfficialFallback: mode !== 'cache-only',
    })

    return {
      allowedLeagues: allowedLeagueIds.length,
      matches: matchesResponse.count ?? 0,
      groups,
    }
  })
  const data = read.value

  return {
    ok: !read.error,
    route: 'prode' as const,
    mode,
    sourceSummary: {
      matches: 'supabase',
      worldCupGroups:
        mode === 'cache-only'
          ? 'football_standings_cache'
          : 'football_standings_cache-or-legacy-fallback',
      worldCupExternalId: WORLD_CUP_EXTERNAL_ID,
    },
    timings: { totalMs: read.durationMs },
    counts: {
      allowedLeagues: data?.allowedLeagues ?? 0,
      matches: data?.matches ?? 0,
      worldCupGroups: data?.groups.length ?? 0,
      worldCupStandingRows: data ? data.groups.reduce((sum, group) => sum + group.rows.length, 0) : 0,
    },
    providerCallsDuringRead: read.providerCalls.length,
    missingData: data && !data.groups.length ? ['worldCupGroups'] : [],
    syncRecommended: Boolean(data && !data.groups.length),
    warnings: mode === 'cache-only' && read.providerCalls.length > 0
      ? ['cache-only route called API-Football']
      : [],
    errors: read.error ? [read.error] : [],
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const route = searchParams.get('route') as AuditRoute | null

  if (route === 'home') return jsonNoStore(await auditHome(searchParams))
  if (route === 'league') return jsonNoStore(await auditLeague(searchParams))
  if (route === 'match-detail') return jsonNoStore(await auditMatchDetail(searchParams))
  if (route === 'prode') return jsonNoStore(await auditProde())

  return jsonNoStore(
    {
      ok: false,
      error: 'invalid_route',
      message: 'route debe ser home, league, match-detail o prode.',
    },
    { status: 400 }
  )
}
