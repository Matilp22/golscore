import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getLeagueEventStatsLeaders } from '@/server/match-event-stats'
import {
  isFinishedStatus,
  isLiveStatus,
} from '@/shared/utils/match-status'
import { formatEventMinute } from '@/shared/utils/event-minute'
import {
  addDaysToISO,
  getArgentinaDayUtcRange,
  getArgentinaDateISO,
} from '@/shared/utils/argentina-time'
import {
  getGoalKindFromDetail,
  getImportantLiveEventKind,
  isRedCardEvent,
  isScoreboardGoalEvent,
  isValidAssistEvent,
  isValidGoalForScorerTable,
  isYellowCardEvent,
  type ImportantLiveEventKind,
} from '@/shared/utils/football-events'
import {
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  getLeagueFinalPhaseKey,
  getLeagueRoundLabel,
  isLigaProfesionalRegularSeasonRound,
} from '@/shared/utils/league-rounds'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'
import {
  pickLeagueLogoUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'

const HOME_SUPABASE_TIMEOUT_MS = 5000

export class ApiFootballError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApiFootballError'
    this.code = code
  }
}

type FixtureStatus = {
  elapsed: number | null
  extra?: number | null
  short: string
  long: string
}

type TeamInfo = {
  id?: number
  name: string
  logo?: string
  colors?: {
    player?: {
      primary?: string
      number?: string
      border?: string
    }
    goalkeeper?: {
      primary?: string
      number?: string
      border?: string
    }
  }
}

type LeagueInfo = {
  id?: number
  name: string
  country: string
  logo?: string
  round?: string
  season?: number
}

type FixtureInfo = {
  id: number
  date: string
  status: FixtureStatus
  venue?: {
    name?: string
    city?: string
  }
  referee?: string
}

type FixtureGoals = {
  home: number | null
  away: number | null
}

type FixtureTeams = {
  home: TeamInfo
  away: TeamInfo
}

type FixtureListItem = {
  fixture: FixtureInfo
  league: LeagueInfo
  teams: FixtureTeams
  goals: FixtureGoals
  score?: {
    fulltime?: FixtureGoals
    penalty?: FixtureGoals
  }
}

export type MatchListItem = {
  id: number
  externalId: number
  leagueId?: number
  league: string
  leagueLogo?: string
  country?: string
  date: string
  homeId?: number
  home: string
  awayId?: number
  away: string
  homeLogo?: string
  awayLogo?: string
  goalsHome: number | null
  goalsAway: number | null
  minute: number | null
  statusShort: string
  statusLong: string
}

export type HomeMatchesSourceSnapshot = {
  storedMatches: MatchListItem[]
  cacheMatches: MatchListItem[]
  apiMatches: MatchListItem[]
  mergedMatches: MatchListItem[]
  apiError: string | null
  apiAuthoritative: boolean
  supplementRecommended: boolean
}

export type MatchGoalScorer = {
  minute: number
  extraMinute?: number | null
  player: string
  kind?: 'penalty' | 'own-goal' | 'regular'
}

export type MatchGoalScorers = {
  home: MatchGoalScorer[]
  away: MatchGoalScorer[]
  unassigned?: MatchGoalScorer[]
}

export type MatchBroadcaster = {
  name: string
  logoUrl?: string | null
  country?: string | null
}

export type HomeLiveEvent = {
  id: string
  matchId: number | string
  fixtureId: number
  home: string
  away: string
  score: string
  minute: number | null
  extraMinute?: number | null
  playerName?: string | null
  teamName?: string | null
  type: string
  detail?: string | null
  kind: ImportantLiveEventKind
  label: string
}

export type MatchListItemWithGoalScorers = MatchListItem & {
  goalScorers: MatchGoalScorers
  liveEvents: HomeLiveEvent[]
  broadcasters?: MatchBroadcaster[]
  broadcastChannel?: string | null
  broadcastLogoUrl?: string | null
  persistedInSupabase?: boolean
}

export type LeagueFixtureEventSummary = {
  id: string
  teamId?: string | number | null
  teamSide?: 'home' | 'away' | null
  playerName: string
  assistName?: string | null
  minute: number | null
  extraMinute?: number | null
  type: string
  detail?: string | null
}

export type LeagueFixtureSummary = {
  id: number | string
  round: string
  date: string | null
  statusShort: string
  minute: number | null
  home: string
  homeId?: number
  away: string
  awayId?: number
  homeLogo?: string
  awayLogo?: string
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
  venueName?: string | null
  venueCity?: string | null
  venueCountry?: string | null
  events?: LeagueFixtureEventSummary[]
}

function getLeagueFixtureTimestamp(date: string | null | undefined) {
  if (!date) return Number.MAX_SAFE_INTEGER

  const timestamp = new Date(date).getTime()

  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

function compareLeagueFixtureIds(a: number | string, b: number | string) {
  if (typeof a === 'number' && typeof b === 'number') return a - b

  return String(a).localeCompare(String(b), 'es-AR', { numeric: true })
}

function compareLeagueFixturesByApiOrder(
  a: Pick<LeagueFixtureSummary, 'round' | 'date' | 'id'>,
  b: Pick<LeagueFixtureSummary, 'round' | 'date' | 'id'>
) {
  const roundCompare = getApiRoundOrder(a.round) - getApiRoundOrder(b.round)
  if (roundCompare !== 0) return roundCompare

  const dateCompare = getLeagueFixtureTimestamp(a.date) - getLeagueFixtureTimestamp(b.date)
  if (dateCompare !== 0) return dateCompare

  return compareLeagueFixtureIds(a.id, b.id)
}

function getApiRoundOrder(round: string) {
  const normalized = round.toLowerCase()

  if (normalized.includes('round of 64') || normalized.includes('32nd finals')) return 10
  if (normalized.includes('round of 32') || normalized.includes('16th finals')) return 20
  if (normalized.includes('round of 16') || normalized.includes('8th finals') || normalized.includes('octavos')) return 30
  if (normalized.includes('quarter') || normalized.includes('cuartos')) return 40
  if (normalized.includes('semi') || normalized.includes('semifinal')) return 50
  if (normalized.includes('final') && !normalized.includes('semi')) return 60
  return 999
}

function logCopaArgentinaFixtureDebug(
  leagueId: number,
  season: number,
  fixtures: LeagueFixtureSummary[],
  source: 'api' | 'cache'
) {
  if (leagueId !== 130) return

  const roundSummary = [...fixtures.reduce((rounds, fixture) => {
    const current = rounds.get(fixture.round) || []
    current.push(fixture)
    rounds.set(fixture.round, current)
    return rounds
  }, new Map<string, LeagueFixtureSummary[]>()).entries()].map(([round, matches]) => {
    const sorted = [...matches].sort(compareLeagueFixturesByApiOrder)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    return {
      round,
      count: sorted.length,
      firstFixtureId: first?.id ?? null,
      lastFixtureId: last?.id ?? null,
    }
  })

  console.info('[copa-argentina:fixtures]', {
    externalLeagueId: leagueId,
    season,
    source,
    count: fixtures.length,
    roundSummary,
    order: [...fixtures].sort(compareLeagueFixturesByApiOrder).map((fixture) => ({
      round: fixture.round,
      date: fixture.date,
      fixtureId: fixture.id,
      home: fixture.home,
      away: fixture.away,
    })),
  })
}

export type MatchEvent = {
  team?: {
    id?: number
    name?: string
  }
  player?: {
    id?: number
    name?: string
  }
  assist?: {
    id?: number
    name?: string
  }
  time?: {
    elapsed?: number | null
    extra?: number | null
  }
  type?: string
  detail?: string
  comments?: string | null
}

export type MatchStatistic = {
  type: string
  value: string | number | null
}

export type MatchStatisticsTeam = {
  team?: TeamInfo
  statistics?: MatchStatistic[]
}

export type LineupPlayer = {
  id?: number
  name?: string
  number?: number
  pos?: string
  grid?: string
  captain?: boolean | string
  photo?: string
}

export type PlayerWrapper = {
  player?: LineupPlayer
  captain?: boolean | string
}

export type MatchLineup = {
  team?: TeamInfo
  formation?: string
  startXI?: PlayerWrapper[]
  substitutes?: PlayerWrapper[]
  coach?: {
    name?: string
  }
}

export type MatchFixture = FixtureListItem

export type TeamVenue = {
  name?: string
  address?: string
  city?: string
  capacity?: number
  surface?: string
  image?: string
}

export type TeamProfile = {
  team: TeamInfo & {
    code?: string
    country?: string
    founded?: number
    national?: boolean
  }
  venue?: TeamVenue
}

export type TeamSquadPlayer = {
  id?: number
  name?: string
  age?: number
  number?: number
  position?: string
  photo?: string
}

export type TeamSquad = {
  team?: TeamInfo
  players?: TeamSquadPlayer[]
}

export type ResolvedTournament = {
  leagueId: number
  season: number
  name: string
  country?: string
  logo?: string
}

export type LeagueStandingRow = {
  rank: number
  teamId?: number
  teamName: string
  teamLogo?: string
  points: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  form?: string
  description?: string | null
}

export type LeagueStandingGroup = {
  name: string
  rows: LeagueStandingRow[]
}

type CalculatedStandingAccumulator = Omit<LeagueStandingRow, 'rank'>

export type TopPlayerRow = {
  playerId?: number
  name: string
  photo?: string
  teamId?: number
  teamName?: string
  teamLogo?: string
  value: number
  details?: string
}

export type LeaderStatType = 'scorers' | 'assists' | 'yellowCards' | 'redCards'

export type PlayerEventMatch = {
  fixtureId: number
  round: string
  date: string
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  goalsHome: number | null
  goalsAway: number | null
  events: Array<{
    minute: number | null
    extraMinute?: number | null
    label: string
  }>
}

export type PlayerDetail = {
  player: {
    id?: number
    name: string
    firstname?: string
    lastname?: string
    age?: number
    nationality?: string
    birthDate?: string
    birthPlace?: string
    birthCountry?: string
    height?: string
    weight?: string
    injured?: boolean
    photo?: string
  }
  team?: {
    id?: number
    name?: string
    logo?: string
  }
  league?: {
    id?: number
    name?: string
    country?: string
    logo?: string
    season?: number
  }
  statistics: {
    appearances: number
    lineups: number
    minutes: number
    position?: string | null
    rating?: string | null
    goals: number
    assists: number
    yellowCards: number
    redCards: number
  }
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
    }),
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(message))
      }, timeoutMs)
    }),
  ])
}

function getArgentinaDateKey(dateString: string) {
  return getArgentinaDateISO(dateString)
}

export async function getMatchesByDate(date: string): Promise<MatchListItem[]> {
  const sources = await getHomeMatchesSourceSnapshot(date)

  return sources.mergedMatches
}

export async function getHomeMatchesSourceSnapshot(
  date: string
): Promise<HomeMatchesSourceSnapshot> {
  let storedMatches: MatchListItem[] = []
  let cacheMatches: MatchListItem[] = []

  try {
    storedMatches = await withTimeout(
      fetchStoredHomeMatches(date),
      HOME_SUPABASE_TIMEOUT_MS,
      'Supabase home matches timeout'
    )
  } catch (error) {
    console.warn('[home] No se pudieron leer partidos desde Supabase/cache.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    cacheMatches = await withTimeout(
      fetchCachedHomeFixtures(getSupabaseAdminClient(), date),
      HOME_SUPABASE_TIMEOUT_MS,
      'Supabase fixture cache timeout'
    )
  } catch (error) {
    console.warn('[home] No se pudo leer football_fixture_cache.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const mergedMatches = mergeHomeMatchesByExternalId(storedMatches, cacheMatches)

  if (process.env.NODE_ENV === 'development') {
    const { startUtc, endUtc } = getArgentinaDayUtcRange(date)

    console.info('[home-date-debug]', {
      selectedDate: date,
      startUtc,
      endUtc,
      supabaseCount: storedMatches.length,
      cacheCount: cacheMatches.length,
      visibleCount: mergedMatches.length,
    })
  }

  return {
    storedMatches,
    cacheMatches,
    apiMatches: [],
    mergedMatches,
    apiError: null,
    apiAuthoritative: false,
    supplementRecommended: false,
  }
}

function getGoalKind(detail?: string | null): MatchGoalScorer['kind'] {
  return getGoalKindFromDetail(detail)
}

function sortGoalScorers(a: MatchGoalScorer, b: MatchGoalScorer) {
  if (a.minute !== b.minute) return a.minute - b.minute
  return (a.extraMinute ?? 0) - (b.extraMinute ?? 0)
}

type HomeMatchRow = {
  id: number | string
  external_id: number | string | null
  broadcast_channel: string | null
  broadcast_logo_url: string | null
  home_team_id: number | string | null
  away_team_id: number | string | null
}

type StoredHomeMatchRow = {
  id: number | string
  external_id: number | string | null
  league_id: number | string | null
  home_team_id: number | string | null
  away_team_id: number | string | null
  match_date: string
  round?: string | null
  home_score: number | null
  away_score: number | null
  status: string | null
  elapsed?: number | null
}

type StoredHomeLeagueRow = {
  id: number | string
  external_id: number | string | null
  name: string | null
  country: string | null
  logo_url?: string | null
}

type StoredHomeTeamRow = {
  id: number | string
  external_id: number | string | null
  name: string | null
  logo_url?: string | null
}

type StoredMatchEventRow = {
  id?: number | string | null
  external_event_id?: string | number | null
  match_id: number | string
  team_id: number | string | null
  player_name: string | null
  assist_name?: string | null
  minute: number | null
  extra_minute: number | null
  type: string
  detail: string | null
}

type HomeMatchBroadcastRow = {
  match_id: number | string
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
}

type HomeBroadcastRuleRow = {
  id: string
  match_external_id?: string | null
  match_date?: string | null
  league_external_id: string | null
  league_name: string | null
  country: string | null
  home_team_name: string | null
  away_team_name: string | null
  broadcaster_name: string
  broadcaster_logo_url: string | null
  priority: number | null
  active: boolean | null
}

type CachedHomeFixtureRow = {
  date?: string | null
  normalized_payload: unknown
}

type HomeMatchExtras = {
  persistedInSupabase: boolean
  broadcasters: MatchBroadcaster[]
  broadcastChannel: string | null
  broadcastLogoUrl: string | null
  goalScorers: MatchGoalScorers
  liveEvents: HomeLiveEvent[]
}

function createEmptyGoalScorers(): MatchGoalScorers {
  return { home: [], away: [], unassigned: [] }
}

function createEmptyHomeMatchExtras(): HomeMatchExtras {
  return {
    persistedInSupabase: false,
    broadcasters: [],
    broadcastChannel: null,
    broadcastLogoUrl: null,
    goalScorers: createEmptyGoalScorers(),
    liveEvents: [],
  }
}

function getNumberFromCachedValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

function getStringFromCachedValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function getNullableStringFromCachedValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function compareHomeMatchesByDateAndId(a: MatchListItem, b: MatchListItem) {
  const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
  if (dateCompare !== 0) return dateCompare

  return a.id - b.id
}

function mergeHomeMatchesByExternalId(
  storedMatches: MatchListItem[],
  cacheMatches: MatchListItem[]
) {
  const mergedByExternalId = new Map<string, MatchListItem>()

  for (const match of cacheMatches) {
    mergedByExternalId.set(String(match.externalId ?? match.id), match)
  }

  for (const match of storedMatches) {
    mergedByExternalId.set(String(match.externalId ?? match.id), match)
  }

  return [...mergedByExternalId.values()].sort(compareHomeMatchesByDateAndId)
}

function mapCachedHomeFixturePayload(payload: unknown): MatchListItem | null {
  if (!payload || typeof payload !== 'object') return null

  const row = payload as Record<string, unknown>
  const id = getNumberFromCachedValue(row.id ?? row.externalId)
  const externalId = getNumberFromCachedValue(row.externalId ?? row.id)
  const leagueId = getNumberFromCachedValue(row.leagueId)
  const homeId = getNumberFromCachedValue(row.homeId)
  const awayId = getNumberFromCachedValue(row.awayId)
  const league = getStringFromCachedValue(row.league)
  const home = getStringFromCachedValue(row.home)
  const away = getStringFromCachedValue(row.away)
  const date = getStringFromCachedValue(row.date)

  if (!id || !externalId || !league || !home || !away || !date) return null

  const excludedReason = getHomeMatchVisibility({
    leagueId,
    league,
    country: getNullableStringFromCachedValue(row.country),
    home,
    away,
    round: getNullableStringFromCachedValue(row.round),
  }).excludedReason

  if (excludedReason) return null

  return {
    id,
    externalId,
    leagueId: leagueId ?? undefined,
    league,
    leagueLogo: getNullableStringFromCachedValue(row.leagueLogo),
    country: getNullableStringFromCachedValue(row.country),
    date,
    homeId: homeId ?? undefined,
    home,
    awayId: awayId ?? undefined,
    away,
    homeLogo: getNullableStringFromCachedValue(row.homeLogo),
    awayLogo: getNullableStringFromCachedValue(row.awayLogo),
    goalsHome: getNumberFromCachedValue(row.goalsHome),
    goalsAway: getNumberFromCachedValue(row.goalsAway),
    minute: getNumberFromCachedValue(row.minute),
    statusShort: getStringFromCachedValue(row.statusShort) ?? 'NS',
    statusLong: getStringFromCachedValue(row.statusLong) ?? 'No iniciado',
  }
}

async function fetchCachedHomeFixtures(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  date: string
) {
  const cacheDates = [
    addDaysToISO(date, -1),
    date,
    addDaysToISO(date, 1),
  ]
  const response = await supabase
    .from('football_fixture_cache')
    .select('date, normalized_payload')
    .in('date', cacheDates)
    .order('fixture_external_id', { ascending: true })

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const missingCacheTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('football_fixture_cache') ||
      message.includes('schema cache')

    if (missingCacheTable) return []

    throw response.error
  }

  return ((response.data ?? []) as CachedHomeFixtureRow[])
    .map((row) => mapCachedHomeFixturePayload(row.normalized_payload))
    .filter((match): match is MatchListItem => Boolean(match))
    .filter((match) => getArgentinaDateKey(match.date) === date)
    .sort(compareHomeMatchesByDateAndId)
}

function serializeGoalEventForLog(event: StoredMatchEventRow) {
  return {
    match_id: event.match_id,
    team_id: event.team_id,
    minute: formatEventMinute(event.minute, event.extra_minute),
    player: event.player_name,
    detail: event.detail,
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function toFiniteNumber(value: number | string | null | undefined) {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

async function fetchStoredHomeMatches(date: string): Promise<MatchListItem[]> {
  const supabase = getSupabaseAdminClient()
  const { startUtc, endUtc } = getArgentinaDayUtcRange(date)
  const selectWithElapsed =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, round, home_score, away_score, status, elapsed'
  const selectBase =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, round, home_score, away_score, status'

  const primaryResponse = await supabase
    .from('matches')
    .select(selectWithElapsed)
    .gte('match_date', startUtc)
    .lt('match_date', endUtc)
    .order('match_date', { ascending: true })
  let responseData: unknown[] | null = primaryResponse.data
  let responseError = primaryResponse.error

  if (
    responseError &&
    (
      responseError.code === '42703' ||
      responseError.code === 'PGRST204' ||
      responseError.message.toLowerCase().includes('elapsed')
    )
  ) {
    const fallbackResponse = await supabase
      .from('matches')
      .select(selectBase)
      .gte('match_date', startUtc)
      .lt('match_date', endUtc)
      .order('match_date', { ascending: true })

    responseData = fallbackResponse.data
    responseError = fallbackResponse.error
  }

  if (responseError) throw responseError

  const matchRows = ((responseData ?? []) as StoredHomeMatchRow[])
    .filter((match) => getArgentinaDateKey(match.match_date) === date)

  const leagueIds = [
    ...new Set(
      matchRows
        .map((match) => match.league_id)
        .filter((id): id is string | number => id !== null && id !== undefined)
        .map(String)
    ),
  ]
  const teamIds = [
    ...new Set(
      matchRows
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is string | number => id !== null && id !== undefined)
        .map(String)
    ),
  ]
  const leagues = new Map<string, StoredHomeLeagueRow>()
  const teams = new Map<string, StoredHomeTeamRow>()

  for (const chunk of chunkArray(leagueIds, 100)) {
    const leagueResponse = await supabase
      .from('leagues')
      .select('id, external_id, name, country, logo_url')
      .in('id', chunk)

    if (!leagueResponse.error) {
      for (const league of (leagueResponse.data ?? []) as StoredHomeLeagueRow[]) {
        leagues.set(String(league.id), league)
      }
      continue
    }

    const fallback = await supabase
      .from('leagues')
      .select('id, external_id, name, country')
      .in('id', chunk)

    if (fallback.error) throw fallback.error

    for (const league of (fallback.data ?? []) as StoredHomeLeagueRow[]) {
      leagues.set(String(league.id), { ...league, logo_url: null })
    }
  }

  for (const chunk of chunkArray(teamIds, 100)) {
    const teamResponse = await supabase
      .from('teams')
      .select('id, external_id, name, logo_url')
      .in('id', chunk)

    if (!teamResponse.error) {
      for (const team of (teamResponse.data ?? []) as StoredHomeTeamRow[]) {
        teams.set(String(team.id), team)
      }
      continue
    }

    const fallback = await supabase
      .from('teams')
      .select('id, external_id, name')
      .in('id', chunk)

    if (fallback.error) throw fallback.error

    for (const team of (fallback.data ?? []) as StoredHomeTeamRow[]) {
      teams.set(String(team.id), { ...team, logo_url: null })
    }
  }

  return matchRows
    .map((match): MatchListItem | null => {
      const externalId = toFiniteNumber(match.external_id)
      const homeTeam = match.home_team_id ? teams.get(String(match.home_team_id)) : null
      const awayTeam = match.away_team_id ? teams.get(String(match.away_team_id)) : null
      const league = match.league_id ? leagues.get(String(match.league_id)) : null

      if (!externalId || !homeTeam?.name || !awayTeam?.name || !league?.name) {
        return null
      }

      const excludedReason = getHomeMatchVisibility({
        leagueId: toFiniteNumber(league.external_id) ?? toFiniteNumber(league.id) ?? null,
        league: league.name,
        country: league.country ?? undefined,
        home: homeTeam.name,
        away: awayTeam.name,
        round: match.round ?? null,
      }).excludedReason

      if (excludedReason) return null

      return {
        id: externalId,
        externalId,
        leagueId: toFiniteNumber(league.external_id) ?? toFiniteNumber(league.id) ?? undefined,
        league: league.name,
        leagueLogo:
          pickLeagueLogoUrl(
            league.logo_url,
            league.external_id ?? league.id
          ) ?? undefined,
        country: league.country ?? undefined,
        date: match.match_date,
        homeId: toFiniteNumber(homeTeam.external_id) ?? undefined,
        home: homeTeam.name,
        awayId: toFiniteNumber(awayTeam.external_id) ?? undefined,
        away: awayTeam.name,
        homeLogo:
          pickTeamLogoUrl(homeTeam.logo_url, homeTeam.external_id ?? homeTeam.id) ?? undefined,
        awayLogo:
          pickTeamLogoUrl(awayTeam.logo_url, awayTeam.external_id ?? awayTeam.id) ?? undefined,
        goalsHome: match.home_score,
        goalsAway: match.away_score,
        minute: match.elapsed ?? null,
        statusShort: match.status ?? 'NS',
        statusLong: match.status ?? 'No iniciado',
      }
    })
    .filter((match): match is MatchListItem => Boolean(match))
}

async function fetchHomeMatchRowsByExternalId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  externalFixtureIds: number[]
) {
  const externalIds = [...new Set(externalFixtureIds.flatMap((id) => [id, String(id)]))]
  const rows: HomeMatchRow[] = []
  let missingBroadcastColumn = false

  for (const chunk of chunkArray(externalIds, 100)) {
    const primary = await supabase
      .from('matches')
      .select('id, external_id, broadcast_channel, broadcast_logo_url, home_team_id, away_team_id')
      .in('external_id', chunk)

    if (!primary.error) {
      rows.push(...((primary.data ?? []) as HomeMatchRow[]))
      continue
    }

    const message = primary.error.message.toLowerCase()
    missingBroadcastColumn =
      primary.error.code === '42703' ||
      message.includes('broadcast_channel') ||
      message.includes('broadcast_logo_url') ||
      message.includes('schema cache')

    if (!missingBroadcastColumn) throw primary.error

    break
  }

  if (!missingBroadcastColumn) return rows

  const fallbackRows: HomeMatchRow[] = []

  for (const chunk of chunkArray(externalIds, 100)) {
    const fallback = await supabase
      .from('matches')
      .select('id, external_id, home_team_id, away_team_id')
      .in('external_id', chunk)

    if (fallback.error) throw fallback.error

    fallbackRows.push(
      ...((fallback.data ?? []) as Array<Omit<HomeMatchRow, 'broadcast_channel'>>).map((row) => ({
        ...row,
        broadcast_channel: null,
        broadcast_logo_url: null,
      }))
    )
  }

  return fallbackRows
}

async function fetchHomeBroadcastRowsByMatchId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const rows: HomeMatchBroadcastRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_broadcasts')
      .select('match_id, broadcaster_name, broadcaster_logo_url, country')
      .in('match_id', chunk)
      .order('broadcaster_name', { ascending: true })

    if (response.error) {
      const message = response.error.message.toLowerCase()
      const isMissingOptionalBroadcastsTable =
        response.error.code === '42P01' ||
        response.error.code === 'PGRST205' ||
        message.includes('match_broadcasts') ||
        message.includes('schema cache')

      if (isMissingOptionalBroadcastsTable) return []
      throw response.error
    }

    rows.push(...((response.data ?? []) as HomeMatchBroadcastRow[]))
  }

  return rows
}

async function fetchHomeBroadcastRules(
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const response = await supabase
    .from('broadcast_rules')
    .select('id, match_external_id, match_date, league_external_id, league_name, country, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active')
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const isMissingOptionalRulesTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('broadcast_rules') ||
      message.includes('schema cache')

    if (isMissingOptionalRulesTable) return []
    const isMissingSpecificRuleColumn =
      response.error.code === '42703' ||
      message.includes('match_external_id') ||
      message.includes('match_date')

    if (isMissingSpecificRuleColumn) {
      const fallback = await supabase
        .from('broadcast_rules')
        .select('id, league_external_id, league_name, country, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active')
        .eq('active', true)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })

      if (fallback.error) return []

      return (fallback.data ?? []) as HomeBroadcastRuleRow[]
    }

    throw response.error
  }

  return (response.data ?? []) as HomeBroadcastRuleRow[]
}

function normalizeBroadcastRuleText(value?: string | number | null) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function textBroadcastRuleMatches(ruleValue: string | null, actualValue?: string | null) {
  if (!ruleValue) return true

  const ruleText = normalizeBroadcastRuleText(ruleValue)
  const actualText = normalizeBroadcastRuleText(actualValue)

  if (!ruleText || !actualText) return false

  return actualText.includes(ruleText) || ruleText.includes(actualText)
}

function teamBroadcastRuleMatches(ruleTeam: string | null, match: MatchListItem) {
  if (!ruleTeam) return true

  return (
    textBroadcastRuleMatches(ruleTeam, match.home) ||
    textBroadcastRuleMatches(ruleTeam, match.away)
  )
}

function homeBroadcastRuleMatches(rule: HomeBroadcastRuleRow, match: MatchListItem) {
  if (
    rule.match_external_id &&
    String(rule.match_external_id) !== String(match.externalId ?? match.id)
  ) {
    return false
  }

  if (
    rule.match_date &&
    getArgentinaDateISO(match.date) !== getArgentinaDateISO(rule.match_date)
  ) {
    return false
  }

  if (
    rule.league_external_id &&
    String(rule.league_external_id) !== String(match.leagueId ?? '')
  ) {
    return false
  }

  return (
    textBroadcastRuleMatches(rule.league_name, match.league) &&
    textBroadcastRuleMatches(rule.country, match.country) &&
    teamBroadcastRuleMatches(rule.home_team_name, match) &&
    teamBroadcastRuleMatches(rule.away_team_name, match)
  )
}

function getHomeBroadcastRuleSpecificity(rule: HomeBroadcastRuleRow) {
  if (rule.match_external_id) return 0
  if (rule.home_team_name && rule.away_team_name) return 1
  if (rule.home_team_name || rule.away_team_name) return 2
  if (rule.league_external_id || rule.league_name) return 3
  if (rule.country) return 4
  return 5
}

function isSpecificHomeBroadcastRule(rule: HomeBroadcastRuleRow) {
  return getHomeBroadcastRuleSpecificity(rule) <= 1
}

function getBestHomeBroadcastRules(rules: HomeBroadcastRuleRow[], match: MatchListItem) {
  const matchingRules = rules
    .filter((rule) => isSpecificHomeBroadcastRule(rule) && homeBroadcastRuleMatches(rule, match))
    .sort((a, b) => {
      const specificityCompare =
        getHomeBroadcastRuleSpecificity(a) - getHomeBroadcastRuleSpecificity(b)
      if (specificityCompare !== 0) return specificityCompare
      return (a.priority ?? 100) - (b.priority ?? 100)
    })

  if (!matchingRules.length) return []

  const bestSpecificity = getHomeBroadcastRuleSpecificity(matchingRules[0])
  const bestPriority = matchingRules[0]?.priority ?? 100

  return matchingRules.filter((rule) =>
    getHomeBroadcastRuleSpecificity(rule) === bestSpecificity &&
    (rule.priority ?? 100) === bestPriority
  )
}

function applyBroadcastRulesToHomeExtras(
  matches: MatchListItem[],
  extrasByExternalId: Map<string, HomeMatchExtras>,
  rules: HomeBroadcastRuleRow[]
) {
  if (!rules.length) return 0

  let applied = 0

  for (const match of matches) {
    const externalKey = String(match.externalId ?? match.id)
    const extras = extrasByExternalId.get(externalKey)

    if (!extras || extras.broadcasters.length > 0) continue

    const matchingRules = getBestHomeBroadcastRules(rules, match)
    if (!matchingRules.length) continue

    extras.broadcasters = matchingRules.map((rule) => ({
      name: rule.broadcaster_name,
      logoUrl: rule.broadcaster_logo_url,
      country: rule.country,
    }))
    extras.broadcastChannel = extras.broadcasters
      .map((broadcaster) => broadcaster.name)
      .join(' / ')
    extras.broadcastLogoUrl =
      extras.broadcasters.find((broadcaster) => broadcaster.logoUrl)?.logoUrl ?? null
    applied += 1
  }

  return applied
}

function getLegacyBroadcaster(row: HomeMatchRow): MatchBroadcaster | null {
  if (!row.broadcast_channel) return null

  return {
    name: row.broadcast_channel,
    logoUrl: row.broadcast_logo_url,
    country: null,
  }
}

function mapStoredGoalEvent(row: StoredMatchEventRow): MatchGoalScorer | null {
  if (row.minute === null || row.minute === undefined || !row.player_name) return null

  return {
    minute: row.minute,
    extraMinute: row.extra_minute,
    player: row.player_name,
    kind: getGoalKind(row.detail),
  }
}

function getLiveEventLabel(row: StoredMatchEventRow, kind: ImportantLiveEventKind) {
  if (kind === 'red-card') return 'Tarjeta roja'
  if (kind === 'penalty') return 'Penal'

  return getGoalKind(row.detail) === 'penalty' ? 'Gol de penal' : 'Gol'
}

function getLiveEventTeamName(
  row: StoredMatchEventRow,
  matchRow: HomeMatchRow,
  visibleMatch: MatchListItem
) {
  if (row.team_id === null || row.team_id === undefined) return null

  if (
    String(row.team_id) === String(matchRow.home_team_id) ||
    String(row.team_id) === String(visibleMatch.homeId)
  ) {
    return visibleMatch.home
  }

  if (
    String(row.team_id) === String(matchRow.away_team_id) ||
    String(row.team_id) === String(visibleMatch.awayId)
  ) {
    return visibleMatch.away
  }

  return null
}

function getStoredEventStableId(row: StoredMatchEventRow, matchRow: HomeMatchRow) {
  if (row.external_event_id !== null && row.external_event_id !== undefined) {
    return String(row.external_event_id)
  }

  if (row.id !== null && row.id !== undefined) {
    return String(row.id)
  }

  return [
    matchRow.external_id ?? row.match_id,
    row.type,
    row.detail ?? 'detail',
    row.minute ?? 'minute',
    row.extra_minute ?? 'no-extra',
    row.player_name ?? 'player',
  ].join(':')
}

function mapStoredLiveEvent(
  row: StoredMatchEventRow,
  matchRow: HomeMatchRow,
  visibleMatch: MatchListItem | undefined
): HomeLiveEvent | null {
  if (!visibleMatch || !isLiveStatus(visibleMatch.statusShort)) return null

  const kind = getImportantLiveEventKind(row.type, row.detail)
  if (!kind) return null

  const fixtureId = Number(matchRow.external_id ?? visibleMatch.externalId ?? visibleMatch.id)
  if (!Number.isFinite(fixtureId)) return null

  return {
    id: getStoredEventStableId(row, matchRow),
    matchId: visibleMatch.id,
    fixtureId,
    home: visibleMatch.home,
    away: visibleMatch.away,
    score: `${visibleMatch.goalsHome ?? '-'} - ${visibleMatch.goalsAway ?? '-'}`,
    minute: row.minute,
    extraMinute: row.extra_minute,
    playerName: row.player_name,
    teamName: getLiveEventTeamName(row, matchRow, visibleMatch),
    type: row.type,
    detail: row.detail,
    kind,
    label: getLiveEventLabel(row, kind),
  }
}

async function getHomeMatchExtrasByFixtureId(matches: MatchListItem[]) {
  const externalFixtureIds = [
    ...new Set(
      matches
        .map((match) => match.externalId ?? match.id)
        .filter((id) => Number.isFinite(id))
    ),
  ]
  const empty = new Map<string, HomeMatchExtras>()

  if (!externalFixtureIds.length) return empty

  try {
    const shouldLogHomeExtras = process.env.NODE_ENV === 'development'
    const supabase = getSupabaseAdminClient()
    const matchRows = await fetchHomeMatchRowsByExternalId(supabase, externalFixtureIds)
    const visibleMatchesByExternalId = new Map(
      matches.map((match) => [String(match.externalId ?? match.id), match])
    )
    const matchRowsByExternalId = new Map<string, HomeMatchRow>()
    const extrasByExternalId = new Map<string, HomeMatchExtras>()
    const matchRowsByMatchId = new Map<string, HomeMatchRow>()

    for (const match of matches) {
      extrasByExternalId.set(
        String(match.externalId ?? match.id),
        createEmptyHomeMatchExtras()
      )
    }

    for (const row of matchRows) {
      const externalId = Number(row.external_id)
      const matchId = String(row.id)

      if (!Number.isFinite(externalId)) continue

      const externalKey = String(row.external_id)

      matchRowsByMatchId.set(matchId, row)
      matchRowsByExternalId.set(externalKey, row)
      const legacyBroadcaster = getLegacyBroadcaster(row)
      const existingExtras =
        extrasByExternalId.get(externalKey) ?? createEmptyHomeMatchExtras()

      existingExtras.persistedInSupabase = true
      existingExtras.broadcasters = legacyBroadcaster ? [legacyBroadcaster] : existingExtras.broadcasters
      existingExtras.broadcastChannel = row.broadcast_channel ?? existingExtras.broadcastChannel
      existingExtras.broadcastLogoUrl = row.broadcast_logo_url ?? existingExtras.broadcastLogoUrl
      extrasByExternalId.set(externalKey, existingExtras)
    }

    const matchIds = [...matchRowsByMatchId.keys()]
    const broadcastRules = await fetchHomeBroadcastRules(supabase)

    if (!matchIds.length) {
      const ruleMatchesApplied = applyBroadcastRulesToHomeExtras(
        matches,
        extrasByExternalId,
        broadcastRules
      )

      if (shouldLogHomeExtras) {
        console.info('[home-broadcasts]', {
          visibleMatches: matches.length,
          matchedRows: matchRows.length,
          broadcastersLoaded: 0,
          broadcastRules: broadcastRules.length,
          ruleMatchesApplied,
          reason: 'no-matches-row-for-visible-external-id',
        })
      }

      if (shouldLogHomeExtras) {
        for (const match of matches) {
          console.info('match events ' + JSON.stringify({
            homeTeamName: match.home,
            awayTeamName: match.away,
            external_id: match.externalId ?? match.id,
            matchId: match.id,
            internal_match_id: null,
            date: match.date,
            league: match.league,
            home_team_id: match.homeId ?? null,
            away_team_id: match.awayId ?? null,
            eventsFound: 0,
            events: [],
            reason: 'no-matches-row-for-visible-external-id',
          }))
        }
      }

      return extrasByExternalId
    }

    const broadcastRows = await fetchHomeBroadcastRowsByMatchId(supabase, matchIds)
    const broadcastsByMatchId = broadcastRows.reduce<Map<string, MatchBroadcaster[]>>(
      (accumulator, row) => {
        const matchId = String(row.match_id)
        const current = accumulator.get(matchId) ?? []

        current.push({
          name: row.broadcaster_name,
          logoUrl: row.broadcaster_logo_url,
          country: row.country,
        })
        accumulator.set(matchId, current)

        return accumulator
      },
      new Map()
    )

    for (const [matchId, broadcasters] of broadcastsByMatchId.entries()) {
      const row = matchRowsByMatchId.get(matchId)
      const externalId = row ? Number(row.external_id) : NaN
      const extras = Number.isFinite(externalId) ? extrasByExternalId.get(String(row?.external_id)) : null

      if (!extras || broadcasters.length === 0) continue

      extras.broadcasters = broadcasters
      extras.broadcastChannel = broadcasters.map((broadcaster) => broadcaster.name).join(' / ')
      extras.broadcastLogoUrl = broadcasters.find((broadcaster) => broadcaster.logoUrl)?.logoUrl ?? null
    }

    const ruleMatchesApplied = applyBroadcastRulesToHomeExtras(
      matches,
      extrasByExternalId,
      broadcastRules
    )

    if (shouldLogHomeExtras) {
      console.info('[home-broadcasts]', {
        visibleMatches: matches.length,
        matchedRows: matchRows.length,
        broadcastersLoaded: broadcastRows.length,
        broadcastRules: broadcastRules.length,
        ruleMatchesApplied,
        matches: matches.map((match) => {
          const externalId = match.externalId ?? match.id
          const row = matchRowsByExternalId.get(String(externalId)) ?? null
          const extras = extrasByExternalId.get(String(externalId)) ?? null
          const broadcastersForMatch = extras?.broadcasters ?? []

          return {
            home: match.home,
            away: match.away,
            matchId: row?.id ?? match.id,
            externalId,
            broadcastersForMatch: broadcastersForMatch.map((broadcaster) => ({
              name: broadcaster.name,
              hasLogo: Boolean(broadcaster.logoUrl),
            })),
          }
        }),
      })
    }

    const eventRows: StoredMatchEventRow[] = []

    for (const chunk of chunkArray(matchIds, 100)) {
      const eventsResponse = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)

      if (eventsResponse.error) {
        const message = eventsResponse.error.message.toLowerCase()
        const isMissingOptionalEventsTable =
          eventsResponse.error.code === '42P01' ||
          eventsResponse.error.code === 'PGRST205' ||
          message.includes('match_events') ||
          message.includes('schema cache')

        if (isMissingOptionalEventsTable) return extrasByExternalId
        throw eventsResponse.error
      }

      eventRows.push(...((eventsResponse.data ?? []) as StoredMatchEventRow[]))
    }

    const goalEvents = eventRows.filter((event) =>
      isScoreboardGoalEvent(event.type, event.detail)
    )
    const importantLiveEvents = eventRows.filter((event) =>
      Boolean(getImportantLiveEventKind(event.type, event.detail))
    )
    const eventsFoundByMatchId = goalEvents.reduce<Map<string, number>>((accumulator, event) => {
      const matchId = String(event.match_id)
      accumulator.set(matchId, (accumulator.get(matchId) ?? 0) + 1)

      return accumulator
    }, new Map())
    const eventsByMatchId = goalEvents.reduce<Map<string, StoredMatchEventRow[]>>(
      (accumulator, event) => {
        const matchId = String(event.match_id)
        const current = accumulator.get(matchId) ?? []
        current.push(event)
        accumulator.set(matchId, current)

        return accumulator
      },
      new Map()
    )
    let mappedHomeGoals = 0
    let mappedAwayGoals = 0
    let unassignedGoals = 0

    for (const event of goalEvents) {
      const matchRow = matchRowsByMatchId.get(String(event.match_id))
      if (!matchRow) continue

      const externalKey = String(matchRow.external_id)
      const visibleMatch = visibleMatchesByExternalId.get(externalKey)
      const extras = extrasByExternalId.get(externalKey)
      const goal = mapStoredGoalEvent(event)
      if (!extras || !goal) continue

      if (event.team_id !== null && String(event.team_id) === String(matchRow.home_team_id)) {
        extras.goalScorers.home.push(goal)
        mappedHomeGoals += 1
      } else if (event.team_id !== null && String(event.team_id) === String(matchRow.away_team_id)) {
        extras.goalScorers.away.push(goal)
        mappedAwayGoals += 1
      } else if (event.team_id !== null && String(event.team_id) === String(visibleMatch?.homeId)) {
        extras.goalScorers.home.push(goal)
        mappedHomeGoals += 1
      } else if (event.team_id !== null && String(event.team_id) === String(visibleMatch?.awayId)) {
        extras.goalScorers.away.push(goal)
        mappedAwayGoals += 1
      } else {
        extras.goalScorers.unassigned?.push(goal)
        unassignedGoals += 1
      }
    }

    for (const event of importantLiveEvents) {
      const matchRow = matchRowsByMatchId.get(String(event.match_id))
      if (!matchRow) continue

      const externalKey = String(matchRow.external_id)
      const extras = extrasByExternalId.get(externalKey)
      const liveEvent = mapStoredLiveEvent(
        event,
        matchRow,
        visibleMatchesByExternalId.get(externalKey)
      )

      if (!extras || !liveEvent) continue
      extras.liveEvents.push(liveEvent)
    }

    for (const extras of extrasByExternalId.values()) {
      extras.goalScorers.home.sort(sortGoalScorers)
      extras.goalScorers.away.sort(sortGoalScorers)
      extras.goalScorers.unassigned?.sort(sortGoalScorers)
      extras.liveEvents.sort((a, b) => {
        if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0)
        return (a.extraMinute ?? 0) - (b.extraMinute ?? 0)
      })
    }

    if (shouldLogHomeExtras) {
      for (const match of matches) {
        const externalId = match.externalId ?? match.id
        const row = matchRowsByExternalId.get(String(externalId)) ?? null
        const internalMatchId = row ? String(row.id) : null
        const foundEvents = internalMatchId ? eventsByMatchId.get(internalMatchId) ?? [] : []

        console.info('match events ' + JSON.stringify({
          homeTeamName: match.home,
          awayTeamName: match.away,
          external_id: row?.external_id ?? externalId,
          matchId: match.id,
          internal_match_id: row?.id ?? null,
          date: match.date,
          league: match.league,
          home_team_id: row?.home_team_id ?? match.homeId ?? null,
          away_team_id: row?.away_team_id ?? match.awayId ?? null,
          eventsFound: internalMatchId ? eventsFoundByMatchId.get(internalMatchId) ?? 0 : 0,
          events: foundEvents.map(serializeGoalEventForLog),
        }))
      }

      console.info('[home:match-extras] goleadores leidos desde Supabase ' + JSON.stringify({
        visibleExternalIds: externalFixtureIds.length,
        matchedRows: matchRows.length,
        matchIds: matchIds.length,
        broadcastRows: broadcastRows.length,
        storedEvents: eventRows.length,
        goalEvents: goalEvents.length,
        importantLiveEvents: importantLiveEvents.length,
        mappedHomeGoals,
        mappedAwayGoals,
        unassignedGoals,
      }))
    }

    return extrasByExternalId
  } catch (error) {
    console.warn(
      '[home:match-extras] No se pudieron leer goleadores/canales desde Supabase; se omiten en Home.',
      {
        message: error instanceof Error ? error.message : String(error),
      }
    )

    return empty
  }
}

export async function withGoalScorers(
  matches: MatchListItem[]
): Promise<MatchListItemWithGoalScorers[]> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const extrasTimeoutMs = 12000
  const extrasByFixtureId = await Promise.race([
    getHomeMatchExtrasByFixtureId(matches),
    new Promise<Map<string, HomeMatchExtras>>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn('[home:match-extras] Supabase tardo demasiado; se renderiza Home sin extras.', {
          matches: matches.length,
          timeoutMs: extrasTimeoutMs,
        })
        resolve(new Map())
      }, extrasTimeoutMs)
    }),
  ])

  if (timeoutId) clearTimeout(timeoutId)

  return matches.map((match) => ({
    ...match,
    goalScorers:
      extrasByFixtureId.get(String(match.externalId ?? match.id))?.goalScorers ||
      createEmptyGoalScorers(),
    liveEvents:
      extrasByFixtureId.get(String(match.externalId ?? match.id))?.liveEvents || [],
    persistedInSupabase:
      extrasByFixtureId.get(String(match.externalId ?? match.id))?.persistedInSupabase ??
      false,
    broadcasters:
      extrasByFixtureId.get(String(match.externalId ?? match.id))?.broadcasters || [],
    broadcastChannel:
      extrasByFixtureId.get(String(match.externalId ?? match.id))?.broadcastChannel || null,
    broadcastLogoUrl:
      extrasByFixtureId.get(String(match.externalId ?? match.id))?.broadcastLogoUrl || null,
  }))
}

async function getMatchBroadcastByExternalId(externalId: number) {
  try {
    const supabase = getSupabaseAdminClient()
    const response = await supabase
      .from('matches')
      .select('id, broadcast_channel, broadcast_logo_url')
      .eq('external_id', externalId)
      .maybeSingle()

    if (response.error) {
      const message = response.error.message.toLowerCase()
      const isMissingBroadcastColumn =
        response.error.code === '42703' ||
        message.includes('broadcast_channel') ||
        message.includes('broadcast_logo_url') ||
        message.includes('schema cache')

      if (isMissingBroadcastColumn) return { channel: null, logoUrl: null, broadcasters: [] }
      throw response.error
    }

    const matchId = response.data?.id ? String(response.data.id) : null
    const broadcastRows = matchId
      ? await fetchHomeBroadcastRowsByMatchId(supabase, [matchId])
      : []
    const broadcasters = broadcastRows.map((row) => ({
      name: row.broadcaster_name,
      logoUrl: row.broadcaster_logo_url,
      country: row.country,
    }))

    if (broadcasters.length) {
      return {
        channel: broadcasters.map((broadcaster) => broadcaster.name).join(' / '),
        logoUrl: broadcasters.find((broadcaster) => broadcaster.logoUrl)?.logoUrl ?? null,
        broadcasters,
      }
    }

    return {
      channel: response.data?.broadcast_channel ?? null,
      logoUrl: response.data?.broadcast_logo_url ?? null,
      broadcasters: response.data?.broadcast_channel
        ? [{
            name: response.data.broadcast_channel,
            logoUrl: response.data.broadcast_logo_url,
            country: null,
          }]
        : [],
    }
  } catch (error) {
    console.warn('[match-broadcast] No se pudo leer televisacion del partido.', {
      externalId,
      message: error instanceof Error ? error.message : String(error),
    })

    return { channel: null, logoUrl: null, broadcasters: [] }
  }
}

async function getMatchHighlightsByExternalId(externalId: number) {
  try {
    const supabase = getSupabaseAdminClient()
    const response = await supabase
      .from('matches')
      .select('highlights_url, highlights_title')
      .eq('external_id', externalId)
      .maybeSingle()

    if (response.error) {
      const message = response.error.message.toLowerCase()
      const isMissingHighlightsColumn =
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        message.includes('highlights_url') ||
        message.includes('highlights_title') ||
        message.includes('schema cache')

      if (isMissingHighlightsColumn) return { url: null, title: null }
      throw response.error
    }

    return {
      url: response.data?.highlights_url ?? null,
      title: response.data?.highlights_title ?? null,
    }
  } catch (error) {
    console.warn('[match-highlights] No se pudo leer el resumen del partido.', {
      externalId,
      message: error instanceof Error ? error.message : String(error),
    })

    return { url: null, title: null }
  }
}

type StoredDetailMatchRow = {
  id: number | string
  external_id: number | string | null
  league_id: number | string | null
  round: string | null
  match_date: string | null
  status: string | null
  elapsed?: number | null
  home_team_id: number | string | null
  away_team_id: number | string | null
  home_score: number | null
  away_score: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  venue_name?: string | null
  venue_city?: string | null
  venue_country?: string | null
  broadcast_channel?: string | null
  broadcast_logo_url?: string | null
  highlights_url?: string | null
  highlights_title?: string | null
}

type StoredLeagueRow = {
  id: number | string
  external_id: number | string | null
  name: string | null
  country: string | null
  season: number | null
  logo_url?: string | null
}

type StoredTeamRow = {
  id: number | string
  external_id: number | string | null
  name: string | null
  logo_url?: string | null
  country?: string | null
}

const KNOWN_TOURNAMENT_RESOLUTIONS: ResolvedTournament[] = [
  { leagueId: 128, season: 2026, name: 'Liga Profesional Argentina', country: 'Argentina' },
  { leagueId: 129, season: 2026, name: 'Primera Nacional', country: 'Argentina' },
  { leagueId: 130, season: 2026, name: 'Copa Argentina', country: 'Argentina' },
  { leagueId: 1, season: 2026, name: 'Mundial 2026', country: 'World' },
  { leagueId: 13, season: 2026, name: 'Copa Libertadores', country: 'World' },
  { leagueId: 11, season: 2026, name: 'Copa Sudamericana', country: 'World' },
  { leagueId: 2, season: 2025, name: 'UEFA Champions League', country: 'World' },
  { leagueId: 3, season: 2025, name: 'UEFA Europa League', country: 'World' },
  { leagueId: 848, season: 2025, name: 'UEFA Europa Conference League', country: 'World' },
  { leagueId: 39, season: 2025, name: 'Premier League', country: 'England' },
  { leagueId: 140, season: 2025, name: 'La Liga', country: 'Spain' },
  { leagueId: 135, season: 2025, name: 'Serie A', country: 'Italy' },
  { leagueId: 78, season: 2025, name: 'Bundesliga', country: 'Germany' },
  { leagueId: 61, season: 2025, name: 'Ligue 1', country: 'France' },
  { leagueId: 71, season: 2026, name: 'Brasileirao Serie A', country: 'Brazil' },
]

const KNOWN_TOURNAMENT_ALIASES: Array<ResolvedTournament & { aliases: string[] }> =
  KNOWN_TOURNAMENT_RESOLUTIONS.map((tournament) => ({
    ...tournament,
    aliases: [
      tournament.name,
      tournament.name.replace(/^UEFA\s+/i, ''),
      tournament.name.replace(/\s+2026$/i, ''),
      tournament.leagueId === 128 ? 'Primera Division' : '',
      tournament.leagueId === 128 ? 'Liga Profesional' : '',
      tournament.leagueId === 13 ? 'CONMEBOL Libertadores' : '',
      tournament.leagueId === 11 ? 'CONMEBOL Sudamericana' : '',
      tournament.leagueId === 848 ? 'Conference League' : '',
      tournament.leagueId === 71 ? 'Brasileirao' : '',
    ].filter(Boolean),
  }))

function normalizeStoredStatusShort(status?: string | null) {
  const normalized = (status || '').trim()
  const lower = normalized.toLowerCase()

  if (!normalized) return 'NS'
  if (lower === 'scheduled') return 'NS'
  if (lower === 'final') return 'FT'
  if (lower === 'live') return 'LIVE'

  return normalized.toUpperCase()
}

function getStoredStatusLong(status?: string | null) {
  const short = normalizeStoredStatusShort(status)

  if (short === 'NS') return 'No iniciado'
  if (short === 'TBD') return 'A programar'
  if (short === '1H') return 'Primer tiempo'
  if (short === 'HT') return 'Entretiempo'
  if (short === '2H') return 'Segundo tiempo'
  if (short === 'FT') return 'Finalizado'
  if (short === 'AET') return 'Finalizado en suplementario'
  if (short === 'PEN') return 'Finalizado por penales'
  if (short === 'PST') return 'Postergado'
  if (short === 'CANC') return 'Cancelado'
  if (short === 'SUSP') return 'Suspendido'

  return status || short
}

function toOptionalDate(value?: string | null) {
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null
}

function findKnownTournament(searchTerms: string[], country?: string) {
  const normalizedSearchTerms = searchTerms.map((term) => normalizeSearchValue(term))
  const normalizedCountry = country ? normalizeSearchValue(country) : null

  return KNOWN_TOURNAMENT_ALIASES.find((tournament) => {
    const countryMatches =
      !normalizedCountry ||
      normalizeSearchValue(tournament.country || '') === normalizedCountry ||
      normalizedCountry === 'world'
    const aliasMatches = tournament.aliases.some((alias) => {
      const normalizedAlias = normalizeSearchValue(alias)
      return normalizedSearchTerms.some(
        (term) => normalizedAlias === term || normalizedAlias.includes(term) || term.includes(normalizedAlias)
      )
    })

    return countryMatches && aliasMatches
  }) ?? null
}

async function fetchStoredLeagueRowsByExternalId(leagueId: number, season?: number) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('leagues')
    .select('id, external_id, name, country, season, logo_url')
    .eq('external_id', String(leagueId))
    .order('season', { ascending: false })

  if (season) query = query.eq('season', season)

  const response = await query
  if (response.error) throw response.error
  if (response.data?.length || !season) return (response.data ?? []) as StoredLeagueRow[]

  const fallback = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season, logo_url')
    .eq('external_id', String(leagueId))
    .order('season', { ascending: false })

  if (fallback.error) throw fallback.error
  return (fallback.data ?? []) as StoredLeagueRow[]
}

async function fetchStoredLeagueRowById(leagueId: string | number | null | undefined) {
  if (leagueId === null || leagueId === undefined) return null

  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season, logo_url')
    .eq('id', String(leagueId))
    .maybeSingle()

  if (response.error) throw response.error

  return (response.data as StoredLeagueRow | null) ?? null
}

async function fetchStoredDetailMatchRowByExternalId(externalId: number) {
  const supabase = getSupabaseAdminClient()
  const selectWithOptional =
    'id, external_id, league_id, round, match_date, status, elapsed, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score, venue_name, venue_city, venue_country, broadcast_channel, broadcast_logo_url, highlights_url, highlights_title'
  const selectBase =
    'id, external_id, league_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score'
  const candidates = [externalId, String(externalId)]

  for (const candidate of candidates) {
    let response = await supabase
      .from('matches')
      .select(selectWithOptional)
      .eq('external_id', candidate)
      .maybeSingle()

    if (
      response.error &&
      (
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        response.error.message.toLowerCase().includes('schema cache')
      )
    ) {
      response = await supabase
        .from('matches')
        .select(selectBase)
        .eq('external_id', candidate)
        .maybeSingle()
    }

    if (response.error) throw response.error
    if (response.data) return response.data as StoredDetailMatchRow
  }

  return null
}

async function fetchStoredTeamsByIds(teamIds: Array<string | number | null | undefined>) {
  const supabase = getSupabaseAdminClient()
  const ids = [...new Set(teamIds.filter((id): id is string | number => id !== null && id !== undefined).map(String))]
  const teams = new Map<string, StoredTeamRow>()

  for (const chunk of chunkArray(ids, 100)) {
    let response = await supabase
      .from('teams')
      .select('id, external_id, name, logo_url, country')
      .in('id', chunk)

    if (
      response.error &&
      (
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        response.error.message.toLowerCase().includes('country') ||
        response.error.message.toLowerCase().includes('schema cache')
      )
    ) {
      const fallbackResponse = await supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .in('id', chunk)
      response = fallbackResponse as unknown as typeof response
    }

    if (response.error) throw response.error

    for (const team of (response.data ?? []) as StoredTeamRow[]) {
      teams.set(String(team.id), team)
    }
  }

  return teams
}

async function fetchStoredEventsByMatchId(matchId: string | number) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('match_events')
    .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
    .eq('match_id', String(matchId))
    .order('minute', { ascending: true, nullsFirst: false })
    .order('extra_minute', { ascending: true, nullsFirst: false })

  if (response.error) {
    if (isMissingOptionalStoredEvents(response.error)) return []
    throw response.error
  }

  return (response.data ?? []) as StoredMatchEventRow[]
}

function mapStoredEventToMatchEvent(
  row: StoredMatchEventRow,
  teamsById: Map<string, StoredTeamRow>
): MatchEvent {
  const team = row.team_id !== null && row.team_id !== undefined
    ? teamsById.get(String(row.team_id))
    : null
  const teamExternalId = toFiniteNumber(team?.external_id)

  return {
    team: team
      ? {
          id: teamExternalId ?? undefined,
          name: team.name ?? undefined,
        }
      : undefined,
    player: row.player_name
      ? {
          name: row.player_name,
        }
      : undefined,
    assist: row.assist_name
      ? {
          name: row.assist_name,
        }
      : undefined,
    time: {
      elapsed: row.minute,
      extra: row.extra_minute,
    },
    type: row.type,
    detail: row.detail ?? undefined,
    comments: null,
  }
}

function mapStoredMatchToFixture(
  match: StoredDetailMatchRow,
  league: StoredLeagueRow | null,
  teamsById: Map<string, StoredTeamRow>,
  fallbackExternalId: number
): MatchFixture | null {
  const homeTeam = match.home_team_id !== null && match.home_team_id !== undefined
    ? teamsById.get(String(match.home_team_id))
    : null
  const awayTeam = match.away_team_id !== null && match.away_team_id !== undefined
    ? teamsById.get(String(match.away_team_id))
    : null
  const matchDate = toOptionalDate(match.match_date)

  if (!homeTeam?.name || !awayTeam?.name || !matchDate) return null

  const externalId = toFiniteNumber(match.external_id) ?? fallbackExternalId
  const leagueExternalId = toFiniteNumber(league?.external_id)
  const homeExternalId = toFiniteNumber(homeTeam.external_id)
  const awayExternalId = toFiniteNumber(awayTeam.external_id)
  const statusShort = normalizeStoredStatusShort(match.status)

  return {
    fixture: {
      id: externalId,
      date: matchDate,
      status: {
        short: statusShort,
        long: getStoredStatusLong(match.status),
        elapsed: match.elapsed ?? null,
      },
      venue: {
        name: match.venue_name ?? undefined,
        city: match.venue_city ?? undefined,
      },
    },
    league: {
      id: leagueExternalId ?? undefined,
      name: league?.name || 'Torneo',
      country: league?.country || match.venue_country || '',
      logo: pickLeagueLogoUrl(league?.logo_url, leagueExternalId) ?? undefined,
      round: match.round ?? undefined,
      season: league?.season ?? undefined,
    },
    teams: {
      home: {
        id: homeExternalId ?? undefined,
        name: homeTeam.name,
        logo: pickTeamLogoUrl(homeTeam.logo_url, homeExternalId) ?? undefined,
      },
      away: {
        id: awayExternalId ?? undefined,
        name: awayTeam.name,
        logo: pickTeamLogoUrl(awayTeam.logo_url, awayExternalId) ?? undefined,
      },
    },
    goals: {
      home: match.home_score,
      away: match.away_score,
    },
    score: {
      fulltime: {
        home: match.home_score,
        away: match.away_score,
      },
      penalty: {
        home: match.home_penalty_score ?? null,
        away: match.away_penalty_score ?? null,
      },
    },
  }
}

export async function getMatchDetail(id: number) {
  const match = await fetchStoredDetailMatchRowByExternalId(id)

  if (!match) {
    return {
      fixture: null,
      events: [],
      statistics: [],
      lineups: [],
      broadcastChannel: null,
      broadcastLogoUrl: null,
      broadcasters: [],
      highlightsUrl: null,
      highlightsTitle: null,
    }
  }

  const [league, teamsById, events, broadcast, highlights] = await Promise.all([
    fetchStoredLeagueRowById(match.league_id).catch(() => null),
    fetchStoredTeamsByIds([match.home_team_id, match.away_team_id]),
    fetchStoredEventsByMatchId(match.id),
    getMatchBroadcastByExternalId(id),
    getMatchHighlightsByExternalId(id),
  ])
  const fixture = mapStoredMatchToFixture(match, league, teamsById, id)

  return {
    fixture,
    events: events.map((event) => mapStoredEventToMatchEvent(event, teamsById)),
    statistics: [] as MatchStatisticsTeam[],
    lineups: [] as MatchLineup[],
    broadcastChannel: broadcast.channel ?? match.broadcast_channel ?? null,
    broadcastLogoUrl: broadcast.logoUrl ?? match.broadcast_logo_url ?? null,
    broadcasters: broadcast.broadcasters.length
      ? broadcast.broadcasters
      : match.broadcast_channel
        ? [{
            name: match.broadcast_channel,
            logoUrl: match.broadcast_logo_url ?? null,
            country: null,
          }]
        : [],
    highlightsUrl: match.highlights_url ?? highlights.url,
    highlightsTitle: match.highlights_title ?? highlights.title,
  }
}

export async function getTeamDetail(id: number) {
  const supabase = getSupabaseAdminClient()
  let response = await supabase
    .from('teams')
    .select('id, external_id, name, logo_url, country')
    .eq('external_id', String(id))
    .maybeSingle()

  if (
    response.error &&
    (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('country') ||
      response.error.message.toLowerCase().includes('schema cache')
    )
  ) {
    response = await supabase
      .from('teams')
      .select('id, external_id, name, logo_url')
      .eq('external_id', String(id))
      .maybeSingle()
  }

  if (response.error) throw response.error

  const team = response.data as StoredTeamRow | null
  const externalId = toFiniteNumber(team?.external_id) ?? id

  return {
    team: team
      ? {
          team: {
            id: externalId,
            name: team.name || 'Equipo',
            logo: pickTeamLogoUrl(team.logo_url, externalId) ?? undefined,
            country: team.country ?? undefined,
          },
        }
      : null,
    squad: null as TeamSquad | null,
  }
}

export async function getPlayerDetail(
  id: number,
  season: number,
  leagueId?: number
): Promise<PlayerDetail | null> {
  void id
  void season
  void leagueId

  return null
}

export async function resolveTournament(
  searchTerms: string[],
  country?: string
): Promise<ResolvedTournament | null> {
  const known = findKnownTournament(searchTerms, country)

  if (known) {
    const storedRows = await fetchStoredLeagueRowsByExternalId(known.leagueId, known.season)
      .catch(() => [])
    const stored = storedRows[0]

    return {
      leagueId: known.leagueId,
      season: stored?.season ?? known.season,
      name: stored?.name || known.name,
      country: stored?.country || known.country,
      logo: pickLeagueLogoUrl(stored?.logo_url, known.leagueId) ?? known.logo,
    }
  }

  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('leagues')
    .select('id, external_id, name, country, season, logo_url')
    .order('season', { ascending: false })
    .limit(1000)

  if (response.error) throw response.error

  const normalizedTerms = searchTerms.map((term) => normalizeSearchValue(term))
  const normalizedCountry = country ? normalizeSearchValue(country) : null
  const selected = ((response.data ?? []) as StoredLeagueRow[]).find((league) => {
    const name = normalizeSearchValue(league.name || '')
    const countryMatches =
      !normalizedCountry ||
      normalizeSearchValue(league.country || '') === normalizedCountry ||
      normalizedCountry === 'world'

    return countryMatches && normalizedTerms.some((term) => name === term || name.includes(term) || term.includes(name))
  })

  const leagueId = toFiniteNumber(selected?.external_id)
  if (!selected || !leagueId || !selected.season) return null

  return {
    leagueId,
    season: selected.season,
    name: selected.name || searchTerms[0] || 'Torneo',
    country: selected.country ?? country,
    logo: pickLeagueLogoUrl(selected.logo_url, leagueId) ?? undefined,
  }
}

function getStandingTeamKey(teamId: number | undefined, name: string) {
  return teamId !== undefined ? `id:${teamId}` : `name:${normalizeSearchValue(name)}`
}

function getStandingAccumulator(
  table: Map<string, CalculatedStandingAccumulator>,
  teamId: number | undefined,
  teamName: string,
  teamLogo?: string
) {
  const key = getStandingTeamKey(teamId, teamName)
  const current = table.get(key)

  if (current) return current

  const next: CalculatedStandingAccumulator = {
    teamId,
    teamName,
    teamLogo,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  }

  table.set(key, next)
  return next
}

export async function getLeagueStandings(
  leagueId: number,
  season: number
): Promise<LeagueStandingGroup[]> {
  const fixtures = await getLeagueFixtures(leagueId, season)
  const table = new Map<string, CalculatedStandingAccumulator>()
  let countedFixtures = 0

  for (const fixture of fixtures) {
    if (!isFinishedStatus(fixture.statusShort)) continue
    if (
      leagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID &&
      !isLigaProfesionalRegularSeasonRound(fixture.round)
    ) {
      continue
    }

    const homeGoals = fixture.goalsHome
    const awayGoals = fixture.goalsAway
    if (homeGoals === null || awayGoals === null) continue

    const home = getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
    const away = getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

    countedFixtures += 1
    home.played += 1
    home.goalsFor += homeGoals
    home.goalsAgainst += awayGoals
    away.played += 1
    away.goalsFor += awayGoals
    away.goalsAgainst += homeGoals

    if (homeGoals > awayGoals) {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (homeGoals < awayGoals) {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst
    away.goalDifference = away.goalsFor - away.goalsAgainst
  }

  const rows = [...table.values()]
    .filter((row) => row.played > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return a.teamName.localeCompare(b.teamName, 'es-AR')
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }))

  console.info('[standings:supabase]', {
    leagueId,
    season,
    fixtures: fixtures.length,
    countedFixtures,
    teams: rows.length,
  })

  return rows.length ? [{ name: 'Tabla', rows }] : []
}

type StoredLeagueFixtureMatchRow = {
  id: number | string
  external_id: number | string | null
  home_team_id: number | string | null
  away_team_id: number | string | null
}

function isMissingOptionalStoredEvents(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes('match_events') ||
    message.includes('schema cache')
  )
}

function mapStoredEventToLeagueFixtureEvent(
  row: StoredMatchEventRow,
  matchRow: StoredLeagueFixtureMatchRow
): LeagueFixtureEventSummary {
  const teamId = row.team_id ?? null
  const teamSide =
    teamId !== null && String(teamId) === String(matchRow.home_team_id)
      ? 'home'
      : teamId !== null && String(teamId) === String(matchRow.away_team_id)
        ? 'away'
        : null

  return {
    id: String(
      row.external_event_id ??
      row.id ??
      `${matchRow.external_id ?? matchRow.id}:${row.minute ?? 'minute'}:${row.player_name ?? 'event'}`
    ),
    teamId,
    teamSide,
    playerName: row.player_name || 'Evento',
    assistName: row.assist_name ?? null,
    minute: row.minute,
    extraMinute: row.extra_minute,
    type: row.type,
    detail: row.detail,
  }
}

async function enrichLeagueFixturesWithStoredEvents(
  leagueId: number,
  fixtures: LeagueFixtureSummary[]
) {
  if (leagueId !== 130 || !fixtures.length) return fixtures

  try {
    const supabase = getSupabaseAdminClient()
    const externalIds = [
      ...new Set(fixtures.flatMap((fixture) => [fixture.id, String(fixture.id)])),
    ]
    const matchRows: StoredLeagueFixtureMatchRow[] = []

    for (const chunk of chunkArray(externalIds, 100)) {
      const response = await supabase
        .from('matches')
        .select('id, external_id, home_team_id, away_team_id')
        .in('external_id', chunk)

      if (response.error) throw response.error
      matchRows.push(...((response.data ?? []) as StoredLeagueFixtureMatchRow[]))
    }

    if (!matchRows.length) return fixtures

    const matchRowsByMatchId = new Map(matchRows.map((row) => [String(row.id), row]))
    const matchRowsByExternalId = new Map(
      matchRows
        .filter((row) => row.external_id !== null && row.external_id !== undefined)
        .map((row) => [String(row.external_id), row])
    )
    const eventsByMatchId = new Map<string, StoredMatchEventRow[]>()

    for (const chunk of chunkArray([...matchRowsByMatchId.keys()], 100)) {
      const response = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)
        .order('minute', { ascending: true })
        .order('extra_minute', { ascending: true })

      if (response.error) {
        if (isMissingOptionalStoredEvents(response.error)) return fixtures
        throw response.error
      }

      for (const event of (response.data ?? []) as StoredMatchEventRow[]) {
        const matchId = String(event.match_id)
        const current = eventsByMatchId.get(matchId) ?? []
        current.push(event)
        eventsByMatchId.set(matchId, current)
      }
    }

    return fixtures.map((fixture) => {
      const matchRow = matchRowsByExternalId.get(String(fixture.id))
      if (!matchRow) return fixture

      const events = (eventsByMatchId.get(String(matchRow.id)) ?? [])
        .map((event) => mapStoredEventToLeagueFixtureEvent(event, matchRow))
        .sort((a, b) => {
          if ((a.minute ?? 0) !== (b.minute ?? 0)) return (a.minute ?? 0) - (b.minute ?? 0)
          return (a.extraMinute ?? 0) - (b.extraMinute ?? 0)
        })

      return {
        ...fixture,
        events,
      }
    })
  } catch (error) {
    console.warn('[copa-argentina:events] No se pudieron leer incidencias desde Supabase.', {
      leagueId,
      message: error instanceof Error ? error.message : String(error),
    })

    return fixtures
  }
}

type StoredDerivedLigaFixtureRow = {
  id: string | number
  external_id: string | number | null
  round: string | null
  match_date: string | null
  status: string | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  home_score: number | null
  away_score: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  source?: string | null
  is_derived?: boolean | null
  bracket_phase?: string | null
  bracket_slot?: number | null
}

type StoredDerivedTeamRow = {
  id: string | number
  name: string | null
  external_id: string | number | null
  logo_url?: string | null
}

function isMissingDerivedFixtureColumns(error: { code?: string; message?: string } | unknown) {
  const errorObject =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : {}
  const message = (errorObject.message ?? String(error)).toLowerCase()

  return (
    errorObject.code === '42703' ||
    errorObject.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('is_derived') ||
    message.includes('bracket_phase') ||
    message.includes('bracket_slot')
  )
}

function toOptionalNumericId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined

  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : undefined
}

function getLigaProfesionalPhaseRound(row: StoredDerivedLigaFixtureRow) {
  const phaseKey = getLeagueFinalPhaseKey(row.round) ?? getLeagueFinalPhaseKey(row.bracket_phase)

  if (!phaseKey) return row.round?.trim() || 'A confirmar'

  return row.round?.trim() || getLeagueRoundLabel(phaseKey, LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) || 'A confirmar'
}

function getFixtureTeamIdentity(teamId: number | undefined, name: string) {
  const normalizedName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return teamId !== undefined ? `id:${teamId}` : `name:${normalizedName}`
}

function sameFixtureTeam(
  aId: number | undefined,
  aName: string,
  bId: number | undefined,
  bName: string
) {
  const aKey = getFixtureTeamIdentity(aId, aName)
  const bKey = getFixtureTeamIdentity(bId, bName)

  return aKey === bKey
}

function sameFixturePair(a: LeagueFixtureSummary, b: LeagueFixtureSummary) {
  return (
    (
      sameFixtureTeam(a.homeId, a.home, b.homeId, b.home) &&
      sameFixtureTeam(a.awayId, a.away, b.awayId, b.away)
    ) ||
    (
      sameFixtureTeam(a.homeId, a.home, b.awayId, b.away) &&
      sameFixtureTeam(a.awayId, a.away, b.homeId, b.home)
    )
  )
}

function shouldKeepDerivedLigaFixture(
  derivedFixture: LeagueFixtureSummary,
  officialFixtures: LeagueFixtureSummary[]
) {
  const derivedPhase = getLeagueFinalPhaseKey(derivedFixture.round)
  if (!derivedPhase) return false

  return !officialFixtures.some((fixture) => {
    const fixturePhase = getLeagueFinalPhaseKey(fixture.round)

    return fixturePhase === derivedPhase && sameFixturePair(fixture, derivedFixture)
  })
}

async function fetchDerivedLigaProfesionalFixtures(
  leagueId: number,
  season: number
): Promise<LeagueFixtureSummary[]> {
  if (leagueId !== LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) return []

  try {
    const supabase = getSupabaseAdminClient()
    let leagueQuery = supabase
      .from('leagues')
      .select('id')
      .eq('external_id', leagueId)
      .order('season', { ascending: false })

    if (season) leagueQuery = leagueQuery.eq('season', season)

    const leagueResponse = await leagueQuery.limit(1)

    if (leagueResponse.error) throw leagueResponse.error

    const leagueRow = (leagueResponse.data ?? [])[0] as { id: string | number } | undefined
    if (!leagueRow) return []

    const matchResponse = await supabase
      .from('matches')
      .select(
        'id, external_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score, source, is_derived, bracket_phase, bracket_slot'
      )
      .eq('league_id', leagueRow.id)
      .or('is_derived.eq.true,source.eq.derived,external_id.is.null')
      .order('match_date', { ascending: true, nullsFirst: false })

    let rawRows: StoredDerivedLigaFixtureRow[]

    if (matchResponse.error) {
      if (!isMissingDerivedFixtureColumns(matchResponse.error)) throw matchResponse.error

      const fallbackResponse = await supabase
        .from('matches')
        .select(
          'id, external_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score'
        )
        .eq('league_id', leagueRow.id)
        .is('external_id', null)
        .order('match_date', { ascending: true, nullsFirst: false })

      if (fallbackResponse.error) throw fallbackResponse.error

      rawRows = (fallbackResponse.data ?? []) as StoredDerivedLigaFixtureRow[]
    } else {
      rawRows = (matchResponse.data ?? []) as StoredDerivedLigaFixtureRow[]
    }

    const rows = rawRows.filter((row) =>
      Boolean(getLeagueFinalPhaseKey(row.round) ?? getLeagueFinalPhaseKey(row.bracket_phase))
    )

    if (!rows.length) return []

    const teamIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.home_team_id, row.away_team_id])
          .filter((id): id is string | number => id !== null && id !== undefined)
          .map(String)
      ),
    ]
    const teams: StoredDerivedTeamRow[] = []

    for (let index = 0; index < teamIds.length; index += 100) {
      const chunk = teamIds.slice(index, index + 100)
      const teamResponse = await supabase
        .from('teams')
        .select('id, name, external_id, logo_url')
        .in('id', chunk)

      if (teamResponse.error) throw teamResponse.error
      teams.push(...((teamResponse.data ?? []) as StoredDerivedTeamRow[]))
    }

    const teamsById = new Map(teams.map((team) => [String(team.id), team]))

    return rows.map((row) => {
      const homeTeam =
        row.home_team_id !== null && row.home_team_id !== undefined
          ? teamsById.get(String(row.home_team_id))
          : undefined
      const awayTeam =
        row.away_team_id !== null && row.away_team_id !== undefined
          ? teamsById.get(String(row.away_team_id))
          : undefined
      const homeId = toOptionalNumericId(homeTeam?.external_id)
      const awayId = toOptionalNumericId(awayTeam?.external_id)

      return {
        id: String(row.id),
        round: getLigaProfesionalPhaseRound(row),
        date: row.match_date,
        statusShort: row.status || 'TBD',
        minute: null,
        home: homeTeam?.name || 'A confirmar',
        homeId,
        away: awayTeam?.name || 'A confirmar',
        awayId,
        homeLogo: pickTeamLogoUrl(homeTeam?.logo_url, homeTeam?.external_id) ?? undefined,
        awayLogo: pickTeamLogoUrl(awayTeam?.logo_url, awayTeam?.external_id) ?? undefined,
        goalsHome: row.home_score,
        goalsAway: row.away_score,
        homePenaltyScore: row.home_penalty_score ?? null,
        awayPenaltyScore: row.away_penalty_score ?? null,
        venueName: null,
        venueCity: null,
        venueCountry: 'Argentina',
      }
    })
  } catch (error) {
    console.warn('[liga-profesional:derived-fixtures] No se pudieron leer cruces derivados.', {
      leagueId,
      season,
      message: error instanceof Error ? error.message : String(error),
    })

    return []
  }
}

async function mergeLigaProfesionalDerivedFixtures(
  leagueId: number,
  season: number,
  officialFixtures: LeagueFixtureSummary[]
) {
  const derivedFixtures = await fetchDerivedLigaProfesionalFixtures(leagueId, season)

  if (!derivedFixtures.length) return officialFixtures

  const missingDerivedFixtures = derivedFixtures.filter((fixture) =>
    shouldKeepDerivedLigaFixture(fixture, officialFixtures)
  )

  return [...officialFixtures, ...missingDerivedFixtures].sort(compareLeagueFixturesByApiOrder)
}

function mapCachedLeagueFixturePayload(payload: unknown): LeagueFixtureSummary | null {
  if (!payload || typeof payload !== 'object') return null

  const row = payload as Record<string, unknown>
  const id = getNumberFromCachedValue(row.id ?? row.externalId)
  const homeId = getNumberFromCachedValue(row.homeId)
  const awayId = getNumberFromCachedValue(row.awayId)
  const home = getStringFromCachedValue(row.home)
  const away = getStringFromCachedValue(row.away)
  const date = getStringFromCachedValue(row.date)

  if (!id || !home || !away || !date) return null

  return {
    id,
    round: getStringFromCachedValue(row.round) ?? 'Fecha',
    date,
    statusShort: getStringFromCachedValue(row.statusShort) ?? 'NS',
    minute: getNumberFromCachedValue(row.minute),
    home,
    homeId: homeId ?? undefined,
    away,
    awayId: awayId ?? undefined,
    homeLogo: getNullableStringFromCachedValue(row.homeLogo),
    awayLogo: getNullableStringFromCachedValue(row.awayLogo),
    goalsHome: getNumberFromCachedValue(row.goalsHome),
    goalsAway: getNumberFromCachedValue(row.goalsAway),
    venueName: null,
    venueCity: null,
    venueCountry: getNullableStringFromCachedValue(row.country) ?? null,
    events: [],
  }
}

async function fetchCachedLeagueFixtures(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueId: number
) {
  const response = await supabase
    .from('football_fixture_cache')
    .select('normalized_payload')
    .eq('league_external_id', String(leagueId))
    .order('date', { ascending: true })
    .order('fixture_external_id', { ascending: true })
    .limit(1000)

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const missingCacheTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('football_fixture_cache') ||
      message.includes('schema cache')

    if (missingCacheTable) return []

    throw response.error
  }

  return ((response.data ?? []) as CachedHomeFixtureRow[])
    .map((row) => mapCachedLeagueFixturePayload(row.normalized_payload))
    .filter((fixture): fixture is LeagueFixtureSummary => Boolean(fixture))
    .sort(compareLeagueFixturesByApiOrder)
}

export async function getLeagueFixtures(leagueId: number, season: number) {
  const supabase = getSupabaseAdminClient()
  const leagueRows = await fetchStoredLeagueRowsByExternalId(leagueId, season)
  const leagueIds = leagueRows.map((league) => String(league.id))
  const storedMatches: StoredDetailMatchRow[] = []

  for (const chunk of chunkArray(leagueIds, 50)) {
    let response = await supabase
      .from('matches')
      .select('id, external_id, league_id, round, match_date, status, elapsed, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score, venue_name, venue_city, venue_country')
      .in('league_id', chunk)
      .order('match_date', { ascending: true, nullsFirst: false })
      .limit(1000)

    if (
      response.error &&
      (
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        response.error.message.toLowerCase().includes('schema cache')
      )
    ) {
      const fallbackResponse = await supabase
        .from('matches')
        .select('id, external_id, league_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score')
        .in('league_id', chunk)
        .order('match_date', { ascending: true, nullsFirst: false })
        .limit(1000)
      response = fallbackResponse as unknown as typeof response
    }

    if (response.error) throw response.error
    storedMatches.push(...((response.data ?? []) as StoredDetailMatchRow[]))
  }

  if (!storedMatches.length) {
    const cachedFixtures = await fetchCachedLeagueFixtures(supabase, leagueId)
    const mergedCachedFixtures = await mergeLigaProfesionalDerivedFixtures(
      leagueId,
      season,
      cachedFixtures
    )
    logCopaArgentinaFixtureDebug(leagueId, season, mergedCachedFixtures, 'cache')
    return mergedCachedFixtures
  }

  const teamsById = await fetchStoredTeamsByIds(
    storedMatches.flatMap((match) => [match.home_team_id, match.away_team_id])
  )
  const leaguesById = new Map(leagueRows.map((league) => [String(league.id), league]))
  const mappedFixtures = storedMatches
    .map((match): LeagueFixtureSummary | null => {
      const homeTeam = match.home_team_id !== null && match.home_team_id !== undefined
        ? teamsById.get(String(match.home_team_id))
        : null
      const awayTeam = match.away_team_id !== null && match.away_team_id !== undefined
        ? teamsById.get(String(match.away_team_id))
        : null

      if (!homeTeam?.name || !awayTeam?.name) return null

      const league = match.league_id !== null && match.league_id !== undefined
        ? leaguesById.get(String(match.league_id))
        : null
      const fixtureExternalId = toFiniteNumber(match.external_id)
      const homeExternalId = toFiniteNumber(homeTeam.external_id)
      const awayExternalId = toFiniteNumber(awayTeam.external_id)

      return {
        id: fixtureExternalId ?? String(match.id),
        round: match.round || 'Fecha',
        date: match.match_date,
        statusShort: normalizeStoredStatusShort(match.status),
        minute: match.elapsed ?? null,
        home: homeTeam.name,
        homeId: homeExternalId ?? undefined,
        away: awayTeam.name,
        awayId: awayExternalId ?? undefined,
        homeLogo: pickTeamLogoUrl(homeTeam.logo_url, homeExternalId) ?? undefined,
        awayLogo: pickTeamLogoUrl(awayTeam.logo_url, awayExternalId) ?? undefined,
        goalsHome: match.home_score,
        goalsAway: match.away_score,
        homePenaltyScore: match.home_penalty_score ?? null,
        awayPenaltyScore: match.away_penalty_score ?? null,
        venueName: match.venue_name ?? null,
        venueCity: match.venue_city ?? null,
        venueCountry: match.venue_country ?? league?.country ?? null,
      }
    })
    .filter((fixture): fixture is LeagueFixtureSummary => Boolean(fixture))

  const enrichedFixtures = await enrichLeagueFixturesWithStoredEvents(leagueId, mappedFixtures)
  const mergedFixtures = await mergeLigaProfesionalDerivedFixtures(
    leagueId,
    season,
    enrichedFixtures
  )
  logCopaArgentinaFixtureDebug(leagueId, season, mergedFixtures, 'cache')

  return mergedFixtures
}

function isPlayedFixture(statusShort: string) {
  return !['NS', 'TBD', 'PST', 'CANC'].includes(statusShort)
}

function normalizePersonName(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function translateEventDetail(detail?: string) {
  const normalized = (detail || '').trim().toLowerCase()

  if (!normalized) return 'Gol'
  if (normalized === 'normal goal') return 'Gol'
  if (normalized === 'penalty') return 'Gol de penal'
  if (normalized === 'missed penalty') return 'Penal errado'
  if (normalized === 'own goal') return 'Gol en contra'
  if (normalized === 'penalty shootout') return 'Definicion por penales'

  return detail || 'Gol'
}

function getEventLabel(event: MatchEvent, statType: LeaderStatType) {
  if (statType === 'scorers') {
    return translateEventDetail(event.detail)
  }

  if (statType === 'assists') return 'Asistencia'
  if (statType === 'yellowCards') return 'Tarjeta amarilla'
  return 'Tarjeta roja'
}

function eventMatchesPlayer(
  event: MatchEvent,
  playerId: number,
  statType: LeaderStatType,
  playerName?: string
) {
  const tokenMatches = (source: string[], target: string[]) => {
    if (!source.length || !target.length) return false

    return source.every((sourceToken) =>
      target.some((targetToken) => {
        if (sourceToken === targetToken) return true
        if (sourceToken.length === 1 && targetToken.startsWith(sourceToken)) return true
        if (targetToken.length === 1 && sourceToken.startsWith(targetToken)) return true
        return false
      })
    )
  }

  const matchesByName = (candidate?: { name?: string }) => {
    const normalizedPlayerName = normalizePersonName(playerName)
    const normalizedCandidateName = normalizePersonName(candidate?.name)

    if (!normalizedPlayerName || !normalizedCandidateName) return false
    if (normalizedPlayerName === normalizedCandidateName) return true
    if (normalizedPlayerName.includes(normalizedCandidateName)) return true
    if (normalizedCandidateName.includes(normalizedPlayerName)) return true

    const playerTokens = normalizedPlayerName.split(' ').filter(Boolean)
    const candidateTokens = normalizedCandidateName.split(' ').filter(Boolean)

    if (!playerTokens.length || !candidateTokens.length) return false
    if (playerTokens[playerTokens.length - 1] === candidateTokens[candidateTokens.length - 1]) {
      if (tokenMatches(candidateTokens, playerTokens) || tokenMatches(playerTokens, candidateTokens)) {
        return true
      }
    }

    const sharedTokens = playerTokens.filter((token) => candidateTokens.includes(token))

    return sharedTokens.length >= Math.min(2, playerTokens.length, candidateTokens.length)
  }

  if (statType === 'scorers') {
    return (
      isValidGoalForScorerTable(event) &&
      (event.player?.id === playerId || matchesByName(event.player))
    )
  }

  if (statType === 'assists') {
    return (
      isValidAssistEvent(event) &&
      (event.assist?.id === playerId || matchesByName(event.assist))
    )
  }

  if (statType === 'yellowCards') {
    return (
      isYellowCardEvent(event) &&
      (event.player?.id === playerId || matchesByName(event.player))
    )
  }

  return (
    isRedCardEvent(event) &&
    (event.player?.id === playerId || matchesByName(event.player))
  )
}

const playerEventCache = new Map<
  string,
  {
    expiresAt: number
    data: PlayerEventMatch[]
  }
>()

const fixtureEventCache = new Map<
  number,
  {
    expiresAt: number
    data: MatchEvent[]
  }
>()

async function getFixtureEvents(fixtureId: number) {
  const cached = fixtureEventCache.get(fixtureId)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const match = await fetchStoredDetailMatchRowByExternalId(fixtureId)
  const teamsById = match
    ? await fetchStoredTeamsByIds([match.home_team_id, match.away_team_id])
    : new Map<string, StoredTeamRow>()
  const data = match
    ? (await fetchStoredEventsByMatchId(match.id)).map((event) =>
        mapStoredEventToMatchEvent(event, teamsById)
      )
    : []

  fixtureEventCache.set(fixtureId, {
    expiresAt: Date.now() + 10 * 60 * 1000,
    data,
  })

  return data
}

export async function getPlayerEventMatches(
  leagueId: number,
  season: number,
  playerId: number,
  statType: LeaderStatType,
  playerName?: string,
  teamId?: number,
  expectedCount?: number
): Promise<PlayerEventMatch[]> {
  const cacheKey = `${leagueId}:${season}:${playerId}:${statType}:${normalizePersonName(playerName)}:${teamId || 0}:${expectedCount || 0}`
  const cached = playerEventCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const fixtures = (await getLeagueFixtures(leagueId, season))
    .filter((fixture): fixture is LeagueFixtureSummary & { id: number; date: string } => {
      if (typeof fixture.id !== 'number' || !fixture.date) return false
      if (!isPlayedFixture(fixture.statusShort)) return false

      const belongsToTeam = !teamId || fixture.homeId === teamId || fixture.awayId === teamId
      if (!belongsToTeam) return false

      if ((statType === 'scorers' || statType === 'assists') && teamId) {
        const teamGoals =
          fixture.homeId === teamId ? (fixture.goalsHome || 0) : (fixture.goalsAway || 0)

        return teamGoals > 0
      }

      return true
    })
    .sort((a, b) => getLeagueFixtureTimestamp(b.date) - getLeagueFixtureTimestamp(a.date))

  const matches: PlayerEventMatch[] = []
  let totalMatchedEvents = 0

  for (const fixture of fixtures) {
    const matchingEvents = (await getFixtureEvents(fixture.id))
      .filter((event) => eventMatchesPlayer(event, playerId, statType, playerName))
      .map((event) => ({
        minute: event.time?.elapsed ?? null,
        extraMinute: event.time?.extra ?? null,
        label: getEventLabel(event, statType),
      }))

    if (!matchingEvents.length) continue

    totalMatchedEvents += matchingEvents.length

    matches.push({
      fixtureId: fixture.id,
      round: fixture.round,
      date: fixture.date,
      home: fixture.home,
      away: fixture.away,
      homeLogo: fixture.homeLogo,
      awayLogo: fixture.awayLogo,
      goalsHome: fixture.goalsHome,
      goalsAway: fixture.goalsAway,
      events: matchingEvents,
    })

    if (expectedCount && totalMatchedEvents >= expectedCount) {
      break
    }
  }

  matches.sort((a, b) => getLeagueFixtureTimestamp(b.date) - getLeagueFixtureTimestamp(a.date))

  playerEventCache.set(cacheKey, {
    expiresAt: Date.now() + 5 * 60 * 1000,
    data: matches,
  })

  return matches
}

export async function getLeagueLeaders(leagueId: number, season: number) {
  try {
    const eventLeaders = await getLeagueEventStatsLeaders(leagueId, season)

    if (eventLeaders.hasEvents) {
      return {
        scorers: eventLeaders.scorers,
        assists: eventLeaders.assists,
        yellowCards: eventLeaders.yellowCards,
        redCards: eventLeaders.redCards,
      }
    }
  } catch (error) {
    console.warn('[league-leaders] No se pudieron armar rankings desde match_events.', {
      leagueId,
      season,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    scorers: [],
    assists: [],
    yellowCards: [],
    redCards: [],
  }
}
