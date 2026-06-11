import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createHeadToHeadCacheKey,
  syncHeadToHeadCache,
  type HeadToHeadResolvedTeams,
  type HeadToHeadTeam,
} from '@/server/head-to-head'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'

type DbId = string | number

type CompetitionLeagueRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  season: number | null
}

type CompetitionMatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  round: string | number | null
  match_date: string | null
  status: string | null
  home_team_id: DbId | null
  away_team_id: DbId | null
}

type CompetitionTeamRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url: string | null
}

type HeadToHeadCacheRow = {
  cache_key: string
  last_synced_at: string | null
}

export type CompetitionHeadToHeadPair = {
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

export type CompetitionHeadToHeadDataset = {
  ok: boolean
  leagueExternalId: string
  requestedSeason: number | null
  leagues: CompetitionLeagueRow[]
  totalMatches: number
  matchesWithBothTeams: number
  uniquePairs: number
  cached: number
  missing: number
  stale: number
  ready: boolean
  pairs: CompetitionHeadToHeadPair[]
  warnings: string[]
}

type CompetitionHeadToHeadSyncOptions = {
  leagueExternalId: string | number
  season?: number
  staleAfterHours?: number
  limit?: number
  force?: boolean
}

export type CompetitionHeadToHeadSyncResult = CompetitionHeadToHeadDataset & {
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

const DEFAULT_STALE_AFTER_HOURS = 24 * 7
const DEFAULT_SYNC_LIMIT = 10
const MAX_SYNC_LIMIT = 80
const PAGE_SIZE = 1000

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

function teamFromStored(row: CompetitionTeamRow | null | undefined, fallbackName: string): HeadToHeadTeam {
  const externalId = toNumber(row?.external_id)

  return {
    externalId,
    name: row?.name?.trim() || fallbackName,
    logoUrl: pickTeamLogoUrl(row?.logo_url, externalId),
  }
}

async function fetchAllByRange<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
) {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const response = await makeQuery(from, to)

    if (response.error) throw response.error

    const page = (response.data ?? []) as T[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) break
  }

  return rows
}

async function fetchCompetitionLeagues(leagueExternalId: string | number, season?: number) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('external_id', String(leagueExternalId))
    .order('season', { ascending: false })
    .order('id', { ascending: true })

  if (season) query = query.eq('season', season)

  const response = await query

  if (response.error) throw response.error

  const leagues = (response.data ?? []) as CompetitionLeagueRow[]

  if (leagues.length || !season) return leagues

  const fallback = await supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('external_id', String(leagueExternalId))
    .order('season', { ascending: false })
    .order('id', { ascending: true })

  if (fallback.error) throw fallback.error

  const fallbackLeagues = (fallback.data ?? []) as CompetitionLeagueRow[]
  const latestSeason = fallbackLeagues[0]?.season ?? null

  return latestSeason === null
    ? fallbackLeagues
    : fallbackLeagues.filter((league) => league.season === latestSeason)
}

async function fetchCompetitionMatches(leagueIds: string[]) {
  const matches: CompetitionMatchRow[] = []

  for (let index = 0; index < leagueIds.length; index += 50) {
    const chunk = leagueIds.slice(index, index + 50)
    const chunkMatches = await fetchAllByRange<CompetitionMatchRow>((from, to) =>
      getSupabaseAdminClient()
        .from('matches')
        .select('id, external_id, league_id, round, match_date, status, home_team_id, away_team_id')
        .in('league_id', chunk)
        .order('match_date', { ascending: true, nullsFirst: false })
        .range(from, to)
    )

    matches.push(...chunkMatches)
  }

  return matches
}

async function fetchTeamsByIds(matches: CompetitionMatchRow[]) {
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is DbId => id !== null && id !== undefined)
        .map(String)
    ),
  ]

  if (!teamIds.length) return new Map<string, CompetitionTeamRow>()

  const teams: CompetitionTeamRow[] = []

  for (let index = 0; index < teamIds.length; index += 100) {
    const chunk = teamIds.slice(index, index + 100)
    const chunkTeams = await fetchAllByRange<CompetitionTeamRow>((from, to) =>
      getSupabaseAdminClient()
        .from('teams')
        .select('id, external_id, name, logo_url')
        .in('id', chunk)
        .range(from, to)
    )

    teams.push(...chunkTeams)
  }

  return new Map(teams.map((team) => [String(team.id), team]))
}

async function fetchCacheRows(cacheKeys: string[]) {
  if (!cacheKeys.length) return new Map<string, HeadToHeadCacheRow>()

  const rows: HeadToHeadCacheRow[] = []

  for (let index = 0; index < cacheKeys.length; index += 100) {
    const chunk = cacheKeys.slice(index, index + 100)
    const response = await getSupabaseAdminClient()
      .from('match_head_to_head_cache')
      .select('cache_key, last_synced_at')
      .in('cache_key', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as HeadToHeadCacheRow[]))
  }

  return new Map(rows.map((row) => [row.cache_key, row]))
}

function getUniquePairs(
  matches: CompetitionMatchRow[],
  teamsById: Map<string, CompetitionTeamRow>
) {
  const pairsByCacheKey = new Map<string, CompetitionHeadToHeadPair>()
  let matchesWithBothTeams = 0

  for (const match of matches) {
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

    if (!cacheKey) continue

    const existingPair = pairsByCacheKey.get(cacheKey)
    if (
      existingPair &&
      getTimestamp(existingPair.matchDate) >= getTimestamp(match.match_date)
    ) {
      continue
    }

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
  }

  return {
    matchesWithBothTeams,
    pairs: [...pairsByCacheKey.values()]
      .sort((a, b) => getTimestamp(b.matchDate) - getTimestamp(a.matchDate)),
  }
}

export async function getCompetitionHeadToHeadPairs({
  leagueExternalId,
  season,
  staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
}: {
  leagueExternalId: string | number
  season?: number
  staleAfterHours?: number
}): Promise<CompetitionHeadToHeadDataset> {
  const leagues = await fetchCompetitionLeagues(leagueExternalId, season)
  const leagueIds = leagues.map((league) => String(league.id))

  if (!leagueIds.length) {
    return {
      ok: false,
      leagueExternalId: String(leagueExternalId),
      requestedSeason: season ?? null,
      leagues: [],
      totalMatches: 0,
      matchesWithBothTeams: 0,
      uniquePairs: 0,
      cached: 0,
      missing: 0,
      stale: 0,
      ready: false,
      pairs: [],
      warnings: ['competition_league_not_found'],
    }
  }

  const matches = await fetchCompetitionMatches(leagueIds)
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
    leagueExternalId: String(leagueExternalId),
    requestedSeason: season ?? null,
    leagues,
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

export async function syncCompetitionHeadToHeadCache({
  leagueExternalId,
  season,
  staleAfterHours = DEFAULT_STALE_AFTER_HOURS,
  limit,
  force = false,
}: CompetitionHeadToHeadSyncOptions): Promise<CompetitionHeadToHeadSyncResult> {
  const audit = await getCompetitionHeadToHeadPairs({
    leagueExternalId,
    season,
    staleAfterHours,
  })

  if (!audit.ok) {
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

  const leagueById = new Map(audit.leagues.map((league) => [String(league.id), league]))
  const pairsToSync = audit.pairs
    .filter((pair) => force || !pair.cacheExists || pair.isStale)
    .slice(0, normalizeLimit(limit))
  const results: CompetitionHeadToHeadSyncResult['results'] = []
  const errors: string[] = []
  let synced = 0
  let cacheHits = 0
  let failed = 0

  for (const pair of pairsToSync) {
    const league = pair.leagueId ? leagueById.get(pair.leagueId) : null
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
      league: league
        ? {
            id: league.id,
            name: league.name,
            season: league.season,
          }
        : null,
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

  const afterSyncAudit = await getCompetitionHeadToHeadPairs({
    leagueExternalId,
    season,
    staleAfterHours,
  })

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
