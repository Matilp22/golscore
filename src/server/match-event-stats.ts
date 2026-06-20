import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchMatchDetailProviderCounts, serializeError, syncMatchDetail } from '@/server/match-detail-cache'
import {
  dedupeRankingEvents,
  getEventAssistName,
  getEventPlayerName,
  getGoalKindFromDetail,
  isCancelledCardEvent,
  isCancelledEvent,
  isCancelledGoalEvent,
  isMissedPenalty,
  isOwnGoal,
  isPenaltyShootoutEvent,
  isSecondYellowCardEvent,
  isValidAssistForAssistTable,
  isValidGoalForScore,
  isValidGoalForScorerTable,
  isValidRedCard,
  isValidYellowCard,
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
  details?: string
  matches?: number
  penalties?: number
  secondYellowReds?: number
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
  comments?: string | null
}

type TeamRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  logo_url?: string | null
}

type PlayerRow = {
  external_id: DbId | null
  name: string | null
  team_id: DbId | null
  team_external_id: DbId | null
  photo_url: string | null
}

type EventLeaderAccumulator = {
  name: string
  normalizedName: string
  teamInternalId?: string
  teamExternalId?: number
  teamExternalKey?: string
  teamName?: string
  teamLogo?: string
  value: number
  penalties: number
  secondYellowReds: number
  matchIds: Set<string>
  kind: 'scorers' | 'assists' | 'yellowCards' | 'redCards'
}

type EventStatsDataset = {
  leagues: LeagueRow[]
  matches: MatchRow[]
  events: MatchEventStatsRow[]
  teamsById: Map<string, TeamRow>
  players: PlayerRow[]
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

function getMatchDateTimestamp(value?: string | null) {
  if (!value) return 0

  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
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
    const chunkEvents = await fetchAllByRange<MatchEventStatsRow>(async (from, to) => {
      const withComments = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
        .in('match_id', chunk)
        .order('minute', { ascending: true, nullsFirst: false })
        .order('extra_minute', { ascending: true, nullsFirst: false })
        .range(from, to)

      if (
        withComments.error &&
        (
          withComments.error.code === '42703' ||
          withComments.error.code === 'PGRST204' ||
          withComments.error.message.toLowerCase().includes('comments') ||
          withComments.error.message.toLowerCase().includes('schema cache')
        )
      ) {
        return supabase
          .from('match_events')
          .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
          .in('match_id', chunk)
          .order('minute', { ascending: true, nullsFirst: false })
          .order('extra_minute', { ascending: true, nullsFirst: false })
          .range(from, to)
      }

      return withComments
    })

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

async function fetchPlayers(supabase: SupabaseClient) {
  return fetchAllByRange<PlayerRow>((from, to) =>
    supabase
      .from('players')
      .select('external_id, name, team_id, team_external_id, photo_url')
      .range(from, to)
  )
}

async function fetchLeagueEventStatsDataset(
  supabase: SupabaseClient,
  leagueExternalId: number | string,
  season?: number,
  options: { includePlayers?: boolean } = {}
): Promise<EventStatsDataset> {
  const includePlayers = options.includePlayers ?? true
  const leagues = await fetchLeagues(supabase, leagueExternalId, season)
  const leagueIds = leagues.map((league) => String(league.id))

  if (!leagueIds.length) {
    return {
      leagues,
      matches: [],
      events: [],
      teamsById: new Map(),
      players: [],
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
  const players = includePlayers ? await fetchPlayers(supabase) : []

  return {
    leagues,
    matches,
    events,
    teamsById,
    players,
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
  team: TeamRow | null,
  kind: EventLeaderAccumulator['kind'],
  options: { penalty?: boolean; secondYellowRed?: boolean; matchId?: DbId | null } = {}
) {
  const name = playerName?.trim()
  if (!name) return

  const normalizedName = normalizeLeaderName(name)
  const teamKey = team?.external_id ?? team?.id ?? team?.name ?? 'sin-equipo'
  const key = `${normalizedName}:${String(teamKey)}`
  const current = leaders.get(key)

  if (current) {
    current.value += 1
    if (options.penalty) current.penalties += 1
    if (options.secondYellowRed) current.secondYellowReds += 1
    if (options.matchId !== null && options.matchId !== undefined) current.matchIds.add(String(options.matchId))
    if (!current.teamInternalId && team?.id) current.teamInternalId = String(team.id)
    if (!current.teamExternalId) current.teamExternalId = toNumericExternalId(team?.external_id)
    if (!current.teamExternalKey && team?.external_id) current.teamExternalKey = String(team.external_id)
    if (!current.teamName && team?.name) current.teamName = team.name
    if (!current.teamLogo && team?.logo_url) current.teamLogo = team.logo_url
    return
  }

  leaders.set(key, {
    name,
    normalizedName,
    teamInternalId: team?.id ? String(team.id) : undefined,
    teamExternalId: toNumericExternalId(team?.external_id),
    teamExternalKey: team?.external_id ? String(team.external_id) : undefined,
    teamName: team?.name ?? undefined,
    teamLogo: team?.logo_url ?? undefined,
    value: 1,
    penalties: options.penalty ? 1 : 0,
    secondYellowReds: options.secondYellowRed ? 1 : 0,
    matchIds:
      options.matchId !== null && options.matchId !== undefined
        ? new Set([String(options.matchId)])
        : new Set(),
    kind,
  })
}

function buildPlayerLookups(players: PlayerRow[]) {
  const byNameTeamId = new Map<string, PlayerRow>()
  const byNameTeamExternalId = new Map<string, PlayerRow>()
  const byName = new Map<string, PlayerRow[]>()

  for (const player of players) {
    const normalizedName = normalizeLeaderName(player.name)
    if (!normalizedName) continue

    if (player.team_id) {
      byNameTeamId.set(`${normalizedName}:${String(player.team_id)}`, player)
    }

    if (player.team_external_id) {
      byNameTeamExternalId.set(`${normalizedName}:${String(player.team_external_id)}`, player)
    }

    const current = byName.get(normalizedName) ?? []
    current.push(player)
    byName.set(normalizedName, current)
  }

  return {
    byNameTeamId,
    byNameTeamExternalId,
    byName,
    all: players,
  }
}

function nameMatchesLeader(candidateName: string | null | undefined, leaderName: string) {
  const candidate = normalizeLeaderName(candidateName)
  const leader = normalizeLeaderName(leaderName)

  if (!candidate || !leader) return false
  if (candidate === leader) return true
  if (candidate.includes(leader) || leader.includes(candidate)) return true

  const candidateTokens = candidate.split(' ').filter(Boolean)
  const leaderTokens = leader.split(' ').filter(Boolean)
  const candidateLast = candidateTokens[candidateTokens.length - 1]
  const leaderLast = leaderTokens[leaderTokens.length - 1]

  if (!candidateLast || candidateLast !== leaderLast) return false

  const leaderFirst = leaderTokens[0]
  const candidateFirst = candidateTokens[0]

  if (!leaderFirst || !candidateFirst) return false
  if (leaderFirst.length === 1) return candidateFirst.startsWith(leaderFirst)
  if (candidateFirst.length === 1) return leaderFirst.startsWith(candidateFirst)

  return candidateFirst[0] === leaderFirst[0]
}

function getLeaderPlayer(
  leader: EventLeaderAccumulator,
  players: ReturnType<typeof buildPlayerLookups>
) {
  if (leader.teamInternalId) {
    const player = players.byNameTeamId.get(`${leader.normalizedName}:${leader.teamInternalId}`)
    if (player) return player
  }

  if (leader.teamExternalKey) {
    const player = players.byNameTeamExternalId.get(`${leader.normalizedName}:${leader.teamExternalKey}`)
    if (player) return player
  }

  const candidates = players.byName.get(leader.normalizedName) ?? []

  if (candidates.length === 1) return candidates[0]

  const teamScopedCandidates = players.all.filter((player) => {
    const sameTeamId = leader.teamInternalId && String(player.team_id) === leader.teamInternalId
    const sameTeamExternalId =
      leader.teamExternalKey && String(player.team_external_id) === leader.teamExternalKey

    return (sameTeamId || sameTeamExternalId) && nameMatchesLeader(player.name, leader.name)
  })

  if (teamScopedCandidates.length) {
    return teamScopedCandidates.find((player) => player.photo_url) ?? teamScopedCandidates[0]
  }

  const fuzzyCandidates = players.all.filter((player) =>
    nameMatchesLeader(player.name, leader.name)
  )

  return fuzzyCandidates.find((player) => player.photo_url) ?? candidates.find((player) => player.photo_url) ?? null
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getLeaderDetails(leader: EventLeaderAccumulator) {
  if (leader.kind === 'scorers') {
    const base = pluralize(leader.value, 'gol', 'goles')
    return leader.penalties > 0
      ? `${base} · ${pluralize(leader.penalties, 'penal', 'penales')}`
      : base
  }

  if (leader.kind === 'assists') {
    return pluralize(leader.value, 'asistencia', 'asistencias')
  }

  if (leader.kind === 'yellowCards') {
    return pluralize(leader.value, 'amarilla', 'amarillas')
  }

  const base = pluralize(leader.value, 'roja', 'rojas')
  return leader.secondYellowReds > 0
    ? `${base} · ${pluralize(leader.secondYellowReds, 'doble amarilla', 'dobles amarillas')}`
    : base
}

function toRows(
  leaders: Map<string, EventLeaderAccumulator>,
  players: ReturnType<typeof buildPlayerLookups>
): EventStatsTopPlayerRow[] {
  return [...leaders.values()]
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      return a.name.localeCompare(b.name, 'es-AR')
    })
    .map((leader) => {
      const player = getLeaderPlayer(leader, players)

      return {
        playerId: toNumericExternalId(player?.external_id),
        name: leader.name,
        photo: player?.photo_url ?? undefined,
        teamId: leader.teamExternalId,
        teamName: leader.teamName,
        teamLogo: leader.teamLogo,
        value: leader.value,
        details: getLeaderDetails(leader),
        matches: leader.matchIds.size || undefined,
        penalties: leader.penalties || undefined,
        secondYellowReds: leader.secondYellowReds || undefined,
      }
    })
}

export function buildEventStatsLeaders(
  events: MatchEventStatsRow[],
  matchesById: Map<string, MatchRow>,
  teamsById: Map<string, TeamRow>,
  players: PlayerRow[] = []
) {
  const scorers = new Map<string, EventLeaderAccumulator>()
  const assists = new Map<string, EventLeaderAccumulator>()
  const yellowCards = new Map<string, EventLeaderAccumulator>()
  const redCards = new Map<string, EventLeaderAccumulator>()
  const countedRedCards = new Set<string>()
  const playerLookups = buildPlayerLookups(players)
  const dedupedEvents = dedupeRankingEvents(events)

  for (const event of dedupedEvents) {
    const team = getEventTeam(event, matchesById, teamsById)

    if (isValidGoalForScorerTable(event)) {
      addLeader(scorers, getEventPlayerName(event), team, 'scorers', {
        penalty: getGoalKindFromDetail(event.detail) === 'penalty',
        matchId: event.match_id,
      })
    }

    if (isValidAssistForAssistTable(event)) {
      addLeader(assists, getEventAssistName(event), team, 'assists', {
        matchId: event.match_id,
      })
    }

    if (isValidYellowCard(event)) {
      addLeader(yellowCards, getEventPlayerName(event), team, 'yellowCards', {
        matchId: event.match_id,
      })
    }

    if (isValidRedCard(event)) {
      const redKey = [
        event.match_id,
        event.team_id,
        normalizeLeaderName(getEventPlayerName(event)),
      ].join(':')

      if (!countedRedCards.has(redKey)) {
        countedRedCards.add(redKey)
        addLeader(redCards, getEventPlayerName(event), team, 'redCards', {
          secondYellowRed: normalizeFootballEventText(event.detail).includes('second yellow'),
          matchId: event.match_id,
        })
      }
    }
  }

  return {
    scorers: toRows(scorers, playerLookups),
    assists: toRows(assists, playerLookups),
    yellowCards: toRows(yellowCards, playerLookups),
    redCards: toRows(redCards, playerLookups),
  }
}

export async function getLeagueEventStatsLeaders(
  leagueExternalId: number | string,
  season?: number
): Promise<EventStatsLeaders> {
  const supabase = getSupabaseAdminClient()
  const dataset = await fetchLeagueEventStatsDataset(supabase, leagueExternalId, season, {
    includePlayers: false,
  })
  const matchesById = new Map(dataset.matches.map((match) => [String(match.id), match]))
  const dedupedEvents = dedupeRankingEvents(dataset.events)
  const leaders = buildEventStatsLeaders(dedupedEvents, matchesById, dataset.teamsById)

  return {
    scorers: leaders.scorers,
    assists: leaders.assists,
    yellowCards: leaders.yellowCards,
    redCards: leaders.redCards,
    hasEvents: dedupedEvents.length > 0,
    warnings: [],
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

function sumLeaderValues(rows: EventStatsTopPlayerRow[]) {
  return rows.reduce((sum, row) => sum + row.value, 0)
}

function groupEventsByMatchId(events: MatchEventStatsRow[]) {
  return events.reduce<Map<string, MatchEventStatsRow[]>>((accumulator, event) => {
    const matchId = String(event.match_id)
    const current = accumulator.get(matchId) ?? []

    current.push(event)
    accumulator.set(matchId, current)

    return accumulator
  }, new Map())
}

function getExpectedGoals(match: MatchRow) {
  if (match.home_score === null || match.away_score === null) return null

  return match.home_score + match.away_score
}

function getMatchLabel(match: MatchRow, teamsById: Map<string, TeamRow>) {
  const home = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
  const away = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null

  return {
    match_id: match.id,
    external_id: match.external_id,
    round: match.round,
    home: home?.name ?? null,
    away: away?.name ?? null,
    status: match.status,
    match_date: match.match_date,
  }
}

function buildMissingGoalMatches(
  matches: MatchRow[],
  eventsByMatchId: Map<string, MatchEventStatsRow[]>,
  teamsById: Map<string, TeamRow>
) {
  return matches
    .filter((match) => isFinishedStatus(match.status))
    .map((match) => {
      const expectedGoals = getExpectedGoals(match)
      const goalEvents = (eventsByMatchId.get(String(match.id)) ?? []).filter(isValidGoalForScore)

      return {
        ...getMatchLabel(match, teamsById),
        expected_goals: expectedGoals,
        valid_goal_events: goalEvents.length,
        missing_goals:
          expectedGoals === null ? null : Math.max(expectedGoals - goalEvents.length, 0),
      }
    })
    .filter((match) => match.missing_goals !== null && match.missing_goals > 0)
}

function buildCompetitionWarnings(input: {
  leagues: LeagueRow[]
  matches: MatchRow[]
  events: MatchEventStatsRow[]
  finishedMatchesWithoutEvents: number
  matchesWithMissingGoals: number
}) {
  const warnings: string[] = []

  if (!input.leagues.length) warnings.push('No se encontro la competencia en Supabase.')
  if (!input.matches.length) warnings.push('No se encontraron partidos para la competencia en Supabase.')
  if (!input.events.length) warnings.push('No hay eventos cargados en match_events para esta competencia.')
  if (input.finishedMatchesWithoutEvents > 0) {
    warnings.push('Hay partidos finalizados sin eventos en match_events; ejecutar sync-competition-incidents.')
  }
  if (input.matchesWithMissingGoals > 0) {
    warnings.push('Hay partidos finalizados con goles faltantes en match_events.')
  }

  return warnings
}

export async function buildCompetitionIncidentRankings(input: {
  leagueExternalId: number | string
  season?: number
  includeKnockouts?: boolean
}) {
  const supabase = getSupabaseAdminClient()
  const includeKnockouts = input.includeKnockouts ?? true
  const dataset = await fetchLeagueEventStatsDataset(supabase, input.leagueExternalId, input.season)
  const matchesById = new Map(dataset.matches.map((match) => [String(match.id), match]))
  const dedupedEvents = dedupeRankingEvents(dataset.events)
  const leaders = buildEventStatsLeaders(dedupedEvents, matchesById, dataset.teamsById, dataset.players)
  const eventsByMatchId = groupEventsByMatchId(dedupedEvents)
  const finishedMatches = dataset.matches.filter((match) => isFinishedStatus(match.status))
  const matchesWithEvents = new Set(dedupedEvents.map((event) => String(event.match_id)))
  const finishedWithoutEvents = finishedMatches.filter((match) => !matchesWithEvents.has(String(match.id)))
  const matchesWithMissingGoals = buildMissingGoalMatches(
    dataset.matches,
    eventsByMatchId,
    dataset.teamsById
  )
  const scorerGoals = dedupedEvents.filter(isValidGoalForScorerTable)
  const scoreboardGoals = dedupedEvents.filter(isValidGoalForScore)
  const shootoutPenalties = dedupedEvents.filter(isPenaltyShootoutEvent)
  const penaltiesScored = scorerGoals.filter((event) => getGoalKindFromDetail(event.detail) === 'penalty')
  const ownGoals = scoreboardGoals.filter(isOwnGoal)
  const missedPenalties = dedupedEvents.filter(isMissedPenalty)
  const assistEvents = dedupedEvents.filter(isValidAssistForAssistTable)
  const yellowCardEvents = dedupedEvents.filter(isValidYellowCard)
  const redCardEvents = dedupedEvents.filter(isValidRedCard)
  const secondYellowEvents = dedupedEvents.filter(isSecondYellowCardEvent)
  const cancelledGoals = dedupedEvents.filter(isCancelledGoalEvent)
  const cancelledCards = dedupedEvents.filter(isCancelledCardEvent)
  const warnings = buildCompetitionWarnings({
    leagues: dataset.leagues,
    matches: dataset.matches,
    events: dataset.events,
    finishedMatchesWithoutEvents: finishedWithoutEvents.length,
    matchesWithMissingGoals: matchesWithMissingGoals.length,
  })

  return {
    ok: true,
    source: 'supabase_match_events' as const,
    includeKnockouts,
    leagueExternalId: String(input.leagueExternalId),
    requestedSeason: input.season ?? null,
    league: dataset.leagues.map((league) => ({
      id: league.id,
      external_id: league.external_id,
      name: league.name,
      season: league.season ?? null,
    })),
    phasesIncluded: [...new Set(dataset.matches.map((match) => match.round).filter(Boolean))],
    rankings: {
      scorers: leaders.scorers,
      assists: leaders.assists,
      yellowCards: leaders.yellowCards,
      redCards: leaders.redCards,
    },
    counts: {
      matchesTotal: dataset.matches.length,
      matchesFinal: finishedMatches.length,
      matchesWithEvents: matchesWithEvents.size,
      eventsRaw: dataset.events.length,
      eventsDeduped: dedupedEvents.length,
      scoreboardGoals: scoreboardGoals.length,
      scorerGoals: scorerGoals.length,
      penaltiesScored: penaltiesScored.length,
      ownGoalsExcludedFromScorers: ownGoals.length,
      missedPenaltiesExcludedFromScorers: missedPenalties.length,
      shootoutPenaltiesExcludedFromScorers: shootoutPenalties.length,
      assists: assistEvents.length,
      yellowCards: yellowCardEvents.length,
      redCards: redCardEvents.length,
      secondYellowRedCards: secondYellowEvents.length,
      cancelledGoalsExcluded: cancelledGoals.length,
      cancelledCardsExcluded: cancelledCards.length,
    },
    rankingRows: {
      scorers: leaders.scorers.length,
      assists: leaders.assists.length,
      yellowCards: leaders.yellowCards.length,
      redCards: leaders.redCards.length,
    },
    rankingEventSums: {
      scorers: sumLeaderValues(leaders.scorers),
      assists: sumLeaderValues(leaders.assists),
      yellowCards: sumLeaderValues(leaders.yellowCards),
      redCards: sumLeaderValues(leaders.redCards),
    },
    coverage: {
      fullCompetitionQuery: true,
      allPhasesIncluded: includeKnockouts,
      finishedMatchesWithoutEvents: finishedWithoutEvents.length,
      matchesWithMissingGoals: matchesWithMissingGoals.length,
      needsSync:
        finishedWithoutEvents.length > 0 ||
        matchesWithMissingGoals.length > 0,
    },
    problemMatches: {
      finishedWithoutEvents: finishedWithoutEvents.slice(0, 50).map((match) =>
        getMatchLabel(match, dataset.teamsById)
      ),
      matchesWithMissingGoals: matchesWithMissingGoals.slice(0, 50),
    },
    warnings,
  }
}

export async function buildCompetitionIncidentRankingsAudit(input: {
  leagueExternalId: number | string
  season?: number
  includeProvider?: boolean
  onlyProblems?: boolean
  limit?: number
}) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const audit = await buildCompetitionIncidentRankings(input)
  const providerSamples: Array<{
    match: unknown
    providerEvents: number | null
    dbEvents: number
    diagnosis: 'provider-no-events' | 'sync-events-not-persisted' | 'provider-not-checked' | 'provider-error'
    error?: string
  }> = []

  if (input.includeProvider) {
    const problemMatches = [
      ...audit.problemMatches.matchesWithMissingGoals,
      ...audit.problemMatches.finishedWithoutEvents,
    ]
    const checkedExternalIds = new Set<string>()

    for (const match of problemMatches) {
      const externalId = Number(match.external_id)
      if (!Number.isFinite(externalId) || checkedExternalIds.has(String(externalId))) continue
      checkedExternalIds.add(String(externalId))

      if (providerSamples.length >= limit) break

      try {
        const providerCounts = await fetchMatchDetailProviderCounts(externalId, {
          events: true,
          lineups: false,
          statistics: false,
        })
        const dbEvents =
          'valid_goal_events' in match && typeof match.valid_goal_events === 'number'
            ? match.valid_goal_events
            : 0

        providerSamples.push({
          match,
          providerEvents: providerCounts.events,
          dbEvents,
          diagnosis:
            providerCounts.events > 0 && dbEvents === 0
              ? 'sync-events-not-persisted'
              : providerCounts.events === 0
                ? 'provider-no-events'
                : 'provider-not-checked',
        })
      } catch (error) {
        providerSamples.push({
          match,
          providerEvents: null,
          dbEvents: 0,
          diagnosis: 'provider-error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  const providerSummary = {
    checkedMatches: providerSamples.length,
    providerNoEvents: providerSamples.filter((sample) => sample.diagnosis === 'provider-no-events').length,
    syncEventsNotPersisted: providerSamples.filter((sample) => sample.diagnosis === 'sync-events-not-persisted').length,
    providerErrors: providerSamples.filter((sample) => sample.diagnosis === 'provider-error').length,
  }
  const diagnosis = {
    sync:
      audit.coverage.finishedMatchesWithoutEvents > 0 ||
      audit.coverage.matchesWithMissingGoals > 0
        ? 'sync-incomplete'
        : 'complete',
    query: audit.coverage.fullCompetitionQuery ? 'full-competition' : 'partial',
    mapper:
      audit.counts.scorerGoals === audit.rankingEventSums.scorers &&
      audit.counts.assists === audit.rankingEventSums.assists &&
      audit.counts.yellowCards === audit.rankingEventSums.yellowCards
        ? 'complete'
        : 'mapper-missing',
    render: 'top-list-expandable',
  }

  return {
    ...audit,
    onlyProblems: Boolean(input.onlyProblems),
    provider: input.includeProvider
      ? {
          summary: providerSummary,
          samples: providerSamples,
        }
      : null,
    diagnosis,
    problem:
      diagnosis.sync !== 'complete' ||
      diagnosis.mapper !== 'complete' ||
      providerSummary.syncEventsNotPersisted > 0,
  }
}

export async function syncCompetitionIncidents(input: {
  leagueExternalId: number | string
  season?: number
  force?: boolean
  onlyMissing?: boolean
  limit?: number
}) {
  const supabase = getSupabaseAdminClient()
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 300)
  const onlyMissing = input.onlyMissing ?? true
  const dataset = await fetchLeagueEventStatsDataset(supabase, input.leagueExternalId, input.season)
  const dedupedEvents = dedupeRankingEvents(dataset.events)
  const eventsByMatchId = groupEventsByMatchId(dedupedEvents)
  const candidates = dataset.matches
    .filter((match) => isFinishedStatus(match.status))
    .filter((match) => {
      if (input.force && !onlyMissing) return true

      const matchEvents = eventsByMatchId.get(String(match.id)) ?? []
      const expectedGoals = getExpectedGoals(match)
      const goalEvents = matchEvents.filter(isValidGoalForScore)

      return (
        matchEvents.length === 0 ||
        (
          expectedGoals !== null &&
          expectedGoals > goalEvents.length
        ) ||
        Boolean(input.force)
      )
    })
    .sort((a, b) => getMatchDateTimestamp(b.match_date) - getMatchDateTimestamp(a.match_date))
    .slice(0, limit)
  const items: Array<{
    matchId: DbId
    fixtureExternalId: number | null
    status: 'synced' | 'skipped' | 'failed'
    eventsBefore: number
    eventsAfter: number
    providerEvents: number | null
    matchEventsUpserted: number
    warnings: string[]
    errors: unknown[]
  }> = []

  for (const match of candidates) {
    const fixtureExternalId = toNumericExternalId(match.external_id)
    const eventsBefore = (eventsByMatchId.get(String(match.id)) ?? []).length

    if (!fixtureExternalId) {
      items.push({
        matchId: match.id,
        fixtureExternalId: null,
        status: 'skipped',
        eventsBefore,
        eventsAfter: eventsBefore,
        providerEvents: null,
        matchEventsUpserted: 0,
        warnings: ['El partido no tiene external_id numerico.'],
        errors: [],
      })
      continue
    }

    try {
      const result = await syncMatchDetail(supabase, {
        fixtureExternalId,
        matchId: String(match.id),
        sections: {
          fixture: false,
          events: true,
          lineups: false,
          statistics: false,
        },
      })
      const afterEvents = await fetchEventsByMatchIds(supabase, [String(match.id)])

      items.push({
        matchId: match.id,
        fixtureExternalId,
        status: result.errors.length ? 'failed' : 'synced',
        eventsBefore,
        eventsAfter: dedupeRankingEvents(afterEvents).length,
        providerEvents: result.fetched.events,
        matchEventsUpserted: result.matchEventsUpserted,
        warnings: result.warnings,
        errors: result.errors,
      })
    } catch (error) {
      items.push({
        matchId: match.id,
        fixtureExternalId,
        status: 'failed',
        eventsBefore,
        eventsAfter: eventsBefore,
        providerEvents: null,
        matchEventsUpserted: 0,
        warnings: [],
        errors: [serializeError(error, 'unknown')],
      })
    }
  }
  const itemErrors = items
    .filter((item) => item.errors.length > 0)
    .map((item) => ({
      matchId: item.matchId,
      fixtureExternalId: item.fixtureExternalId,
      errors: item.errors,
    }))

  return {
    ok: true,
    leagueExternalId: String(input.leagueExternalId),
    season: input.season ?? null,
    force: Boolean(input.force),
    onlyMissing,
    selected: candidates.length,
    processed: items.length,
    synced: items.filter((item) => item.status === 'synced').length,
    succeeded: items.filter((item) => item.status === 'synced').length,
    failed: items.filter((item) => item.status === 'failed').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    eventsBefore: items.reduce((sum, item) => sum + item.eventsBefore, 0),
    eventsAfter: items.reduce((sum, item) => sum + item.eventsAfter, 0),
    providerEvents: items.reduce((sum, item) => sum + (item.providerEvents ?? 0), 0),
    matchesSynced: items.filter((item) => item.matchEventsUpserted > 0).length,
    eventsUpserted: items.reduce((sum, item) => sum + item.matchEventsUpserted, 0),
    errors: itemErrors,
    sampleErrors: itemErrors.slice(0, 20),
    items,
  }
}

export async function getLeagueEventStatsAudit(
  leagueExternalId: number | string,
  season?: number
) {
  const supabase = getSupabaseAdminClient()
  const dataset = await fetchLeagueEventStatsDataset(supabase, leagueExternalId, season)
  const matchesById = new Map(dataset.matches.map((match) => [String(match.id), match]))
  const dedupedEvents = dedupeRankingEvents(dataset.events)
  const leaders = buildEventStatsLeaders(dataset.events, matchesById, dataset.teamsById, dataset.players)
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
  const scorerGoals = dedupedEvents.filter(isValidGoalForScorerTable)
  const scoreboardGoals = dedupedEvents.filter(isValidGoalForScore)
  const shootoutPenalties = dedupedEvents.filter(isPenaltyShootoutEvent)
  const ownGoals = scoreboardGoals.filter((event) =>
    getGoalKindFromDetail(event.detail) === 'own-goal'
  )
  const yellowCards = dedupedEvents.filter(isValidYellowCard)
  const redCards = dedupedEvents.filter(isValidRedCard)
  const validAssistEvents = dedupedEvents.filter(isValidAssistForAssistTable)
  const missingPlayerEvents = dedupedEvents.filter((event) =>
    (
      isValidGoalForScorerTable(event) ||
      isValidYellowCard(event) ||
      isValidRedCard(event)
    ) && !getEventPlayerName(event)?.trim()
  )
  const eventsByMatchId = dedupedEvents.reduce<Map<string, MatchEventStatsRow[]>>(
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
      const goalEvents = (eventsByMatchId.get(String(match.id)) ?? []).filter(isValidGoalForScore)
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
      shootoutPenaltiesExcludedFromScorers: shootoutPenalties.length,
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
