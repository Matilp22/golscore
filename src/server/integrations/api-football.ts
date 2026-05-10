import {
  readPersistentCache,
  readStoredFixturesByDate,
  readStoredFixturesByLeagueSeason,
  upsertStoredFixtures,
  writePersistentCache,
} from '@/server/cache/cache-db'
import { getFootballApiConfig } from '@/server/config/env'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isFinishedStatus, isLiveStatus } from '@/shared/utils/match-status'
import { formatEventMinute } from '@/shared/utils/event-minute'
import {
  addDaysToISO,
  getArgentinaDayUtcRange,
  getArgentinaDateISO,
  getArgentinaTodayISO,
} from '@/shared/utils/argentina-time'
import {
  getGoalKindFromDetail,
  getImportantLiveEventKind,
  isScoreboardGoalEvent,
  type ImportantLiveEventKind,
} from '@/shared/utils/football-events'
import { isLigaProfesionalRegularSeasonRound } from '@/shared/utils/league-rounds'
import { getFixtureStatusElapsedMinute } from '@/shared/utils/match-minute'
import {
  enrichMatchDetailAssets,
  enrichPlayerDetailAssets,
  enrichTeamDetailAssets,
  enrichTopPlayerAssets,
  persistFixtureListAssets,
} from '@/server/assets/image-assets'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'
import {
  getApiSportsTeamLogoUrl,
  pickStableAssetUrl,
} from '@/shared/utils/asset-urls'

type ApiFootballResponse<T> = {
  errors?: Record<string, string>
  response?: T[]
}

type ApiRequestOptions = {
  revalidate?: number
  noStore?: boolean
}

type CacheEntry = {
  expiresAt: number
  data: ApiFootballResponse<unknown>
}

const apiResponseCache = new Map<string, CacheEntry>()
const inflightApiRequests = new Map<string, Promise<ApiFootballResponse<unknown>>>()
const API_FOOTBALL_REQUEST_TIMEOUT_MS = 8000
const HOME_SUPABASE_TIMEOUT_MS = 5000
const HOME_API_FALLBACK_TIMEOUT_MS = 9000
const HOME_STORED_MATCHES_SUPPLEMENT_THRESHOLD = 6

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
  id: number
  round: string
  date: string
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

function compareLeagueFixturesByApiOrder(
  a: Pick<LeagueFixtureSummary, 'round' | 'date' | 'id'>,
  b: Pick<LeagueFixtureSummary, 'round' | 'date' | 'id'>
) {
  const roundCompare = getApiRoundOrder(a.round) - getApiRoundOrder(b.round)
  if (roundCompare !== 0) return roundCompare

  const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
  if (dateCompare !== 0) return dateCompare

  return a.id - b.id
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

type PlayerBirth = {
  date?: string
  place?: string
  country?: string
}

type PlayerProfileInfo = {
  id?: number
  name?: string
  firstname?: string
  lastname?: string
  age?: number
  birth?: PlayerBirth
  nationality?: string
  height?: string
  weight?: string
  injured?: boolean
  photo?: string
}

type LeagueSearchSeason = {
  year: number
  current?: boolean
}

type LeagueSearchItem = {
  league?: {
    id?: number
    name?: string
    type?: string
    logo?: string
  }
  country?: {
    name?: string
  }
  seasons?: LeagueSearchSeason[]
}

export type ResolvedTournament = {
  leagueId: number
  season: number
  name: string
  country?: string
  logo?: string
}

type StandingStats = {
  played?: number
  win?: number
  draw?: number
  lose?: number
  goals?: {
    for?: number
    against?: number
  }
}

type StandingEntry = {
  rank?: number
  points?: number
  goalsDiff?: number
  team?: TeamInfo
  all?: StandingStats
  group?: string
  description?: string | null
  form?: string
}

type StandingLeague = {
  standings?: StandingEntry[][]
}

type StandingResponseItem = {
  league?: StandingLeague
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

const CALCULATED_STANDINGS_LEAGUE_IDS = new Set([128])

type PlayerStatistic = {
  team?: TeamInfo
  league?: {
    id?: number
    name?: string
    country?: string
    logo?: string
    season?: number
  }
  games?: {
    appearences?: number | null
    lineups?: number | null
    minutes?: number | null
    position?: string | null
    rating?: string | null
  }
  goals?: {
    total?: number | null
    assists?: number | null
  }
  cards?: {
    yellow?: number | null
    red?: number | null
  }
}

type TopPlayerResponseItem = {
  player?: PlayerProfileInfo
  statistics?: PlayerStatistic[]
}

export type TopPlayerRow = {
  playerId?: number
  name: string
  photo?: string
  teamId?: number
  teamName?: string
  teamLogo?: string
  value: number
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

function isHomeApiFallbackFixture(item: FixtureListItem) {
  return getHomeMatchVisibility({
    leagueId: item.league.id ?? null,
    league: item.league.name,
    country: item.league.country,
    home: item.teams.home.name,
    away: item.teams.away.name,
    round: item.league.round,
  }).included
}

function getArgentinaDateKey(dateString: string) {
  return getArgentinaDateISO(dateString)
}

function getMatchMergeKey(match: MatchListItem) {
  return String(match.externalId ?? match.id)
}

function mergeHomeMatches(
  storedMatches: MatchListItem[],
  apiMatches: MatchListItem[],
  options: { apiAuthoritative?: boolean } = {}
) {
  const mergedByExternalId = new Map<string, MatchListItem>()

  if (!options.apiAuthoritative) {
    for (const match of storedMatches) {
      mergedByExternalId.set(getMatchMergeKey(match), match)
    }
  }

  for (const apiMatch of apiMatches) {
    const key = getMatchMergeKey(apiMatch)
    const storedMatch =
      mergedByExternalId.get(key) ||
      storedMatches.find((match) => getMatchMergeKey(match) === key)

    mergedByExternalId.set(
      key,
      storedMatch
        ? {
            ...storedMatch,
            ...apiMatch,
            leagueLogo: apiMatch.leagueLogo ?? storedMatch.leagueLogo,
            homeLogo: apiMatch.homeLogo ?? storedMatch.homeLogo,
            awayLogo: apiMatch.awayLogo ?? storedMatch.awayLogo,
          }
        : apiMatch
    )
  }

  return [...mergedByExternalId.values()]
}

function shouldSupplementStoredHomeMatches(date: string, storedMatches: MatchListItem[]) {
  const today = getArgentinaTodayISO()
  const yesterday = addDaysToISO(today, -1)
  const tomorrow = addDaysToISO(today, 1)

  if (date === yesterday || date === today || date === tomorrow) {
    return true
  }

  return storedMatches.length < HOME_STORED_MATCHES_SUPPLEMENT_THRESHOLD
}

function pickBestSeason(seasons?: LeagueSearchSeason[]) {
  if (!seasons?.length) return undefined

  const currentSeason = seasons.find((entry) => entry.current)
  if (currentSeason) return currentSeason.year

  const currentYear = new Date().getFullYear()
  const sorted = [...seasons].sort((a, b) => b.year - a.year)
  const recentSeason = sorted.find((entry) => entry.year <= currentYear + 1)

  return recentSeason?.year || sorted[0]?.year
}

async function apiFootball(
  path: string,
  params?: Record<string, string | number | undefined>,
  options?: ApiRequestOptions
): Promise<ApiFootballResponse<unknown>> {
  const { apiKey, baseUrl } = getFootballApiConfig()
  const url = new URL(`${baseUrl}${path}`)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const cacheKey = url.toString()
  const ttlSeconds = options?.noStore ? 0 : options?.revalidate ?? 30
  const shouldPersist = ttlSeconds >= 300 || path === '/fixtures'

  if (ttlSeconds > 0) {
    const cached = apiResponseCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }
  }

  if (shouldPersist) {
    const persistentCache = readPersistentCache<ApiFootballResponse<unknown>>(cacheKey)

    if (persistentCache && !persistentCache.isExpired) {
      apiResponseCache.set(cacheKey, {
        expiresAt: persistentCache.expiresAt,
        data: persistentCache.data,
      })

      return persistentCache.data
    }
  }

  const existingRequest = inflightApiRequests.get(cacheKey)
  if (existingRequest) return existingRequest

  const requestPromise = (async () => {
    const abortController = new AbortController()
    const timeoutId = setTimeout(
      () => abortController.abort(),
      API_FOOTBALL_REQUEST_TIMEOUT_MS
    )
    let res: Response

    try {
      res = await fetch(url.toString(), {
        headers: {
          'x-apisports-key': apiKey,
        },
        signal: abortController.signal,
        ...(options?.noStore
          ? { cache: 'no-store' as const }
          : { next: { revalidate: ttlSeconds } }),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`API timeout: ${path}`)
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`)
    }

    const data = (await res.json()) as ApiFootballResponse<unknown>

    if (data.errors && Object.keys(data.errors).length > 0) {
      const [code, message] = Object.entries(data.errors)[0]
      throw new ApiFootballError(message, code)
    }

    if (ttlSeconds > 0) {
      apiResponseCache.set(cacheKey, {
        expiresAt: Date.now() + ttlSeconds * 1000,
        data,
      })
    }

    if (shouldPersist) {
      writePersistentCache(cacheKey, path, data, ttlSeconds)
    }

    return data
  })()

  inflightApiRequests.set(cacheKey, requestPromise)

  try {
    return await requestPromise
  } catch (error) {
    if (shouldPersist) {
      const persistentCache = readPersistentCache<ApiFootballResponse<unknown>>(cacheKey)

      if (persistentCache && (path !== '/fixtures' || !persistentCache.isExpired)) {
        return persistentCache.data
      }
    }

    throw error
  } finally {
    inflightApiRequests.delete(cacheKey)
  }
}

async function fetchApiFallbackHomeMatches(date: string): Promise<MatchListItem[]> {
  const requestedDates = [addDaysToISO(date, -1), date, addDaysToISO(date, 1)]
  const responses = await withTimeout(
    Promise.allSettled(
      requestedDates.map((requestedDate) =>
        apiFootball('/fixtures', {
          date: requestedDate,
          timezone: 'America/Argentina/Buenos_Aires',
        }, {
          noStore: true,
        }) as Promise<ApiFootballResponse<FixtureListItem>>
      )
    ),
    HOME_API_FALLBACK_TIMEOUT_MS,
    'API-Football home fallback timeout'
  )

  const dedupedFixtures = new Map<number, FixtureListItem>()

  for (const response of responses) {
    if (response.status !== 'fulfilled') continue

    for (const item of response.value.response || []) {
      if (getArgentinaDateKey(item.fixture.date) !== date) continue
      dedupedFixtures.set(item.fixture.id, item)
    }
  }

  const apiFallbackFixtures = [...dedupedFixtures.values()].filter(isHomeApiFallbackFixture)
  const mappedFixtures = apiFallbackFixtures.map((item): MatchListItem => ({
    id: item.fixture.id,
    externalId: item.fixture.id,
    leagueId: item.league.id,
    league: item.league.name,
    leagueLogo: item.league.logo,
    country: item.league.country,
    date: item.fixture.date,
    homeId: item.teams.home.id,
    home: item.teams.home.name,
    awayId: item.teams.away.id,
    away: item.teams.away.name,
    homeLogo: item.teams.home.logo,
    awayLogo: item.teams.away.logo,
    goalsHome: item.goals.home,
    goalsAway: item.goals.away,
    minute: getFixtureStatusElapsedMinute(item.fixture.status),
    statusShort: item.fixture.status.short,
    statusLong: item.fixture.status.long,
  }))

  upsertStoredFixtures(
    mappedFixtures.map((item) => ({
      fixtureId: item.id,
      leagueId: item.leagueId,
      leagueName: item.league,
      leagueLogo: item.leagueLogo,
      country: item.country,
      dateUtc: item.date,
      statusShort: item.statusShort,
      statusLong: item.statusLong,
      minute: item.minute,
      homeTeamId: item.homeId,
      homeTeamName: item.home,
      homeTeamLogo: item.homeLogo,
      awayTeamId: item.awayId,
      awayTeamName: item.away,
      awayTeamLogo: item.awayLogo,
      goalsHome: item.goalsHome,
      goalsAway: item.goalsAway,
    }))
  )

  const storedFixtures = readStoredFixturesByDate(date)
  if (storedFixtures.length) {
    return storedFixtures.map((item): MatchListItem => ({
      id: item.fixtureId,
      externalId: item.fixtureId,
      leagueId: item.leagueId,
      league: item.leagueName,
      leagueLogo: item.leagueLogo,
      country: item.country,
      date: item.date,
      homeId: item.homeTeamId,
      home: item.homeTeamName,
      awayId: item.awayTeamId,
      away: item.awayTeamName,
      homeLogo: item.homeTeamLogo,
      awayLogo: item.awayTeamLogo,
      goalsHome: item.goalsHome,
      goalsAway: item.goalsAway,
      minute: item.minute,
      statusShort: item.statusShort,
      statusLong: item.statusLong,
    }))
  }

  if (responses.every((response) => response.status === 'rejected')) {
    const firstError = responses[0]?.status === 'rejected' ? responses[0].reason : null
    throw firstError || new Error('No se pudieron sincronizar los fixtures del dia.')
  }

  return mappedFixtures
}

export async function getMatchesByDate(date: string): Promise<MatchListItem[]> {
  const sources = await getHomeMatchesSourceSnapshot(date)

  if (sources.storedMatches.length && !sources.supplementRecommended) {
    return sources.storedMatches
  }

  if (sources.apiMatches.length) {
    if (sources.storedMatches.length && sources.apiMatches.length > sources.storedMatches.length) {
      console.warn('[home] Supabase devolvio una tanda parcial; se completo con API-Football.', {
        date,
        stored: sources.storedMatches.length,
        api: sources.apiMatches.length,
        merged: sources.mergedMatches.length,
      })
    }

    return sources.mergedMatches
  }

  if (sources.storedMatches.length) {
    if (sources.apiError) {
      console.warn('[home] No se pudo completar Supabase con API-Football; se usa la tanda persistida.', {
        date,
        stored: sources.storedMatches.length,
        message: sources.apiError,
      })
    }

    return sources.storedMatches
  }

  if (sources.apiError) {
    throw new Error(sources.apiError)
  }

  return sources.mergedMatches
}

export async function getHomeMatchesSourceSnapshot(
  date: string
): Promise<HomeMatchesSourceSnapshot> {
  let storedMatches: MatchListItem[] = []

  try {
    storedMatches = await withTimeout(
      fetchStoredHomeMatches(date),
      HOME_SUPABASE_TIMEOUT_MS,
      'Supabase home matches timeout'
    )
  } catch (error) {
    console.warn('[home] No se pudieron leer partidos desde Supabase; se usa API fallback.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const supplementRecommended = shouldSupplementStoredHomeMatches(date, storedMatches)
  let apiMatches: MatchListItem[] = []
  let apiError: string | null = null

  try {
    if (supplementRecommended || !storedMatches.length) {
      apiMatches = await fetchApiFallbackHomeMatches(date)
    }
  } catch (error) {
    apiError = error instanceof Error ? error.message : String(error)
  }

  const apiAuthoritative = supplementRecommended && !apiError

  return {
    storedMatches,
    apiMatches,
    mergedMatches: storedMatches.length
      ? mergeHomeMatches(storedMatches, apiMatches, { apiAuthoritative })
      : apiMatches,
    apiError,
    apiAuthoritative,
    supplementRecommended,
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

type HomeMatchExtras = {
  persistedInSupabase: boolean
  broadcasters: MatchBroadcaster[]
  broadcastChannel: string | null
  broadcastLogoUrl: string | null
  goalScorers: MatchGoalScorers
  liveEvents: HomeLiveEvent[]
}

type StoredMatchTeamLogos = {
  homeLogo?: string
  awayLogo?: string
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

async function fetchStoredMatchTeamLogosByExternalId(
  fixtureId: number
): Promise<StoredMatchTeamLogos | null> {
  try {
    const supabase = getSupabaseAdminClient()
    const matchResponse = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('external_id', String(fixtureId))
      .maybeSingle()

    if (matchResponse.error) throw matchResponse.error
    if (!matchResponse.data) return null

    const match = matchResponse.data as Pick<StoredHomeMatchRow, 'home_team_id' | 'away_team_id'>
    const teamIds = [match.home_team_id, match.away_team_id]
      .filter((id): id is string | number => id !== null && id !== undefined)
      .map(String)

    if (!teamIds.length) return null

    const teamsResponse = await supabase
      .from('teams')
      .select('id, external_id, logo_url')
      .in('id', teamIds)

    if (teamsResponse.error) throw teamsResponse.error

    const teams = new Map(
      ((teamsResponse.data ?? []) as StoredHomeTeamRow[]).map((team) => [
        String(team.id),
        team,
      ])
    )
    const homeTeam = match.home_team_id ? teams.get(String(match.home_team_id)) : null
    const awayTeam = match.away_team_id ? teams.get(String(match.away_team_id)) : null
    const homeExternalId = toFiniteNumber(homeTeam?.external_id)
    const awayExternalId = toFiniteNumber(awayTeam?.external_id)

    return {
      homeLogo:
        pickStableAssetUrl(
          homeTeam?.logo_url,
          null,
          getApiSportsTeamLogoUrl(homeExternalId)
        ) ?? undefined,
      awayLogo:
        pickStableAssetUrl(
          awayTeam?.logo_url,
          null,
          getApiSportsTeamLogoUrl(awayExternalId)
        ) ?? undefined,
    }
  } catch (error) {
    console.warn('[match-detail] No se pudieron leer escudos persistidos del partido.', {
      fixtureId,
      message: error instanceof Error ? error.message : String(error),
    })

    return null
  }
}

function applyStoredMatchTeamLogos(
  fixture: MatchFixture | null,
  storedLogos: StoredMatchTeamLogos | null
) {
  if (!fixture || !storedLogos) return fixture

  const homeExternalId = fixture.teams.home.id
  const awayExternalId = fixture.teams.away.id

  return {
    ...fixture,
    teams: {
      ...fixture.teams,
      home: {
        ...fixture.teams.home,
        logo:
          pickStableAssetUrl(
            storedLogos.homeLogo,
            fixture.teams.home.logo,
            getApiSportsTeamLogoUrl(homeExternalId)
          ) ?? undefined,
      },
      away: {
        ...fixture.teams.away,
        logo:
          pickStableAssetUrl(
            storedLogos.awayLogo,
            fixture.teams.away.logo,
            getApiSportsTeamLogoUrl(awayExternalId)
          ) ?? undefined,
      },
    },
  }
}

async function fetchStoredHomeMatches(date: string): Promise<MatchListItem[]> {
  const supabase = getSupabaseAdminClient()
  const { startUtc, endUtc } = getArgentinaDayUtcRange(date)
  const selectWithElapsed =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, home_score, away_score, status, elapsed'
  const selectBase =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, home_score, away_score, status'

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

  if (!matchRows.length) return []

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
      }).excludedReason

      if (excludedReason) return null

      return {
        id: externalId,
        externalId,
        leagueId: toFiniteNumber(league.external_id) ?? toFiniteNumber(league.id) ?? undefined,
        league: league.name,
        leagueLogo: league.logo_url ?? undefined,
        country: league.country ?? undefined,
        date: match.match_date,
        homeId: toFiniteNumber(homeTeam.external_id) ?? undefined,
        home: homeTeam.name,
        awayId: toFiniteNumber(awayTeam.external_id) ?? undefined,
        away: awayTeam.name,
        homeLogo: homeTeam.logo_url ?? undefined,
        awayLogo: awayTeam.logo_url ?? undefined,
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
    match.date.slice(0, 10) !== rule.match_date.slice(0, 10)
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
  const extrasTimeoutMs = 2500
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

export async function getMatchDetail(id: number) {
  const [fixture, events, statistics, lineups, broadcast] = await Promise.all([
    apiFootball('/fixtures', { id }, { revalidate: 30 }),
    apiFootball('/fixtures/events', { fixture: id }, { revalidate: 30 }),
    apiFootball('/fixtures/statistics', { fixture: id }, { revalidate: 30 }),
    apiFootball('/fixtures/lineups', { fixture: id }, { revalidate: 30 }),
    getMatchBroadcastByExternalId(id),
  ])
  const rawFixture = (fixture as ApiFootballResponse<MatchFixture>).response?.[0] || null
  const rawLineups = (lineups as ApiFootballResponse<MatchLineup>).response || []
  const enriched = await enrichMatchDetailAssets(rawFixture, rawLineups)
  const storedTeamLogos = rawFixture
    ? await fetchStoredMatchTeamLogosByExternalId(id)
    : null

  return {
    fixture: applyStoredMatchTeamLogos(enriched.fixture, storedTeamLogos),
    events: (events as ApiFootballResponse<MatchEvent>).response || [],
    statistics:
      (statistics as ApiFootballResponse<MatchStatisticsTeam>).response || [],
    lineups: enriched.lineups,
    broadcastChannel: broadcast.channel,
    broadcastLogoUrl: broadcast.logoUrl,
    broadcasters: broadcast.broadcasters,
  }
}

export async function getTeamDetail(id: number) {
  const [team, squad] = await Promise.all([
    apiFootball('/teams', { id }, { revalidate: 300 }),
    apiFootball('/players/squads', { team: id }, { revalidate: 300 }),
  ])
  const rawTeam = (team as ApiFootballResponse<TeamProfile>).response?.[0] || null
  const rawSquad = (squad as ApiFootballResponse<TeamSquad>).response?.[0] || null
  const enriched = await enrichTeamDetailAssets(rawTeam, rawSquad)

  return {
    team: enriched.team,
    squad: enriched.squad,
  }
}

export async function getPlayerDetail(
  id: number,
  season: number,
  leagueId?: number
): Promise<PlayerDetail | null> {
  const response = (await apiFootball('/players', {
    id,
    season,
    league: leagueId,
  }, {
    revalidate: 300,
  })) as ApiFootballResponse<TopPlayerResponseItem>

  const item = response.response?.[0]
  const stats = leagueId
    ? item?.statistics?.find((entry) => entry.league?.id === leagueId) || item?.statistics?.[0]
    : item?.statistics?.[0]

  if (!item?.player) return null

  return enrichPlayerDetailAssets({
    player: {
      id: item.player.id,
      name: item.player.name || 'Jugador',
      firstname: item.player.firstname,
      lastname: item.player.lastname,
      age: item.player.age,
      nationality: item.player.nationality,
      birthDate: item.player.birth?.date,
      birthPlace: item.player.birth?.place,
      birthCountry: item.player.birth?.country,
      height: item.player.height,
      weight: item.player.weight,
      injured: item.player.injured,
      photo: item.player.photo,
    },
    team: stats?.team
      ? {
          id: stats.team.id,
          name: stats.team.name,
          logo: stats.team.logo,
        }
      : undefined,
    league: stats?.league
      ? {
          id: stats.league.id,
          name: stats.league.name,
          country: stats.league.country,
          logo: stats.league.logo,
          season: stats.league.season,
        }
      : undefined,
    statistics: {
      appearances: stats?.games?.appearences || 0,
      lineups: stats?.games?.lineups || 0,
      minutes: stats?.games?.minutes || 0,
      position: stats?.games?.position,
      rating: stats?.games?.rating,
      goals: stats?.goals?.total || 0,
      assists: stats?.goals?.assists || 0,
      yellowCards: stats?.cards?.yellow || 0,
      redCards: stats?.cards?.red || 0,
    },
  })
}

export async function resolveTournament(
  searchTerms: string[],
  country?: string
): Promise<ResolvedTournament | null> {
  for (const term of searchTerms) {
    const response = (await apiFootball('/leagues', {
      search: term,
    }, {
      revalidate: 3600,
    })) as ApiFootballResponse<LeagueSearchItem>

    const leagues = response.response || []
    const normalizedTerm = normalizeSearchValue(term)
    const normalizedCountry = country ? normalizeSearchValue(country) : null

    const filteredByCountry = normalizedCountry
      ? leagues.filter((item) =>
          normalizeSearchValue(item.country?.name || '') === normalizedCountry
        )
      : leagues

    const candidateLeagues = filteredByCountry.length ? filteredByCountry : leagues

    const selected =
      candidateLeagues.find((item) =>
        normalizeSearchValue(item.league?.name || '') === normalizedTerm
      ) ||
      candidateLeagues.find((item) =>
        normalizeSearchValue(item.league?.name || '').includes(normalizedTerm)
      ) ||
      candidateLeagues[0]

    const season = pickBestSeason(selected?.seasons)

    if (selected?.league?.id && season) {
      return {
        leagueId: selected.league.id,
        season,
        name: selected.league.name || term,
        country: selected.country?.name || country,
        logo: selected.league.logo,
      }
    }
  }

  return null
}

export async function getLeagueStandings(
  leagueId: number,
  season: number
): Promise<LeagueStandingGroup[]> {
  if (CALCULATED_STANDINGS_LEAGUE_IDS.has(leagueId)) {
    try {
      const calculatedStandings = await getCalculatedLeagueStandings(leagueId, season)

      if (calculatedStandings.length && calculatedStandings[0]?.rows.length) {
        return calculatedStandings
      }
    } catch (error) {
      console.warn('[standings:calculated] No se pudo calcular tabla desde fixtures', {
        leagueId,
        season,
        error: error instanceof Error ? error.message : 'Error desconocido',
      })
    }
  }

  const data = (await apiFootball('/standings', {
    league: leagueId,
    season,
  }, {
    revalidate: 300,
  })) as ApiFootballResponse<StandingResponseItem>

  const groups = data.response?.[0]?.league?.standings || []

  return groups.map((group, index) => {
    const groupName =
      group.find((row) => row.group)?.group ||
      (groups.length > 1 ? `Grupo ${index + 1}` : 'Tabla')

    return {
      name: groupName,
      rows: group.map((row) => ({
        rank: row.rank || 0,
        teamId: row.team?.id,
        teamName: row.team?.name || 'Equipo',
        teamLogo: row.team?.logo,
        points: row.points || 0,
        played: row.all?.played || 0,
        won: row.all?.win || 0,
        drawn: row.all?.draw || 0,
        lost: row.all?.lose || 0,
        goalsFor: row.all?.goals?.for || 0,
        goalsAgainst: row.all?.goals?.against || 0,
        goalDifference: row.goalsDiff || 0,
        form: row.form,
        description: row.description,
      })),
    }
  })
}

async function getCalculatedLeagueStandings(
  leagueId: number,
  season: number
): Promise<LeagueStandingGroup[]> {
  const [fixturesData, standingsData] = await Promise.all([
    apiFootball('/fixtures', {
      league: leagueId,
      season,
      timezone: 'America/Argentina/Buenos_Aires',
    }, {
      revalidate: 60,
    }) as Promise<ApiFootballResponse<FixtureListItem>>,
    apiFootball('/standings', {
      league: leagueId,
      season,
    }, {
      revalidate: 300,
    }) as Promise<ApiFootballResponse<StandingResponseItem>>,
  ])
  const seenFixtureIds = new Set<number>()
  const table = new Map<number | string, CalculatedStandingAccumulator>()
  const zoneMembership = getStandingZoneMembership(standingsData.response?.[0]?.league?.standings || [])

  function getTeamRow(team: TeamInfo | undefined) {
    const teamId = team?.id ?? team?.name ?? 'unknown'
    const current = table.get(teamId)

    if (current) return current

    const next: CalculatedStandingAccumulator = {
      teamId: team?.id,
      teamName: team?.name || 'Equipo',
      teamLogo: team?.logo,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    }

    table.set(teamId, next)
    return next
  }

  for (const item of fixturesData.response ?? []) {
    const fixtureId = item.fixture.id
    const statusShort = item.fixture.status.short

    if (seenFixtureIds.has(fixtureId)) continue
    seenFixtureIds.add(fixtureId)

    if (!isFinishedStatus(statusShort)) continue
    if (
      leagueId === 128 &&
      !isLigaProfesionalRegularSeasonRound(item.league.round)
    ) {
      continue
    }

    const homeGoals = item.goals.home ?? item.score?.fulltime?.home ?? null
    const awayGoals = item.goals.away ?? item.score?.fulltime?.away ?? null

    if (homeGoals === null || awayGoals === null) continue

    const home = getTeamRow(item.teams.home)
    const away = getTeamRow(item.teams.away)

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

  if (zoneMembership.length) {
    const rowsByTeam = new Map(rows.map((row) => [String(row.teamId || row.teamName), row]))
    const zoneGroups = zoneMembership
      .map((zone) => ({
        name: zone.name,
        rows: zone.teamKeys
          .map((teamKey) => rowsByTeam.get(teamKey))
          .filter((row): row is LeagueStandingRow => Boolean(row))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
            return a.teamName.localeCompare(b.teamName, 'es-AR')
          })
          .map((row, index) => ({
            ...row,
            rank: index + 1,
          })),
      }))
      .filter((group) => group.rows.length)

    if (zoneGroups.length >= 2) {
      console.info('[standings:calculated]', {
        leagueId,
        season,
        fixtures: seenFixtureIds.size,
        countedFixtures: zoneGroups.reduce((max, group) => Math.max(max, ...group.rows.map((row) => row.played)), 0),
        groups: zoneGroups.map((group) => ({ name: group.name, teams: group.rows.length })),
        source: 'fixtures+api-groups',
      })

      return zoneGroups
    }
  }

  console.info('[standings:calculated]', {
    leagueId,
    season,
    fixtures: seenFixtureIds.size,
    teams: rows.length,
    source: 'fixtures',
  })

  return rows.length ? [{ name: 'Tabla', rows }] : []
}

function getStandingZoneMembership(groups: StandingEntry[][]) {
  return groups
    .map((group, index) => {
      const groupName =
        group.find((row) => row.group)?.group ||
        (groups.length > 1 ? `Grupo ${index + 1}` : 'Tabla')
      const normalized = normalizeStandingGroupName(groupName)

      if (
        !normalized.includes('group a') &&
        !normalized.includes('group b') &&
        !normalized.includes('grupo a') &&
        !normalized.includes('grupo b')
      ) {
        return null
      }

      return {
        name: normalized.includes('group b') || normalized.includes('grupo b') ? 'Zona B' : 'Zona A',
        teamKeys: group.map((row) => String(row.team?.id || row.team?.name || '')).filter(Boolean),
      }
    })
    .filter((group): group is { name: string; teamKeys: string[] } => Boolean(group))
    .sort((a, b) => a.name.localeCompare(b.name, 'es-AR'))
}

function normalizeStandingGroupName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

export async function getLeagueFixtures(leagueId: number, season: number) {
  const storedFixtures = readStoredFixturesByLeagueSeason(leagueId, season)

  try {
    const data = (await apiFootball('/fixtures', {
      league: leagueId,
      season,
      timezone: 'America/Argentina/Buenos_Aires',
    }, {
      revalidate: 30,
    })) as ApiFootballResponse<FixtureListItem>

    const mappedFixtures = (data.response || []).map((item): LeagueFixtureSummary => ({
      id: item.fixture.id,
      round: item.league.round || 'Fecha',
      date: item.fixture.date,
      statusShort: item.fixture.status.short,
      minute: getFixtureStatusElapsedMinute(item.fixture.status),
      home: item.teams.home.name,
      homeId: item.teams.home.id,
      away: item.teams.away.name,
      awayId: item.teams.away.id,
      homeLogo: item.teams.home.logo,
      awayLogo: item.teams.away.logo,
      goalsHome: item.goals.home,
      goalsAway: item.goals.away,
      homePenaltyScore: item.score?.penalty?.home ?? null,
      awayPenaltyScore: item.score?.penalty?.away ?? null,
      venueName: item.fixture.venue?.name ?? null,
      venueCity: item.fixture.venue?.city ?? null,
      venueCountry: item.league.country ?? null,
    }))
    const enrichedMappedFixtures = await enrichLeagueFixturesWithStoredEvents(
      leagueId,
      mappedFixtures
    )
    logCopaArgentinaFixtureDebug(leagueId, season, enrichedMappedFixtures, 'api')

    if (mappedFixtures.length) {
      await persistFixtureListAssets(data.response || [])
      upsertStoredFixtures(
        (data.response || []).map((item) => ({
          fixtureId: item.fixture.id,
          leagueId: item.league.id,
          season,
          leagueName: item.league.name,
          leagueLogo: item.league.logo,
          country: item.league.country,
          round: item.league.round,
          dateUtc: item.fixture.date,
          statusShort: item.fixture.status.short,
          statusLong: item.fixture.status.long,
          minute: getFixtureStatusElapsedMinute(item.fixture.status),
          homeTeamId: item.teams.home.id,
          homeTeamName: item.teams.home.name,
          homeTeamLogo: item.teams.home.logo,
          awayTeamId: item.teams.away.id,
          awayTeamName: item.teams.away.name,
          awayTeamLogo: item.teams.away.logo,
          goalsHome: item.goals.home,
          goalsAway: item.goals.away,
          homePenaltyScore: item.score?.penalty?.home ?? null,
          awayPenaltyScore: item.score?.penalty?.away ?? null,
          venueName: item.fixture.venue?.name ?? null,
          venueCity: item.fixture.venue?.city ?? null,
          venueCountry: item.league.country ?? null,
        }))
      )
    }

    const refreshedStoredFixtures = readStoredFixturesByLeagueSeason(leagueId, season)
    if (refreshedStoredFixtures.length) {
      const refreshedFixtures = refreshedStoredFixtures.map((item): LeagueFixtureSummary => ({
        id: item.fixtureId,
        round: item.round || 'Fecha',
        date: item.date,
        statusShort: item.statusShort,
        minute: item.minute,
        home: item.homeTeamName,
        homeId: item.homeTeamId,
        away: item.awayTeamName,
        awayId: item.awayTeamId,
        homeLogo: item.homeTeamLogo,
        awayLogo: item.awayTeamLogo,
        goalsHome: item.goalsHome,
        goalsAway: item.goalsAway,
        homePenaltyScore: item.homePenaltyScore,
        awayPenaltyScore: item.awayPenaltyScore,
        venueName: item.venueName ?? null,
        venueCity: item.venueCity ?? null,
        venueCountry: item.venueCountry ?? item.country ?? null,
      }))
      const enrichedRefreshedFixtures = await enrichLeagueFixturesWithStoredEvents(
        leagueId,
        refreshedFixtures
      )
      logCopaArgentinaFixtureDebug(leagueId, season, enrichedRefreshedFixtures, 'cache')
      return enrichedRefreshedFixtures
    }

    return enrichedMappedFixtures
  } catch (error) {
    if (storedFixtures.length) {
      const fallbackFixtures = storedFixtures.map((item): LeagueFixtureSummary => ({
        id: item.fixtureId,
        round: item.round || 'Fecha',
        date: item.date,
        statusShort: item.statusShort,
        minute: item.minute,
        home: item.homeTeamName,
        homeId: item.homeTeamId,
        away: item.awayTeamName,
        awayId: item.awayTeamId,
        homeLogo: item.homeTeamLogo,
        awayLogo: item.awayTeamLogo,
        goalsHome: item.goalsHome,
        goalsAway: item.goalsAway,
        homePenaltyScore: item.homePenaltyScore,
        awayPenaltyScore: item.awayPenaltyScore,
        venueName: item.venueName ?? null,
        venueCity: item.venueCity ?? null,
        venueCountry: item.venueCountry ?? item.country ?? null,
      }))
      const enrichedFallbackFixtures = await enrichLeagueFixturesWithStoredEvents(
        leagueId,
        fallbackFixtures
      )
      logCopaArgentinaFixtureDebug(leagueId, season, enrichedFallbackFixtures, 'cache')
      return enrichedFallbackFixtures
    }

    throw error
  }
}

async function getTopPlayersByType(
  path: string,
  leagueId: number,
  season: number,
  selector: (statistics?: PlayerStatistic) => number | null | undefined
) {
  const data = (await apiFootball(path, {
    league: leagueId,
    season,
  }, {
    revalidate: 300,
  })) as ApiFootballResponse<TopPlayerResponseItem>

  const rows = (data.response || [])
    .map((item): TopPlayerRow => {
      const stats = item.statistics?.[0]

      return {
        playerId: item.player?.id,
        name: item.player?.name || 'Jugador',
        photo: item.player?.photo,
        teamId: stats?.team?.id,
        teamName: stats?.team?.name,
        teamLogo: stats?.team?.logo,
        value: selector(stats) || 0,
      }
    })
    .filter((item) => item.value > 0)

  return enrichTopPlayerAssets(rows)
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
      event.type === 'Goal' &&
      (event.player?.id === playerId || matchesByName(event.player))
    )
  }

  if (statType === 'assists') {
    return (
      event.type === 'Goal' &&
      (event.assist?.id === playerId || matchesByName(event.assist))
    )
  }

  if (statType === 'yellowCards') {
    return (
      event.type === 'Card' &&
      (event.player?.id === playerId || matchesByName(event.player)) &&
      (event.detail || '').toLowerCase().includes('yellow')
    )
  }

  return (
    event.type === 'Card' &&
    (event.player?.id === playerId || matchesByName(event.player)) &&
    (event.detail || '').toLowerCase().includes('red')
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

  const eventResponse = (await apiFootball('/fixtures/events', {
    fixture: fixtureId,
  }, {
    revalidate: 300,
  })) as ApiFootballResponse<MatchEvent>

  const data = eventResponse.response || []

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
    .filter((fixture) => {
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
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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

  matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  playerEventCache.set(cacheKey, {
    expiresAt: Date.now() + 5 * 60 * 1000,
    data: matches,
  })

  return matches
}

export async function getLeagueLeaders(leagueId: number, season: number) {
  const [scorers, assists, yellowCards, redCards] = await Promise.all([
    getTopPlayersByType(
      '/players/topscorers',
      leagueId,
      season,
      (statistics) => statistics?.goals?.total
    ),
    getTopPlayersByType(
      '/players/topassists',
      leagueId,
      season,
      (statistics) => statistics?.goals?.assists
    ),
    getTopPlayersByType(
      '/players/topyellowcards',
      leagueId,
      season,
      (statistics) => statistics?.cards?.yellow
    ),
    getTopPlayersByType(
      '/players/topredcards',
      leagueId,
      season,
      (statistics) => statistics?.cards?.red
    ),
  ])

  return {
    scorers,
    assists,
    yellowCards,
    redCards,
  }
}
