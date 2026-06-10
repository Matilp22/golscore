import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { MatchFixture } from '@/lib/api-football'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'
import { isFinishedStatus } from '@/shared/utils/match-status'
import {
  getCompetitionStageDisplayLabel,
  normalizeCompetitionDisplayName,
} from '@/shared/utils/competition-display'

type DbId = string | number

type StoredMatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  match_date: string | null
  status: string | null
}

type StoredTeamRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url: string | null
}

type StoredLeagueRow = {
  id: DbId
  name: string | null
  season: number | null
}

type HeadToHeadCacheRow = {
  cache_key: string
  team_a_external_id: string
  team_b_external_id: string
  payload: unknown
  normalized_payload: unknown
  last_synced_at: string | null
}

type HeadToHeadApiFixture = {
  fixture?: {
    id?: number | string | null
    date?: string | null
    status?: {
      short?: string | null
      long?: string | null
    } | null
  } | null
  league?: {
    name?: string | null
    season?: number | string | null
    round?: string | null
  } | null
  teams?: {
    home?: {
      id?: number | string | null
      name?: string | null
      logo?: string | null
    } | null
    away?: {
      id?: number | string | null
      name?: string | null
      logo?: string | null
    } | null
  } | null
  goals?: {
    home?: number | string | null
    away?: number | string | null
  } | null
  score?: {
    penalty?: {
      home?: number | string | null
      away?: number | string | null
    } | null
  } | null
}

type HeadToHeadApiTeam = {
  id?: number | string | null
  name?: string | null
  logo?: string | null
} | null | undefined

type CurrentHeadToHeadMatch = {
  fixtureExternalId?: string | number | null
  date?: string | null
} | null

export type HeadToHeadTeam = {
  externalId: number | null
  name: string
  logoUrl: string | null
}

export type HeadToHeadMatchItem = {
  fixtureExternalId: string | null
  date: string | null
  leagueName: string
  stageLabel: string
  season: number | null
  homeTeam: HeadToHeadTeam
  awayTeam: HeadToHeadTeam
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore: number | null
  awayPenaltyScore: number | null
  scoreLabel: string
  status: string | null
  winnerTeamExternalId: number | null
}

export type HeadToHeadViewModel = {
  cacheKey: string | null
  cacheExists: boolean
  cacheLastSyncedAt: string | null
  summary: {
    total: number
    homePerspectiveWins: number
    awayPerspectiveWins: number
    draws: number
    homePerspectiveGoals: number
    awayPerspectiveGoals: number
  }
  matches: HeadToHeadMatchItem[]
  renderReadiness: 'render_ready' | 'missing_home_external_id' | 'missing_away_external_id' | 'cache_empty' | 'provider_no_h2h' | 'mapper_empty'
  warnings: string[]
  errors: string[]
}

export type HeadToHeadResolvedTeams = {
  match: StoredMatchRow | null
  league: StoredLeagueRow | null
  homeTeam: HeadToHeadTeam
  awayTeam: HeadToHeadTeam
  homeTeamInternalId: string | null
  awayTeamInternalId: string | null
}

export function createEmptyHeadToHeadViewModel(
  renderReadiness: HeadToHeadViewModel['renderReadiness'],
  options: Partial<Pick<HeadToHeadViewModel, 'cacheKey' | 'cacheExists' | 'cacheLastSyncedAt' | 'warnings' | 'errors'>> = {}
): HeadToHeadViewModel {
  return {
    cacheKey: options.cacheKey ?? null,
    cacheExists: options.cacheExists ?? false,
    cacheLastSyncedAt: options.cacheLastSyncedAt ?? null,
    summary: {
      total: 0,
      homePerspectiveWins: 0,
      awayPerspectiveWins: 0,
      draws: 0,
      homePerspectiveGoals: 0,
      awayPerspectiveGoals: 0,
    },
    matches: [],
    renderReadiness,
    warnings: options.warnings ?? [],
    errors: options.errors ?? [],
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function compareExternalIds(a: string, b: string) {
  const numberA = Number(a)
  const numberB = Number(b)

  if (Number.isFinite(numberA) && Number.isFinite(numberB)) return numberA - numberB

  return a.localeCompare(b, 'es-AR', { numeric: true })
}

export function createHeadToHeadCacheKey(
  homeTeamExternalId: string | number,
  awayTeamExternalId: string | number
) {
  const [first, second] = [String(homeTeamExternalId), String(awayTeamExternalId)]
    .sort(compareExternalIds)

  return `h2h:${first}:${second}`
}

function getRawFixturesFromPayload(payload: unknown): HeadToHeadApiFixture[] {
  if (Array.isArray(payload)) return payload as HeadToHeadApiFixture[]
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  const response = record.response
  const rawFixtures = record.rawFixtures

  if (Array.isArray(response)) return response as HeadToHeadApiFixture[]
  if (Array.isArray(rawFixtures)) return rawFixtures as HeadToHeadApiFixture[]

  return []
}

function getFixtureDateTimestamp(date: string | null) {
  if (!date) return 0

  const timestamp = new Date(date).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function getTeam(input: HeadToHeadApiTeam, fallbackName: string): HeadToHeadTeam {
  const row = (input ?? {}) as {
    id?: number | string | null
    name?: string | null
    logo?: string | null
  }
  const externalId = toNumber(row.id)

  return {
    externalId,
    name: row.name?.trim() || fallbackName,
    logoUrl: pickTeamLogoUrl(row.logo, externalId),
  }
}

function getWinnerTeamExternalId(match: HeadToHeadApiFixture) {
  const homeId = toNumber(match.teams?.home?.id)
  const awayId = toNumber(match.teams?.away?.id)
  const goalsHome = toNumber(match.goals?.home)
  const goalsAway = toNumber(match.goals?.away)

  if (goalsHome !== null && goalsAway !== null && goalsHome !== goalsAway) {
    return goalsHome > goalsAway ? homeId : awayId
  }

  const homePenalty = toNumber(match.score?.penalty?.home)
  const awayPenalty = toNumber(match.score?.penalty?.away)

  if (homePenalty !== null && awayPenalty !== null && homePenalty !== awayPenalty) {
    return homePenalty > awayPenalty ? homeId : awayId
  }

  return null
}

function isSameTeam(candidate: HeadToHeadTeam, target: HeadToHeadTeam) {
  if (candidate.externalId && target.externalId) {
    return candidate.externalId === target.externalId
  }

  return Boolean(normalizeText(candidate.name) && normalizeText(candidate.name) === normalizeText(target.name))
}

function mapHeadToHeadFixture(match: HeadToHeadApiFixture): HeadToHeadMatchItem {
  const homeTeam = getTeam(match.teams?.home, 'Local')
  const awayTeam = getTeam(match.teams?.away, 'Visitante')
  const goalsHome = toNumber(match.goals?.home)
  const goalsAway = toNumber(match.goals?.away)
  const homePenaltyScore = toNumber(match.score?.penalty?.home)
  const awayPenaltyScore = toNumber(match.score?.penalty?.away)
  const rawLeagueName = match.league?.name ?? null

  return {
    fixtureExternalId:
      match.fixture?.id === null || match.fixture?.id === undefined
        ? null
        : String(match.fixture.id),
    date: match.fixture?.date ?? null,
    leagueName: normalizeCompetitionDisplayName(rawLeagueName),
    stageLabel: getCompetitionStageDisplayLabel(rawLeagueName, match.league?.round),
    season: toNumber(match.league?.season),
    homeTeam,
    awayTeam,
    homeLogoUrl: homeTeam.logoUrl,
    awayLogoUrl: awayTeam.logoUrl,
    goalsHome,
    goalsAway,
    homePenaltyScore,
    awayPenaltyScore,
    scoreLabel: formatMatchScoreWithPenalties({
      goalsHome,
      goalsAway,
      homePenaltyScore,
      awayPenaltyScore,
    }),
    status: match.fixture?.status?.short ?? match.fixture?.status?.long ?? null,
    winnerTeamExternalId: getWinnerTeamExternalId(match),
  }
}

function hasHeadToHeadResult(match: HeadToHeadMatchItem) {
  return (
    (match.goalsHome !== null && match.goalsAway !== null) ||
    (match.homePenaltyScore !== null && match.awayPenaltyScore !== null)
  )
}

function isPreviousHeadToHeadMatch(
  match: HeadToHeadMatchItem,
  currentMatch: CurrentHeadToHeadMatch
) {
  const currentFixtureId =
    currentMatch?.fixtureExternalId === null || currentMatch?.fixtureExternalId === undefined
      ? null
      : String(currentMatch.fixtureExternalId)

  if (currentFixtureId && match.fixtureExternalId === currentFixtureId) return false
  if (!isFinishedStatus(match.status) && !hasHeadToHeadResult(match)) return false

  const currentTimestamp = getFixtureDateTimestamp(currentMatch?.date ?? null)
  if (!currentTimestamp) return true

  const matchTimestamp = getFixtureDateTimestamp(match.date)

  return Boolean(matchTimestamp && matchTimestamp < currentTimestamp)
}

export function buildHeadToHeadViewModel({
  currentMatch,
  rawFixtures,
  perspectiveHomeTeam,
  perspectiveAwayTeam,
  cacheKey = null,
  cacheExists = false,
  cacheLastSyncedAt = null,
  warnings = [],
  errors = [],
}: {
  currentMatch?: CurrentHeadToHeadMatch
  rawFixtures: unknown
  perspectiveHomeTeam: HeadToHeadTeam
  perspectiveAwayTeam: HeadToHeadTeam
  cacheKey?: string | null
  cacheExists?: boolean
  cacheLastSyncedAt?: string | null
  warnings?: string[]
  errors?: string[]
}): HeadToHeadViewModel {
  const rawMatches = getRawFixturesFromPayload(rawFixtures)
  const matches = rawMatches
    .map(mapHeadToHeadFixture)
    .filter((match) => isPreviousHeadToHeadMatch(match, currentMatch ?? null))
    .sort((a, b) => getFixtureDateTimestamp(b.date) - getFixtureDateTimestamp(a.date))

  if (!rawMatches.length) {
    return createEmptyHeadToHeadViewModel('provider_no_h2h', {
      cacheKey,
      cacheExists,
      cacheLastSyncedAt,
      warnings,
      errors,
    })
  }

  if (!matches.length) {
    return createEmptyHeadToHeadViewModel('mapper_empty', {
      cacheKey,
      cacheExists,
      cacheLastSyncedAt,
      warnings,
      errors,
    })
  }

  const summary = matches.reduce(
    (accumulator, match) => {
      const matchHomeIsPerspectiveHome = isSameTeam(match.homeTeam, perspectiveHomeTeam)
      const perspectiveHomeGoals = matchHomeIsPerspectiveHome ? match.goalsHome : match.goalsAway
      const perspectiveAwayGoals = matchHomeIsPerspectiveHome ? match.goalsAway : match.goalsHome

      accumulator.total += 1
      accumulator.homePerspectiveGoals += perspectiveHomeGoals ?? 0
      accumulator.awayPerspectiveGoals += perspectiveAwayGoals ?? 0

      if (!match.winnerTeamExternalId) {
        accumulator.draws += 1
      } else if (match.winnerTeamExternalId === perspectiveHomeTeam.externalId) {
        accumulator.homePerspectiveWins += 1
      } else if (match.winnerTeamExternalId === perspectiveAwayTeam.externalId) {
        accumulator.awayPerspectiveWins += 1
      } else {
        accumulator.draws += 1
      }

      return accumulator
    },
    {
      total: 0,
      homePerspectiveWins: 0,
      awayPerspectiveWins: 0,
      draws: 0,
      homePerspectiveGoals: 0,
      awayPerspectiveGoals: 0,
    }
  )

  return {
    cacheKey,
    cacheExists,
    cacheLastSyncedAt,
    summary,
    matches,
    renderReadiness: 'render_ready',
    warnings,
    errors,
  }
}

function isMissingCacheTable(error: { code?: string; message?: string } | null) {
  if (!error) return false

  const message = error.message?.toLowerCase() ?? ''

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('match_head_to_head_cache') ||
    message.includes('schema cache')
  )
}

async function readHeadToHeadCache(cacheKey: string) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('match_head_to_head_cache')
    .select('cache_key, team_a_external_id, team_b_external_id, payload, normalized_payload, last_synced_at')
    .eq('cache_key', cacheKey)
    .maybeSingle()

  if (response.error) {
    if (isMissingCacheTable(response.error)) {
      return {
        row: null,
        warning: 'missing_cache_table',
        error: null,
      }
    }

    return {
      row: null,
      warning: null,
      error: response.error,
    }
  }

  return {
    row: response.data as HeadToHeadCacheRow | null,
    warning: null,
    error: null,
  }
}

function getFixturePerspectiveTeam(team: MatchFixture['teams']['home'], fallbackName: string): HeadToHeadTeam {
  return {
    externalId: toNumber(team.id),
    name: team.name?.trim() || fallbackName,
    logoUrl: pickTeamLogoUrl(team.logo ?? team.logo_url ?? team.logoUrl, team.id ?? null),
  }
}

export async function getCachedHeadToHeadForFixture(
  fixture: MatchFixture
): Promise<HeadToHeadViewModel> {
  const homeTeam = getFixturePerspectiveTeam(fixture.teams.home, 'Local')
  const awayTeam = getFixturePerspectiveTeam(fixture.teams.away, 'Visitante')

  if (!homeTeam.externalId) return createEmptyHeadToHeadViewModel('missing_home_external_id')
  if (!awayTeam.externalId) return createEmptyHeadToHeadViewModel('missing_away_external_id')

  const cacheKey = createHeadToHeadCacheKey(homeTeam.externalId, awayTeam.externalId)
  const cache = await readHeadToHeadCache(cacheKey)

  if (cache.error) {
    return createEmptyHeadToHeadViewModel('cache_empty', {
      cacheKey,
      errors: [cache.error.message],
    })
  }

  if (!cache.row) {
    return createEmptyHeadToHeadViewModel('cache_empty', {
      cacheKey,
      warnings: cache.warning ? [cache.warning] : [],
    })
  }

  return buildHeadToHeadViewModel({
    currentMatch: {
      fixtureExternalId: fixture.fixture.id,
      date: fixture.fixture.date ?? null,
    },
    rawFixtures: cache.row.payload,
    perspectiveHomeTeam: homeTeam,
    perspectiveAwayTeam: awayTeam,
    cacheKey,
    cacheExists: true,
    cacheLastSyncedAt: cache.row.last_synced_at,
  })
}

async function fetchTeamsByInternalIds(teamIds: DbId[]) {
  if (!teamIds.length) return new Map<string, StoredTeamRow>()

  const response = await getSupabaseAdminClient()
    .from('teams')
    .select('id, external_id, name, logo_url')
    .in('id', teamIds.map((id) => String(id)))

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as StoredTeamRow[]).map((team) => [String(team.id), team])
  )
}

async function fetchLeagueById(leagueId: DbId | null) {
  if (leagueId === null || leagueId === undefined) return null

  const response = await getSupabaseAdminClient()
    .from('leagues')
    .select('id, name, season')
    .eq('id', String(leagueId))
    .maybeSingle()

  if (response.error) throw response.error

  return response.data as StoredLeagueRow | null
}

function teamFromStored(row: StoredTeamRow | null | undefined, fallbackName: string): HeadToHeadTeam {
  const externalId = toNumber(row?.external_id)

  return {
    externalId,
    name: row?.name?.trim() || fallbackName,
    logoUrl: pickTeamLogoUrl(row?.logo_url, externalId),
  }
}

async function findMatchByIdOrFixture(input: {
  matchId?: string | null
  fixture?: string | null
}) {
  const supabase = getSupabaseAdminClient()

  if (input.fixture) {
    const response = await supabase
      .from('matches')
      .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
      .eq('external_id', input.fixture)
      .maybeSingle()

    if (response.error) throw response.error
    if (response.data) return response.data as StoredMatchRow
  }

  if (!input.matchId) return null

  const byId = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
    .eq('id', input.matchId)
    .maybeSingle()

  if (byId.error && !String(byId.error.message).toLowerCase().includes('invalid input syntax')) {
    throw byId.error
  }

  if (byId.data) return byId.data as StoredMatchRow

  const byExternalId = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status')
    .eq('external_id', input.matchId)
    .maybeSingle()

  if (byExternalId.error) throw byExternalId.error

  return byExternalId.data as StoredMatchRow | null
}

async function fetchTeamByExternalId(externalId: string | number) {
  const response = await getSupabaseAdminClient()
    .from('teams')
    .select('id, external_id, name, logo_url')
    .eq('external_id', String(externalId))
    .limit(1)
    .maybeSingle()

  if (response.error) throw response.error

  return response.data as StoredTeamRow | null
}

export async function resolveHeadToHeadTeams(input: {
  matchId?: string | null
  fixture?: string | null
  homeTeamExternalId?: string | null
  awayTeamExternalId?: string | null
}): Promise<HeadToHeadResolvedTeams | null> {
  if (input.homeTeamExternalId && input.awayTeamExternalId) {
    const [homeTeamRow, awayTeamRow] = await Promise.all([
      fetchTeamByExternalId(input.homeTeamExternalId),
      fetchTeamByExternalId(input.awayTeamExternalId),
    ])

    return {
      match: null,
      league: null,
      homeTeam: teamFromStored(homeTeamRow, `Equipo ${input.homeTeamExternalId}`),
      awayTeam: teamFromStored(awayTeamRow, `Equipo ${input.awayTeamExternalId}`),
      homeTeamInternalId: homeTeamRow?.id === undefined ? null : String(homeTeamRow.id),
      awayTeamInternalId: awayTeamRow?.id === undefined ? null : String(awayTeamRow.id),
    }
  }

  const match = await findMatchByIdOrFixture(input)

  if (!match) return null

  const teamIds = [match.home_team_id, match.away_team_id].filter(
    (id): id is DbId => id !== null && id !== undefined
  )
  const [teamsById, league] = await Promise.all([
    fetchTeamsByInternalIds(teamIds),
    fetchLeagueById(match.league_id),
  ])
  const homeTeamRow = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
  const awayTeamRow = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null

  return {
    match,
    league,
    homeTeam: teamFromStored(homeTeamRow, 'Local'),
    awayTeam: teamFromStored(awayTeamRow, 'Visitante'),
    homeTeamInternalId: match.home_team_id === null ? null : String(match.home_team_id),
    awayTeamInternalId: match.away_team_id === null ? null : String(match.away_team_id),
  }
}

export async function auditHeadToHeadCache(resolved: HeadToHeadResolvedTeams) {
  const homeExternalId = resolved.homeTeam.externalId
  const awayExternalId = resolved.awayTeam.externalId

  if (!homeExternalId || !awayExternalId) {
    return {
      cacheKey: null,
      cacheExists: false,
      rawMatchesCount: 0,
      normalizedMatchesCount: 0,
      viewModel: createEmptyHeadToHeadViewModel(
        !homeExternalId ? 'missing_home_external_id' : 'missing_away_external_id'
      ),
      warnings: [],
      errors: [],
    }
  }

  const cacheKey = createHeadToHeadCacheKey(homeExternalId, awayExternalId)
  const cache = await readHeadToHeadCache(cacheKey)

  if (cache.error) {
    return {
      cacheKey,
      cacheExists: false,
      rawMatchesCount: 0,
      normalizedMatchesCount: 0,
      viewModel: createEmptyHeadToHeadViewModel('cache_empty', {
        cacheKey,
        errors: [cache.error.message],
      }),
      warnings: [],
      errors: [cache.error.message],
    }
  }

  if (!cache.row) {
    return {
      cacheKey,
      cacheExists: false,
      rawMatchesCount: 0,
      normalizedMatchesCount: 0,
      viewModel: createEmptyHeadToHeadViewModel('cache_empty', {
        cacheKey,
        warnings: cache.warning ? [cache.warning] : [],
      }),
      warnings: cache.warning ? [cache.warning] : [],
      errors: [],
    }
  }

  const viewModel = buildHeadToHeadViewModel({
    currentMatch: {
      fixtureExternalId: resolved.match?.external_id ?? null,
      date: resolved.match?.match_date ?? null,
    },
    rawFixtures: cache.row.payload,
    perspectiveHomeTeam: resolved.homeTeam,
    perspectiveAwayTeam: resolved.awayTeam,
    cacheKey,
    cacheExists: true,
    cacheLastSyncedAt: cache.row.last_synced_at,
  })

  return {
    cacheKey,
    cacheExists: true,
    rawMatchesCount: getRawFixturesFromPayload(cache.row.payload).length,
    normalizedMatchesCount: viewModel.matches.length,
    viewModel,
    warnings: viewModel.warnings,
    errors: viewModel.errors,
  }
}

export async function syncHeadToHeadCache(input: {
  resolved: HeadToHeadResolvedTeams
  force?: boolean
}) {
  const { resolved, force = false } = input
  const homeExternalId = resolved.homeTeam.externalId
  const awayExternalId = resolved.awayTeam.externalId

  if (!homeExternalId || !awayExternalId) {
    return {
      ok: false,
      cacheHit: false,
      cacheKey: null,
      synced: false,
      rawMatchesCount: 0,
      normalizedMatchesCount: 0,
      viewModel: createEmptyHeadToHeadViewModel(
        !homeExternalId ? 'missing_home_external_id' : 'missing_away_external_id'
      ),
      warnings: [],
      errors: ['missing_team_external_id'],
    }
  }

  const cacheKey = createHeadToHeadCacheKey(homeExternalId, awayExternalId)

  if (!force) {
    const cache = await readHeadToHeadCache(cacheKey)

    if (cache.row) {
      const viewModel = buildHeadToHeadViewModel({
        currentMatch: {
          fixtureExternalId: resolved.match?.external_id ?? null,
          date: resolved.match?.match_date ?? null,
        },
        rawFixtures: cache.row.payload,
        perspectiveHomeTeam: resolved.homeTeam,
        perspectiveAwayTeam: resolved.awayTeam,
        cacheKey,
        cacheExists: true,
        cacheLastSyncedAt: cache.row.last_synced_at,
      })

      return {
        ok: true,
        cacheHit: true,
        cacheKey,
        synced: false,
        rawMatchesCount: getRawFixturesFromPayload(cache.row.payload).length,
        normalizedMatchesCount: viewModel.matches.length,
        viewModel,
        warnings: [],
        errors: [],
      }
    }
  }

  const apiResponse = await requestFootballApi<HeadToHeadApiFixture[]>(
    '/fixtures/headtohead',
    { h2h: `${homeExternalId}-${awayExternalId}` },
    { logContext: 'head-to-head' }
  )
  const payload = apiResponse.payload
  if (payload.errors && Object.keys(payload.errors).length > 0) {
    throw new Error(`API-Football head-to-head error: ${JSON.stringify(payload.errors)}`)
  }

  const rawMatches = payload.response ?? []
  const viewModel = buildHeadToHeadViewModel({
    currentMatch: {
      fixtureExternalId: resolved.match?.external_id ?? null,
      date: resolved.match?.match_date ?? null,
    },
    rawFixtures: payload,
    perspectiveHomeTeam: resolved.homeTeam,
    perspectiveAwayTeam: resolved.awayTeam,
    cacheKey,
    cacheExists: true,
  })
  const sortedExternalIds = [String(homeExternalId), String(awayExternalId)].sort(compareExternalIds)
  const upsertResponse = await getSupabaseAdminClient()
    .from('match_head_to_head_cache')
    .upsert(
      {
        cache_key: cacheKey,
        team_a_external_id: sortedExternalIds[0],
        team_b_external_id: sortedExternalIds[1],
        payload,
        normalized_payload: {
          summary: viewModel.summary,
          matches: viewModel.matches,
          generatedAt: new Date().toISOString(),
        },
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' }
    )

  if (upsertResponse.error) throw upsertResponse.error

  return {
    ok: true,
    cacheHit: false,
    cacheKey,
    synced: true,
    rawMatchesCount: rawMatches.length,
    normalizedMatchesCount: viewModel.matches.length,
    viewModel,
    warnings: viewModel.renderReadiness === 'render_ready' ? [] : [viewModel.renderReadiness],
    errors: [],
  }
}
