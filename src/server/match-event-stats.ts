import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getEventAssistName,
  getEventPlayerName,
  getGoalKindFromDetail,
  isCancelledEvent,
  isRedCardEvent,
  isScoreboardGoalEvent,
  isValidAssistEvent,
  isValidGoalForScorerTable,
  isYellowCardEvent,
  normalizeFootballEventText,
  type FootballEventLike,
} from '@/shared/utils/football-events'
import { isFinishedStatus } from '@/shared/utils/match-status'

type DbId = string | number

export type EventStatsTopPlayerRow = {
  playerId?: number
  name: string
  photo?: string
  teamId?: number
  teamName?: string
  teamLogo?: string
  value: number
}

export type EventStatsLeaders = {
  scorers: EventStatsTopPlayerRow[]
  assists: EventStatsTopPlayerRow[]
  yellowCards: EventStatsTopPlayerRow[]
  redCards: EventStatsTopPlayerRow[]
  hasEvents: boolean
  warnings: string[]
}

type LeagueRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  season?: number | null
}

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  round: string | null
  match_date: string | null
  status: string | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
}

export type MatchEventStatsRow = FootballEventLike & {
  id: DbId
  external_event_id: DbId | null
  match_id: DbId
  team_id: DbId | null
  player_name: string | null
  assist_name: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
}

type TeamRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url?: string | null
}

type EventLeaderAccumulator = {
  name: string
  teamExternalId?: number
  teamName?: string
  teamLogo?: string
  value: number
}

type EventStatsDataset = {
  leagues: LeagueRow[]
  matches: MatchRow[]
  events: MatchEventStatsRow[]
  teamsById: Map<string, TeamRow>
}

const PAGE_SIZE = 1000

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeLeaderName(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNumericExternalId(value?: DbId | null) {
  if (value === null || value === undefined) return undefined

  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : undefined
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

async function fetchLeagues(
  supabase: SupabaseClient,
  leagueExternalId: number | string,
  season?: number
) {
  let query = supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('external_id', String(leagueExternalId))

  if (season) query = query.eq('season', season)

  const response = await query

  if (response.error) throw response.error
  if (response.data?.length || !season) return (response.data ?? []) as LeagueRow[]

  const fallback = await supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('external_id', String(leagueExternalId))

  if (fallback.error) throw fallback.error

  return (fallback.data ?? []) as LeagueRow[]
}

async function fetchMatchesByLeagueIds(supabase: SupabaseClient, leagueIds: string[]) {
  const matches: MatchRow[] = []

  for (const chunk of chunkArray(leagueIds, 50)) {
    const chunkMatches = await fetchAllByRange<MatchRow>((from, to) =>
      supabase
        .from('matches')
        .select('id, external_id, league_id, round, match_date, status, home_team_id, away_team_id, home_score, away_score')
        .in('league_id', chunk)
        .order('match_date', { ascending: true, nullsFirst: false })
        .range(from, to)
    )

    matches.push(...chunkMatches)
  }

  return matches
}

async function fetchEventsByMatchIds(supabase: SupabaseClient, matchIds: string[]) {
  const events: MatchEventStatsRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const chunkEvents = await fetchAllByRange<MatchEventStatsRow>((from, to) =>
      supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)
        .order('minute', { ascending: true, nullsFirst: false })
        .order('extra_minute', { ascending: true, nullsFirst: false })
        .range(from, to)
    )

    events.push(...chunkEvents)
  }

  return events
}

async function fetchTeamsByIds(supabase: SupabaseClient, teamIds: string[]) {
  const teams: TeamRow[] = []

  for (const chunk of chunkArray([...new Set(teamIds)], 100)) {
    const chunkTeams = await fetchAllByRange<TeamRow>((from, to) =>
      supabase
        .from('teams')
        .select('id, external_id, name, logo_url')
        .in('id', chunk)
        .range(from, to)
    )

    teams.push(...chunkTeams)
  }

  return new Map(teams.map((team) => [String(team.id), team]))
}

async function fetchLeagueEventStatsDataset(
  supabase: SupabaseClient,
  leagueExternalId: number | string,
  season?: number
): Promise<EventStatsDataset> {
  const leagues = await fetchLeagues(supabase, leagueExternalId, season)
  const leagueIds = leagues.map((league) => String(league.id))

  if (!leagueIds.length) {
    return {
      leagues,
      matches: [],
      events: [],
      teamsById: new Map(),
    }
  }

  const matches = await fetchMatchesByLeagueIds(supabase, leagueIds)
  const matchIds = matches.map((match) => String(match.id))
  const events = matchIds.length ? await fetchEventsByMatchIds(supabase, matchIds) : []
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .concat(events.map((event) => event.team_id))
        .filter((id): id is DbId => id !== null && id !== undefined)
        .map(String)
    ),
  ]
  const teamsById = teamIds.length ? await fetchTeamsByIds(supabase, teamIds) : new Map()

  return {
    leagues,
    matches,
    events,
    teamsById,
  }
}

function getEventTeam(
  event: MatchEventStatsRow,
  matchesById: Map<string, MatchRow>,
  teamsById: Map<string, TeamRow>
) {
  const match = matchesById.get(String(event.match_id))
  const teamId = event.team_id ? String(event.team_id) : null
  const eventTeam = teamId ? teamsById.get(teamId) : null
  const homeTeam = match?.home_team_id ? teamsById.get(String(match.home_team_id)) : null
  const awayTeam = match?.away_team_id ? teamsById.get(String(match.away_team_id)) : null

  if (eventTeam) return eventTeam
  if (teamId && String(match?.home_team_id) === teamId) return homeTeam ?? null
  if (teamId && String(match?.away_team_id) === teamId) return awayTeam ?? null

  return null
}

function addLeader(
  leaders: Map<string, EventLeaderAccumulator>,
  playerName: string | null | undefined,
  team: TeamRow | null
) {
  const name = playerName?.trim()
  if (!name) return

  const teamKey = team?.external_id ?? team?.id ?? team?.name ?? 'sin-equipo'
  const key = `${normalizeLeaderName(name)}:${String(teamKey)}`
  const current = leaders.get(key)

  if (current) {
    current.value += 1
    if (!current.teamExternalId) current.teamExternalId = toNumericExternalId(team?.external_id)
    if (!current.teamName && team?.name) current.teamName = team.name
    if (!current.teamLogo && team?.logo_url) current.teamLogo = team.logo_url
    return
  }

  leaders.set(key, {
    name,
    teamExternalId: toNumericExternalId(team?.external_id),
    teamName: team?.name ?? undefined,
    teamLogo: team?.logo_url ?? undefined,
    value: 1,
  })
}

function toRows(leaders: Map<string, EventLeaderAccumulator>): EventStatsTopPlayerRow[] {
  return [...leaders.values()]
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      return a.name.localeCompare(b.name, 'es-AR')
    })
    .map((leader) => ({
      name: leader.name,
      teamId: leader.teamExternalId,
      teamName: leader.teamName,
      teamLogo: leader.teamLogo,
      value: leader.value,
    }))
}

export function buildEventStatsLeaders(
  events: MatchEventStatsRow[],
  matchesById: Map<string, MatchRow>,
  teamsById: Map<string, TeamRow>
) {
  const scorers = new Map<string, EventLeaderAccumulator>()
  const assists = new Map<string, EventLeaderAccumulator>()
  const yellowCards = new Map<string, EventLeaderAccumulator>()
  const redCards = new Map<string, EventLeaderAccumulator>()
  const countedRedCards = new Set<string>()

  for (const event of events) {
    const team = getEventTeam(event, matchesById, teamsById)

    if (isValidGoalForScorerTable(event)) {
      addLeader(scorers, getEventPlayerName(event), team)
    }

    if (isValidAssistEvent(event)) {
      addLeader(assists, getEventAssistName(event), team)
    }

    if (isYellowCardEvent(event)) {
      addLeader(yellowCards, getEventPlayerName(event), team)
    }

    if (isRedCardEvent(event)) {
      const redKey = [
        event.match_id,
        event.team_id,
        normalizeLeaderName(getEventPlayerName(event)),
      ].join(':')

      if (!countedRedCards.has(redKey)) {
        countedRedCards.add(redKey)
        addLeader(redCards, getEventPlayerName(event), team)
      }
    }
  }

  return {
    scorers: toRows(scorers),
    assists: toRows(assists),
    yellowCards: toRows(yellowCards),
    redCards: toRows(redCards),
  }
}

export async function getLeagueEventStatsLeaders(
  leagueExternalId: number | string,
  season?: number
): Promise<EventStatsLeaders> {
  const warnings: string[] = []
  const supabase = getSupabaseAdminClient()
  const dataset = await fetchLeagueEventStatsDataset(supabase, leagueExternalId, season)

  if (!dataset.leagues.length) {
    warnings.push('No se encontro la competencia en Supabase.')
  }

  if (!dataset.matches.length) {
    warnings.push('No se encontraron partidos para la competencia en Supabase.')
  }

  if (!dataset.events.length) {
    warnings.push('No hay eventos cargados en match_events para esta competencia.')
  }

  const matchesById = new Map(dataset.matches.map((match) => [String(match.id), match]))

  return {
    ...buildEventStatsLeaders(dataset.events, matchesById, dataset.teamsById),
    hasEvents: dataset.events.length > 0,
    warnings,
  }
}

function getDuplicateEventKey(event: MatchEventStatsRow) {
  if (event.external_event_id) {
    return `${event.match_id}:external:${event.external_event_id}`
  }

  return [
    event.match_id,
    event.team_id,
    normalizeLeaderName(getEventPlayerName(event)),
    normalizeLeaderName(getEventAssistName(event)),
    event.minute ?? '',
    event.extra_minute ?? '',
    normalizeFootballEventText(event.type),
    normalizeFootballEventText(event.detail),
  ].join(':')
}

function serializeTopRows(rows: EventStatsTopPlayerRow[]) {
  return rows.slice(0, 20).map((row, index) => ({
    rank: index + 1,
    player: row.name,
    team: row.teamName ?? null,
    value: row.value,
  }))
}

export async function getLeagueEventStatsAudit(
  leagueExternalId: number | string,
  season?: number
) {
  const supabase = getSupabaseAdminClient()
  const dataset = await fetchLeagueEventStatsDataset(supabase, leagueExternalId, season)
  const matchesById = new Map(dataset.matches.map((match) => [String(match.id), match]))
  const leaders = buildEventStatsLeaders(dataset.events, matchesById, dataset.teamsById)
  const duplicateCounts = dataset.events.reduce<Map<string, MatchEventStatsRow[]>>((accumulator, event) => {
    const key = getDuplicateEventKey(event)
    const current = accumulator.get(key) ?? []

    current.push(event)
    accumulator.set(key, current)

    return accumulator
  }, new Map())
  const duplicatedEvents = [...duplicateCounts.values()].filter((items) => items.length > 1)
  const eventsWithInvalidTeam = dataset.events.filter((event) => {
    const match = matchesById.get(String(event.match_id))

    if (!match || !event.team_id) return false

    return (
      String(event.team_id) !== String(match.home_team_id) &&
      String(event.team_id) !== String(match.away_team_id)
    )
  })
  const scorerGoals = dataset.events.filter(isValidGoalForScorerTable)
  const scoreboardGoals = dataset.events.filter((event) =>
    isScoreboardGoalEvent(event.type, event.detail)
  )
  const ownGoals = scoreboardGoals.filter((event) =>
    getGoalKindFromDetail(event.detail) === 'own-goal'
  )
  const yellowCards = dataset.events.filter(isYellowCardEvent)
  const redCards = dataset.events.filter(isRedCardEvent)
  const validAssistEvents = dataset.events.filter(isValidAssistEvent)
  const missingPlayerEvents = dataset.events.filter((event) =>
    (
      isValidGoalForScorerTable(event) ||
      isYellowCardEvent(event) ||
      isRedCardEvent(event)
    ) && !getEventPlayerName(event)?.trim()
  )
  const eventsByMatchId = dataset.events.reduce<Map<string, MatchEventStatsRow[]>>(
    (accumulator, event) => {
      const matchId = String(event.match_id)
      const current = accumulator.get(matchId) ?? []

      current.push(event)
      accumulator.set(matchId, current)

      return accumulator
    },
    new Map()
  )
  const matchesWithMissingGoals = dataset.matches
    .filter((match) => isFinishedStatus(match.status))
    .map((match) => {
      const expectedGoals =
        match.home_score !== null && match.away_score !== null
          ? match.home_score + match.away_score
          : null
      const goalEvents = (eventsByMatchId.get(String(match.id)) ?? []).filter((event) =>
        isScoreboardGoalEvent(event.type, event.detail)
      )
      const home = match.home_team_id ? dataset.teamsById.get(String(match.home_team_id)) : null
      const away = match.away_team_id ? dataset.teamsById.get(String(match.away_team_id)) : null

      return {
        match_id: match.id,
        external_id: match.external_id,
        round: match.round,
        home: home?.name ?? null,
        away: away?.name ?? null,
        status: match.status,
        match_date: match.match_date,
        expected_goals: expectedGoals,
        valid_goal_events: goalEvents.length,
        missing_goals:
          expectedGoals === null ? null : Math.max(expectedGoals - goalEvents.length, 0),
      }
    })
    .filter((match) => match.missing_goals !== null && match.missing_goals > 0)
  const warnings: string[] = []

  if (!dataset.leagues.length) warnings.push('No se encontro la competencia en Supabase.')
  if (!dataset.events.length) warnings.push('No hay eventos cargados para esta competencia.')
  if (duplicatedEvents.length) warnings.push('Hay eventos duplicados en match_events.')
  if (eventsWithInvalidTeam.length) warnings.push('Hay eventos con equipo que no coincide con local/visitante.')
  if (missingPlayerEvents.length) warnings.push('Hay goles o tarjetas sin jugador.')
  if (matchesWithMissingGoals.length) warnings.push('Hay partidos finalizados con goles faltantes en match_events.')

  return {
    ok: true,
    league: dataset.leagues.map((league) => ({
      id: league.id,
      external_id: league.external_id,
      name: league.name,
      season: league.season ?? null,
    })),
    totals: {
      matchesFinal: dataset.matches.filter((match) => isFinishedStatus(match.status)).length,
      goalEvents: scoreboardGoals.length,
      scorerGoals: scorerGoals.length,
      ownGoals: ownGoals.length,
      assists: validAssistEvents.length,
      yellowCards: yellowCards.length,
      redCards: redCards.length,
      duplicatedEvents: duplicatedEvents.reduce((sum, items) => sum + items.length - 1, 0),
      invalidEvents:
        eventsWithInvalidTeam.length +
        missingPlayerEvents.length,
      matchesWithMissingGoals: matchesWithMissingGoals.length,
    },
    topScorers: serializeTopRows(leaders.scorers),
    topAssists: serializeTopRows(leaders.assists),
    topYellowCards: serializeTopRows(leaders.yellowCards),
    topRedCards: serializeTopRows(leaders.redCards),
    diagnostics: {
      eventsTotal: dataset.events.length,
      cancelledEvents: dataset.events.filter(isCancelledEvent).length,
      eventsWithInvalidTeam: eventsWithInvalidTeam.slice(0, 30).map((event) => ({
        id: event.id,
        match_id: event.match_id,
        team_id: event.team_id,
        type: event.type,
        detail: event.detail,
        player: getEventPlayerName(event),
      })),
      duplicatedEvents: duplicatedEvents.slice(0, 30).map((items) => ({
        key: getDuplicateEventKey(items[0]),
        count: items.length,
        ids: items.map((event) => event.id),
      })),
      missingPlayerEvents: missingPlayerEvents.slice(0, 30).map((event) => ({
        id: event.id,
        match_id: event.match_id,
        type: event.type,
        detail: event.detail,
      })),
    },
    matchesWithMissingGoals: matchesWithMissingGoals.slice(0, 50),
    warnings,
  }
}
