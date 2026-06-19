import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getLeagueEventStatsLeaders } from '@/server/match-event-stats'
import {
  readApiLeagueStandings,
  readCachedLeagueStandings,
} from '@/server/football-standings-cache'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { formatEventMinute } from '@/shared/utils/event-minute'
import {
  addDaysToISO,
  getArgentinaDayUtcRange,
  getArgentinaDateISO,
} from '@/shared/utils/argentina-time'
import {
  dedupeTimelineEvents,
  formatMatchEventSemanticKey,
  getGoalKindFromDetail,
  getImportantLiveEventKind,
  isRedCardEvent,
  isValidAssistEvent,
  isValidGoalForScore,
  isValidGoalForScorerTable,
  isYellowCardEvent,
  type ImportantLiveEventKind,
} from '@/shared/utils/football-events'
import {
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  getLeagueFinalPhaseKey,
  getLeagueRoundLabel,
  isLigaProfesionalRegularSeasonRound,
  normalizeLeagueRound,
  normalizeRoundText,
} from '@/shared/utils/league-rounds'
import {
  getUefaLeaguePhaseRoundNumber,
  isUefaLeaguePhaseRound,
} from '@/shared/utils/uefa-rounds'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'
import { formatMatchScoreWithPenalties } from '@/shared/utils/match-display'
import {
  pickLeagueLogoUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { getCompetitionRuleByExternalId } from '@/shared/config/competition-rules'

const HOME_SUPABASE_TIMEOUT_MS = 5000
const HOME_MATCH_EXTRAS_TIMEOUT_MS = 4000
const LEAGUE_LEADERS_TIMEOUT_MS = 4500

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
  logo_url?: string
  logoUrl?: string
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
  logo_url?: string
  logoUrl?: string
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
    halftime?: FixtureGoals
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
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
  minute: number | null
  statusShort: string
  statusLong: string
  broadcastChannel?: string | null
  broadcastLogoUrl?: string | null
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
  source?: string | null
  confidence?: string | null
  verified?: boolean | null
}

export type MatchKitRoleColors = {
  primary: string | null
  secondary: string | null
  number: string | null
}

export type MatchTeamSideKitColors = MatchKitRoleColors & {
  player?: MatchKitRoleColors
  goalkeeper?: MatchKitRoleColors
}

export type MatchTeamKitColors = {
  home: MatchTeamSideKitColors
  away: MatchTeamSideKitColors
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
  comments?: string | null
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
  height?: string
  clubExternalId?: number
  clubName?: string
  clubLogo?: string
  club_logo_url?: string
  clubLogoUrl?: string
  profile_last_synced_at?: string
  profileLastSyncedAt?: string
  photo?: string
  photo_url?: string
  photoUrl?: string
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
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
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
    photo_url?: string
    photoUrl?: string
  }
  team?: {
    id?: number
    name?: string
    logo?: string
    logo_url?: string
    logoUrl?: string
  }
  league?: {
    id?: number
    name?: string
    country?: string
    logo?: string
    logo_url?: string
    logoUrl?: string
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

  const [storedMatchesResult, cacheMatchesResult] = await Promise.allSettled([
    withTimeout(
      fetchStoredHomeMatches(date),
      HOME_SUPABASE_TIMEOUT_MS,
      'Supabase home matches timeout'
    ),
    withTimeout(
      Promise.resolve().then(() => fetchCachedHomeFixtures(getSupabaseAdminClient(), date)),
      HOME_SUPABASE_TIMEOUT_MS,
      'Supabase fixture cache timeout'
    ),
  ])

  if (storedMatchesResult.status === 'fulfilled') {
    storedMatches = storedMatchesResult.value
  } else {
    const error = storedMatchesResult.reason
    console.warn('[home] No se pudieron leer partidos desde Supabase/cache.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  if (cacheMatchesResult.status === 'fulfilled') {
    cacheMatches = cacheMatchesResult.value
  } else {
    const error = cacheMatchesResult.reason
    console.warn('[home] No se pudo leer football_fixture_cache.', {
      date,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const mergedMatches = mergeHomeMatchesByExternalId(storedMatches, cacheMatches)

  if (process.env.NODE_ENV === 'development') {
    const { startUtc, endUtc } = getArgentinaDayUtcRange(date)
    const activeOrFinishedWithoutScore = mergedMatches
      .filter((match) =>
        !hasCompleteMatchScore(match) &&
        (
          isLiveStatus(match.statusShort) ||
          isFinishedStatus(match.statusShort) ||
          isPostponedStatus(match.statusShort)
        )
      )
      .map((match) => ({
        fixtureId: match.externalId ?? match.id,
        statusShort: match.statusShort,
        statusLong: match.statusLong,
        goalsHome: match.goalsHome,
        goalsAway: match.goalsAway,
      }))

    console.info('[home-date-debug]', {
      selectedDate: date,
      startUtc,
      endUtc,
      supabaseCount: storedMatches.length,
      cacheCount: cacheMatches.length,
      visibleCount: mergedMatches.length,
      activeOrFinishedWithoutScore,
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
  home_penalty_score?: number | null
  away_penalty_score?: number | null
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
  comments?: string | null
}

type HomeMatchBroadcastRow = {
  match_id: number | string
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
  source?: string | null
  confidence?: string | null
  verified?: boolean | null
}

type CachedHomeFixtureRow = {
  date?: string | null
  fixture_external_id?: string | number | null
  league_external_id?: string | number | null
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

function readAdminMatchOverridePayload(value: unknown) {
  const record = readRecord(value)
  if (!record) return null

  return readRecord(record.overrides) ?? record
}

type AdminCaptainOverrideSide = 'home' | 'away'

type AdminCaptainOverride = {
  playerId: string | null
  playerName: string | null
}

function getCaptainTextFromCachedValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

function readAdminCaptainOverride(
  overrides: Record<string, unknown> | null,
  side: AdminCaptainOverrideSide
): AdminCaptainOverride | null {
  const captains = readRecord(overrides?.captains)
  const sideCaptain = readRecord(captains?.[side])
  const playerId =
    getCaptainTextFromCachedValue(overrides?.[`${side}CaptainPlayerId`]) ??
    getCaptainTextFromCachedValue(sideCaptain?.playerId)
  const playerName =
    getCaptainTextFromCachedValue(overrides?.[`${side}CaptainPlayerName`]) ??
    getCaptainTextFromCachedValue(sideCaptain?.playerName)

  if (!playerId && !playerName) return null

  return {
    playerId,
    playerName,
  }
}

function normalizeCaptainMatchText(value: string | null | undefined) {
  return normalizeSearchValue(value ?? '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function playerMatchesAdminCaptain(
  playerWrapper: PlayerWrapper,
  captain: AdminCaptainOverride
) {
  const wrapperRecord = readRecord(playerWrapper)
  const playerRecord = readRecord(wrapperRecord?.player)
  const playerId = getCaptainTextFromCachedValue(playerRecord?.id ?? wrapperRecord?.id)
  const playerName = getCaptainTextFromCachedValue(playerRecord?.name ?? wrapperRecord?.name)

  if (captain.playerId && playerId && captain.playerId === playerId) return true

  return Boolean(
    captain.playerName &&
      playerName &&
      normalizeCaptainMatchText(captain.playerName) === normalizeCaptainMatchText(playerName)
  )
}

function applyAdminCaptainOverrideToPlayers(
  players: PlayerWrapper[] | undefined,
  captain: AdminCaptainOverride
) {
  if (!Array.isArray(players)) return players

  return players.map((playerWrapper) => {
    const isCaptain = playerMatchesAdminCaptain(playerWrapper, captain)

    return {
      ...playerWrapper,
      captain: isCaptain,
      player: playerWrapper.player
        ? {
            ...playerWrapper.player,
            captain: isCaptain,
          }
        : playerWrapper.player,
    }
  })
}

function isSameCaptainTeam(lineupTeam: TeamInfo | undefined, fixtureTeam: TeamInfo | undefined) {
  const lineupTeamId = toFiniteNumber(lineupTeam?.id)
  const fixtureTeamId = toFiniteNumber(fixtureTeam?.id)

  if (lineupTeamId !== null && fixtureTeamId !== null && lineupTeamId === fixtureTeamId) {
    return true
  }

  const lineupTeamName = normalizeCaptainMatchText(lineupTeam?.name)
  const fixtureTeamName = normalizeCaptainMatchText(fixtureTeam?.name)

  return Boolean(lineupTeamName && fixtureTeamName && lineupTeamName === fixtureTeamName)
}

function getLineupFixtureSide(
  lineup: MatchLineup,
  fixture: MatchFixture | null,
  index: number
): AdminCaptainOverrideSide | null {
  if (isSameCaptainTeam(lineup.team, fixture?.teams?.home)) return 'home'
  if (isSameCaptainTeam(lineup.team, fixture?.teams?.away)) return 'away'
  if (index === 0) return 'home'
  if (index === 1) return 'away'

  return null
}

function applyAdminCaptainOverridesToLineups(
  lineups: MatchLineup[],
  fixture: MatchFixture | null,
  overrides: Record<string, unknown> | null
) {
  const homeCaptain = readAdminCaptainOverride(overrides, 'home')
  const awayCaptain = readAdminCaptainOverride(overrides, 'away')

  if (!homeCaptain && !awayCaptain) return lineups

  return lineups.map((lineup, index) => {
    const side = getLineupFixtureSide(lineup, fixture, index)
    const captain = side === 'home' ? homeCaptain : side === 'away' ? awayCaptain : null

    if (!captain) return lineup

    return {
      ...lineup,
      startXI: applyAdminCaptainOverrideToPlayers(lineup.startXI, captain),
      substitutes: applyAdminCaptainOverrideToPlayers(lineup.substitutes, captain),
    }
  })
}

function hasAdminCaptainOverrides(overrides: Record<string, unknown> | null) {
  return Boolean(
    readAdminCaptainOverride(overrides, 'home') ||
    readAdminCaptainOverride(overrides, 'away')
  )
}

function getHexColorFromCachedValue(value: unknown) {
  if (typeof value !== 'string') return null

  const cleaned = value.trim().replace(/^#/, '')

  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned.toLowerCase()}` : null
}

function getCachedKitColorSide(value: unknown) {
  const record = readRecord(value)
  const playerRecord = readRecord(record?.player)
  const goalkeeperRecord = readRecord(record?.goalkeeper)
  const player = {
    primary:
      getHexColorFromCachedValue(playerRecord?.primary) ??
      getHexColorFromCachedValue(record?.primary),
    secondary:
      getHexColorFromCachedValue(playerRecord?.secondary) ??
      getHexColorFromCachedValue(record?.secondary),
    number:
      getHexColorFromCachedValue(playerRecord?.number) ??
      getHexColorFromCachedValue(record?.number),
  }
  const goalkeeper = {
    primary: getHexColorFromCachedValue(goalkeeperRecord?.primary),
    secondary: getHexColorFromCachedValue(goalkeeperRecord?.secondary),
    number: getHexColorFromCachedValue(goalkeeperRecord?.number),
  }

  return {
    ...player,
    player,
    goalkeeper,
  }
}

function getCachedTeamKitColors(row: Record<string, unknown>): MatchTeamKitColors | null {
  const teamKitColors = readRecord(row.teamKitColors)
  const homeKitColors = getCachedKitColorSide(teamKitColors?.home)
  const awayKitColors = getCachedKitColorSide(teamKitColors?.away)
  const homePrimary =
    homeKitColors.primary ??
    getHexColorFromCachedValue(row.homePrimaryColor) ??
    getHexColorFromCachedValue(row.home_primary_color)
  const homeSecondary =
    homeKitColors.secondary ??
    getHexColorFromCachedValue(row.homeSecondaryColor) ??
    getHexColorFromCachedValue(row.home_secondary_color)
  const homeNumber =
    homeKitColors.number ??
    getHexColorFromCachedValue(row.homeNumberColor) ??
    getHexColorFromCachedValue(row.home_number_color)
  const homeGoalkeeperPrimary =
    homeKitColors.goalkeeper?.primary ??
    getHexColorFromCachedValue(row.homeGoalkeeperPrimaryColor) ??
    getHexColorFromCachedValue(row.home_goalkeeper_primary_color)
  const homeGoalkeeperSecondary =
    homeKitColors.goalkeeper?.secondary ??
    getHexColorFromCachedValue(row.homeGoalkeeperSecondaryColor) ??
    getHexColorFromCachedValue(row.home_goalkeeper_secondary_color)
  const homeGoalkeeperNumber =
    homeKitColors.goalkeeper?.number ??
    getHexColorFromCachedValue(row.homeGoalkeeperNumberColor) ??
    getHexColorFromCachedValue(row.home_goalkeeper_number_color)
  const awayPrimary =
    awayKitColors.primary ??
    getHexColorFromCachedValue(row.awayPrimaryColor) ??
    getHexColorFromCachedValue(row.away_primary_color)
  const awaySecondary =
    awayKitColors.secondary ??
    getHexColorFromCachedValue(row.awaySecondaryColor) ??
    getHexColorFromCachedValue(row.away_secondary_color)
  const awayNumber =
    awayKitColors.number ??
    getHexColorFromCachedValue(row.awayNumberColor) ??
    getHexColorFromCachedValue(row.away_number_color)
  const awayGoalkeeperPrimary =
    awayKitColors.goalkeeper?.primary ??
    getHexColorFromCachedValue(row.awayGoalkeeperPrimaryColor) ??
    getHexColorFromCachedValue(row.away_goalkeeper_primary_color)
  const awayGoalkeeperSecondary =
    awayKitColors.goalkeeper?.secondary ??
    getHexColorFromCachedValue(row.awayGoalkeeperSecondaryColor) ??
    getHexColorFromCachedValue(row.away_goalkeeper_secondary_color)
  const awayGoalkeeperNumber =
    awayKitColors.goalkeeper?.number ??
    getHexColorFromCachedValue(row.awayGoalkeeperNumberColor) ??
    getHexColorFromCachedValue(row.away_goalkeeper_number_color)

  if (
    !homePrimary &&
    !homeSecondary &&
    !homeNumber &&
    !homeGoalkeeperPrimary &&
    !homeGoalkeeperSecondary &&
    !homeGoalkeeperNumber &&
    !awayPrimary &&
    !awaySecondary &&
    !awayNumber &&
    !awayGoalkeeperPrimary &&
    !awayGoalkeeperSecondary &&
    !awayGoalkeeperNumber
  ) {
    return null
  }

  return {
    home: {
      primary: homePrimary,
      secondary: homeSecondary,
      number: homeNumber,
      player: {
        primary: homePrimary,
        secondary: homeSecondary,
        number: homeNumber,
      },
      goalkeeper: {
        primary: homeGoalkeeperPrimary,
        secondary: homeGoalkeeperSecondary,
        number: homeGoalkeeperNumber,
      },
    },
    away: {
      primary: awayPrimary,
      secondary: awaySecondary,
      number: awayNumber,
      player: {
        primary: awayPrimary,
        secondary: awaySecondary,
        number: awayNumber,
      },
      goalkeeper: {
        primary: awayGoalkeeperPrimary,
        secondary: awayGoalkeeperSecondary,
        number: awayGoalkeeperNumber,
      },
    },
  }
}

function mergeKitRoleColors(
  base: MatchKitRoleColors | null | undefined,
  override: MatchKitRoleColors | null | undefined
): MatchKitRoleColors {
  return {
    primary: override?.primary ?? base?.primary ?? null,
    secondary: override?.secondary ?? base?.secondary ?? null,
    number: override?.number ?? base?.number ?? null,
  }
}

function mergeKitSideColors(
  base: MatchTeamSideKitColors | null | undefined,
  override: MatchTeamSideKitColors | null | undefined
): MatchTeamSideKitColors {
  const player = mergeKitRoleColors(
    base?.player ?? base,
    override?.player ?? override
  )
  const goalkeeper = mergeKitRoleColors(base?.goalkeeper, override?.goalkeeper)

  return {
    primary: player.primary,
    secondary: player.secondary,
    number: player.number,
    player,
    goalkeeper,
  }
}

function mergeTeamKitColors(
  base: MatchTeamKitColors | null | undefined,
  override: MatchTeamKitColors | null | undefined
) {
  if (!base && !override) return null

  return {
    home: mergeKitSideColors(base?.home, override?.home),
    away: mergeKitSideColors(base?.away, override?.away),
  }
}

function getNullableStringFromCachedValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function compareHomeMatchesByDateAndId(a: MatchListItem, b: MatchListItem) {
  const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
  if (dateCompare !== 0) return dateCompare

  return a.id - b.id
}

function hasCompleteMatchScore(match: MatchListItem) {
  return match.goalsHome !== null && match.goalsHome !== undefined &&
    match.goalsAway !== null && match.goalsAway !== undefined
}

function hasAnyMatchScore(match: MatchListItem) {
  return match.goalsHome !== null && match.goalsHome !== undefined ||
    match.goalsAway !== null && match.goalsAway !== undefined
}

function getHomeMatchStatusRank(match: MatchListItem) {
  const statusShort = match.statusShort
  const statusLong = match.statusLong

  if (isLiveStatus(statusShort) || isLiveStatus(statusLong)) return 50
  if (isFinishedStatus(statusShort) || isFinishedStatus(statusLong)) return 45
  if (isPostponedStatus(statusShort) || isPostponedStatus(statusLong)) return 35
  if (!isUpcomingStatus(statusShort) && !isUpcomingStatus(statusLong)) return 25

  return 10
}

function getHomeMatchDataRank(match: MatchListItem) {
  let score = getHomeMatchStatusRank(match)

  if (hasCompleteMatchScore(match)) score += 20
  else if (hasAnyMatchScore(match)) score += 10
  if (match.minute !== null && match.minute !== undefined) score += 3

  return score
}

function pickTextValue(primary?: string | null, fallback?: string | null) {
  return primary || fallback || undefined
}

function pickNumberValue(primary?: number | null, fallback?: number | null) {
  return primary !== null && primary !== undefined
    ? primary
    : fallback !== null && fallback !== undefined
      ? fallback
      : null
}

function mergeHomeMatchData(existing: MatchListItem, incoming: MatchListItem) {
  const existingRank = getHomeMatchDataRank(existing)
  const incomingRank = getHomeMatchDataRank(incoming)
  const primary = incomingRank >= existingRank ? incoming : existing
  const secondary = primary === incoming ? existing : incoming
  const statusSource =
    getHomeMatchStatusRank(incoming) >= getHomeMatchStatusRank(existing)
      ? incoming
      : existing
  const scoreSource =
    hasCompleteMatchScore(incoming) || (!hasCompleteMatchScore(existing) && hasAnyMatchScore(incoming))
      ? incoming
      : existing

  return {
    ...secondary,
    ...primary,
    leagueId: primary.leagueId ?? secondary.leagueId,
    leagueLogo: pickTextValue(primary.leagueLogo, secondary.leagueLogo),
    country: pickTextValue(primary.country, secondary.country),
    homeId: primary.homeId ?? secondary.homeId,
    awayId: primary.awayId ?? secondary.awayId,
    homeLogo: pickTextValue(primary.homeLogo, secondary.homeLogo),
    awayLogo: pickTextValue(primary.awayLogo, secondary.awayLogo),
    goalsHome: pickNumberValue(scoreSource.goalsHome, secondary.goalsHome),
    goalsAway: pickNumberValue(scoreSource.goalsAway, secondary.goalsAway),
    homePenaltyScore: pickNumberValue(scoreSource.homePenaltyScore, secondary.homePenaltyScore),
    awayPenaltyScore: pickNumberValue(scoreSource.awayPenaltyScore, secondary.awayPenaltyScore),
    minute: Math.max(primary.minute ?? 0, secondary.minute ?? 0) || primary.minute || secondary.minute || null,
    statusShort: statusSource.statusShort || primary.statusShort,
    statusLong: statusSource.statusLong || primary.statusLong,
    broadcastChannel: pickTextValue(primary.broadcastChannel, secondary.broadcastChannel) ?? null,
    broadcastLogoUrl: pickTextValue(primary.broadcastLogoUrl, secondary.broadcastLogoUrl) ?? null,
  }
}

function mergeHomeMatchesByExternalId(
  storedMatches: MatchListItem[],
  cacheMatches: MatchListItem[]
) {
  const mergedByExternalId = new Map<string, MatchListItem>()

  for (const match of cacheMatches) {
    const key = String(match.externalId ?? match.id)
    const existing = mergedByExternalId.get(key)
    mergedByExternalId.set(key, existing ? mergeHomeMatchData(existing, match) : match)
  }

  for (const match of storedMatches) {
    const key = String(match.externalId ?? match.id)
    const existing = mergedByExternalId.get(key)
    mergedByExternalId.set(key, existing ? mergeHomeMatchData(existing, match) : match)
  }

  return [...mergedByExternalId.values()].sort(compareHomeMatchesByDateAndId)
}

function mapCachedHomeFixturePayload(
  payload: unknown,
  rowMeta?: Pick<CachedHomeFixtureRow, 'date' | 'fixture_external_id' | 'league_external_id'>
): MatchListItem | null {
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

  if (
    rowMeta?.fixture_external_id !== null &&
    rowMeta?.fixture_external_id !== undefined &&
    String(rowMeta.fixture_external_id) !== String(externalId)
  ) {
    console.warn('[home-cache] Ignoring fixture cache row with mismatched external id.', {
      rowFixtureExternalId: rowMeta.fixture_external_id,
      payloadExternalId: externalId,
      home,
      away,
    })
    return null
  }

  const payloadArgentinaDate = getArgentinaDateKey(date)
  if (rowMeta?.date && payloadArgentinaDate !== rowMeta.date) {
    console.warn('[home-cache] Ignoring fixture cache row with mismatched date.', {
      rowDate: rowMeta.date,
      payloadDate: date,
      payloadArgentinaDate,
      externalId,
      home,
      away,
    })
    return null
  }

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
    homePenaltyScore: getNumberFromCachedValue(row.homePenaltyScore),
    awayPenaltyScore: getNumberFromCachedValue(row.awayPenaltyScore),
    minute: getNumberFromCachedValue(row.minute),
    statusShort: getStringFromCachedValue(row.statusShort) ?? 'NS',
    statusLong: getStringFromCachedValue(row.statusLong) ?? 'No iniciado',
    broadcastChannel:
      getStringFromCachedValue(row.broadcastChannel) ??
      getStringFromCachedValue(row.broadcast_channel),
    broadcastLogoUrl:
      getStringFromCachedValue(row.broadcastLogoUrl) ??
      getStringFromCachedValue(row.broadcast_logo_url),
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
    .select('date, fixture_external_id, league_external_id, normalized_payload')
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
    .map((row) => mapCachedHomeFixturePayload(row.normalized_payload, row))
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
    'id, external_id, league_id, home_team_id, away_team_id, match_date, round, home_score, away_score, home_penalty_score, away_penalty_score, status, elapsed'
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
        homePenaltyScore: match.home_penalty_score ?? null,
        awayPenaltyScore: match.away_penalty_score ?? null,
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
      .select('match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified')
      .in('match_id', chunk)
      .order('broadcaster_name', { ascending: true })

    if (response.error) {
      const message = response.error.message.toLowerCase()
      const isMissingTrustColumns =
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        message.includes('source') ||
        message.includes('confidence') ||
        message.includes('verified') ||
        message.includes('schema cache')

      if (isMissingTrustColumns) {
        const fallback = await supabase
          .from('match_broadcasts')
          .select('match_id, broadcaster_name, broadcaster_logo_url, country')
          .in('match_id', chunk)
          .order('broadcaster_name', { ascending: true })

        if (fallback.error) {
          const fallbackMessage = fallback.error.message.toLowerCase()
          const isMissingOptionalBroadcastsTable =
            fallback.error.code === '42P01' ||
            fallback.error.code === 'PGRST205' ||
            fallbackMessage.includes('match_broadcasts')

          if (isMissingOptionalBroadcastsTable) return []
          throw fallback.error
        }

        rows.push(
          ...((fallback.data ?? []) as HomeMatchBroadcastRow[]).map((row) => ({
            ...row,
            source: row.source ?? 'manual',
            confidence: row.confidence ?? 'high',
            verified: row.verified ?? true,
          }))
        )
        continue
      }

      const isMissingOptionalBroadcastsTable =
        response.error.code === '42P01' ||
        response.error.code === 'PGRST205' ||
        message.includes('match_broadcasts') ||
        message.includes('schema cache')

      if (isMissingOptionalBroadcastsTable) return []
      throw response.error
    }

    rows.push(...(((response.data ?? []) as HomeMatchBroadcastRow[]).filter(isTrustedBroadcast)))
  }

  return rows
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

function isTrustedBroadcastSource(value?: string | null) {
  return ['manual', 'verified_rule', 'official', 'provider', 'provider_suggestion_approved'].includes(
    normalizeBroadcastRuleText(value)
  )
}

function isHighBroadcastConfidence(value?: string | null) {
  return normalizeBroadcastRuleText(value) === 'high'
}

function isTrustedBroadcast(row: HomeMatchBroadcastRow | MatchBroadcaster) {
  return (
    row.verified === true &&
    (
      isTrustedBroadcastSource(row.source) ||
      isHighBroadcastConfidence(row.confidence)
    )
  )
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

function dedupeStoredMatchEventRows(rows: StoredMatchEventRow[]) {
  return dedupeTimelineEvents(rows, {
    descending: false,
    excludePenaltyShootout: false,
    semanticDedupe: true,
  })
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
    score: formatMatchScoreWithPenalties({
      goalsHome: visibleMatch.goalsHome,
      goalsAway: visibleMatch.goalsAway,
      homePenaltyScore: visibleMatch.homePenaltyScore,
      awayPenaltyScore: visibleMatch.awayPenaltyScore,
    }),
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
      const cachedBroadcastChannel = match.broadcastChannel?.trim()
      const extras = createEmptyHomeMatchExtras()

      if (cachedBroadcastChannel) {
        extras.broadcasters = [{
          name: cachedBroadcastChannel,
          logoUrl: match.broadcastLogoUrl ?? null,
          country: null,
          source: 'normalized_cache',
          confidence: 'high',
          verified: true,
        }]
        extras.broadcastChannel = cachedBroadcastChannel
        extras.broadcastLogoUrl = match.broadcastLogoUrl ?? null
      }

      extrasByExternalId.set(
        String(match.externalId ?? match.id),
        extras
      )
    }

    for (const row of matchRows) {
      const externalId = Number(row.external_id)
      const matchId = String(row.id)

      if (!Number.isFinite(externalId)) continue

      const externalKey = String(row.external_id)

      matchRowsByMatchId.set(matchId, row)
      matchRowsByExternalId.set(externalKey, row)
      const existingExtras =
        extrasByExternalId.get(externalKey) ?? createEmptyHomeMatchExtras()

      existingExtras.persistedInSupabase = true
      extrasByExternalId.set(externalKey, existingExtras)
    }

    const matchIds = [...matchRowsByMatchId.keys()]
    const broadcastRuleCount = 0

    if (!matchIds.length) {
      const ruleMatchesApplied = 0

      if (shouldLogHomeExtras) {
        console.info('[home-broadcasts]', {
          visibleMatches: matches.length,
          matchedRows: matchRows.length,
          broadcastersLoaded: 0,
          broadcastRules: broadcastRuleCount,
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
          source: row.source,
          confidence: row.confidence,
          verified: row.verified,
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

    for (const row of matchRows) {
      const externalId = Number(row.external_id)
      if (!Number.isFinite(externalId)) continue

      const extras = extrasByExternalId.get(String(row.external_id))
      const legacyChannel = row.broadcast_channel?.trim()

      if (!extras || extras.broadcasters.length || !legacyChannel) continue

      extras.broadcasters = [{
        name: legacyChannel,
        logoUrl: row.broadcast_logo_url ?? null,
        country: null,
        source: 'legacy',
        confidence: 'high',
        verified: true,
      }]
      extras.broadcastChannel = legacyChannel
      extras.broadcastLogoUrl = row.broadcast_logo_url ?? null
    }

    const ruleMatchesApplied = 0

    if (shouldLogHomeExtras) {
      console.info('[home-broadcasts]', {
        visibleMatches: matches.length,
        matchedRows: matchRows.length,
        broadcastersLoaded: broadcastRows.length,
        broadcastRules: broadcastRuleCount,
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
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
        .in('match_id', chunk)

      if (eventsResponse.error) {
        const message = eventsResponse.error.message.toLowerCase()
        const isMissingOptionalEventsColumn =
          eventsResponse.error.code === '42703' ||
          eventsResponse.error.code === 'PGRST204' ||
          message.includes('comments') ||
          message.includes('assist_name') ||
          message.includes('schema cache')
        const isMissingOptionalEventsTable =
          eventsResponse.error.code === '42P01' ||
          eventsResponse.error.code === 'PGRST205' ||
          message.includes('match_events')

        if (isMissingOptionalEventsColumn) {
          const fallbackResponse = await supabase
            .from('match_events')
            .select('id, external_event_id, match_id, team_id, player_name, minute, extra_minute, type, detail')
            .in('match_id', chunk)

          if (fallbackResponse.error) {
            const fallbackMessage = fallbackResponse.error.message.toLowerCase()
            const isMissingFallbackTable =
              fallbackResponse.error.code === '42P01' ||
              fallbackResponse.error.code === 'PGRST205' ||
              fallbackMessage.includes('match_events')

            if (isMissingFallbackTable) return extrasByExternalId
            throw fallbackResponse.error
          }

          eventRows.push(...((fallbackResponse.data ?? []) as StoredMatchEventRow[]))
          continue
        }

        if (isMissingOptionalEventsTable) return extrasByExternalId
        throw eventsResponse.error
      }

      eventRows.push(...((eventsResponse.data ?? []) as StoredMatchEventRow[]))
    }

    const dedupedEventRows = dedupeStoredMatchEventRows(eventRows)
    const goalEvents = dedupedEventRows.filter(isValidGoalForScore)
    const importantLiveEvents = dedupedEventRows.filter((event) =>
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
        dedupedStoredEvents: dedupedEventRows.length,
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
  const extrasByFixtureId = await Promise.race([
    getHomeMatchExtrasByFixtureId(matches),
    new Promise<Map<string, HomeMatchExtras>>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn('[home:match-extras] Supabase tardo demasiado; se renderiza Home sin extras.', {
          matches: matches.length,
          timeoutMs: HOME_MATCH_EXTRAS_TIMEOUT_MS,
        })
        resolve(new Map())
      }, HOME_MATCH_EXTRAS_TIMEOUT_MS)
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
    let matchId: string | null = null
    let legacyChannel: string | null = null
    let legacyLogoUrl: string | null = null
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

      if (isMissingBroadcastColumn) {
        const fallback = await supabase
          .from('matches')
          .select('id')
          .eq('external_id', externalId)
          .maybeSingle()

        if (fallback.error) throw fallback.error

        matchId = fallback.data?.id ? String(fallback.data.id) : null
      } else {
        throw response.error
      }
    } else {
      matchId = response.data?.id ? String(response.data.id) : null
      legacyChannel = response.data?.broadcast_channel?.trim() || null
      legacyLogoUrl = response.data?.broadcast_logo_url ?? null
    }

    const broadcastRows = matchId
      ? await fetchHomeBroadcastRowsByMatchId(supabase, [matchId])
      : []
    const broadcasters = broadcastRows.map((row) => ({
      name: row.broadcaster_name,
      logoUrl: row.broadcaster_logo_url,
      country: row.country,
      source: row.source,
      confidence: row.confidence,
      verified: row.verified,
    }))

    if (broadcasters.length) {
      return {
        channel: broadcasters.map((broadcaster) => broadcaster.name).join(' / '),
        logoUrl: broadcasters.find((broadcaster) => broadcaster.logoUrl)?.logoUrl ?? null,
        broadcasters,
      }
    }

    if (legacyChannel) {
      return {
        channel: legacyChannel,
        logoUrl: legacyLogoUrl,
        broadcasters: [{
          name: legacyChannel,
          logoUrl: legacyLogoUrl,
          country: null,
          source: 'legacy',
          confidence: 'high',
          verified: true,
        }],
      }
    }

    return { channel: null, logoUrl: null, broadcasters: [] }
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
  referee?: string | null
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
  code?: string | null
  founded?: number | null
  national?: boolean | null
  venue_name?: string | null
  venue_address?: string | null
  venue_city?: string | null
  venue_capacity?: number | null
  venue_surface?: string | null
  venue_image?: string | null
  profile_last_synced_at?: string | null
}

type StoredPlayerRow = {
  id: number | string
  external_id: number | string | null
  name: string | null
  team_id: number | string | null
  team_external_id: number | string | null
  number: number | null
  position: string | null
  firstname?: string | null
  lastname?: string | null
  age?: number | null
  nationality?: string | null
  birth_date?: string | null
  birth_place?: string | null
  birth_country?: string | null
  height?: string | null
  weight?: string | null
  injured?: boolean | null
  club_external_id?: number | string | null
  club_name?: string | null
  club_logo_url?: string | null
  profile_last_synced_at?: string | null
  photo_url: string | null
}

type ApiFootballTeamDetailRow = {
  team?: {
    id?: number
    name?: string
    code?: string | null
    country?: string | null
    founded?: number | null
    national?: boolean | null
    logo?: string | null
  }
  venue?: {
    id?: number
    name?: string | null
    address?: string | null
    city?: string | null
    capacity?: number | null
    surface?: string | null
    image?: string | null
  }
}

type ApiFootballSquadPlayer = {
  id?: number
  name?: string
  age?: number | null
  number?: number | null
  position?: string | null
  photo?: string | null
}

type ApiFootballSquadRow = {
  team?: {
    id?: number
    name?: string
    logo?: string | null
  }
  players?: ApiFootballSquadPlayer[]
}

type ApiFootballPlayerDetailRow = {
  player?: {
    id?: number
    name?: string
    firstname?: string | null
    lastname?: string | null
    age?: number | null
    nationality?: string | null
    birth?: {
      date?: string | null
      place?: string | null
      country?: string | null
    } | null
    height?: string | null
    weight?: string | null
    injured?: boolean | null
    photo?: string | null
  }
  statistics?: Array<{
    team?: {
      id?: number
      name?: string | null
      logo?: string | null
    }
    league?: {
      id?: number
      name?: string | null
      country?: string | null
      logo?: string | null
      season?: number | null
    }
    games?: {
      appearences?: number | string | null
      appearances?: number | string | null
      lineups?: number | string | null
      minutes?: number | string | null
      position?: string | null
      rating?: string | null
    }
    goals?: {
      total?: number | string | null
      assists?: number | string | null
    }
    cards?: {
      yellow?: number | string | null
      red?: number | string | null
    }
  }>
}

type SquadPlayerProfile = Pick<
  TeamSquadPlayer,
  'age' | 'height' | 'clubExternalId' | 'clubName' | 'clubLogo' | 'club_logo_url' | 'clubLogoUrl' | 'photo' | 'photo_url' | 'photoUrl'
>

const STORED_PLAYER_BASE_SELECT =
  'id, external_id, name, team_id, team_external_id, number, position, photo_url'
const STORED_PLAYER_ROSTER_PROFILE_SELECT =
  `${STORED_PLAYER_BASE_SELECT}, height, club_external_id, club_name, club_logo_url, profile_last_synced_at`
const STORED_PLAYER_PROFILE_SELECT =
  `${STORED_PLAYER_ROSTER_PROFILE_SELECT}, firstname, lastname, age, nationality, birth_date, birth_place, birth_country, weight, injured`
const STORED_TEAM_BASE_SELECT =
  'id, external_id, name, logo_url'
const STORED_TEAM_COUNTRY_SELECT =
  `${STORED_TEAM_BASE_SELECT}, country`
const STORED_TEAM_PROFILE_SELECT =
  `${STORED_TEAM_COUNTRY_SELECT}, code, founded, national, venue_name, venue_address, venue_city, venue_capacity, venue_surface, venue_image, profile_last_synced_at`

const KNOWN_TOURNAMENT_RESOLUTIONS: ResolvedTournament[] = [
  { leagueId: 128, season: 2026, name: 'Liga Profesional Argentina', country: 'Argentina' },
  { leagueId: 129, season: 2026, name: 'Primera Nacional', country: 'Argentina' },
  { leagueId: 130, season: 2026, name: 'Copa Argentina', country: 'Argentina' },
  { leagueId: 131, season: 2026, name: 'Primera B Metropolitana', country: 'Argentina' },
  { leagueId: 134, season: 2026, name: 'Federal A', country: 'Argentina' },
  { leagueId: 132, season: 2026, name: 'Primera C', country: 'Argentina' },
  { leagueId: 906, season: 2026, name: 'Torneo Proyección', country: 'Argentina' },
  { leagueId: 1, season: 2026, name: 'Mundial 2026', country: 'World' },
  { leagueId: 10, season: 2026, name: 'International Friendlies', country: 'World' },
  { leagueId: 13, season: 2026, name: 'Copa Libertadores', country: 'World' },
  { leagueId: 11, season: 2026, name: 'Copa Sudamericana', country: 'World' },
  { leagueId: 2, season: 2025, name: 'UEFA Champions League', country: 'World' },
  { leagueId: 3, season: 2025, name: 'UEFA Europa League', country: 'World' },
  { leagueId: 848, season: 2025, name: 'UEFA Europa Conference League', country: 'World' },
  { leagueId: 16, season: 2026, name: 'CONCACAF Champions Cup', country: 'World' },
  { leagueId: 39, season: 2025, name: 'Premier League', country: 'England' },
  { leagueId: 45, season: 2025, name: 'FA Cup', country: 'England' },
  { leagueId: 140, season: 2025, name: 'La Liga', country: 'Spain' },
  { leagueId: 143, season: 2025, name: 'Copa del Rey', country: 'Spain' },
  { leagueId: 135, season: 2025, name: 'Serie A', country: 'Italy' },
  { leagueId: 137, season: 2025, name: 'Coppa Italia', country: 'Italy' },
  { leagueId: 78, season: 2025, name: 'Bundesliga', country: 'Germany' },
  { leagueId: 81, season: 2025, name: 'DFB Pokal', country: 'Germany' },
  { leagueId: 61, season: 2025, name: 'Ligue 1', country: 'France' },
  { leagueId: 66, season: 2025, name: 'Coupe de France', country: 'France' },
  { leagueId: 94, season: 2025, name: 'Primeira Liga', country: 'Portugal' },
  { leagueId: 96, season: 2025, name: 'Taca de Portugal', country: 'Portugal' },
  { leagueId: 71, season: 2026, name: 'Brasileirao Serie A', country: 'Brazil' },
  { leagueId: 73, season: 2026, name: 'Copa do Brasil', country: 'Brazil' },
  { leagueId: 268, season: 2026, name: 'Primera Division', country: 'Uruguay' },
  { leagueId: 930, season: 2026, name: 'Copa Uruguay', country: 'Uruguay' },
  { leagueId: 250, season: 2026, name: 'Division Profesional', country: 'Paraguay' },
  { leagueId: 252, season: 2026, name: 'Copa Paraguay', country: 'Paraguay' },
  { leagueId: 239, season: 2026, name: 'Primera A', country: 'Colombia' },
  { leagueId: 240, season: 2026, name: 'Copa Colombia', country: 'Colombia' },
  { leagueId: 265, season: 2026, name: 'Primera Division', country: 'Chile' },
  { leagueId: 267, season: 2026, name: 'Copa Chile', country: 'Chile' },
  { leagueId: 262, season: 2026, name: 'Liga MX', country: 'Mexico' },
  { leagueId: 263, season: 2026, name: 'Copa MX', country: 'Mexico' },
  { leagueId: 253, season: 2026, name: 'Major League Soccer', country: 'USA' },
  { leagueId: 257, season: 2026, name: 'US Open Cup', country: 'USA' },
  { leagueId: 9, season: 2024, name: 'Copa America', country: 'World' },
  { leagueId: 4, season: 2024, name: 'UEFA Euro', country: 'World' },
  { leagueId: 5, season: 2025, name: 'UEFA Nations League', country: 'World' },
  { leagueId: 34, season: 2026, name: 'World Cup - Qualification South America', country: 'World' },
  { leagueId: 32, season: 2026, name: 'World Cup - Qualification Europe', country: 'World' },
  { leagueId: 31, season: 2026, name: 'World Cup - Qualification CONCACAF', country: 'World' },
  { leagueId: 960, season: 2024, name: 'UEFA Euro Qualification', country: 'World' },
  { leagueId: 15, season: 2026, name: 'World Cup - Qualification Intercontinental Play-offs', country: 'World' },
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
      tournament.leagueId === 906 ? 'Reserve League' : '',
      tournament.leagueId === 906 ? 'Torneo Proyeccion' : '',
      tournament.leagueId === 1 ? 'World Cup' : '',
      tournament.leagueId === 1 ? 'FIFA World Cup' : '',
      tournament.leagueId === 1 ? 'Mundial' : '',
      tournament.leagueId === 10 ? 'Friendlies' : '',
      tournament.leagueId === 10 ? 'International Friendlies' : '',
      tournament.leagueId === 10 ? 'Friendly International' : '',
      tournament.leagueId === 10 ? 'Amistosos internacionales' : '',
      tournament.leagueId === 13 ? 'CONMEBOL Libertadores' : '',
      tournament.leagueId === 11 ? 'CONMEBOL Sudamericana' : '',
      tournament.leagueId === 848 ? 'Conference League' : '',
      tournament.leagueId === 16 ? 'CONCACAF Champions League' : '',
      tournament.leagueId === 16 ? 'Concacaf Champions' : '',
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
  if (short === 'INT') return 'Interrumpido'

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

async function fetchStoredLeagueRowsByExternalId(
  leagueId: number,
  season?: number,
  options: { fallbackToAnySeason?: boolean } = {}
) {
  const supabase = getSupabaseAdminClient()
  const fallbackToAnySeason = options.fallbackToAnySeason ?? true
  let query = supabase
    .from('leagues')
    .select('id, external_id, name, country, season, logo_url')
    .eq('external_id', String(leagueId))
    .order('season', { ascending: false })

  if (season) query = query.eq('season', season)

  const response = await query
  if (response.error) throw response.error
  if (response.data?.length || !season) return (response.data ?? []) as StoredLeagueRow[]
  if (!fallbackToAnySeason) return []

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
    'id, external_id, league_id, round, match_date, status, elapsed, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score, venue_name, venue_city, venue_country, referee, broadcast_channel, broadcast_logo_url, highlights_url, highlights_title'
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

async function fetchStoredDetailMatchRowById(matchId: number | string) {
  const supabase = getSupabaseAdminClient()
  const selectWithOptional =
    'id, external_id, league_id, round, match_date, status, elapsed, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score, venue_name, venue_city, venue_country, referee, broadcast_channel, broadcast_logo_url, highlights_url, highlights_title'
  const selectBase =
    'id, external_id, league_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score'

  let response = await supabase
    .from('matches')
    .select(selectWithOptional)
    .eq('id', String(matchId))
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
      .eq('id', String(matchId))
      .maybeSingle()
  }

  if (response.error) throw response.error

  return (response.data as StoredDetailMatchRow | null) ?? null
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
    .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
    .eq('match_id', String(matchId))
    .order('minute', { ascending: true, nullsFirst: false })
    .order('extra_minute', { ascending: true, nullsFirst: false })

  if (response.error) {
    if (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('comments') ||
      response.error.message.toLowerCase().includes('schema cache')
    ) {
      const fallbackResponse = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
        .eq('match_id', String(matchId))
        .order('minute', { ascending: true, nullsFirst: false })
        .order('extra_minute', { ascending: true, nullsFirst: false })

      if (fallbackResponse.error) {
        if (isMissingOptionalStoredEvents(fallbackResponse.error)) return []
        throw fallbackResponse.error
      }

      return (fallbackResponse.data ?? []) as StoredMatchEventRow[]
    }

    if (isMissingOptionalStoredEvents(response.error)) return []
    throw response.error
  }

  return (response.data ?? []) as StoredMatchEventRow[]
}

type StoredMatchDetailCacheRow = {
  fixture_payload?: unknown
  events: unknown
  lineups: unknown
  statistics: unknown
}

type StoredFixtureDetailCacheRow = {
  normalized_payload: unknown
}

type CachedFixtureSummary = {
  date?: string
  goalsHome: number | null
  goalsAway: number | null
  homePenaltyScore?: number | null
  awayPenaltyScore?: number | null
  minute: number | null
  statusShort?: string
  statusLong?: string
  broadcastChannel?: string | null
  broadcastLogoUrl?: string | null
  teamKitColors?: MatchTeamKitColors | null
  captains?: {
    home: AdminCaptainOverride | null
    away: AdminCaptainOverride | null
  } | null
}

type AdminMatchDetailOverrideRow = {
  fixture_external_id: string
  overrides: unknown
  active?: boolean | null
}

function isMissingOptionalMatchDetailCache(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes('football_match_detail_cache') ||
    message.includes('schema cache')
  )
}

function isMissingOptionalMatchOverrideStore(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes('admin_match_detail_overrides') ||
    message.includes('schema cache')
  )
}

function isMissingMatchDetailFixturePayloadColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    (error?.code === '42703' || error?.code === 'PGRST204') &&
    message.includes('fixture_payload')
  )
}

function readRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function hasCachedDetailItems(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

function countCachedLineupPlayers(value: unknown) {
  if (!Array.isArray(value)) return 0

  return value.reduce((total, lineup) => {
    const record = readRecord(lineup)
    const startXI = Array.isArray(record?.startXI) ? record.startXI.length : 0
    const substitutes = Array.isArray(record?.substitutes) ? record.substitutes.length : 0

    return total + startXI + substitutes
  }, 0)
}

function countCachedStatisticsValues(value: unknown) {
  if (!Array.isArray(value)) return 0

  return value.reduce((total, entry) => {
    const record = readRecord(entry)
    const statistics = Array.isArray(record?.statistics) ? record.statistics.length : 0

    return total + statistics
  }, 0)
}

function hasCachedLineupPlayers(value: unknown) {
  return countCachedLineupPlayers(value) > 0
}

function hasCachedStatisticsValues(value: unknown) {
  return countCachedStatisticsValues(value) > 0
}

function hasCachedDetailRecord(value: unknown) {
  return Boolean(readRecord(value))
}

function mergeStoredMatchDetailCacheRows(
  primary: StoredMatchDetailCacheRow | null,
  fallback: StoredMatchDetailCacheRow | null
): StoredMatchDetailCacheRow | null {
  if (!primary) return fallback
  if (!fallback) return primary

  return {
    fixture_payload: hasCachedDetailRecord(primary.fixture_payload)
      ? primary.fixture_payload
      : fallback.fixture_payload,
    events: hasCachedDetailItems(primary.events) ? primary.events : fallback.events,
    lineups: hasCachedLineupPlayers(primary.lineups)
      ? primary.lineups
      : hasCachedLineupPlayers(fallback.lineups)
        ? fallback.lineups
        : hasCachedDetailItems(primary.lineups)
          ? primary.lineups
          : fallback.lineups,
    statistics: hasCachedStatisticsValues(primary.statistics)
      ? primary.statistics
      : hasCachedStatisticsValues(fallback.statistics)
        ? fallback.statistics
        : hasCachedDetailItems(primary.statistics)
          ? primary.statistics
          : fallback.statistics,
  }
}

function mapCachedFixtureSummaryPayload(payload: unknown): CachedFixtureSummary | null {
  const row = readRecord(payload)
  if (!row) return null

  return {
    date: getStringFromCachedValue(row.date) ?? undefined,
    goalsHome: getNumberFromCachedValue(row.goalsHome),
    goalsAway: getNumberFromCachedValue(row.goalsAway),
    homePenaltyScore: getNumberFromCachedValue(row.homePenaltyScore),
    awayPenaltyScore: getNumberFromCachedValue(row.awayPenaltyScore),
    minute: getNumberFromCachedValue(row.minute),
    statusShort: getStringFromCachedValue(row.statusShort) ?? undefined,
    statusLong: getStringFromCachedValue(row.statusLong) ?? undefined,
    broadcastChannel:
      getStringFromCachedValue(row.broadcastChannel) ??
      getStringFromCachedValue(row.broadcast_channel),
    broadcastLogoUrl:
      getStringFromCachedValue(row.broadcastLogoUrl) ??
      getStringFromCachedValue(row.broadcast_logo_url),
    teamKitColors: getCachedTeamKitColors(row),
    captains: {
      home: readAdminCaptainOverride(row, 'home'),
      away: readAdminCaptainOverride(row, 'away'),
    },
  }
}

async function fetchCachedFixtureSummaryByExternalId(externalId: number) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('football_fixture_cache')
    .select('normalized_payload')
    .eq('fixture_external_id', String(externalId))
    .limit(1)
    .maybeSingle()

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const missingCacheTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('football_fixture_cache') ||
      message.includes('schema cache')

    if (missingCacheTable) return null

    throw response.error
  }

  const row = (response.data as StoredFixtureDetailCacheRow | null) ?? null
  return mapCachedFixtureSummaryPayload(row?.normalized_payload)
}

async function fetchAdminMatchDetailOverrideByExternalId(externalId: number) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('admin_match_detail_overrides')
    .select('fixture_external_id, overrides, active')
    .eq('fixture_external_id', String(externalId))
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (response.error) {
    if (isMissingOptionalMatchOverrideStore(response.error)) return null

    throw response.error
  }

  return ((response.data as AdminMatchDetailOverrideRow | null)?.overrides ?? null)
}

async function fetchStoredFixtureDetailCacheByExternalId(externalId: number) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('football_fixture_cache')
    .select('normalized_payload')
    .eq('fixture_external_id', String(externalId))
    .limit(1)
    .maybeSingle()

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const missingCacheTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('football_fixture_cache') ||
      message.includes('schema cache')

    if (missingCacheTable) return null

    throw response.error
  }

  const row = (response.data as StoredFixtureDetailCacheRow | null) ?? null
  const normalizedPayload = readRecord(row?.normalized_payload)
  const matchDetail = readRecord(normalizedPayload?.matchDetail)

  if (!matchDetail) return null

  return {
    fixture_payload: matchDetail.fixture,
    events: matchDetail.events,
    lineups: matchDetail.lineups,
    statistics: matchDetail.statistics,
  } satisfies StoredMatchDetailCacheRow
}

async function fetchStoredMatchDetailCacheByExternalId(externalId: number) {
  const supabase = getSupabaseAdminClient()
  const response = await supabase
    .from('football_match_detail_cache')
    .select('fixture_payload, events, lineups, statistics')
    .eq('fixture_external_id', String(externalId))
    .maybeSingle()

  if (response.error) {
    if (isMissingMatchDetailFixturePayloadColumn(response.error)) {
      const legacyResponse = await supabase
        .from('football_match_detail_cache')
        .select('events, lineups, statistics')
        .eq('fixture_external_id', String(externalId))
        .maybeSingle()

      if (legacyResponse.error) {
        if (isMissingOptionalMatchDetailCache(legacyResponse.error)) {
          return fetchStoredFixtureDetailCacheByExternalId(externalId)
        }
        throw legacyResponse.error
      }

      const primary = (legacyResponse.data as StoredMatchDetailCacheRow | null) ?? null
      const fallback = await fetchStoredFixtureDetailCacheByExternalId(externalId)

      return mergeStoredMatchDetailCacheRows(primary, fallback)
    }

    if (isMissingOptionalMatchDetailCache(response.error)) {
      return fetchStoredFixtureDetailCacheByExternalId(externalId)
    }
    throw response.error
  }

  const primary = (response.data as StoredMatchDetailCacheRow | null) ?? null
  const fallback = await fetchStoredFixtureDetailCacheByExternalId(externalId)

  return mergeStoredMatchDetailCacheRows(primary, fallback)
}

function readCachedArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

type CachedFixturePayload = Partial<FixtureListItem> & {
  fixture?: Partial<FixtureInfo>
  league?: Partial<LeagueInfo>
  teams?: {
    home?: Partial<TeamInfo>
    away?: Partial<TeamInfo>
  }
  goals?: Partial<FixtureGoals>
  score?: {
    halftime?: Partial<FixtureGoals>
    fulltime?: Partial<FixtureGoals>
    penalty?: Partial<FixtureGoals>
  }
}

function readCachedFixturePayload(value: unknown): CachedFixturePayload | null {
  const payload = readRecord(value)
  const fixture = readRecord(payload?.fixture)

  if (!payload || !fixture) return null

  return payload as CachedFixturePayload
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
    comments: row.comments ?? null,
  }
}

function getMatchEventSortValue(event: MatchEvent) {
  const elapsed = Number(event.time?.elapsed ?? 0)
  const extra = Number(event.time?.extra ?? 0)

  return elapsed * 100 + extra
}

function getMatchEventMergeKey(event: MatchEvent) {
  return formatMatchEventSemanticKey(event)
}

function mergeMatchEvents(cachedEvents: MatchEvent[], storedEvents: MatchEvent[]) {
  if (!cachedEvents.length || storedEvents.length >= cachedEvents.length) {
    return dedupeTimelineEvents(storedEvents, {
      descending: false,
      excludePenaltyShootout: false,
      semanticDedupe: true,
    })
  }

  const merged = new Map<string, MatchEvent>()

  for (const event of storedEvents) {
    merged.set(getMatchEventMergeKey(event), event)
  }

  for (const event of cachedEvents) {
    const key = getMatchEventMergeKey(event)
    const previous = merged.get(key)
    merged.set(key, {
      ...(previous ?? {}),
      ...event,
      team: event.team ?? previous?.team,
      player: event.player ?? previous?.player,
      assist: event.assist ?? previous?.assist,
      time: event.time ?? previous?.time,
      comments: event.comments ?? previous?.comments ?? null,
    })
  }

  return [...merged.values()].sort((a, b) => getMatchEventSortValue(a) - getMatchEventSortValue(b))
}

function mapStoredMatchToFixture(
  match: StoredDetailMatchRow,
  league: StoredLeagueRow | null,
  teamsById: Map<string, StoredTeamRow>,
  fallbackExternalId: number,
  cachedSummary?: CachedFixtureSummary | null,
  cachedFixture?: CachedFixturePayload | null
): MatchFixture | null {
  const homeTeam = match.home_team_id !== null && match.home_team_id !== undefined
    ? teamsById.get(String(match.home_team_id))
    : null
  const awayTeam = match.away_team_id !== null && match.away_team_id !== undefined
    ? teamsById.get(String(match.away_team_id))
    : null
  const matchDate =
    toOptionalDate(cachedSummary?.date) ??
    toOptionalDate(cachedFixture?.fixture?.date) ??
    toOptionalDate(match.match_date)

  if (!homeTeam?.name || !awayTeam?.name || !matchDate) return null

  const externalId = toFiniteNumber(match.external_id) ?? fallbackExternalId
  const leagueExternalId =
    toFiniteNumber(league?.external_id) ??
    toFiniteNumber(cachedFixture?.league?.id)
  const homeExternalId = toFiniteNumber(homeTeam.external_id)
  const awayExternalId = toFiniteNumber(awayTeam.external_id)
  const statusShort = normalizeStoredStatusShort(
    match.status ??
    cachedSummary?.statusShort ??
    cachedFixture?.fixture?.status?.short
  ) ?? 'NS'
  const leagueLogoUrl = pickLeagueLogoUrl(
    league?.logo_url ??
    cachedFixture?.league?.logo_url ??
    cachedFixture?.league?.logoUrl ??
    cachedFixture?.league?.logo,
    leagueExternalId
  ) ?? undefined
  const homeLogoUrl = pickTeamLogoUrl(homeTeam.logo_url, homeExternalId) ?? undefined
  const awayLogoUrl = pickTeamLogoUrl(awayTeam.logo_url, awayExternalId) ?? undefined
  const cachedGoalsHome = getNumberFromCachedValue(
    cachedFixture?.goals?.home ??
    cachedFixture?.score?.fulltime?.home
  )
  const cachedGoalsAway = getNumberFromCachedValue(
    cachedFixture?.goals?.away ??
    cachedFixture?.score?.fulltime?.away
  )
  const goalsHome = match.home_score ?? cachedSummary?.goalsHome ?? cachedGoalsHome
  const goalsAway = match.away_score ?? cachedSummary?.goalsAway ?? cachedGoalsAway
  const halftimeHome = getNumberFromCachedValue(cachedFixture?.score?.halftime?.home)
  const halftimeAway = getNumberFromCachedValue(cachedFixture?.score?.halftime?.away)
  const penaltyHome =
    match.home_penalty_score ??
    cachedSummary?.homePenaltyScore ??
    getNumberFromCachedValue(cachedFixture?.score?.penalty?.home)
  const penaltyAway =
    match.away_penalty_score ??
    cachedSummary?.awayPenaltyScore ??
    getNumberFromCachedValue(cachedFixture?.score?.penalty?.away)
  const venueName =
    getStringFromCachedValue(match.venue_name) ??
    getStringFromCachedValue(cachedFixture?.fixture?.venue?.name) ??
    undefined
  const venueCity =
    getStringFromCachedValue(match.venue_city) ??
    getStringFromCachedValue(cachedFixture?.fixture?.venue?.city) ??
    undefined
  const referee = getStringFromCachedValue(cachedFixture?.fixture?.referee) ?? undefined
  const matchReferee = getStringFromCachedValue(match.referee) ?? undefined

  return {
    fixture: {
      id: externalId,
      date: matchDate,
      status: {
        short: statusShort,
        long:
          (match.status ? getStoredStatusLong(match.status) : null) ??
          cachedSummary?.statusLong ??
          cachedFixture?.fixture?.status?.long ??
          statusShort,
        elapsed:
          match.elapsed ??
          cachedSummary?.minute ??
          getNumberFromCachedValue(cachedFixture?.fixture?.status?.elapsed) ??
          null,
      },
      venue: {
        name: venueName,
        city: venueCity,
      },
      referee: matchReferee ?? referee,
    },
    league: {
      id: leagueExternalId ?? undefined,
      name: league?.name || cachedFixture?.league?.name || 'Torneo',
      country: league?.country || cachedFixture?.league?.country || match.venue_country || '',
      logo: leagueLogoUrl,
      logo_url: leagueLogoUrl,
      logoUrl: leagueLogoUrl,
      round: match.round ?? cachedFixture?.league?.round ?? undefined,
      season: league?.season ?? cachedFixture?.league?.season ?? undefined,
    },
    teams: {
      home: {
        id: homeExternalId ?? undefined,
        name: homeTeam.name,
        logo: homeLogoUrl,
        logo_url: homeLogoUrl,
        logoUrl: homeLogoUrl,
      },
      away: {
        id: awayExternalId ?? undefined,
        name: awayTeam.name,
        logo: awayLogoUrl,
        logo_url: awayLogoUrl,
        logoUrl: awayLogoUrl,
      },
    },
    goals: {
      home: goalsHome,
      away: goalsAway,
    },
    score: {
      halftime: {
        home: halftimeHome,
        away: halftimeAway,
      },
      fulltime: {
        home: goalsHome,
        away: goalsAway,
      },
      penalty: {
        home: penaltyHome,
        away: penaltyAway,
      },
    },
  }
}

export async function getMatchDetail(id: number) {
  const match =
    await fetchStoredDetailMatchRowByExternalId(id) ??
    await fetchStoredDetailMatchRowById(id)

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
      teamKitColors: null,
    }
  }

  const fixtureExternalId = toFiniteNumber(match.external_id) ?? id
  const [league, teamsById, events, detailCache, fixtureSummary, adminOverride, broadcast, highlights] = await Promise.all([
    fetchStoredLeagueRowById(match.league_id).catch(() => null),
    fetchStoredTeamsByIds([match.home_team_id, match.away_team_id]),
    fetchStoredEventsByMatchId(match.id),
    fetchStoredMatchDetailCacheByExternalId(fixtureExternalId),
    fetchCachedFixtureSummaryByExternalId(fixtureExternalId),
    fetchAdminMatchDetailOverrideByExternalId(fixtureExternalId),
    getMatchBroadcastByExternalId(fixtureExternalId),
    getMatchHighlightsByExternalId(fixtureExternalId),
  ])
  const cachedFixture = readCachedFixturePayload(detailCache?.fixture_payload)
  const fixture = mapStoredMatchToFixture(match, league, teamsById, fixtureExternalId, fixtureSummary, cachedFixture)
  const adminOverrideRecord = readAdminMatchOverridePayload(adminOverride)
  const fixtureSummaryCaptainOverrideRecord =
    fixtureSummary?.captains?.home || fixtureSummary?.captains?.away
      ? { captains: fixtureSummary.captains }
      : null
  const captainOverrideRecord = hasAdminCaptainOverrides(adminOverrideRecord)
    ? adminOverrideRecord
    : fixtureSummaryCaptainOverrideRecord
  const adminBroadcastChannel = getStringFromCachedValue(adminOverrideRecord?.tv)
  const adminBroadcastLogoUrl = getStringFromCachedValue(adminOverrideRecord?.broadcastLogoUrl)
  const adminTeamKitColors = adminOverrideRecord ? getCachedTeamKitColors(adminOverrideRecord) : null
  const cachedBroadcastChannel = adminBroadcastChannel || fixtureSummary?.broadcastChannel?.trim() || null
  const cachedBroadcastLogoUrl = adminBroadcastLogoUrl || fixtureSummary?.broadcastLogoUrl || null
  const resolvedBroadcast = broadcast.channel || !cachedBroadcastChannel
    ? broadcast
    : {
        channel: cachedBroadcastChannel,
        logoUrl: cachedBroadcastLogoUrl,
        broadcasters: [{
          name: cachedBroadcastChannel,
          logoUrl: cachedBroadcastLogoUrl,
          country: null,
          source: adminBroadcastChannel ? 'admin_override' : 'normalized_cache',
          confidence: 'high',
          verified: true,
        }],
      }
  const cachedEvents = readCachedArray<MatchEvent>(detailCache?.events)
  const storedEvents = events.map((event) => mapStoredEventToMatchEvent(event, teamsById))
  const mergedEvents = mergeMatchEvents(cachedEvents, storedEvents)
  const statistics = readCachedArray<MatchStatisticsTeam>(detailCache?.statistics)
  const lineups = applyAdminCaptainOverridesToLineups(
    readCachedArray<MatchLineup>(detailCache?.lineups),
    fixture,
    captainOverrideRecord
  )

  if (process.env.NODE_ENV === 'development') {
    console.info('[match-detail-data]', {
      fixtureId: id,
      fixtureExternalId,
      storedEvents: storedEvents.length,
      cachedEvents: cachedEvents.length,
      renderedEvents: mergedEvents.length,
      cachedFixtureStatus: fixtureSummary?.statusShort ?? null,
      cachedFixtureGoals: fixtureSummary
        ? { home: fixtureSummary.goalsHome, away: fixtureSummary.goalsAway }
        : null,
      cachedFixtureInfo: {
        hasPayload: Boolean(cachedFixture),
        venue: fixture?.fixture.venue?.name ?? null,
        referee: fixture?.fixture.referee ?? null,
      },
      broadcast: {
        direct: broadcast.channel,
        rules: null,
        rendered: resolvedBroadcast.channel,
      },
      statisticsTeams: statistics.length,
      statisticsCount: statistics.reduce((count, team) => count + (team.statistics?.length ?? 0), 0),
      lineups: lineups.length,
      lineupPlayers: lineups.reduce(
        (count, lineup) => count + (lineup.startXI?.length ?? 0) + (lineup.substitutes?.length ?? 0),
        0
      ),
    })
  }

  return {
    fixture,
    events: mergedEvents,
    statistics,
    lineups,
    broadcastChannel: resolvedBroadcast.channel ?? null,
    broadcastLogoUrl: resolvedBroadcast.logoUrl ?? null,
    broadcasters: resolvedBroadcast.broadcasters,
    highlightsUrl:
      getStringFromCachedValue(adminOverrideRecord?.highlightsUrl) ??
      match.highlights_url ??
      highlights.url,
    highlightsTitle:
      getStringFromCachedValue(adminOverrideRecord?.highlightsTitle) ??
      match.highlights_title ??
      highlights.title,
    teamKitColors: mergeTeamKitColors(fixtureSummary?.teamKitColors, adminTeamKitColors),
  }
}

async function fetchStoredPlayersByTeam(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  team: StoredTeamRow | null,
  externalId: number
) {
  if (!team?.id && !externalId) return []

  const rows = await fetchStoredPlayerRowsByTeamSelector(
    supabase,
    team,
    externalId
  )
  const rowsByExternalId = team?.id
    ? await fetchStoredPlayerRowsByTeamSelector(
        supabase,
        null,
        externalId,
        { suppressErrors: true }
      )
    : []

  return mergeStoredPlayerRows(rows, rowsByExternalId)
}

async function fetchStoredPlayerRowsByTeamSelector(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  team: StoredTeamRow | null,
  externalId: number,
  options: { suppressErrors?: boolean } = {}
) {
  let response = await selectStoredPlayersByTeam(
    supabase,
    team,
    externalId,
    STORED_PLAYER_PROFILE_SELECT
  )

  if (response.error && isStoredPlayerReadFallbackError(response.error)) {
    response = await selectStoredPlayersByTeam(
      supabase,
      team,
      externalId,
      STORED_PLAYER_ROSTER_PROFILE_SELECT
    )
  }

  if (response.error && isStoredPlayerReadFallbackError(response.error)) {
    response = await selectStoredPlayersByTeam(
      supabase,
      team,
      externalId,
      STORED_PLAYER_BASE_SELECT
    )
  }

  if (response.error) {
    if (isStoredPlayerReadFallbackError(response.error) || options.suppressErrors) return []
    throw response.error
  }

  return (response.data ?? []) as unknown as StoredPlayerRow[]
}

function getStoredPlayerMergeKey(player: StoredPlayerRow) {
  const externalId = toFiniteNumber(player.external_id)
  if (externalId) return `external:${externalId}`

  const normalizedName = normalizeSquadPlayerKey(player.name)

  return normalizedName ? `name:${normalizedName}` : `row:${player.id}`
}

function getStoredPlayerCompletenessScore(player: StoredPlayerRow) {
  return [
    player.external_id,
    player.name,
    player.team_id,
    player.team_external_id,
    player.number,
    player.position,
    player.height,
    player.club_external_id,
    player.club_name,
    player.club_logo_url,
    player.profile_last_synced_at,
    player.photo_url,
  ].filter(Boolean).length
}

function mergeStoredPlayerRow(
  current: StoredPlayerRow,
  candidate: StoredPlayerRow
): StoredPlayerRow {
  const currentScore = getStoredPlayerCompletenessScore(current)
  const candidateScore = getStoredPlayerCompletenessScore(candidate)
  const primary = candidateScore >= currentScore ? candidate : current
  const fallback = primary === candidate ? current : candidate

  return {
    id: primary.id ?? fallback.id,
    external_id: primary.external_id ?? fallback.external_id,
    name: primary.name ?? fallback.name,
    team_id: primary.team_id ?? fallback.team_id,
    team_external_id: primary.team_external_id ?? fallback.team_external_id,
    number: primary.number ?? fallback.number,
    position: primary.position ?? fallback.position,
    height: primary.height ?? fallback.height,
    club_external_id: primary.club_external_id ?? fallback.club_external_id,
    club_name: primary.club_name ?? fallback.club_name,
    club_logo_url: primary.club_logo_url ?? fallback.club_logo_url,
    profile_last_synced_at: primary.profile_last_synced_at ?? fallback.profile_last_synced_at,
    photo_url: primary.photo_url ?? fallback.photo_url,
  }
}

function mergeStoredPlayerRows(...groups: StoredPlayerRow[][]) {
  const rowsByKey = new Map<string, StoredPlayerRow>()

  for (const player of groups.flat()) {
    const key = getStoredPlayerMergeKey(player)
    const current = rowsByKey.get(key)

    rowsByKey.set(key, current ? mergeStoredPlayerRow(current, player) : player)
  }

  return [...rowsByKey.values()].sort((a, b) => {
    const positionCompare = String(a.position ?? '').localeCompare(String(b.position ?? ''))
    if (positionCompare !== 0) return positionCompare

    return (a.number ?? 999) - (b.number ?? 999) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''))
  })
}

function selectStoredPlayersByTeam(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  team: StoredTeamRow | null,
  externalId: number,
  columns: string
) {
  let query = supabase
    .from('players')
    .select(columns)
    .order('position', { ascending: true, nullsFirst: false })
    .order('number', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (team?.id) {
    query = query.eq('team_id', String(team.id))
  } else {
    query = query.eq('team_external_id', String(externalId))
  }

  return query.limit(80)
}

function isStoredPlayerReadFallbackError(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('players') ||
    message.includes('schema cache') ||
    message.includes('height') ||
    message.includes('firstname') ||
    message.includes('lastname') ||
    message.includes('age') ||
    message.includes('nationality') ||
    message.includes('birth_') ||
    message.includes('weight') ||
    message.includes('injured') ||
    message.includes('club_') ||
    message.includes('profile_last_synced_at')
  )
}

function isStoredTeamProfileReadFallbackError(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('teams') ||
    message.includes('schema cache') ||
    message.includes('country') ||
    message.includes('code') ||
    message.includes('founded') ||
    message.includes('national') ||
    message.includes('venue_') ||
    message.includes('profile_last_synced_at')
  )
}

async function fetchStoredTeamByExternalId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  externalId: number
) {
  let response = await supabase
    .from('teams')
    .select(STORED_TEAM_PROFILE_SELECT)
    .eq('external_id', String(externalId))
    .maybeSingle()

  if (response.error && isStoredTeamProfileReadFallbackError(response.error)) {
    response = await supabase
      .from('teams')
      .select(STORED_TEAM_COUNTRY_SELECT)
      .eq('external_id', String(externalId))
      .maybeSingle()
  }

  if (response.error && isStoredTeamProfileReadFallbackError(response.error)) {
    response = await supabase
      .from('teams')
      .select(STORED_TEAM_BASE_SELECT)
      .eq('external_id', String(externalId))
      .maybeSingle()
  }

  if (response.error) throw response.error

  return (response.data as StoredTeamRow | null) ?? null
}

async function fetchApiTeamDetailSafe(externalId: number) {
  try {
    const { payload } = await requestFootballApi<ApiFootballTeamDetailRow[]>(
      '/teams',
      { id: externalId },
      { logContext: `team-detail:${externalId}:profile` }
    )

    return payload.response?.[0] ?? null
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[team-detail-data] No se pudo enriquecer perfil desde API-Football.', {
        teamExternalId: externalId,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    return null
  }
}

async function fetchApiTeamSquadSafe(externalId: number) {
  try {
    const { payload } = await requestFootballApi<ApiFootballSquadRow[]>(
      '/players/squads',
      { team: externalId },
      { logContext: `team-detail:${externalId}:squad` }
    )

    return payload.response?.[0] ?? null
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[team-detail-data] No se pudo enriquecer plantel desde API-Football.', {
        teamExternalId: externalId,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    return null
  }
}

function isFreshTeamProfileSync(team: StoredTeamRow | null) {
  if (!team?.profile_last_synced_at) return false

  const timestamp = new Date(team.profile_last_synced_at).getTime()
  if (!Number.isFinite(timestamp)) return false

  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return Date.now() - timestamp < thirtyDays
}

function hasStoredTeamProfileGap(team: StoredTeamRow | null) {
  if (!team) return true
  if (isFreshTeamProfileSync(team)) return false

  return Boolean(
    !team.country ||
    !team.code ||
    !team.founded ||
    !team.venue_name ||
    !team.venue_city ||
    !team.venue_capacity ||
    !team.venue_surface
  )
}

function hasStoredSquadProfileGap(players: StoredPlayerRow[]) {
  if (!players.length) return true

  return players.some((player) =>
    !player.age ||
    !player.height ||
    !player.club_name ||
    !player.photo_url
  )
}

function hasStoredPlayerDetailGap(player: StoredPlayerRow | null) {
  if (!player) return true

  return Boolean(
    !player.age ||
    !player.nationality ||
    !player.birth_date ||
    !player.birth_place ||
    !player.height ||
    !player.weight
  )
}

function mapStoredTeamVenue(team: StoredTeamRow | null): TeamVenue | undefined {
  if (!team) return undefined

  const venue: TeamVenue = {
    name: team.venue_name ?? undefined,
    address: team.venue_address ?? undefined,
    city: team.venue_city ?? undefined,
    capacity: team.venue_capacity ?? undefined,
    surface: team.venue_surface ?? undefined,
    image: team.venue_image ?? undefined,
  }

  return Object.values(venue).some(Boolean) ? venue : undefined
}

function mapApiTeamVenue(apiVenue?: ApiFootballTeamDetailRow['venue']): TeamVenue | undefined {
  if (!apiVenue) return undefined

  const venue: TeamVenue = {
    name: apiVenue.name ?? undefined,
    address: apiVenue.address ?? undefined,
    city: apiVenue.city ?? undefined,
    capacity: apiVenue.capacity ?? undefined,
    surface: apiVenue.surface ?? undefined,
    image: apiVenue.image ?? undefined,
  }

  return Object.values(venue).some(Boolean) ? venue : undefined
}

function mergeTeamVenue(
  storedVenue?: TeamVenue,
  apiVenue?: TeamVenue
): TeamVenue | undefined {
  if (!storedVenue && !apiVenue) return undefined

  return {
    name: storedVenue?.name ?? apiVenue?.name,
    address: storedVenue?.address ?? apiVenue?.address,
    city: storedVenue?.city ?? apiVenue?.city,
    capacity: storedVenue?.capacity ?? apiVenue?.capacity,
    surface: storedVenue?.surface ?? apiVenue?.surface,
    image: storedVenue?.image ?? apiVenue?.image,
  }
}

async function persistApiTeamProfileSafe(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  externalId: number,
  currentTeam: StoredTeamRow | null,
  apiDetail: ApiFootballTeamDetailRow | null
) {
  const apiTeam = apiDetail?.team
  const apiVenue = apiDetail?.venue
  if (!apiTeam && !apiVenue) return

  const syncedAt = new Date().toISOString()
  const row: Record<string, string | number | boolean> = {
    profile_last_synced_at: syncedAt,
  }

  assignPlayerProfileValue(row, 'name', apiTeam?.name)
  assignPlayerProfileValue(row, 'logo_url', apiTeam?.logo)
  assignPlayerProfileValue(row, 'country', apiTeam?.country)
  assignPlayerProfileValue(row, 'code', apiTeam?.code)
  assignPlayerProfileValue(row, 'founded', apiTeam?.founded)
  assignPlayerProfileValue(row, 'national', apiTeam?.national)
  assignPlayerProfileValue(row, 'venue_name', apiVenue?.name)
  assignPlayerProfileValue(row, 'venue_address', apiVenue?.address)
  assignPlayerProfileValue(row, 'venue_city', apiVenue?.city)
  assignPlayerProfileValue(row, 'venue_capacity', apiVenue?.capacity)
  assignPlayerProfileValue(row, 'venue_surface', apiVenue?.surface)
  assignPlayerProfileValue(row, 'venue_image', apiVenue?.image)

  const changedFields = Object.keys(row).filter((key) => key !== 'profile_last_synced_at')
  if (!changedFields.length) return

  const result = currentTeam
    ? await supabase
        .from('teams')
        .update(row)
        .eq('external_id', String(externalId))
    : await supabase
        .from('teams')
        .upsert(
          {
            external_id: externalId,
            name: apiTeam?.name || `Equipo ${externalId}`,
            ...row,
          },
          { onConflict: 'external_id' }
        )

  if (!result.error) return
  if (isStoredTeamProfileReadFallbackError(result.error)) return

  throw result.error
}

function mapStoredPlayerToSquadPlayer(player: StoredPlayerRow): TeamSquadPlayer {
  const playerExternalId = toFiniteNumber(player.external_id) ?? undefined
  const clubExternalId = toFiniteNumber(player.club_external_id)
  const photoUrl = player.photo_url ?? undefined
  const clubLogoUrl = player.club_logo_url ?? undefined

  return {
    id: playerExternalId,
    name: player.name ?? 'Jugador',
    age: player.age ?? undefined,
    number: player.number ?? undefined,
    position: player.position ?? undefined,
    height: player.height ?? undefined,
    clubExternalId: clubExternalId ?? undefined,
    clubName: player.club_name ?? undefined,
    clubLogo: clubLogoUrl,
    club_logo_url: clubLogoUrl,
    clubLogoUrl,
    profile_last_synced_at: player.profile_last_synced_at ?? undefined,
    profileLastSyncedAt: player.profile_last_synced_at ?? undefined,
    photo: photoUrl,
    photo_url: photoUrl,
    photoUrl,
  }
}

function mapApiPlayerToSquadPlayer(player: ApiFootballSquadPlayer): TeamSquadPlayer {
  const photoUrl = player.photo ?? undefined

  return {
    id: player.id,
    name: player.name ?? 'Jugador',
    age: player.age ?? undefined,
    number: player.number ?? undefined,
    position: player.position ?? undefined,
    photo: photoUrl,
    photo_url: photoUrl,
    photoUrl,
  }
}

function normalizeSquadPlayerKey(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getSquadPlayerMergeKey(player: TeamSquadPlayer) {
  return player.id ? `id:${player.id}` : `name:${normalizeSquadPlayerKey(player.name)}`
}

function mergeSquadPlayers(
  storedPlayers: TeamSquadPlayer[],
  apiPlayers: TeamSquadPlayer[]
) {
  const merged = new Map<string, TeamSquadPlayer>()

  for (const player of storedPlayers) {
    merged.set(getSquadPlayerMergeKey(player), player)
  }

  for (const player of apiPlayers) {
    const key = getSquadPlayerMergeKey(player)
    const previous = merged.get(key)

    merged.set(key, {
      ...(previous ?? {}),
      ...player,
      id: previous?.id ?? player.id,
      name: previous?.name || player.name,
      age: previous?.age ?? player.age,
      number: previous?.number ?? player.number,
      position: previous?.position ?? player.position,
      height: previous?.height ?? player.height,
      clubExternalId: previous?.clubExternalId ?? player.clubExternalId,
      clubName: previous?.clubName ?? player.clubName,
      clubLogo: previous?.clubLogo ?? player.clubLogo,
      club_logo_url: previous?.club_logo_url ?? player.club_logo_url,
      clubLogoUrl: previous?.clubLogoUrl ?? player.clubLogoUrl,
      photo: previous?.photo ?? player.photo,
      photo_url: previous?.photo_url ?? player.photo_url,
      photoUrl: previous?.photoUrl ?? player.photoUrl,
      profile_last_synced_at: previous?.profile_last_synced_at ?? player.profile_last_synced_at,
      profileLastSyncedAt: previous?.profileLastSyncedAt ?? player.profileLastSyncedAt,
    })
  }

  return [...merged.values()].sort((a, b) => {
    const positionCompare = String(a.position ?? '').localeCompare(String(b.position ?? ''))
    if (positionCompare !== 0) return positionCompare

    return (a.number ?? 999) - (b.number ?? 999) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''))
  })
}

function getSquadProfileLookupSeasons() {
  const currentYear = new Date().getFullYear()

  return [currentYear, currentYear - 1].filter((season, index, seasons) =>
    season > 2000 && seasons.indexOf(season) === index
  )
}

function getTrimmedValue(value?: string | null) {
  const trimmed = value?.trim()

  return trimmed || undefined
}

type ApiFootballPlayerStatistic = NonNullable<ApiFootballPlayerDetailRow['statistics']>[number]

function getFirstFinitePlayerNumber(
  ...values: Array<number | string | null | undefined>
) {
  for (const value of values) {
    const numericValue = toFiniteNumber(value)
    if (numericValue !== null) return numericValue
  }

  return 0
}

function getFirstTrimmedPlayerValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = getTrimmedValue(value)
    if (trimmed) return trimmed
  }

  return undefined
}

function pickApiPlayerStatistic(
  rows: ApiFootballPlayerDetailRow[],
  leagueId?: number
): ApiFootballPlayerStatistic | null {
  const statistics = rows.flatMap((row) => row.statistics ?? [])
  if (!statistics.length) return null

  if (leagueId) {
    const leagueStatistic = statistics.find(
      (statistic) => toFiniteNumber(statistic.league?.id) === leagueId
    )
    if (leagueStatistic) return leagueStatistic
  }

  return (
    statistics.find((statistic) => statistic.team?.id || statistic.league?.id) ??
    statistics[0] ??
    null
  )
}

function pickApiPlayerRow(rows: ApiFootballPlayerDetailRow[], leagueId?: number) {
  if (leagueId) {
    const leagueRow = rows.find((row) =>
      row.statistics?.some((statistic) => toFiniteNumber(statistic.league?.id) === leagueId)
    )
    if (leagueRow?.player) return leagueRow
  }

  return rows.find((row) => row.player) ?? null
}

function mapApiPlayerRowsToPlayerDetail(
  rows: ApiFootballPlayerDetailRow[],
  leagueId?: number
): PlayerDetail | null {
  if (!rows.length) return null

  const row = pickApiPlayerRow(rows, leagueId)
  const statistic = pickApiPlayerStatistic(rows, leagueId)
  const apiPlayer = row?.player
  if (!apiPlayer && !statistic) return null

  const playerId = toFiniteNumber(apiPlayer?.id) ?? undefined
  const playerPhotoUrl = getTrimmedValue(apiPlayer?.photo)
  const playerNameFromParts = [apiPlayer?.firstname, apiPlayer?.lastname]
    .map((part) => getTrimmedValue(part))
    .filter((part): part is string => Boolean(part))
    .join(' ')
  const playerName =
    getFirstTrimmedPlayerValue(apiPlayer?.name, playerNameFromParts) ?? 'Jugador'
  const teamId = toFiniteNumber(statistic?.team?.id)
  const teamLogoUrl =
    pickTeamLogoUrl(getTrimmedValue(statistic?.team?.logo), teamId) ?? undefined
  const statisticLeagueId = toFiniteNumber(statistic?.league?.id)
  const leagueLogoUrl =
    pickLeagueLogoUrl(
      getTrimmedValue(statistic?.league?.logo),
      statisticLeagueId ?? leagueId
    ) ?? undefined

  return {
    player: {
      id: playerId,
      name: playerName || 'Jugador',
      firstname: getTrimmedValue(apiPlayer?.firstname),
      lastname: getTrimmedValue(apiPlayer?.lastname),
      age: toFiniteNumber(apiPlayer?.age) ?? undefined,
      nationality: getTrimmedValue(apiPlayer?.nationality),
      birthDate: getTrimmedValue(apiPlayer?.birth?.date),
      birthPlace: getTrimmedValue(apiPlayer?.birth?.place),
      birthCountry: getTrimmedValue(apiPlayer?.birth?.country),
      height: getTrimmedValue(apiPlayer?.height),
      weight: getTrimmedValue(apiPlayer?.weight),
      injured: apiPlayer?.injured ?? undefined,
      photo: playerPhotoUrl,
      photo_url: playerPhotoUrl,
      photoUrl: playerPhotoUrl,
    },
    team: statistic?.team
      ? {
          id: teamId ?? undefined,
          name: getTrimmedValue(statistic.team.name),
          logo: teamLogoUrl,
          logo_url: teamLogoUrl,
          logoUrl: teamLogoUrl,
        }
      : undefined,
    league: statistic?.league
      ? {
          id: statisticLeagueId ?? leagueId,
          name: getTrimmedValue(statistic.league.name),
          country: getTrimmedValue(statistic.league.country),
          logo: leagueLogoUrl,
          logo_url: leagueLogoUrl,
          logoUrl: leagueLogoUrl,
          season: toFiniteNumber(statistic.league.season) ?? undefined,
        }
      : undefined,
    statistics: {
      appearances: getFirstFinitePlayerNumber(
        statistic?.games?.appearences,
        statistic?.games?.appearances
      ),
      lineups: getFirstFinitePlayerNumber(statistic?.games?.lineups),
      minutes: getFirstFinitePlayerNumber(statistic?.games?.minutes),
      position: getTrimmedValue(statistic?.games?.position),
      rating: getTrimmedValue(statistic?.games?.rating) ?? null,
      goals: getFirstFinitePlayerNumber(statistic?.goals?.total),
      assists: getFirstFinitePlayerNumber(statistic?.goals?.assists),
      yellowCards: getFirstFinitePlayerNumber(statistic?.cards?.yellow),
      redCards: getFirstFinitePlayerNumber(statistic?.cards?.red),
    },
  }
}

async function fetchApiPlayerDetailSafe(
  playerExternalId: number,
  season: number,
  leagueId?: number
) {
  const attempts = leagueId
    ? [
        { id: playerExternalId, season, league: leagueId },
        { id: playerExternalId, season },
      ]
    : [{ id: playerExternalId, season }]

  for (const params of attempts) {
    try {
      const { payload } = await withTimeout(
        requestFootballApi<ApiFootballPlayerDetailRow[]>('/players', params, {
          logContext: `player-detail:${playerExternalId}:${season}:${leagueId ?? 'all'}`,
        }),
        4500,
        `API-Football player detail timeout ${playerExternalId}`
      )
      const rows = payload.response ?? []
      if (rows.length) return rows
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[player-detail-data] No se pudo enriquecer la ficha del jugador.', {
          playerExternalId,
          season,
          leagueId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return []
}

function getValidPlayerBirthDate(value?: string | null) {
  const trimmed = getTrimmedValue(value)
  if (!trimmed) return undefined

  const date = new Date(trimmed)
  if (!Number.isFinite(date.getTime())) return undefined

  return date.toISOString().slice(0, 10)
}

function assignPlayerProfileValue(
  row: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | null | undefined
) {
  if (value === null || value === undefined || value === '') return

  row[key] = value
}

async function persistApiPlayerDetailProfileSafe(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  playerExternalId: number,
  currentPlayer: StoredPlayerRow | null,
  apiDetail: PlayerDetail | null
) {
  const apiPlayer = apiDetail?.player
  if (!apiPlayer) return

  const syncedAt = new Date().toISOString()
  const row: Record<string, string | number | boolean> = {
    profile_last_synced_at: syncedAt,
    updated_at: syncedAt,
  }

  assignPlayerProfileValue(row, 'name', apiPlayer.name)
  assignPlayerProfileValue(row, 'firstname', apiPlayer.firstname)
  assignPlayerProfileValue(row, 'lastname', apiPlayer.lastname)
  assignPlayerProfileValue(row, 'age', apiPlayer.age)
  assignPlayerProfileValue(row, 'nationality', apiPlayer.nationality)
  assignPlayerProfileValue(row, 'birth_date', getValidPlayerBirthDate(apiPlayer.birthDate))
  assignPlayerProfileValue(row, 'birth_place', apiPlayer.birthPlace)
  assignPlayerProfileValue(row, 'birth_country', apiPlayer.birthCountry)
  assignPlayerProfileValue(row, 'height', apiPlayer.height)
  assignPlayerProfileValue(row, 'weight', apiPlayer.weight)
  assignPlayerProfileValue(row, 'injured', apiPlayer.injured)
  assignPlayerProfileValue(row, 'photo_url', apiPlayer.photo_url ?? apiPlayer.photo)

  const changedFields = Object.keys(row).filter(
    (key) => key !== 'profile_last_synced_at' && key !== 'updated_at'
  )
  if (!changedFields.length) return

  const result = currentPlayer
    ? await supabase
        .from('players')
        .update(row)
        .eq('external_id', String(playerExternalId))
    : await supabase
        .from('players')
        .upsert(
          {
            external_id: String(playerExternalId),
            name: apiPlayer.name || `Jugador ${playerExternalId}`,
            ...row,
          },
          { onConflict: 'external_id' }
        )

  if (!result.error) return
  if (isStoredPlayerReadFallbackError(result.error)) return

  throw result.error
}

function isFreshPlayerProfileSync(player: TeamSquadPlayer) {
  const value = player.profileLastSyncedAt ?? player.profile_last_synced_at
  if (!value) return false

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return false

  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - timestamp < sevenDays
}

function needsNationalSquadProfile(player: TeamSquadPlayer) {
  return Boolean(player.id && (!player.height || !player.clubName) && !isFreshPlayerProfileSync(player))
}

function pickClubFromPlayerStatistics(
  rows: ApiFootballPlayerDetailRow[],
  nationalTeamExternalId: number
) {
  for (const row of rows) {
    const club = row.statistics?.find((stat) => {
      const teamId = toFiniteNumber(stat.team?.id)
      const teamName = getTrimmedValue(stat.team?.name)

      return Boolean(teamId && teamName && teamId !== nationalTeamExternalId)
    })?.team

    if (club?.id && club.name) return club
  }

  return null
}

function mapApiPlayerRowsToSquadProfile(
  rows: ApiFootballPlayerDetailRow[],
  nationalTeamExternalId: number
): SquadPlayerProfile | null {
  if (!rows.length) return null

  const profile: SquadPlayerProfile = {}
  const player = rows.find((row) => row.player)?.player
  const club = pickClubFromPlayerStatistics(rows, nationalTeamExternalId)
  const clubLogoUrl = getTrimmedValue(club?.logo)

  if (player?.age) profile.age = player.age
  profile.height = getTrimmedValue(player?.height)
  profile.photo = getTrimmedValue(player?.photo)
  profile.photo_url = profile.photo
  profile.photoUrl = profile.photo

  if (club?.id) profile.clubExternalId = club.id
  profile.clubName = getTrimmedValue(club?.name)
  profile.clubLogo = clubLogoUrl
  profile.club_logo_url = clubLogoUrl
  profile.clubLogoUrl = clubLogoUrl

  return Object.values(profile).some(Boolean) ? profile : null
}

function mergeSquadPlayerProfile(
  player: TeamSquadPlayer,
  profile: SquadPlayerProfile | null,
  profileLastSyncedAt: string
): TeamSquadPlayer {
  if (!profile) {
    return {
      ...player,
      profile_last_synced_at: profileLastSyncedAt,
      profileLastSyncedAt,
    }
  }

  return {
    ...player,
    age: player.age ?? profile.age,
    height: player.height ?? profile.height,
    clubExternalId: player.clubExternalId ?? profile.clubExternalId,
    clubName: player.clubName ?? profile.clubName,
    clubLogo: player.clubLogo ?? profile.clubLogo,
    club_logo_url: player.club_logo_url ?? profile.club_logo_url,
    clubLogoUrl: player.clubLogoUrl ?? profile.clubLogoUrl,
    photo: player.photo ?? profile.photo,
    photo_url: player.photo_url ?? profile.photo_url,
    photoUrl: player.photoUrl ?? profile.photoUrl,
    profile_last_synced_at: profileLastSyncedAt,
    profileLastSyncedAt,
  }
}

async function fetchApiSquadPlayerProfileSafe(
  playerExternalId: number,
  nationalTeamExternalId: number
) {
  let mergedProfile: SquadPlayerProfile = {}

  for (const season of getSquadProfileLookupSeasons()) {
    try {
      const { payload } = await withTimeout(
        requestFootballApi<ApiFootballPlayerDetailRow[]>(
          '/players',
          {
            id: playerExternalId,
            season,
          },
          {
            logContext:
              `team-detail:${nationalTeamExternalId}:player:${playerExternalId}:${season}`,
          }
        ),
        4500,
        `API-Football player profile timeout ${playerExternalId}`
      )
      const profile = mapApiPlayerRowsToSquadProfile(
        payload.response ?? [],
        nationalTeamExternalId
      )

      if (!profile) continue

      mergedProfile = {
        ...mergedProfile,
        age: mergedProfile.age ?? profile.age,
        height: mergedProfile.height ?? profile.height,
        clubExternalId: mergedProfile.clubExternalId ?? profile.clubExternalId,
        clubName: mergedProfile.clubName ?? profile.clubName,
        clubLogo: mergedProfile.clubLogo ?? profile.clubLogo,
        club_logo_url: mergedProfile.club_logo_url ?? profile.club_logo_url,
        clubLogoUrl: mergedProfile.clubLogoUrl ?? profile.clubLogoUrl,
        photo: mergedProfile.photo ?? profile.photo,
        photo_url: mergedProfile.photo_url ?? profile.photo_url,
        photoUrl: mergedProfile.photoUrl ?? profile.photoUrl,
      }

      if (mergedProfile.height && mergedProfile.clubName) break
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[team-detail-data] No se pudo enriquecer jugador del plantel.', {
          playerExternalId,
          season,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return Object.values(mergedProfile).some(Boolean) ? mergedProfile : null
}

async function persistNationalSquadPlayerProfiles(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  nationalTeamExternalId: number,
  players: TeamSquadPlayer[],
  profiles: Map<number, SquadPlayerProfile | null>,
  profileLastSyncedAt: string
) {
  const rows = players
    .filter((player) => player.id && profiles.has(player.id))
    .map((player) => {
      const profile = player.id ? profiles.get(player.id) ?? null : null
      const clubExternalId = profile?.clubExternalId ?? player.clubExternalId
      const clubLogoUrl =
        profile?.clubLogoUrl ??
        profile?.club_logo_url ??
        profile?.clubLogo ??
        player.clubLogoUrl ??
        player.club_logo_url ??
        player.clubLogo ??
        null
      const photoUrl = profile?.photoUrl ?? profile?.photo_url ?? profile?.photo ?? player.photoUrl ?? player.photo_url ?? player.photo ?? null

      return {
        external_id: String(player.id),
        name: player.name || `Jugador ${player.id}`,
        team_external_id: String(nationalTeamExternalId),
        number: player.number ?? null,
        position: player.position ?? null,
        height: profile?.height ?? player.height ?? null,
        club_external_id: clubExternalId ? String(clubExternalId) : null,
        club_name: profile?.clubName ?? player.clubName ?? null,
        club_logo_url: clubLogoUrl,
        photo_url: photoUrl,
        profile_last_synced_at: profileLastSyncedAt,
        updated_at: profileLastSyncedAt,
      }
    })

  if (!rows.length) return

  const { error } = await supabase
    .from('players')
    .upsert(rows, { onConflict: 'external_id' })

  if (error) throw error
}

async function enrichNationalSquadProfiles(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  players: TeamSquadPlayer[],
  nationalTeamExternalId: number,
  maxProfiles = 8
) {
  if (!process.env.FOOTBALL_API_KEY) return players

  const candidates = players.filter(needsNationalSquadProfile).slice(0, maxProfiles)
  if (!candidates.length) return players

  const profileLastSyncedAt = new Date().toISOString()
  const profiles = new Map<number, SquadPlayerProfile | null>()

  for (const group of chunkArray(candidates, 4)) {
    const resolvedProfiles = await Promise.all(
      group.map(async (player) => ({
        playerId: player.id,
        profile: player.id
          ? await fetchApiSquadPlayerProfileSafe(player.id, nationalTeamExternalId)
          : null,
      }))
    )

    for (const resolvedProfile of resolvedProfiles) {
      if (resolvedProfile.playerId) {
        profiles.set(resolvedProfile.playerId, resolvedProfile.profile)
      }
    }
  }

  try {
    await persistNationalSquadPlayerProfiles(
      supabase,
      nationalTeamExternalId,
      players,
      profiles,
      profileLastSyncedAt
    )
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[team-detail-data] No se pudieron persistir perfiles del plantel.', {
        teamExternalId: nationalTeamExternalId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return players.map((player) => {
    if (!player.id || !profiles.has(player.id)) return player

    return mergeSquadPlayerProfile(player, profiles.get(player.id) ?? null, profileLastSyncedAt)
  })
}

type PublicDetailDataOptions = {
  allowApiEnrichment?: boolean
  deepPlayerProfileLimit?: number
}

export async function getTeamDetail(
  id: number,
  options: PublicDetailDataOptions = {}
) {
  const supabase = getSupabaseAdminClient()
  const team = await fetchStoredTeamByExternalId(supabase, id)
  const externalId = toFiniteNumber(team?.external_id) ?? id
  const players = await fetchStoredPlayersByTeam(supabase, team, externalId)
  const shouldFetchApiTeamDetail =
    options.allowApiEnrichment === true && hasStoredTeamProfileGap(team)
  const shouldFetchApiSquad =
    options.allowApiEnrichment === true && hasStoredSquadProfileGap(players)
  const [apiTeamDetail, apiSquad] = await Promise.all([
    shouldFetchApiTeamDetail ? fetchApiTeamDetailSafe(externalId) : Promise.resolve(null),
    shouldFetchApiSquad ? fetchApiTeamSquadSafe(externalId) : Promise.resolve(null),
  ])
  const apiTeam = apiTeamDetail?.team
  const storedVenue = mapStoredTeamVenue(team)
  const apiVenue = mapApiTeamVenue(apiTeamDetail?.venue)
  const resolvedExternalId = toFiniteNumber(apiTeam?.id) ?? externalId
  const logoUrl =
    pickTeamLogoUrl(team?.logo_url, resolvedExternalId) ??
    pickTeamLogoUrl(apiTeam?.logo, resolvedExternalId) ??
    undefined
  const apiSquadPlayers = (apiSquad?.players ?? []).map(mapApiPlayerToSquadPlayer)
  let squadPlayers = mergeSquadPlayers(
    players.map(mapStoredPlayerToSquadPlayer),
    apiSquadPlayers
  )

  if (apiTeamDetail) {
    try {
      await persistApiTeamProfileSafe(supabase, resolvedExternalId, team, apiTeamDetail)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[team-detail-data] No se pudo persistir el perfil del equipo.', {
          teamExternalId: resolvedExternalId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (options.allowApiEnrichment === true && (team?.national ?? apiTeam?.national)) {
    squadPlayers = await enrichNationalSquadProfiles(
      supabase,
      squadPlayers,
      resolvedExternalId,
      options.deepPlayerProfileLimit
    )
  }

  const resolvedTeamName = team?.name || apiTeam?.name || apiSquad?.team?.name || 'Equipo'

  if (process.env.NODE_ENV === 'development') {
    console.info('[team-detail-data]', {
      teamExternalId: resolvedExternalId,
      hasStoredTeam: Boolean(team),
      hasApiTeam: Boolean(apiTeam),
      storedPlayers: players.length,
      apiSquadPlayers: apiSquadPlayers.length,
      renderedPlayers: squadPlayers.length,
      fetchedApiTeamDetail: shouldFetchApiTeamDetail,
      fetchedApiSquad: shouldFetchApiSquad,
    })
  }

  return {
    team: team || apiTeam
      ? {
          team: {
            id: resolvedExternalId,
            name: resolvedTeamName,
            logo: logoUrl,
            logo_url: logoUrl,
            logoUrl,
            code: team?.code ?? apiTeam?.code ?? undefined,
            country: team?.country ?? apiTeam?.country ?? undefined,
            founded: team?.founded ?? apiTeam?.founded ?? undefined,
            national: team?.national ?? apiTeam?.national ?? undefined,
          },
          venue: mergeTeamVenue(storedVenue, apiVenue),
        }
      : null,
    squad: team || apiTeam || apiSquad
      ? {
          team: {
            id: resolvedExternalId,
            name: resolvedTeamName,
            logo: logoUrl,
            logo_url: logoUrl,
            logoUrl,
          },
          players: squadPlayers,
        }
      : null,
  }
}

export async function getPlayerDetail(
  id: number,
  season: number,
  leagueId?: number,
  options: PublicDetailDataOptions = {}
): Promise<PlayerDetail | null> {
  const supabase = getSupabaseAdminClient()
  let response = await supabase
    .from('players')
    .select(STORED_PLAYER_PROFILE_SELECT)
    .eq('external_id', String(id))
    .maybeSingle()

  if (response.error && isStoredPlayerReadFallbackError(response.error)) {
    response = await supabase
      .from('players')
      .select(STORED_PLAYER_ROSTER_PROFILE_SELECT)
      .eq('external_id', String(id))
      .maybeSingle()
  }

  if (response.error && isStoredPlayerReadFallbackError(response.error)) {
    response = await supabase
      .from('players')
      .select(STORED_PLAYER_BASE_SELECT)
      .eq('external_id', String(id))
      .maybeSingle()
  }

  if (response.error) {
    const message = response.error.message.toLowerCase()
    const missingPlayersTable =
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      response.error.code === '42703' ||
      message.includes('players') ||
      message.includes('schema cache')

    if (missingPlayersTable) return null
    throw response.error
  }

  const player = response.data as StoredPlayerRow | null
  const playerExternalId = toFiniteNumber(player?.external_id) ?? id
  const shouldUseApiEnrichment =
    options.allowApiEnrichment === true &&
    (hasStoredPlayerDetailGap(player) || season > 0)
  const apiRows = shouldUseApiEnrichment
    ? await fetchApiPlayerDetailSafe(playerExternalId, season, leagueId)
    : []
  const apiDetail = mapApiPlayerRowsToPlayerDetail(apiRows, leagueId)

  if (!player && !apiDetail) return null

  if (shouldUseApiEnrichment) {
    try {
      await persistApiPlayerDetailProfileSafe(supabase, playerExternalId, player, apiDetail)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[player-detail-data] No se pudo persistir la ficha del jugador.', {
          playerExternalId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  const apiPlayer = apiDetail?.player
  const apiTeam = apiDetail?.team
  const apiLeague = apiDetail?.league
  const apiStatistics = apiDetail?.statistics
  const playerPhotoUrl = player?.photo_url ?? apiPlayer?.photo_url ?? apiPlayer?.photo
  const preferredTeamExternalId =
    player?.club_external_id ??
    player?.team_external_id ??
    (apiTeam?.id ? String(apiTeam.id) : undefined)
  const teamResponse = player?.club_external_id
    ? await supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .eq('external_id', String(player.club_external_id))
        .maybeSingle()
    : player?.team_id
      ? await supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .eq('id', String(player.team_id))
        .maybeSingle()
      : preferredTeamExternalId
        ? await supabase
            .from('teams')
            .select('id, external_id, name, logo_url')
            .eq('external_id', String(preferredTeamExternalId))
            .maybeSingle()
        : null
  const storedTeam = teamResponse && !teamResponse.error
    ? (teamResponse.data as StoredTeamRow | null)
    : null
  const teamExternalId =
    toFiniteNumber(storedTeam?.external_id ?? preferredTeamExternalId) ??
    apiTeam?.id ??
    undefined
  const teamName = storedTeam?.name ?? player?.club_name ?? apiTeam?.name
  const teamLogoUrl =
    pickTeamLogoUrl(
      player?.club_logo_url ?? storedTeam?.logo_url,
      teamExternalId,
      apiTeam?.logo
    ) ??
    apiTeam?.logo ??
    undefined
  const leagueRows = leagueId
    ? await fetchStoredLeagueRowsByExternalId(leagueId, season).catch(() => [])
    : []
  const storedLeague = leagueRows[0] ?? null
  const resolvedLeagueId = leagueId ?? apiLeague?.id
  const leagueLogoUrl =
    pickLeagueLogoUrl(storedLeague?.logo_url, resolvedLeagueId, apiLeague?.logo) ??
    apiLeague?.logo ??
    undefined

  return {
    player: {
      id: apiPlayer?.id ?? playerExternalId,
      name: apiPlayer?.name ?? player?.name ?? 'Jugador',
      firstname: apiPlayer?.firstname ?? player?.firstname ?? undefined,
      lastname: apiPlayer?.lastname ?? player?.lastname ?? undefined,
      age: apiPlayer?.age ?? player?.age ?? undefined,
      nationality: apiPlayer?.nationality ?? player?.nationality ?? undefined,
      birthDate: apiPlayer?.birthDate ?? player?.birth_date ?? undefined,
      birthPlace: apiPlayer?.birthPlace ?? player?.birth_place ?? undefined,
      birthCountry: apiPlayer?.birthCountry ?? player?.birth_country ?? undefined,
      height: apiPlayer?.height ?? player?.height ?? undefined,
      weight: apiPlayer?.weight ?? player?.weight ?? undefined,
      injured: apiPlayer?.injured ?? player?.injured ?? undefined,
      photo: playerPhotoUrl,
      photo_url: playerPhotoUrl,
      photoUrl: playerPhotoUrl,
    },
    team: storedTeam || teamName || teamExternalId
      ? {
          id: teamExternalId ?? undefined,
          name: teamName ?? undefined,
          logo: teamLogoUrl,
          logo_url: teamLogoUrl,
          logoUrl: teamLogoUrl,
        }
      : undefined,
    league: storedLeague || apiLeague
      ? {
          id: resolvedLeagueId,
          name: storedLeague?.name ?? apiLeague?.name,
          country: storedLeague?.country ?? apiLeague?.country,
          logo: leagueLogoUrl,
          logo_url: leagueLogoUrl,
          logoUrl: leagueLogoUrl,
          season: storedLeague?.season ?? apiLeague?.season ?? season,
        }
      : undefined,
    statistics: {
      appearances: apiStatistics?.appearances ?? 0,
      lineups: apiStatistics?.lineups ?? 0,
      minutes: apiStatistics?.minutes ?? 0,
      position: apiStatistics?.position ?? player?.position ?? null,
      rating: apiStatistics?.rating ?? null,
      goals: apiStatistics?.goals ?? 0,
      assists: apiStatistics?.assists ?? 0,
      yellowCards: apiStatistics?.yellowCards ?? 0,
      redCards: apiStatistics?.redCards ?? 0,
    },
  }
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

const CONMEBOL_GROUP_STAGE_LEAGUE_IDS = new Set([1, 4, 9, 11, 13])
const CONMEBOL_GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const UEFA_LEAGUE_PHASE_LIMITS = new Map<number, number>([
  [2, 8],
  [3, 8],
  [848, 6],
])

function isConmebolTraditionalGroupStageLeague(leagueId: number) {
  return CONMEBOL_GROUP_STAGE_LEAGUE_IDS.has(leagueId)
}

function isUefaLeaguePhaseCompetition(leagueId: number) {
  return UEFA_LEAGUE_PHASE_LIMITS.has(leagueId)
}

function isUefaLeaguePhaseFixture(leagueId: number, round: string) {
  const matchdayLimit = UEFA_LEAGUE_PHASE_LIMITS.get(leagueId)
  const roundNumber = getUefaLeaguePhaseRoundNumber(round)

  return Boolean(
    matchdayLimit &&
    roundNumber &&
    roundNumber >= 1 &&
    roundNumber <= matchdayLimit &&
    isUefaLeaguePhaseRound(round)
  )
}

function isConmebolGroupStageFixtureRound(round: string) {
  const normalized = normalizeSearchValue(round)

  return (
    normalized.includes('group stage') ||
    normalized.includes('fase de grupos') ||
    /\bgroup\b/.test(normalized) ||
    /\bgrupo\b/.test(normalized)
  )
}

function updateStandingWithFixtureResult(
  home: CalculatedStandingAccumulator,
  away: CalculatedStandingAccumulator,
  homeGoals: number,
  awayGoals: number
) {
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

function buildConmebolGroupStageStandings(fixtures: LeagueFixtureSummary[]) {
  const groupStageFixtures = fixtures.filter((fixture) =>
    isConmebolGroupStageFixtureRound(fixture.round)
  )

  if (!groupStageFixtures.length) return []

  const parentByTeamKey = new Map<string, string>()
  const teamsByKey = new Map<
    string,
    { teamId?: number; teamName: string; teamLogo?: string }
  >()

  const find = (key: string): string => {
    const parent = parentByTeamKey.get(key)

    if (!parent || parent === key) return key

    const root = find(parent)
    parentByTeamKey.set(key, root)
    return root
  }

  const ensureTeam = (teamId: number | undefined, teamName: string, teamLogo?: string) => {
    const key = getStandingTeamKey(teamId, teamName)

    if (!parentByTeamKey.has(key)) parentByTeamKey.set(key, key)
    if (!teamsByKey.has(key)) {
      teamsByKey.set(key, { teamId, teamName, teamLogo })
    }

    return key
  }

  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)

    if (rootA !== rootB) parentByTeamKey.set(rootB, rootA)
  }

  for (const fixture of groupStageFixtures) {
    const homeKey = ensureTeam(fixture.homeId, fixture.home, fixture.homeLogo)
    const awayKey = ensureTeam(fixture.awayId, fixture.away, fixture.awayLogo)

    union(homeKey, awayKey)
  }

  const teamKeysByGroup = new Map<string, string[]>()

  for (const teamKey of teamsByKey.keys()) {
    const root = find(teamKey)
    const current = teamKeysByGroup.get(root) ?? []

    current.push(teamKey)
    teamKeysByGroup.set(root, current)
  }

  const groupMetadata = new Map<string, { firstDate: number; firstFixtureId: number | string }>()

  for (const fixture of groupStageFixtures) {
    const homeKey = getStandingTeamKey(fixture.homeId, fixture.home)
    const root = find(homeKey)
    const current = groupMetadata.get(root)
    const fixtureDate = getLeagueFixtureTimestamp(fixture.date)

    if (
      !current ||
      fixtureDate < current.firstDate ||
      (
        fixtureDate === current.firstDate &&
        compareLeagueFixtureIds(fixture.id, current.firstFixtureId) < 0
      )
    ) {
      groupMetadata.set(root, {
        firstDate: fixtureDate,
        firstFixtureId: fixture.id,
      })
    }
  }

  return [...teamKeysByGroup.entries()]
    .sort(([groupA, teamKeysA], [groupB, teamKeysB]) => {
      const metadataA = groupMetadata.get(groupA)
      const metadataB = groupMetadata.get(groupB)
      const dateA = metadataA?.firstDate ?? Number.MAX_SAFE_INTEGER
      const dateB = metadataB?.firstDate ?? Number.MAX_SAFE_INTEGER

      if (dateA !== dateB) return dateA - dateB

      const fixtureIdCompare = compareLeagueFixtureIds(
        metadataA?.firstFixtureId ?? '',
        metadataB?.firstFixtureId ?? ''
      )

      if (fixtureIdCompare !== 0) return fixtureIdCompare

      const nameA = teamKeysA
        .map((teamKey) => teamsByKey.get(teamKey)?.teamName ?? '')
        .sort((a, b) => a.localeCompare(b, 'es-AR'))[0] ?? ''
      const nameB = teamKeysB
        .map((teamKey) => teamsByKey.get(teamKey)?.teamName ?? '')
        .sort((a, b) => a.localeCompare(b, 'es-AR'))[0] ?? ''

      return nameA.localeCompare(nameB, 'es-AR')
    })
    .map(([, teamKeys], groupIndex) => {
      const table = new Map<string, CalculatedStandingAccumulator>()
      const groupTeamKeys = new Set(teamKeys)

      for (const teamKey of teamKeys) {
        const team = teamsByKey.get(teamKey)

        if (!team) continue
        getStandingAccumulator(table, team.teamId, team.teamName, team.teamLogo)
      }

      for (const fixture of groupStageFixtures) {
        const homeKey = getStandingTeamKey(fixture.homeId, fixture.home)
        const awayKey = getStandingTeamKey(fixture.awayId, fixture.away)

        if (!groupTeamKeys.has(homeKey) || !groupTeamKeys.has(awayKey)) continue
        if (!isFinishedStatus(fixture.statusShort)) continue

        const homeGoals = fixture.goalsHome
        const awayGoals = fixture.goalsAway
        if (homeGoals === null || awayGoals === null) continue

        const home = getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
        const away = getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

        updateStandingWithFixtureResult(home, away, homeGoals, awayGoals)
      }

      const rows = [...table.values()]
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

      return {
        name: `Grupo ${CONMEBOL_GROUP_LABELS[groupIndex] ?? groupIndex + 1}`,
        rows,
      }
    })
}

function buildUefaLeaguePhaseStandings(leagueId: number, fixtures: LeagueFixtureSummary[]) {
  const leaguePhaseFixtures = fixtures.filter((fixture) =>
    isUefaLeaguePhaseFixture(leagueId, fixture.round)
  )

  if (!leaguePhaseFixtures.length) return []

  const table = new Map<string, CalculatedStandingAccumulator>()

  for (const fixture of leaguePhaseFixtures) {
    getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
    getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

    if (!isFinishedStatus(fixture.statusShort)) continue

    const homeGoals = fixture.goalsHome
    const awayGoals = fixture.goalsAway
    if (homeGoals === null || awayGoals === null) continue

    const home = getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
    const away = getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

    updateStandingWithFixtureResult(home, away, homeGoals, awayGoals)
  }

  const rows = [...table.values()]
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

  return rows.length ? [{ name: 'Fase liga', rows }] : []
}

type LigaProfesionalPartition = {
  groupA: Set<string>
  groupB: Set<string>
  teamsByKey: Map<string, { teamId?: number; teamName: string; teamLogo?: string }>
}

function getPairKey(a: string, b: string) {
  return [a, b].sort().join('__')
}

function getPairWeight(weights: Map<string, number>, a: string, b: string) {
  return weights.get(getPairKey(a, b)) ?? 0
}

function scoreLigaProfesionalPartition(
  weights: Map<string, number>,
  groupA: Set<string>,
  groupB: Set<string>
) {
  const scoreGroup = (group: Set<string>) => {
    const keys = [...group]
    let score = 0

    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        score += getPairWeight(weights, keys[i], keys[j])
      }
    }

    return score
  }

  return scoreGroup(groupA) + scoreGroup(groupB)
}

function cloneSet<T>(input: Set<T>) {
  return new Set(input)
}

function improveLigaProfesionalPartition(
  weights: Map<string, number>,
  groupA: Set<string>,
  groupB: Set<string>
) {
  let improved = true

  while (improved) {
    improved = false
    let bestSwap: { a: string; b: string; score: number } | null = null
    const currentScore = scoreLigaProfesionalPartition(weights, groupA, groupB)

    for (const a of groupA) {
      for (const b of groupB) {
        const nextA = cloneSet(groupA)
        const nextB = cloneSet(groupB)

        nextA.delete(a)
        nextB.delete(b)
        nextA.add(b)
        nextB.add(a)

        const nextScore = scoreLigaProfesionalPartition(weights, nextA, nextB)

        if (nextScore > (bestSwap?.score ?? currentScore)) {
          bestSwap = { a, b, score: nextScore }
        }
      }
    }

    if (bestSwap) {
      groupA.delete(bestSwap.a)
      groupB.delete(bestSwap.b)
      groupA.add(bestSwap.b)
      groupB.add(bestSwap.a)
      improved = true
    }
  }
}

function isLigaProfesionalClausuraRegularRound(round: string | null | undefined) {
  const normalizedRound = normalizeLeagueRound(round, LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID)

  return typeof normalizedRound === 'string' && /^clausura-fecha-\d+$/i.test(normalizedRound)
}

function inferLigaProfesionalPartition(fixtures: LeagueFixtureSummary[]): LigaProfesionalPartition | null {
  const regularFixtures = fixtures.filter((fixture) =>
    isLigaProfesionalRegularSeasonRound(fixture.round)
  )

  if (!regularFixtures.length) return null

  const teamsByKey = new Map<string, { teamId?: number; teamName: string; teamLogo?: string }>()
  const weights = new Map<string, number>()

  const ensureTeam = (teamId: number | undefined, teamName: string, teamLogo?: string) => {
    const key = getStandingTeamKey(teamId, teamName)

    if (!teamsByKey.has(key)) {
      teamsByKey.set(key, { teamId, teamName, teamLogo })
    }

    return key
  }

  for (const fixture of regularFixtures) {
    const homeKey = ensureTeam(fixture.homeId, fixture.home, fixture.homeLogo)
    const awayKey = ensureTeam(fixture.awayId, fixture.away, fixture.awayLogo)
    const pairKey = getPairKey(homeKey, awayKey)

    weights.set(pairKey, (weights.get(pairKey) ?? 0) + 1)
  }

  const teamKeys = [...teamsByKey.keys()].sort((a, b) => {
    const teamA = teamsByKey.get(a)?.teamName ?? a
    const teamB = teamsByKey.get(b)?.teamName ?? b

    return teamA.localeCompare(teamB, 'es-AR')
  })
  const groupSize = teamKeys.length / 2

  if (!Number.isInteger(groupSize) || groupSize < 2) return null

  const seedPairs: Array<{ a: string; b: string; weight: number }> = []

  for (let i = 0; i < teamKeys.length; i += 1) {
    for (let j = i + 1; j < teamKeys.length; j += 1) {
      seedPairs.push({
        a: teamKeys[i],
        b: teamKeys[j],
        weight: getPairWeight(weights, teamKeys[i], teamKeys[j]),
      })
    }
  }

  seedPairs.sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight
    const leftName = `${teamsByKey.get(left.a)?.teamName ?? left.a}-${teamsByKey.get(left.b)?.teamName ?? left.b}`
    const rightName = `${teamsByKey.get(right.a)?.teamName ?? right.a}-${teamsByKey.get(right.b)?.teamName ?? right.b}`

    return leftName.localeCompare(rightName, 'es-AR')
  })

  let best: { groupA: Set<string>; groupB: Set<string>; score: number } | null = null

  for (const seed of seedPairs.slice(0, 60)) {
    const groupA = new Set([seed.a])
    const groupB = new Set([seed.b])
    const remaining = teamKeys.filter((key) => key !== seed.a && key !== seed.b)

    while (remaining.length) {
      let bestIndex = 0
      let bestSide: 'A' | 'B' = groupA.size <= groupB.size ? 'A' : 'B'
      let bestValue = Number.NEGATIVE_INFINITY

      for (let index = 0; index < remaining.length; index += 1) {
        const key = remaining[index]
        const scoreA = [...groupA].reduce((sum, current) => sum + getPairWeight(weights, key, current), 0)
        const scoreB = [...groupB].reduce((sum, current) => sum + getPairWeight(weights, key, current), 0)
        const side =
          groupA.size >= groupSize
            ? 'B'
            : groupB.size >= groupSize
              ? 'A'
              : scoreA >= scoreB
                ? 'A'
                : 'B'
        const value = Math.abs(scoreA - scoreB)

        if (value > bestValue) {
          bestIndex = index
          bestSide = side
          bestValue = value
        }
      }

      const [nextTeam] = remaining.splice(bestIndex, 1)
      if (bestSide === 'A') groupA.add(nextTeam)
      else groupB.add(nextTeam)
    }

    improveLigaProfesionalPartition(weights, groupA, groupB)

    const score = scoreLigaProfesionalPartition(weights, groupA, groupB)
    if (!best || score > best.score) {
      best = { groupA, groupB, score }
    }
  }

  if (!best) return null

  const firstHomeKey = getStandingTeamKey(
    regularFixtures[0]?.homeId,
    regularFixtures[0]?.home ?? ''
  )
  const groupA = best.groupA.has(firstHomeKey) ? best.groupA : best.groupB
  const groupB = best.groupA.has(firstHomeKey) ? best.groupB : best.groupA

  return { groupA, groupB, teamsByKey }
}

function updateSingleTeamStanding(
  team: CalculatedStandingAccumulator,
  goalsFor: number,
  goalsAgainst: number
) {
  team.played += 1
  team.goalsFor += goalsFor
  team.goalsAgainst += goalsAgainst

  if (goalsFor > goalsAgainst) {
    team.won += 1
    team.points += 3
  } else if (goalsFor < goalsAgainst) {
    team.lost += 1
  } else {
    team.drawn += 1
    team.points += 1
  }

  team.goalDifference = team.goalsFor - team.goalsAgainst
}

function buildLigaProfesionalGroupStandings(fixtures: LeagueFixtureSummary[]) {
  const currentPhaseFixtures = fixtures.filter((fixture) =>
    isLigaProfesionalClausuraRegularRound(fixture.round)
  )

  if (!currentPhaseFixtures.length) return []

  const partition = inferLigaProfesionalPartition(currentPhaseFixtures)

  if (!partition) return []

  const regularFixtures = currentPhaseFixtures.filter((fixture) =>
    isLigaProfesionalRegularSeasonRound(fixture.round)
  )
  const groupByTeamKey = new Map<string, 'A' | 'B'>()
  const tableA = new Map<string, CalculatedStandingAccumulator>()
  const tableB = new Map<string, CalculatedStandingAccumulator>()

  for (const teamKey of partition.groupA) {
    const team = partition.teamsByKey.get(teamKey)
    if (!team) continue
    groupByTeamKey.set(teamKey, 'A')
    getStandingAccumulator(tableA, team.teamId, team.teamName, team.teamLogo)
  }

  for (const teamKey of partition.groupB) {
    const team = partition.teamsByKey.get(teamKey)
    if (!team) continue
    groupByTeamKey.set(teamKey, 'B')
    getStandingAccumulator(tableB, team.teamId, team.teamName, team.teamLogo)
  }

  for (const fixture of regularFixtures) {
    if (!isFinishedStatus(fixture.statusShort)) continue

    const homeGoals = fixture.goalsHome
    const awayGoals = fixture.goalsAway
    if (homeGoals === null || awayGoals === null) continue

    const homeKey = getStandingTeamKey(fixture.homeId, fixture.home)
    const awayKey = getStandingTeamKey(fixture.awayId, fixture.away)
    const homeTable = groupByTeamKey.get(homeKey) === 'A' ? tableA : tableB
    const awayTable = groupByTeamKey.get(awayKey) === 'A' ? tableA : tableB
    const home = getStandingAccumulator(homeTable, fixture.homeId, fixture.home, fixture.homeLogo)
    const away = getStandingAccumulator(awayTable, fixture.awayId, fixture.away, fixture.awayLogo)

    updateSingleTeamStanding(home, homeGoals, awayGoals)
    updateSingleTeamStanding(away, awayGoals, homeGoals)
  }

  const buildRows = (table: Map<string, CalculatedStandingAccumulator>) =>
    [...table.values()]
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

  return [
    { name: 'Grupo A', rows: buildRows(tableA) },
    { name: 'Grupo B', rows: buildRows(tableB) },
  ].filter((group) => group.rows.length > 0)
}

const PRIMERA_NACIONAL_EXTERNAL_ID = 129
const PRIMERA_C_EXTERNAL_ID = 132
const FEDERAL_A_EXTERNAL_ID = 134

const ZONED_LEAGUE_STANDINGS_CONFIGS = new Map<number, {
  expectedGroups: number
  expectedTeamsPerGroup?: number
  labelPrefix: 'Zona' | 'Grupo'
}>([
  [PRIMERA_NACIONAL_EXTERNAL_ID, { expectedGroups: 2, expectedTeamsPerGroup: 18, labelPrefix: 'Zona' }],
  [PRIMERA_C_EXTERNAL_ID, { expectedGroups: 2, expectedTeamsPerGroup: 14, labelPrefix: 'Zona' }],
  [FEDERAL_A_EXTERNAL_ID, { expectedGroups: 4, labelPrefix: 'Grupo' }],
])

const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const STATIC_ZONED_LEAGUE_TEAM_GROUPS = new Map<number, string[][]>([
  [
    PRIMERA_C_EXTERNAL_ID,
    [
      [
        'Argentino Rosario',
        'Berazategui',
        'Centro Español',
        'Defensores de Cambaceres',
        'Deportivo Paraguayo',
        'Estrella Del Sur',
        'JJ Urquiza',
        'Juventud Unida',
        'Leandro N. Alem',
        'Lugano',
        'Mercedes',
        'Puerto Nuevo',
        'Sacachispas',
        'Victoriano Arenas',
      ],
      [
        'Atletico Atlas',
        'Canuelas',
        'Central Ballester',
        'Central Cordoba',
        'Claypole',
        'Deportivo Español',
        'Deportivo Muñiz',
        'El Porvenir',
        'Fénix',
        'General Lamadrid',
        'Leones de Rosario',
        'Lujan',
        'Sportivo Barracas',
        'Yupanqui',
      ],
    ],
  ],
])

function isRegularLeagueTableRound(round: string | null | undefined) {
  const normalized = normalizeRoundText(round)

  if (!normalized) return true
  if (getLeagueFinalPhaseKey(normalized)) return false

  return !(
    /\b(playoff|play-off|play offs|play-offs|reducido|liguilla|promotion|promocion)\b/.test(normalized) ||
    /\b(round of 16|8th finals?|16th finals?|32nd finals?|octavos?|cuartos?|quarter finals?|semi finals?|semifinal(?:es)?|final)\b/.test(normalized)
  )
}

function getRegularLeagueTableFixtures(fixtures: LeagueFixtureSummary[]) {
  return fixtures.filter((fixture) => isRegularLeagueTableRound(fixture.round))
}

function sortStandingRows(table: Map<string, CalculatedStandingAccumulator>) {
  return [...table.values()]
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
}

function buildSingleLeagueTableStandings(
  fixtures: LeagueFixtureSummary[],
  options: { includeUnplayedTeams?: boolean } = {}
) {
  const table = new Map<string, CalculatedStandingAccumulator>()
  let countedFixtures = 0
  const regularFixtures = getRegularLeagueTableFixtures(fixtures)

  for (const fixture of regularFixtures) {
    if (options.includeUnplayedTeams) {
      getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
      getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)
    }

    if (!isFinishedStatus(fixture.statusShort)) continue

    const homeGoals = fixture.goalsHome
    const awayGoals = fixture.goalsAway
    if (homeGoals === null || awayGoals === null) continue

    const home = getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)
    const away = getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

    countedFixtures += 1
    updateStandingWithFixtureResult(home, away, homeGoals, awayGoals)
  }

  const rows = sortStandingRows(table)
    .filter((row) => options.includeUnplayedTeams || row.played > 0)

  return rows.length ? {
    groups: [{ name: 'Tabla', rows }],
    countedFixtures,
    regularFixtures: regularFixtures.length,
  } : {
    groups: [] as LeagueStandingGroup[],
    countedFixtures,
    regularFixtures: regularFixtures.length,
  }
}

function buildZonedLeagueStandings(
  leagueId: number,
  fixtures: LeagueFixtureSummary[]
): LeagueStandingGroup[] {
  const config = ZONED_LEAGUE_STANDINGS_CONFIGS.get(leagueId)
  if (!config) return []

  const regularFixtures = getRegularLeagueTableFixtures(fixtures)
  if (!regularFixtures.length) return []

  const teamsByKey = new Map<
    string,
    { teamId?: number; teamName: string; teamLogo?: string }
  >()

  const ensureTeam = (
    teamId: number | undefined,
    teamName: string,
    teamLogo?: string
  ) => {
    const key = getStandingTeamKey(teamId, teamName)

    if (!teamsByKey.has(key)) {
      teamsByKey.set(key, { teamId, teamName, teamLogo })
    }

    return key
  }

  for (const fixture of regularFixtures) {
    ensureTeam(fixture.homeId, fixture.home, fixture.homeLogo)
    ensureTeam(fixture.awayId, fixture.away, fixture.awayLogo)
  }

  const getPairKey = (fixture: LeagueFixtureSummary) => {
    const homeKey = getStandingTeamKey(fixture.homeId, fixture.home)
    const awayKey = getStandingTeamKey(fixture.awayId, fixture.away)

    return [homeKey, awayKey].sort().join('::')
  }

  const getRegularRoundNumber = (round: string | null | undefined) => {
    const normalized = normalizeRoundText(round)
    const match = normalized.match(/\b(?:regular season|fecha|jornada|round)\s*-?\s*(\d+)\b/)

    return match ? Number(match[1]) : null
  }

  const firstLegFixtures = config.expectedTeamsPerGroup
    ? regularFixtures.filter((fixture) => {
        const roundNumber = getRegularRoundNumber(fixture.round)

        return roundNumber !== null && roundNumber >= 1 && roundNumber < config.expectedTeamsPerGroup!
      })
    : []

  const buildComponents = (
    sourceFixtures: LeagueFixtureSummary[],
    options: { minPairMeetings: number }
  ) => {
    const parentByTeamKey = new Map<string, string>()

    for (const teamKey of teamsByKey.keys()) parentByTeamKey.set(teamKey, teamKey)

    const find = (key: string): string => {
      const parent = parentByTeamKey.get(key)

      if (!parent || parent === key) return key

      const root = find(parent)
      parentByTeamKey.set(key, root)
      return root
    }

    const union = (a: string, b: string) => {
      const rootA = find(a)
      const rootB = find(b)

      if (rootA !== rootB) parentByTeamKey.set(rootB, rootA)
    }

    const pairMeetings = new Map<string, number>()

    for (const fixture of sourceFixtures) {
      const homeKey = getStandingTeamKey(fixture.homeId, fixture.home)
      const awayKey = getStandingTeamKey(fixture.awayId, fixture.away)

      if (!teamsByKey.has(homeKey) || !teamsByKey.has(awayKey)) continue
      pairMeetings.set(getPairKey(fixture), (pairMeetings.get(getPairKey(fixture)) ?? 0) + 1)
    }

    for (const fixture of sourceFixtures) {
      const pairKey = getPairKey(fixture)

      if ((pairMeetings.get(pairKey) ?? 0) < options.minPairMeetings) continue
      union(
        getStandingTeamKey(fixture.homeId, fixture.home),
        getStandingTeamKey(fixture.awayId, fixture.away)
      )
    }

    const teamKeysByRoot = new Map<string, string[]>()

    for (const teamKey of teamsByKey.keys()) {
      const root = find(teamKey)
      const current = teamKeysByRoot.get(root) ?? []

      current.push(teamKey)
      teamKeysByRoot.set(root, current)
    }

    const groupMetadata = new Map<string, { firstDate: number; firstFixtureId: number | string }>()

    for (const fixture of sourceFixtures) {
      const root = find(getStandingTeamKey(fixture.homeId, fixture.home))
      const current = groupMetadata.get(root)
      const fixtureDate = getLeagueFixtureTimestamp(fixture.date)

      if (
        !current ||
        fixtureDate < current.firstDate ||
        (
          fixtureDate === current.firstDate &&
          compareLeagueFixtureIds(fixture.id, current.firstFixtureId) < 0
        )
      ) {
        groupMetadata.set(root, {
          firstDate: fixtureDate,
          firstFixtureId: fixture.id,
        })
      }
    }

    return [...teamKeysByRoot.entries()]
      .filter(([, teamKeys]) => teamKeys.length > 1)
      .sort(([rootA, keysA], [rootB, keysB]) => {
        const metadataA = groupMetadata.get(rootA)
        const metadataB = groupMetadata.get(rootB)
        const dateA = metadataA?.firstDate ?? Number.MAX_SAFE_INTEGER
        const dateB = metadataB?.firstDate ?? Number.MAX_SAFE_INTEGER

        if (dateA !== dateB) return dateA - dateB

        const sizeCompare = keysB.length - keysA.length
        if (sizeCompare !== 0) return sizeCompare

        const firstNameA = keysA
          .map((teamKey) => teamsByKey.get(teamKey)?.teamName ?? teamKey)
          .sort((a, b) => a.localeCompare(b, 'es-AR'))[0] ?? ''
        const firstNameB = keysB
          .map((teamKey) => teamsByKey.get(teamKey)?.teamName ?? teamKey)
          .sort((a, b) => a.localeCompare(b, 'es-AR'))[0] ?? ''

        return firstNameA.localeCompare(firstNameB, 'es-AR')
      })
      .map(([, teamKeys]) => teamKeys)
  }

  const hasExpectedShape = (components: string[][]) =>
    components.length === config.expectedGroups &&
    (!config.expectedTeamsPerGroup ||
      components.every((teamKeys) => teamKeys.length === config.expectedTeamsPerGroup))
  const configuredTeamGroups = STATIC_ZONED_LEAGUE_TEAM_GROUPS.get(leagueId)
  const configuredComponents = configuredTeamGroups
    ?.map((teamNames) => {
      const expectedNames = new Set(teamNames.map(normalizeSearchValue))

      return [...teamsByKey.entries()]
        .filter(([, team]) => expectedNames.has(normalizeSearchValue(team.teamName)))
        .map(([teamKey]) => teamKey)
    })
    .filter((teamKeys) => teamKeys.length > 0)

  const componentCandidates: string[][][] = []

  if (configuredComponents) componentCandidates.push(configuredComponents)
  componentCandidates.push(buildComponents(regularFixtures, { minPairMeetings: 2 }))
  if (firstLegFixtures.length) {
    componentCandidates.push(buildComponents(firstLegFixtures, { minPairMeetings: 1 }))
  }
  componentCandidates.push(buildComponents(regularFixtures, { minPairMeetings: 1 }))

  const components = componentCandidates.find(hasExpectedShape)

  if (!components) return []

  const groupIndexByTeamKey = new Map<string, number>()

  components.forEach((teamKeys, index) => {
    for (const teamKey of teamKeys) groupIndexByTeamKey.set(teamKey, index)
  })

  return components.map((teamKeys, index) => {
    const table = new Map<string, CalculatedStandingAccumulator>()

    for (const teamKey of teamKeys) {
      const team = teamsByKey.get(teamKey)
      if (!team) continue
      getStandingAccumulator(table, team.teamId, team.teamName, team.teamLogo)
    }

    for (const fixture of regularFixtures) {
      const homeKey = getStandingTeamKey(fixture.homeId, fixture.home)
      const awayKey = getStandingTeamKey(fixture.awayId, fixture.away)
      const homeGroupIndex = groupIndexByTeamKey.get(homeKey)
      const awayGroupIndex = groupIndexByTeamKey.get(awayKey)

      if (homeGroupIndex !== index && awayGroupIndex !== index) continue
      if (!isFinishedStatus(fixture.statusShort)) continue

      const homeGoals = fixture.goalsHome
      const awayGoals = fixture.goalsAway
      if (homeGoals === null || awayGoals === null) continue

      if (homeGroupIndex === index) {
        const home = getStandingAccumulator(table, fixture.homeId, fixture.home, fixture.homeLogo)

        home.played += 1
        home.goalsFor += homeGoals
        home.goalsAgainst += awayGoals

        if (homeGoals > awayGoals) {
          home.won += 1
          home.points += 3
        } else if (homeGoals < awayGoals) {
          home.lost += 1
        } else {
          home.drawn += 1
          home.points += 1
        }

        home.goalDifference = home.goalsFor - home.goalsAgainst
      }

      if (awayGroupIndex === index) {
        const away = getStandingAccumulator(table, fixture.awayId, fixture.away, fixture.awayLogo)

        away.played += 1
        away.goalsFor += awayGoals
        away.goalsAgainst += homeGoals

        if (awayGoals > homeGoals) {
          away.won += 1
          away.points += 3
        } else if (awayGoals < homeGoals) {
          away.lost += 1
        } else {
          away.drawn += 1
          away.points += 1
        }

        away.goalDifference = away.goalsFor - away.goalsAgainst
      }
    }

    return {
      name: `${config.labelPrefix} ${GROUP_LABELS[index] ?? index + 1}`,
      rows: sortStandingRows(table),
    }
  }).filter((group) => group.rows.length > 0)
}

function getCachedStandingDescriptions(groups: LeagueStandingGroup[]) {
  const descriptions = new Map<string, string | null | undefined>()

  for (const group of groups) {
    for (const row of group.rows) {
      for (const key of [
        getStandingTeamKey(row.teamId, row.teamName),
        `name:${normalizeSearchValue(row.teamName)}`,
      ]) {
        if (!descriptions.has(key)) descriptions.set(key, row.description)
      }
    }
  }

  return descriptions
}

function applyCachedStandingDescriptions(
  groups: LeagueStandingGroup[],
  cachedStandings: LeagueStandingGroup[]
) {
  if (!cachedStandings.length) return groups

  const descriptions = getCachedStandingDescriptions(cachedStandings)

  return groups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      ...row,
      description:
        row.description ??
        descriptions.get(getStandingTeamKey(row.teamId, row.teamName)) ??
        descriptions.get(`name:${normalizeSearchValue(row.teamName)}`) ??
        null,
    })),
  }))
}

function normalizeOfficialStandingGroupNames(
  leagueId: number,
  groups: LeagueStandingGroup[]
): LeagueStandingGroup[] {
  const config = ZONED_LEAGUE_STANDINGS_CONFIGS.get(leagueId)

  if (!config || groups.length !== config.expectedGroups) return groups

  return groups.map((group, index) => ({
    ...group,
    name: `${config.labelPrefix} ${GROUP_LABELS[index] ?? index + 1}`,
  }))
}

function shouldPreferOfficialStandings(
  leagueId: number,
  rule: ReturnType<typeof getCompetitionRuleByExternalId> | null | undefined,
  groups: LeagueStandingGroup[]
) {
  if (!groups.length) return false
  if (leagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) return false
  if (!rule) return false
  if (rule.standingsMode === 'zones') {
    const config = ZONED_LEAGUE_STANDINGS_CONFIGS.get(leagueId)

    return Boolean(config && groups.length === config.expectedGroups)
  }

  return (
    rule.type === 'league' ||
    rule.standingsMode === 'groups' ||
    rule.standingsMode === 'conferences' ||
    rule.standingsMode === 'league_phase'
  )
}

export async function getLeagueStandings(
  leagueId: number,
  season: number
): Promise<LeagueStandingGroup[]> {
  const supabase = getSupabaseAdminClient()
  const fixtures = await getLeagueFixtures(leagueId, season)
  const cachedStandings = normalizeOfficialStandingGroupNames(
    leagueId,
    await readCachedLeagueStandings(supabase, leagueId, season)
  )
  const competitionRule = getCompetitionRuleByExternalId(leagueId)
  const officialStandings = cachedStandings.length
    ? cachedStandings
    : normalizeOfficialStandingGroupNames(
        leagueId,
        await readApiLeagueStandings(leagueId, season, {
          logContext: `league-page-standings:${leagueId}`,
        })
      )

  if (shouldPreferOfficialStandings(leagueId, competitionRule, officialStandings)) {
    console.info('[standings:official]', {
      leagueId,
      season,
      source: cachedStandings.length ? 'supabase-cache' : 'api-football-memory-cache',
      groups: officialStandings.length,
      teams: officialStandings.reduce((total, group) => total + group.rows.length, 0),
    })

    return officialStandings
  }

  if (isConmebolTraditionalGroupStageLeague(leagueId)) {
    const groups = buildConmebolGroupStageStandings(fixtures)

    if (groups.length) {
      console.info('[standings:supabase:group-stage]', {
        leagueId,
        season,
        fixtures: fixtures.length,
        groups: groups.length,
        teams: groups.reduce((total, group) => total + group.rows.length, 0),
      })

      return applyCachedStandingDescriptions(groups, officialStandings)
    }
  }

  if (leagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) {
    const groups = buildLigaProfesionalGroupStandings(fixtures)

    if (groups.length >= 2) {
      console.info('[standings:supabase:liga-profesional-groups]', {
        leagueId,
        season,
        fixtures: fixtures.length,
        groups: groups.length,
        teams: groups.reduce((total, group) => total + group.rows.length, 0),
      })

      return applyCachedStandingDescriptions(groups, officialStandings)
    }

    console.info('[standings:supabase:liga-profesional-clausura-empty]', {
      leagueId,
      season,
      fixtures: fixtures.length,
      officialGroups: officialStandings.length,
    })

    return []
  }

  const zonedGroups = buildZonedLeagueStandings(leagueId, fixtures)

  if (zonedGroups.length) {
    console.info('[standings:supabase:zoned-league]', {
      leagueId,
      season,
      fixtures: fixtures.length,
      groups: zonedGroups.length,
      teams: zonedGroups.reduce((total, group) => total + group.rows.length, 0),
    })

    return applyCachedStandingDescriptions(zonedGroups, officialStandings)
  }

  if (isUefaLeaguePhaseCompetition(leagueId)) {
    const groups = buildUefaLeaguePhaseStandings(leagueId, fixtures)

    if (groups.length) {
      console.info('[standings:supabase:uefa-league-phase]', {
        leagueId,
        season,
        fixtures: fixtures.length,
        teams: groups[0]?.rows.length ?? 0,
      })

      return applyCachedStandingDescriptions(groups, officialStandings)
    }
  }

  const shouldCalculateSingleLeagueTable =
    !competitionRule ||
    (
      competitionRule.standingsMode === 'single' &&
      (competitionRule.type === 'league' || competitionRule.type === 'playoff')
    )

  if (shouldCalculateSingleLeagueTable) {
    const calculated = buildSingleLeagueTableStandings(fixtures)

    if (calculated.groups.length) {
      console.info('[standings:supabase:calculated-league-table]', {
        leagueId,
        season,
        fixtures: fixtures.length,
        regularFixtures: calculated.regularFixtures,
        countedFixtures: calculated.countedFixtures,
        teams: calculated.groups[0]?.rows.length ?? 0,
      })

      return applyCachedStandingDescriptions(calculated.groups, officialStandings)
    }
  }

  if (officialStandings.length) {
    console.info('[standings:supabase:standings-cache]', {
      leagueId,
      season,
      groups: officialStandings.length,
      teams: officialStandings.reduce((total, group) => total + group.rows.length, 0),
    })

    return officialStandings
  }

  const calculatedFallback = buildSingleLeagueTableStandings(fixtures)

  console.info('[standings:supabase]', {
    leagueId,
    season,
    fixtures: fixtures.length,
    countedFixtures: calculatedFallback.countedFixtures,
    teams: calculatedFallback.groups[0]?.rows.length ?? 0,
  })

  return calculatedFallback.groups
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
    comments: row.comments ?? null,
  }
}

async function enrichLeagueFixturesWithStoredEvents(
  leagueId: number,
  fixtures: LeagueFixtureSummary[]
) {
  if (!fixtures.length) return fixtures

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
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
        .in('match_id', chunk)
        .order('minute', { ascending: true })
        .order('extra_minute', { ascending: true })

      if (response.error) {
        if (
          response.error.code === '42703' ||
          response.error.code === 'PGRST204' ||
          response.error.message.toLowerCase().includes('comments') ||
          response.error.message.toLowerCase().includes('schema cache')
        ) {
          const fallbackResponse = await supabase
            .from('match_events')
            .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
            .in('match_id', chunk)
            .order('minute', { ascending: true })
            .order('extra_minute', { ascending: true })

          if (fallbackResponse.error) {
            if (isMissingOptionalStoredEvents(fallbackResponse.error)) return fixtures
            throw fallbackResponse.error
          }

          for (const event of (fallbackResponse.data ?? []) as StoredMatchEventRow[]) {
            const matchId = String(event.match_id)
            const current = eventsByMatchId.get(matchId) ?? []
            current.push(event)
            eventsByMatchId.set(matchId, current)
          }
          continue
        }

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

      const events = dedupeStoredMatchEventRows(eventsByMatchId.get(String(matchRow.id)) ?? [])
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
    console.warn('[league-fixtures:events] No se pudieron leer incidencias desde Supabase.', {
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

const EUROPEAN_SEASON_LEAGUE_IDS = new Set([
  2,
  3,
  39,
  45,
  61,
  66,
  78,
  81,
  88,
  94,
  96,
  135,
  137,
  140,
  143,
  848,
])

function getFixtureDateYear(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.getUTCFullYear()
}

function cachedFixtureMatchesSeason(input: {
  leagueId: number
  targetSeason: number
  payloadSeason: number | null
  date?: string | null
}) {
  if (input.payloadSeason !== null) return input.payloadSeason === input.targetSeason

  const year = getFixtureDateYear(input.date)
  if (year === null) return true

  if (EUROPEAN_SEASON_LEAGUE_IDS.has(input.leagueId)) {
    return year === input.targetSeason || year === input.targetSeason + 1
  }

  return year === input.targetSeason
}

function mapCachedLeagueFixturePayload(
  payload: unknown,
  options: { leagueId: number; season: number; cacheDate?: string | null }
): LeagueFixtureSummary | null {
  if (!payload || typeof payload !== 'object') return null

  const row = payload as Record<string, unknown>
  const id = getNumberFromCachedValue(row.id ?? row.externalId)
  const homeId = getNumberFromCachedValue(row.homeId)
  const awayId = getNumberFromCachedValue(row.awayId)
  const home = getStringFromCachedValue(row.home)
  const away = getStringFromCachedValue(row.away)
  const date = getStringFromCachedValue(row.date)
  const payloadSeason = getNumberFromCachedValue(row.season)

  if (!id || !home || !away || !date) return null
  if (
    !cachedFixtureMatchesSeason({
      leagueId: options.leagueId,
      targetSeason: options.season,
      payloadSeason,
      date: date ?? options.cacheDate,
    })
  ) {
    return null
  }

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
    homePenaltyScore: getNumberFromCachedValue(row.homePenaltyScore),
    awayPenaltyScore: getNumberFromCachedValue(row.awayPenaltyScore),
    venueName: null,
    venueCity: null,
    venueCountry: getNullableStringFromCachedValue(row.country) ?? null,
    events: [],
  }
}

async function fetchCachedLeagueFixtures(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueId: number,
  season: number
) {
  const rows: CachedHomeFixtureRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const response = await supabase
      .from('football_fixture_cache')
      .select('date, normalized_payload')
      .eq('league_external_id', String(leagueId))
      .order('date', { ascending: true })
      .order('fixture_external_id', { ascending: true })
      .range(from, from + pageSize - 1)

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

    rows.push(...((response.data ?? []) as CachedHomeFixtureRow[]))

    if (!response.data || response.data.length < pageSize) break
  }

  return rows
    .map((row) => mapCachedLeagueFixturePayload(row.normalized_payload, {
      leagueId,
      season,
      cacheDate: row.date,
    }))
    .filter((fixture): fixture is LeagueFixtureSummary => Boolean(fixture))
    .sort(compareLeagueFixturesByApiOrder)
}

function getLeagueFixtureDataRank(fixture: LeagueFixtureSummary) {
  let score = 0

  if (isLiveStatus(fixture.statusShort)) score += 50
  else if (isFinishedStatus(fixture.statusShort)) score += 45
  else if (isPostponedStatus(fixture.statusShort)) score += 35
  else if (!isUpcomingStatus(fixture.statusShort)) score += 20

  if (fixture.goalsHome !== null && fixture.goalsAway !== null) score += 20
  else if (fixture.goalsHome !== null || fixture.goalsAway !== null) score += 10
  if (fixture.minute !== null && fixture.minute !== undefined) score += 2
  if (fixture.events?.length) score += 1

  return score
}

function mergeLeagueFixtureData(
  existing: LeagueFixtureSummary,
  incoming: LeagueFixtureSummary
): LeagueFixtureSummary {
  const incomingWins = getLeagueFixtureDataRank(incoming) >= getLeagueFixtureDataRank(existing)
  const primary = incomingWins ? incoming : existing
  const secondary = incomingWins ? existing : incoming

  return {
    ...secondary,
    ...primary,
    round: primary.round || secondary.round,
    date: primary.date ?? secondary.date,
    statusShort: primary.statusShort || secondary.statusShort,
    minute: primary.minute ?? secondary.minute,
    homeId: primary.homeId ?? secondary.homeId,
    awayId: primary.awayId ?? secondary.awayId,
    homeLogo: primary.homeLogo ?? secondary.homeLogo,
    awayLogo: primary.awayLogo ?? secondary.awayLogo,
    goalsHome: primary.goalsHome ?? secondary.goalsHome,
    goalsAway: primary.goalsAway ?? secondary.goalsAway,
    homePenaltyScore: primary.homePenaltyScore ?? secondary.homePenaltyScore,
    awayPenaltyScore: primary.awayPenaltyScore ?? secondary.awayPenaltyScore,
    venueName: primary.venueName ?? secondary.venueName,
    venueCity: primary.venueCity ?? secondary.venueCity,
    venueCountry: primary.venueCountry ?? secondary.venueCountry,
    events: primary.events?.length ? primary.events : secondary.events,
  }
}

function mergeLeagueFixtureSources(
  cachedFixtures: LeagueFixtureSummary[],
  storedFixtures: LeagueFixtureSummary[]
) {
  const fixturesById = new Map<string, LeagueFixtureSummary>()

  for (const fixture of cachedFixtures) {
    fixturesById.set(String(fixture.id), fixture)
  }

  for (const fixture of storedFixtures) {
    const key = String(fixture.id)
    const existing = fixturesById.get(key)

    fixturesById.set(key, existing ? mergeLeagueFixtureData(existing, fixture) : fixture)
  }

  return [...fixturesById.values()].sort(compareLeagueFixturesByApiOrder)
}

export async function getLeagueFixtures(
  leagueId: number,
  season: number,
  options: { includeEvents?: boolean } = {}
) {
  const includeEvents = options.includeEvents ?? true
  const supabase = getSupabaseAdminClient()
  const leagueRows = await fetchStoredLeagueRowsByExternalId(leagueId, season, {
    fallbackToAnySeason: false,
  })
  const leagueIds = leagueRows.map((league) => String(league.id))
  const storedMatches: StoredDetailMatchRow[] = []
  const cachedFixtures = await fetchCachedLeagueFixtures(supabase, leagueId, season)

  for (const chunk of chunkArray(leagueIds, 50)) {
    const selectWithPenaltyScores =
      'id, external_id, league_id, round, match_date, status, elapsed, home_team_id, away_team_id, home_score, away_score, home_penalty_score, away_penalty_score'
    let response = await supabase
      .from('matches')
      .select(`${selectWithPenaltyScores}, venue_name, venue_city, venue_country`)
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
        .select(selectWithPenaltyScores)
        .in('league_id', chunk)
        .order('match_date', { ascending: true, nullsFirst: false })
        .limit(1000)

      if (
        fallbackResponse.error &&
        (
          fallbackResponse.error.code === '42703' ||
          fallbackResponse.error.code === 'PGRST204' ||
          fallbackResponse.error.message.toLowerCase().includes('schema cache')
        )
      ) {
        const baseResponse = await supabase
          .from('matches')
          .select('id, external_id, league_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score')
          .in('league_id', chunk)
          .order('match_date', { ascending: true, nullsFirst: false })
          .limit(1000)

        response = baseResponse as unknown as typeof response
      } else {
        response = fallbackResponse as unknown as typeof response
      }
    }

    if (response.error) throw response.error
    storedMatches.push(...((response.data ?? []) as StoredDetailMatchRow[]))
  }

  if (!storedMatches.length) {
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

  const enrichedFixtures = includeEvents
    ? await enrichLeagueFixturesWithStoredEvents(leagueId, mappedFixtures)
    : mappedFixtures
  const mergedStoredAndCachedFixtures = mergeLeagueFixtureSources(
    cachedFixtures,
    enrichedFixtures
  )
  const mergedFixtures = await mergeLigaProfesionalDerivedFixtures(
    leagueId,
    season,
    mergedStoredAndCachedFixtures
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
      homePenaltyScore: fixture.homePenaltyScore ?? null,
      awayPenaltyScore: fixture.awayPenaltyScore ?? null,
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
    const eventLeaders = await withTimeout(
      getLeagueEventStatsLeaders(leagueId, season),
      LEAGUE_LEADERS_TIMEOUT_MS,
      `League leaders timeout ${leagueId}:${season}`
    )

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
