import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createHeadToHeadCacheKey,
  syncHeadToHeadCache,
  type HeadToHeadResolvedTeams,
  type HeadToHeadTeam,
} from '@/server/head-to-head'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'
import { WORLD_CUP_EXTERNAL_ID } from '@/shared/utils/league-rounds'

type DbId = string | number

type WorldCupLeagueRow = {
  id: DbId
  name: string | null
  external_id: DbId | null
  season: number | null
}

type WorldCupMatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  round: string | number | null
  match_date: string | null
  status: string | null
  home_team_id: DbId | null
  away_team_id: DbId | null
}

type WorldCupTeamRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url: string | null
}

type HeadToHeadCacheRow = {
  cache_key: string
  last_synced_at: string | null
}

export type WorldCupHeadToHeadPair = {
  matchId: string
  fixtureExternalId: string | null
  leagueId: string | null
  round: string | null
  matchDate: string | null
  status: string | null
  cacheKey: string | null
  homeTeam: HeadToHeadTeam
  awayTeam: HeadToHeadTeam
  homeTeamInternalId: string | null
  awayTeamInternalId: string | null
  cacheExists: boolean
  cacheLastSyncedAt: string | null
  isStale: boolean
  hasExternalIds: boolean
}

type WorldCupHeadToHeadDataset = {
  ok: boolean
  league: WorldCupLeagueRow | null
  totalMatches: number
  matchesWithBothTeams: number
  uniquePairs: number
  cached: number
  missing: number
  stale: number
  ready: boolean
  pairs: WorldCupHeadToHeadPair[]
  warnings: string[]
}

type WorldCupHeadToHeadSyncOptions = {
  season?: number
  staleAfterHours?: number
  limit?: number
  force?: boolean
}

type WorldCupHeadToHeadSyncResult = WorldCupHeadToHeadDataset & {
  selected: number
  synced: number
  cacheHits: number
  failed: number
  results: Array<{
    cacheKey: string | null
    fixtureExternalId: string | null
    homeTeam: string
    awayTeam: string
    synced: boolean
    cacheHit: boolean
    rawMatchesCount: number
    normalizedMatchesCount: number
    renderReadiness: string
    warnings: string[]
    errors: string[]
  }>
  errors: string[]
}

const DEFAULT_WORLD_CUP_SEASON = 2026
const DEFAULT_STALE_AFTER_HOURS = 24
const DEFAULT_SYNC_LIMIT = 12
const MAX_SYNC_LIMIT = 100

function toNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function toStringOrNull(value: DbId | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  return String(value)
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_SYNC_LIMIT

  return Math.min(Math.max(Math.trunc(value), 1), MAX_SYNC_LIMIT)
}

function getTimestamp(value: string | null) {
  if (!value) return 0

  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function isCacheStale(lastSyncedAt: string | null, staleAfterHours: number) {
  if (!lastSyncedAt) return true
  if (staleAfterHours <= 0) return true

  const timestamp = getTimestamp(lastSyncedAt)
  if (!timestamp) return true

  return Date.now() - timestamp > staleAfterHours * 60 * 60 * 1000
}

function teamFromStored(row: WorldCupTeamRow | null | undefined, fallbackName: string): HeadToHeadTeam {
  const externalId = toNumber(row?.external_id)

  return {
    externalId,
    name: row?.name?.trim() || fallbackName,
    logoUrl: pickTeamLogoUrl(row?.logo_url, externalId),
  }
}

async function fetchWorldCupLeague(season: number) {
  const response = await getSupabaseAdminClient()
    .from('leagues')
    .select('id, name, external_id, season')
    .eq('external_id', String(WORLD_CUP_EXTERNAL_ID))
    .eq('season', season)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (response.error) throw response.error

  return response.data as WorldCupLeagueRow | null
}

async function fetchWorldCupMatches(leagueId: DbId) {
  const response = await getSupabaseAdminClient()
    .from('matches')
    .select('id, external_id, league_id, round, match_date, status, home_team_id, away_team_id')
    .eq('league_id', String(leagueId))
    .order('match_date', { ascending: true, nullsFirst: false })

  if (response.error) throw response.error

  return (response.data ?? []) as WorldCupMatchRow[]
}

async function fetchTeamsByIds(matches: WorldCupMatchRow[]) {
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is DbId => id !== null && id !== undefined)
        .map((id) => String(id))
    ),
  ]

  if (!teamIds.length) return new Map<string, WorldCupTeamRow>()

  const response = await getSupabaseAdminClient()
    .from('teams')
    .select('id, external_id, name, logo_url')
    .in('id', teamIds)

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as WorldCupTeamRow[]).map((team) => [String(team.id), team])
  )
}

async function fetchCacheRows(cacheKeys: string[]) {
  if (!cacheKeys.length) return new Map<string, HeadToHeadCacheRow>()

  const response = await getSupabaseAdminClient()
    .from('match_head_to_head_cache')
    .select('cache_key, last_synced_at')
    .in('cache_key', cacheKeys)

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as HeadToHeadCacheRow[]).map((row) => [row.cache_key, row])
  )
}

function getUniquePairs(
  matches: WorldCupMatchRow[],
  teamsById: Map<string, WorldCupTeamRow>
) {
  const pairsByCacheKey = new Map<string, WorldCupHeadToHeadPair>()
  let matchesWithBothTeams = 0

  matches.forEach((match) => {
    const homeTeamRow = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
    const awayTeamRow = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null

    if (homeTeamRow && awayTeamRow) {
      matchesWithBothTeams += 1
    }

    const homeTeam = teamFromStored(homeTeamRow, 'Local')
    const awayTeam = teamFromStored(awayTeamRow, 'Visitante')
    const hasExternalIds = Boolean(homeTeam.externalId && awayTeam.externalId)
    const cacheKey = hasExternalIds
      ? createHeadToHeadCacheKey(homeTeam.externalId as number, awayTeam.externalId as number)
      : null

    if (!cacheKey || pairsByCacheKey.has(cacheKey)) return

    pairsByCacheKey.set(cacheKey, {
      matchId: String(match.id),
      fixtureExternalId: toStringOrNull(match.external_id),
      leagueId: toStringOrNull(match.league_id),
      round: match.round === null || match.round === undefined ? null : String(match.round),
      matchDate: match.match_date,
      status: match.status,
      cacheKey,
      homeTeam,
      awayTeam,
      homeTeamInternalId: toStringOrNull(match.home_team_id),
      awayTeamInternalId: toStringOrNull(match.away_team_id),
      cacheExists: false,
      cacheLastSyncedAt: null,
      isStale: true,
      hasExternalIds,
    })
  })

  return {
    matchesWithBothTeams,
    pairs: [...pairsByCacheKey.values()],
  }
}

export async function getWorldCupHeadToHeadPairs({
  season = DEFAULT_WORLD_CUP_SEASON,
  staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
}: {
  season?: number
  staleAfterHours?: number
} = {}): Promise<WorldCupHeadToHeadDataset> {
  const league = await fetchWorldCupLeague(season)

  if (!league) {
    return {
      ok: false,
      league: null,
      totalMatches: 0,
      matchesWithBothTeams: 0,
      uniquePairs: 0,
      cached: 0,
      missing: 0,
      stale: 0,
      ready: false,
      pairs: [],
      warnings: ['world_cup_league_not_found'],
    }
  }

  const matches = await fetchWorldCupMatches(league.id)
  const teamsById = await fetchTeamsByIds(matches)
  const { matchesWithBothTeams, pairs } = getUniquePairs(matches, teamsById)
  const cacheRowsByKey = await fetchCacheRows(
    pairs
      .map((pair) => pair.cacheKey)
      .filter((cacheKey): cacheKey is string => Boolean(cacheKey))
  )
  const enrichedPairs = pairs.map((pair) => {
    const cacheRow = pair.cacheKey ? cacheRowsByKey.get(pair.cacheKey) : null
    const cacheLastSyncedAt = cacheRow?.last_synced_at ?? null
    const cacheExists = Boolean(cacheRow)

    return {
      ...pair,
      cacheExists,
      cacheLastSyncedAt,
      isStale: cacheExists ? isCacheStale(cacheLastSyncedAt, staleAfterHours) : true,
    }
  })
  const cached = enrichedPairs.filter((pair) => pair.cacheExists).length
  const missing = enrichedPairs.filter((pair) => !pair.cacheExists).length
  const stale = enrichedPairs.filter((pair) => pair.cacheExists && pair.isStale).length

  return {
    ok: true,
    league,
    totalMatches: matches.length,
    matchesWithBothTeams,
    uniquePairs: enrichedPairs.length,
    cached,
    missing,
    stale,
    ready: missing === 0 && stale === 0,
    pairs: enrichedPairs,
    warnings: [],
  }
}

export async function auditWorldCupHeadToHeadCache(options?: {
  season?: number
  staleAfterHours?: number
}) {
  return getWorldCupHeadToHeadPairs(options)
}

export async function syncWorldCupHeadToHeadCache({
  season = DEFAULT_WORLD_CUP_SEASON,
  staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
  limit,
  force = false,
}: WorldCupHeadToHeadSyncOptions = {}): Promise<WorldCupHeadToHeadSyncResult> {
  const audit = await getWorldCupHeadToHeadPairs({ season, staleAfterHours })

  if (!audit.ok || !audit.league) {
    return {
      ...audit,
      selected: 0,
      synced: 0,
      cacheHits: 0,
      failed: 0,
      results: [],
      errors: audit.warnings,
    }
  }

  const pairsToSync = audit.pairs
    .filter((pair) => force || !pair.cacheExists || pair.isStale)
    .slice(0, normalizeLimit(limit))
  const results: WorldCupHeadToHeadSyncResult['results'] = []
  const errors: string[] = []
  let synced = 0
  let cacheHits = 0
  let failed = 0

  for (const pair of pairsToSync) {
    const resolved: HeadToHeadResolvedTeams = {
      match: {
        id: pair.matchId,
        external_id: pair.fixtureExternalId,
        league_id: pair.leagueId,
        home_team_id: pair.homeTeamInternalId,
        away_team_id: pair.awayTeamInternalId,
        match_date: pair.matchDate,
        status: pair.status,
      },
      league: {
        id: audit.league.id,
        name: audit.league.name,
        season: audit.league.season,
      },
      homeTeam: pair.homeTeam,
      awayTeam: pair.awayTeam,
      homeTeamInternalId: pair.homeTeamInternalId,
      awayTeamInternalId: pair.awayTeamInternalId,
    }

    try {
      const result = await syncHeadToHeadCache({ resolved, force: true })

      if (result.synced) synced += 1
      if (result.cacheHit) cacheHits += 1

      results.push({
        cacheKey: result.cacheKey ?? pair.cacheKey,
        fixtureExternalId: pair.fixtureExternalId,
        homeTeam: pair.homeTeam.name,
        awayTeam: pair.awayTeam.name,
        synced: result.synced,
        cacheHit: result.cacheHit,
        rawMatchesCount: result.rawMatchesCount,
        normalizedMatchesCount: result.normalizedMatchesCount,
        renderReadiness: result.viewModel.renderReadiness,
        warnings: result.warnings,
        errors: result.errors,
      })
    } catch (error) {
      failed += 1

      const message = error instanceof Error ? error.message : 'No se pudo sincronizar historial.'
      const detail = `${pair.homeTeam.name} vs ${pair.awayTeam.name}: ${message}`

      errors.push(detail)
      results.push({
        cacheKey: pair.cacheKey,
        fixtureExternalId: pair.fixtureExternalId,
        homeTeam: pair.homeTeam.name,
        awayTeam: pair.awayTeam.name,
        synced: false,
        cacheHit: false,
        rawMatchesCount: 0,
        normalizedMatchesCount: 0,
        renderReadiness: 'error',
        warnings: [],
        errors: [message],
      })
    }
  }

  const afterSyncAudit = await getWorldCupHeadToHeadPairs({ season, staleAfterHours })

  return {
    ...afterSyncAudit,
    selected: pairsToSync.length,
    synced,
    cacheHits,
    failed,
    results,
    errors,
  }
}
