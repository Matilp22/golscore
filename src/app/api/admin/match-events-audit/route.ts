import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { serializeError } from '@/server/match-detail-cache'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'
import {
  dedupeTimelineEvents,
  getMatchEventDedupeKey,
  getEventAssistName,
  getEventPlayerName,
  getEventTeamId,
  normalizeFootballEventText,
  normalizeMatchEvent,
  type FootballEventLike,
} from '@/shared/utils/football-events'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  status: string | null
  match_date: string | null
}

type MatchEventRow = {
  id: DbId
  external_event_id?: string | null
  match_id: DbId
  team_id: DbId | null
  player_name: string | null
  assist_name?: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
  comments?: string | null
}

type TeamRow = {
  id: DbId
  name: string | null
}

type LeagueRow = {
  id: DbId
  name: string | null
  external_id: DbId | null
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function eventToLike(event: MatchEventRow): FootballEventLike {
  return {
    id: event.id,
    external_event_id: event.external_event_id,
    match_id: event.match_id,
    team_id: event.team_id,
    player_name: event.player_name,
    assist_name: event.assist_name,
    time: {
      elapsed: event.minute,
      extra: event.extra_minute,
    },
    team: event.team_id !== null && event.team_id !== undefined
      ? { id: event.team_id }
      : null,
    player: event.player_name ? { name: event.player_name } : null,
    assist: event.assist_name ? { name: event.assist_name } : null,
    type: event.type,
    detail: event.detail,
    comments: event.comments ?? null,
  }
}

function getEventDedupeKey(event: MatchEventRow) {
  return getMatchEventDedupeKey(eventToLike(event), event.match_id)
}

function getIncidentLikeKey(event: FootballEventLike) {
  const normalized = normalizeMatchEvent(event)

  return [
    normalized.teamId ?? getEventTeamId(event) ?? 'team',
    normalized.playerRole,
    normalized.kind,
    normalized.minute ?? 'minute',
    normalized.extraMinute ?? 'no-extra',
    normalizeFootballEventText(normalized.playerName),
  ].join(':')
}

function incidentLikeSample(event: FootballEventLike) {
  return {
    id: event.id,
    minute: event.time?.elapsed ?? null,
    extraMinute: event.time?.extra ?? null,
    teamId: getEventTeamId(event),
    playerName: getEventPlayerName(event),
    assistName: getEventAssistName(event),
    type: event.type ?? null,
    detail: event.detail ?? null,
  }
}

function groupDuplicates<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>()

  for (const item of items) {
    const key = getKey(item)
    const group = grouped.get(key) ?? []
    group.push(item)
    grouped.set(key, group)
  }

  return [...grouped.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, events: group }))
}

function classifyDuplicateGroups(groups: Array<{ events: MatchEventRow[] }>) {
  return groups.reduce(
    (totals, group) => {
      const kind = normalizeMatchEvent(eventToLike(group.events[0])).kind
      const duplicates = group.events.length - 1

      if (kind === 'goal' || kind === 'penalty-goal' || kind === 'own-goal') {
        totals.goals += duplicates
      } else if (kind === 'yellow-card' || kind === 'red-card' || kind === 'second-yellow') {
        totals.cards += duplicates
      } else if (kind === 'substitution') {
        totals.substitutions += duplicates
      } else if (kind === 'var') {
        totals.var += duplicates
      }

      return totals
    },
    {
      goals: 0,
      cards: 0,
      substitutions: 0,
      var: 0,
    }
  )
}

async function resolveLeagueIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueExternalId: number | null
) {
  if (!leagueExternalId) return null

  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', String(leagueExternalId))

  if (response.error) throw response.error

  return (response.data ?? []).map((league) => String(league.id))
}

async function fetchRowsByIds<T>(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  table: string,
  select: string,
  ids: string[]
) {
  const rows: T[] = []

  for (const chunk of chunkArray([...new Set(ids)], 100)) {
    const response = await supabase.from(table).select(select).in('id', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as T[]))
  }

  return rows
}

async function fetchMatches(input: {
  fixture: number | null
  matchId: string | null
  dateFrom: string | null
  dateTo: string | null
  leagueExternalId: number | null
  limit: number
}) {
  const supabase = getSupabaseAdminClient()
  const leagueIds = await resolveLeagueIds(supabase, input.leagueExternalId)

  let query = supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, status, match_date')
    .not('external_id', 'is', null)
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(input.limit)

  if (input.fixture) query = query.eq('external_id', String(input.fixture))
  if (input.matchId) query = query.eq('id', input.matchId)

  if (!input.fixture && !input.matchId) {
    if (input.dateFrom) query = query.gte('match_date', input.dateFrom)
    if (input.dateTo) query = query.lte('match_date', input.dateTo)
    if (leagueIds) {
      if (!leagueIds.length) return { supabase, matches: [] as MatchRow[] }
      query = query.in('league_id', leagueIds)
    }
  }

  const response = await query
  if (response.error) throw response.error

  return {
    supabase,
    matches: (response.data ?? []) as MatchRow[],
  }
}

async function fetchEvents(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const events: MatchEventRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_events')
      .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
      .in('match_id', chunk)

    if (response.error) {
      const fallback = await supabase
        .from('match_events')
        .select('id, match_id, team_id, player_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)

      if (fallback.error) throw fallback.error
      events.push(...((fallback.data ?? []) as MatchEventRow[]))
      continue
    }

    events.push(...((response.data ?? []) as MatchEventRow[]))
  }

  return events
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fixture = readNumber(searchParams.get('fixture'))
    const matchId = searchParams.get('matchId') ?? searchParams.get('match_id')
    const leagueExternalId = readNumber(searchParams.get('leagueExternalId'))
    const onlyProblems = readBoolean(searchParams.get('onlyProblems'))
    const limit = Math.min(Math.max(readNumber(searchParams.get('limit')) ?? 100, 1), 500)
    const range = readDateRange(searchParams)
    const { supabase, matches } = await fetchMatches({
      fixture,
      matchId,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      leagueExternalId,
      limit,
    })
    const matchIds = matches.map((match) => String(match.id))
    const events = await fetchEvents(supabase, matchIds)
    const teamIds = matches
      .flatMap((match) => [match.home_team_id, match.away_team_id])
      .filter((id): id is DbId => id !== null && id !== undefined)
      .map(String)
    const leagueIds = matches
      .map((match) => match.league_id)
      .filter((id): id is DbId => id !== null && id !== undefined)
      .map(String)
    const [teams, leagues] = await Promise.all([
      fetchRowsByIds<TeamRow>(supabase, 'teams', 'id, name', teamIds),
      fetchRowsByIds<LeagueRow>(supabase, 'leagues', 'id, name, external_id', leagueIds),
    ])
    const teamsById = new Map(teams.map((team) => [String(team.id), team]))
    const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
    const eventsByMatchId = events.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const key = String(event.match_id)
      const current = accumulator.get(key) ?? []

      current.push(event)
      accumulator.set(key, current)

      return accumulator
    }, new Map())
    const matchesAudit = matches.map((match) => {
      const matchEvents = eventsByMatchId.get(String(match.id)) ?? []
      const duplicateGroups = groupDuplicates(matchEvents, getEventDedupeKey)
      const renderedIncidentEvents = dedupeTimelineEvents(
        matchEvents.map(eventToLike),
        {
          descending: false,
          matchId: match.id,
          semanticDedupe: true,
        }
      )
      const incidentGroups = groupDuplicates(renderedIncidentEvents, getIncidentLikeKey)
      const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.events.length - 1, 0)
      const playerIncidentDuplicates = incidentGroups.reduce((sum, group) => sum + group.events.length - 1, 0)
      const duplicateKinds = classifyDuplicateGroups(duplicateGroups)
      const league = match.league_id === null ? null : leaguesById.get(String(match.league_id))
      const home = match.home_team_id === null ? null : teamsById.get(String(match.home_team_id))
      const away = match.away_team_id === null ? null : teamsById.get(String(match.away_team_id))

      return {
        fixtureExternalId: match.external_id,
        matchId: match.id,
        league: league
          ? {
              id: league.id,
              externalId: league.external_id,
              name: league.name,
            }
          : null,
        home: home?.name ?? null,
        away: away?.name ?? null,
        status: match.status,
        matchDate: match.match_date,
        eventsCount: matchEvents.length,
        uniqueEventsCount: matchEvents.length - duplicateCount,
        duplicateCount,
        duplicateGroups: duplicateGroups.length,
        duplicatedGoals: duplicateKinds.goals,
        duplicatedCards: duplicateKinds.cards,
        duplicatedSubstitutions: duplicateKinds.substitutions,
        duplicatedVar: duplicateKinds.var,
        playerIncidentDuplicates,
        duplicateSamples: duplicateGroups.slice(0, 5).map((group) => ({
          key: group.key,
          events: group.events.map((event) => ({
            id: event.id,
            externalEventId: event.external_event_id ?? null,
            minute: event.minute,
            extraMinute: event.extra_minute,
            teamId: event.team_id,
            playerName: event.player_name,
            assistName: event.assist_name ?? null,
            type: event.type,
            detail: event.detail,
          })),
        })),
        playerIncidentDuplicateSamples: incidentGroups.slice(0, 5).map((group) => ({
          key: group.key,
          events: group.events.map(incidentLikeSample),
        })),
      }
    })
    const problemMatches = matchesAudit.filter((match) =>
      match.duplicateCount > 0 ||
      match.playerIncidentDuplicates > 0
    )
    const returnedMatches = onlyProblems ? problemMatches : matchesAudit
    const totalEvents = matchesAudit.reduce((sum, match) => sum + match.eventsCount, 0)
    const duplicateEvents = matchesAudit.reduce((sum, match) => sum + match.duplicateCount, 0)

    return jsonNoStore({
      ok: true,
      filters: {
        fixture,
        matchId,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        leagueExternalId,
        onlyProblems,
        limit,
      },
      matchesChecked: matchesAudit.length,
      totalEvents,
      uniqueEvents: totalEvents - duplicateEvents,
      duplicateEvents,
      duplicateGroups: matchesAudit.reduce((sum, match) => sum + match.duplicateGroups, 0),
      examples: problemMatches.slice(0, 10),
      matches: returnedMatches,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-events-audit] Error completo', serialized)

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
