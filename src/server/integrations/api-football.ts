import {
  readPersistentCache,
  readStoredFixturesByDate,
  readStoredFixturesByLeagueSeason,
  upsertStoredFixtures,
  writePersistentCache,
} from '@/server/cache/cache-db'
import { getFootballApiConfig } from '@/server/config/env'

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
    penalty?: FixtureGoals
  }
}

export type MatchListItem = {
  id: number
  leagueId?: number
  league: string
  leagueLogo?: string
  country?: string
  date: string
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  goalsHome: number | null
  goalsAway: number | null
  minute: number | null
  statusShort: string
  statusLong: string
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
  if (normalized.includes('round of 16') || normalized.includes('octavos')) return 30
  if (normalized.includes('quarter')) return 40
  if (normalized.includes('semi')) return 50
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

function addDaysToISO(isoDate: string, amount: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + amount)

  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function getArgentinaDateKey(dateString: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateString))
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
    const res = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': apiKey,
      },
      ...(options?.noStore
        ? { cache: 'no-store' as const }
        : { next: { revalidate: ttlSeconds } }),
    })

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

      if (persistentCache) {
        return persistentCache.data
      }
    }

    throw error
  } finally {
    inflightApiRequests.delete(cacheKey)
  }
}

export async function getMatchesByDate(date: string): Promise<MatchListItem[]> {
  const requestedDates = [addDaysToISO(date, -1), date, addDaysToISO(date, 1)]
  const responses = await Promise.allSettled(
    requestedDates.map((requestedDate) =>
      apiFootball('/fixtures', {
        date: requestedDate,
        timezone: 'America/Argentina/Buenos_Aires',
      }, {
        revalidate: 30,
      }) as Promise<ApiFootballResponse<FixtureListItem>>
    )
  )

  const dedupedFixtures = new Map<number, FixtureListItem>()

  for (const response of responses) {
    if (response.status !== 'fulfilled') continue

    for (const item of response.value.response || []) {
      if (getArgentinaDateKey(item.fixture.date) !== date) continue
      dedupedFixtures.set(item.fixture.id, item)
    }
  }

  const mappedFixtures = [...dedupedFixtures.values()].map((item): MatchListItem => ({
    id: item.fixture.id,
    leagueId: item.league.id,
    league: item.league.name,
    leagueLogo: item.league.logo,
    country: item.league.country,
    date: item.fixture.date,
    home: item.teams.home.name,
    away: item.teams.away.name,
    homeLogo: item.teams.home.logo,
    awayLogo: item.teams.away.logo,
    goalsHome: item.goals.home,
    goalsAway: item.goals.away,
    minute: item.fixture.status.elapsed,
    statusShort: item.fixture.status.short,
    statusLong: item.fixture.status.long,
  }))

  if (mappedFixtures.length) {
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
        homeTeamName: item.home,
        homeTeamLogo: item.homeLogo,
        awayTeamName: item.away,
        awayTeamLogo: item.awayLogo,
        goalsHome: item.goalsHome,
        goalsAway: item.goalsAway,
      }))
    )
  }

  const storedFixtures = readStoredFixturesByDate(date)
  if (storedFixtures.length) {
    return storedFixtures.map((item): MatchListItem => ({
      id: item.fixtureId,
      leagueId: item.leagueId,
      league: item.leagueName,
      leagueLogo: item.leagueLogo,
      country: item.country,
      date: item.date,
      home: item.homeTeamName,
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

export async function getMatchDetail(id: number) {
  const [fixture, events, statistics, lineups] = await Promise.all([
    apiFootball('/fixtures', { id }, { revalidate: 30 }),
    apiFootball('/fixtures/events', { fixture: id }, { revalidate: 30 }),
    apiFootball('/fixtures/statistics', { fixture: id }, { revalidate: 30 }),
    apiFootball('/fixtures/lineups', { fixture: id }, { revalidate: 30 }),
  ])

  return {
    fixture: (fixture as ApiFootballResponse<MatchFixture>).response?.[0] || null,
    events: (events as ApiFootballResponse<MatchEvent>).response || [],
    statistics:
      (statistics as ApiFootballResponse<MatchStatisticsTeam>).response || [],
    lineups: (lineups as ApiFootballResponse<MatchLineup>).response || [],
  }
}

export async function getTeamDetail(id: number) {
  const [team, squad] = await Promise.all([
    apiFootball('/teams', { id }, { revalidate: 300 }),
    apiFootball('/players/squads', { team: id }, { revalidate: 300 }),
  ])

  return {
    team: (team as ApiFootballResponse<TeamProfile>).response?.[0] || null,
    squad: (squad as ApiFootballResponse<TeamSquad>).response?.[0] || null,
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

  return {
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
  }
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
      minute: item.fixture.status.elapsed,
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
    }))
    logCopaArgentinaFixtureDebug(leagueId, season, mappedFixtures, 'api')

    if (mappedFixtures.length) {
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
          minute: item.fixture.status.elapsed,
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
      }))
      logCopaArgentinaFixtureDebug(leagueId, season, refreshedFixtures, 'cache')
      return refreshedFixtures
    }

    return mappedFixtures
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
      }))
      logCopaArgentinaFixtureDebug(leagueId, season, fallbackFixtures, 'cache')
      return fallbackFixtures
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

  return (data.response || [])
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
