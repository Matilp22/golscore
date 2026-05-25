import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  auditMatchDetailCache,
  fetchMatchDetailProviderCounts,
  serializeError,
  type MatchDetailCounts,
  type MatchDetailRenderCounts,
  type MatchDetailRenderStatus,
} from '@/server/match-detail-cache'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'
import { isFinishedStatus, isLiveStatus, isUpcomingStatus } from '@/shared/utils/match-status'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  match_date: string | null
  status: string | null
  home_score?: number | null
  away_score?: number | null
}

type LeagueRow = {
  id: DbId
  external_id: DbId | null
  name?: string | null
}

type LeagueAuditBucket = {
  leagueExternalId: number | null
  leagueName: string | null
  matchesCount: number
  finishedCount: number
  liveCount: number
  futureCount: number
  withEvents: number
  withLineups: number
  withStatistics: number
  completeDetails: number
  partialDetails: number
  providerNoLineups: number
  providerNoStatistics: number
  syncProblems: number
  renderProblems: number
  usuallyHasLineups: boolean | null
  usuallyHasStatistics: boolean | null
  examples: Array<{
    matchId: DbId
    fixtureExternalId: number
    status: string | null
    dataStatus: string
    providerStatus: string
    renderStatus: MatchDetailRenderStatus
    dbCounts: MatchDetailCounts
    providerCounts: MatchDetailCounts | null
    renderCounts: MatchDetailRenderCounts
    warnings: string[]
  }>
}

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

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function emptyCounts(): MatchDetailCounts {
  return {
    events: 0,
    lineups: 0,
    statistics: 0,
  }
}

function emptyRenderCounts(): MatchDetailRenderCounts {
  return {
    timelineEvents: 0,
    formationPlayers: 0,
    statisticsRows: 0,
    startersCount: 0,
    substitutesCount: 0,
  }
}

function isStartedStatus(status: string | null) {
  return isLiveStatus(status) || isFinishedStatus(status)
}

function getDataStatus(match: MatchRow, dbCounts: MatchDetailCounts) {
  if (isUpcomingStatus(match.status) && !dbCounts.events && !dbCounts.lineups && !dbCounts.statistics) {
    return 'future-no-details-yet'
  }

  if (dbCounts.events > 0 && dbCounts.lineups > 0 && dbCounts.statistics > 0) return 'complete'
  if (dbCounts.events > 0 || dbCounts.lineups > 0 || dbCounts.statistics > 0) return 'partial'

  return 'missing'
}

function getProviderStatus(input: {
  match: MatchRow
  dbCounts: MatchDetailCounts
  providerCounts: MatchDetailCounts | null
  includeProvider: boolean
}) {
  const { match, dbCounts, providerCounts, includeProvider } = input
  if (!isStartedStatus(match.status)) return 'not-required-yet'
  if (!includeProvider) return 'not-checked'
  if (!providerCounts) return 'provider-error'

  const missingLineups = dbCounts.lineups === 0 && providerCounts.lineups === 0
  const missingStatistics = dbCounts.statistics === 0 && providerCounts.statistics === 0

  if (missingLineups && missingStatistics) return 'provider-no-detail-data'
  if (missingLineups) return 'provider-no-lineups'
  if (missingStatistics) return 'provider-no-statistics'
  if (providerCounts.lineups > 0 && dbCounts.lineups === 0) return 'sync-lineups-not-persisted'
  if (providerCounts.statistics > 0 && dbCounts.statistics === 0) return 'sync-statistics-not-persisted'

  return 'complete'
}

function getLeagueKey(match: MatchRow, league: LeagueRow | undefined) {
  return String(league?.external_id ?? match.league_id ?? 'unknown')
}

async function fetchMatches(input: {
  dateFrom: string | null
  dateTo: string | null
  leagueExternalId: number | null
  limit: number
}) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('matches')
    .select('id, external_id, league_id, match_date, status, home_score, away_score')
    .not('external_id', 'is', null)
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(input.limit)

  if (input.dateFrom) query = query.gte('match_date', input.dateFrom)
  if (input.dateTo) query = query.lte('match_date', input.dateTo)

  if (input.leagueExternalId) {
    const leagueResponse = await supabase
      .from('leagues')
      .select('id')
      .eq('external_id', String(input.leagueExternalId))

    if (leagueResponse.error) throw leagueResponse.error

    const ids = ((leagueResponse.data ?? []) as Array<{ id: DbId }>).map((league) => String(league.id))
    if (!ids.length) return []
    query = query.in('league_id', ids)
  }

  const response = await query
  if (response.error) throw response.error

  return (response.data ?? []) as MatchRow[]
}

async function fetchLeagues(matches: MatchRow[]) {
  const ids = [...new Set(matches.map((match) => match.league_id).filter(Boolean).map(String))]
  if (!ids.length) return new Map<string, LeagueRow>()

  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('leagues')
    .select('id, external_id, name')
    .in('id', ids)

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as LeagueRow[]).map((league) => [String(league.id), league])
  )
}

function shouldKeepLeague(bucket: LeagueAuditBucket, onlyProblems: boolean) {
  if (!onlyProblems) return true

  return (
    bucket.providerNoLineups > 0 ||
    bucket.providerNoStatistics > 0 ||
    bucket.syncProblems > 0 ||
    bucket.renderProblems > 0 ||
    bucket.partialDetails > 0
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const supabase = getSupabaseAdminClient()
    const range = readDateRange(searchParams)
    const includeProvider = readBoolean(searchParams.get('includeProvider'))
    const onlyProblems = readBoolean(searchParams.get('onlyProblems'))
    const limit = Math.min(Math.max(readNumber(searchParams.get('limit')) ?? 200, 1), 500)
    const leagueExternalId = readNumber(searchParams.get('leagueExternalId'))
    const matches = await fetchMatches({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      leagueExternalId,
      limit,
    })
    const leaguesById = await fetchLeagues(matches)
    const buckets = new Map<string, LeagueAuditBucket>()
    const warnings: string[] = []

    for (const match of matches) {
      const fixtureExternalId = toNumber(match.external_id)
      if (!fixtureExternalId) continue

      const league = match.league_id ? leaguesById.get(String(match.league_id)) : undefined
      const key = getLeagueKey(match, league)
      const bucket = buckets.get(key) ?? {
        leagueExternalId: toNumber(league?.external_id),
        leagueName: league?.name ?? null,
        matchesCount: 0,
        finishedCount: 0,
        liveCount: 0,
        futureCount: 0,
        withEvents: 0,
        withLineups: 0,
        withStatistics: 0,
        completeDetails: 0,
        partialDetails: 0,
        providerNoLineups: 0,
        providerNoStatistics: 0,
        syncProblems: 0,
        renderProblems: 0,
        usuallyHasLineups: null,
        usuallyHasStatistics: null,
        examples: [],
      }
      const audit = await auditMatchDetailCache(supabase, {
        fixtureExternalId,
        matchId: String(match.id),
      })
      const dbCounts = (audit as { dbCounts?: MatchDetailCounts }).dbCounts ?? emptyCounts()
      const renderCounts = (audit as { renderCounts?: MatchDetailRenderCounts }).renderCounts ?? emptyRenderCounts()
      const renderStatus =
        (audit as { renderStatus?: MatchDetailRenderStatus }).renderStatus ?? 'not-renderable'
      let providerCounts: MatchDetailCounts | null = null
      const providerShouldBeChecked =
        includeProvider &&
        isStartedStatus(match.status) &&
        (dbCounts.events === 0 || dbCounts.lineups === 0 || dbCounts.statistics === 0)

      if (providerShouldBeChecked) {
        try {
          providerCounts = await fetchMatchDetailProviderCounts(fixtureExternalId)
        } catch (error) {
          const serialized = serializeError(error, 'api-football')
          warnings.push(`No se pudo consultar provider para fixture ${fixtureExternalId}: ${serialized.message}`)
        }
      }

      const dataStatus = getDataStatus(match, dbCounts)
      const providerStatus = getProviderStatus({
        match,
        dbCounts,
        providerCounts,
        includeProvider,
      })
      const syncProblem =
        providerStatus === 'sync-lineups-not-persisted' ||
        providerStatus === 'sync-statistics-not-persisted'

      bucket.matchesCount += 1
      if (isFinishedStatus(match.status)) bucket.finishedCount += 1
      if (isLiveStatus(match.status)) bucket.liveCount += 1
      if (isUpcomingStatus(match.status)) bucket.futureCount += 1
      if (dbCounts.events > 0) bucket.withEvents += 1
      if (dbCounts.lineups > 0) bucket.withLineups += 1
      if (dbCounts.statistics > 0) bucket.withStatistics += 1
      if (dataStatus === 'complete') bucket.completeDetails += 1
      if (dataStatus === 'partial') bucket.partialDetails += 1
      if (providerStatus === 'provider-no-lineups' || providerStatus === 'provider-no-detail-data') {
        bucket.providerNoLineups += 1
      }
      if (providerStatus === 'provider-no-statistics' || providerStatus === 'provider-no-detail-data') {
        bucket.providerNoStatistics += 1
      }
      if (syncProblem) bucket.syncProblems += 1
      if (renderStatus === 'render-problem') bucket.renderProblems += 1

      if (
        bucket.examples.length < 8 &&
        (
          dataStatus !== 'complete' ||
          providerStatus !== 'complete' ||
          renderStatus === 'render-problem'
        )
      ) {
        bucket.examples.push({
          matchId: match.id,
          fixtureExternalId,
          status: match.status,
          dataStatus,
          providerStatus,
          renderStatus,
          dbCounts,
          providerCounts,
          renderCounts,
          warnings: [
            ...(audit.warnings ?? []),
            ...(
              renderStatus === 'render-problem'
                ? ['DB tiene datos que el mapper/render no puede preparar.']
                : []
            ),
          ],
        })
      }

      buckets.set(key, bucket)
    }

    const leagues = [...buckets.values()].map((bucket) => {
      const startedCount = Math.max(bucket.finishedCount + bucket.liveCount, 1)

      return {
        ...bucket,
        usuallyHasLineups:
          bucket.finishedCount + bucket.liveCount > 0
            ? bucket.withLineups / startedCount >= 0.5
            : null,
        usuallyHasStatistics:
          bucket.finishedCount + bucket.liveCount > 0
            ? bucket.withStatistics / startedCount >= 0.5
            : null,
      }
    }).filter((bucket) => shouldKeepLeague(bucket, onlyProblems))

    return jsonNoStore({
      ok: true,
      endpoint: 'match-details-league-audit',
      dateRange: {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      },
      filters: {
        leagueExternalId,
        onlyProblems,
        includeProvider,
        limit,
      },
      leagues,
      warnings,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-details-league-audit] Error completo', serialized)

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
