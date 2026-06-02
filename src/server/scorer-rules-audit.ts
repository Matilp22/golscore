import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  dedupeRankingEvents,
  getEventExtraMinute,
  getEventMinute,
  getEventPlayerName,
  getGoalKindFromDetail,
  isCancelledGoalEvent,
  isMissedPenaltyEvent,
  isPenaltyShootoutEvent,
  isScoreboardGoalEvent,
  isValidGoalForScorerTable,
  type FootballEventLike,
} from '@/shared/utils/football-events'

type DbId = string | number

type LeagueRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  season: number | null
}

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  match_date: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
}

type MatchEventRow = FootballEventLike & {
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

type ScorerRulesAuditInput = {
  leagueExternalId?: string | null
  season?: number | null
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  status?: string | null
  limit?: number | null
}

const PAGE_SIZE = 1000

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function toIsoDateBoundary(date: string, endOfDay = false) {
  return `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
}

function toPositiveLimit(value?: number | null) {
  if (!value || !Number.isFinite(value)) return 500

  return Math.max(1, Math.min(Math.trunc(value), 2000))
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

async function fetchLeagues(leagueExternalId: string, season?: number | null) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('external_id', leagueExternalId)

  if (season) query = query.eq('season', season)

  const { data, error } = await query

  if (error) throw error

  return (data ?? []) as LeagueRow[]
}

async function fetchMatches(input: ScorerRulesAuditInput, leagueIds: string[]) {
  const supabase = getSupabaseAdminClient()
  const limit = toPositiveLimit(input.limit)
  const matches: MatchRow[] = []

  if (leagueIds.length) {
    for (const chunk of chunkArray(leagueIds, 50)) {
      const chunkMatches = await fetchAllByRange<MatchRow>((from, to) => {
        let query = supabase
          .from('matches')
          .select('id, external_id, league_id, match_date, status, home_score, away_score')
          .in('league_id', chunk)
          .order('match_date', { ascending: false, nullsFirst: false })
          .range(from, to)

        if (input.status) query = query.eq('status', input.status)
        if (input.date) {
          query = query
            .gte('match_date', toIsoDateBoundary(input.date))
            .lte('match_date', toIsoDateBoundary(input.date, true))
        } else {
          if (input.dateFrom) query = query.gte('match_date', toIsoDateBoundary(input.dateFrom))
          if (input.dateTo) query = query.lte('match_date', toIsoDateBoundary(input.dateTo, true))
        }

        return query
      })

      matches.push(...chunkMatches)
    }

    return matches.slice(0, limit)
  }

  let query = supabase
    .from('matches')
    .select('id, external_id, league_id, match_date, status, home_score, away_score')
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (input.status) query = query.eq('status', input.status)
  if (input.date) {
    query = query
      .gte('match_date', toIsoDateBoundary(input.date))
      .lte('match_date', toIsoDateBoundary(input.date, true))
  } else {
    if (input.dateFrom) query = query.gte('match_date', toIsoDateBoundary(input.dateFrom))
    if (input.dateTo) query = query.lte('match_date', toIsoDateBoundary(input.dateTo, true))
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []) as MatchRow[]
}

async function fetchEvents(matchIds: string[]) {
  const supabase = getSupabaseAdminClient()
  const events: MatchEventRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const chunkEvents = await fetchAllByRange<MatchEventRow>(async (from, to) => {
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

function serializeEvent(event: MatchEventRow) {
  return {
    id: event.id,
    external_event_id: event.external_event_id,
    match_id: event.match_id,
    team_id: event.team_id,
    player: getEventPlayerName(event),
    minute: getEventMinute(event),
    extra_minute: getEventExtraMinute(event),
    type: event.type,
    detail: event.detail,
    comments: event.comments ?? null,
  }
}

export async function buildScorerRulesAudit(input: ScorerRulesAuditInput = {}) {
  const leagues = input.leagueExternalId
    ? await fetchLeagues(input.leagueExternalId, input.season)
    : []
  const matches = await fetchMatches(input, leagues.map((league) => String(league.id)))
  const events = matches.length ? await fetchEvents(matches.map((match) => String(match.id))) : []
  const dedupedEvents = dedupeRankingEvents(events)
  const rawScoreboardGoals = dedupedEvents.filter((event) =>
    isScoreboardGoalEvent(event.type, event.detail)
  )
  const validScorerGoals = dedupedEvents.filter(isValidGoalForScorerTable)
  const ownGoalsExcluded = rawScoreboardGoals.filter((event) =>
    getGoalKindFromDetail(event.detail) === 'own-goal'
  )
  const missedPenaltiesExcluded = dedupedEvents.filter(isMissedPenaltyEvent)
  const cancelledGoalsExcluded = dedupedEvents.filter(isCancelledGoalEvent)
  const shootoutPenaltiesExcluded = dedupedEvents.filter(isPenaltyShootoutEvent)
  const suspiciousIncludedShootouts = shootoutPenaltiesExcluded.filter(isValidGoalForScorerTable)
  const warnings: string[] = []

  if (input.leagueExternalId && !leagues.length) {
    warnings.push('No se encontró la liga solicitada en Supabase.')
  }

  if (!matches.length) {
    warnings.push('No se encontraron partidos para el alcance solicitado.')
  }

  if (suspiciousIncludedShootouts.length) {
    warnings.push('Hay goles de tanda que siguen entrando en tabla de goleadores.')
  }

  return {
    ok: suspiciousIncludedShootouts.length === 0,
    scope: {
      leagueExternalId: input.leagueExternalId ?? null,
      season: input.season ?? null,
      date: input.date ?? null,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
      status: input.status ?? null,
      limit: toPositiveLimit(input.limit),
    },
    leagues: leagues.map((league) => ({
      id: league.id,
      external_id: league.external_id,
      name: league.name,
      season: league.season,
    })),
    counts: {
      matchesChecked: matches.length,
      eventsRaw: events.length,
      eventsDeduped: dedupedEvents.length,
      rawScoreboardGoals: rawScoreboardGoals.length,
      validScorerGoals: validScorerGoals.length,
      ownGoalsExcludedFromScorers: ownGoalsExcluded.length,
      missedPenaltiesExcludedFromScorers: missedPenaltiesExcluded.length,
      cancelledGoalsExcludedFromScorers: cancelledGoalsExcluded.length,
      shootoutPenaltiesExcludedFromScorers: shootoutPenaltiesExcluded.length,
      suspiciousShootoutGoalsIncluded: suspiciousIncludedShootouts.length,
    },
    rules: {
      countNormalGoal: true,
      countPenaltyDuringMatch: true,
      countShootoutPenalty: false,
      countOwnGoalForPlayer: false,
      countMissedPenalty: false,
      countCancelledGoal: false,
    },
    samples: {
      validScorerGoals: validScorerGoals.slice(0, 20).map(serializeEvent),
      shootoutPenaltiesExcluded: shootoutPenaltiesExcluded.slice(0, 20).map(serializeEvent),
      ownGoalsExcluded: ownGoalsExcluded.slice(0, 20).map(serializeEvent),
      missedPenaltiesExcluded: missedPenaltiesExcluded.slice(0, 20).map(serializeEvent),
      cancelledGoalsExcluded: cancelledGoalsExcluded.slice(0, 20).map(serializeEvent),
      suspiciousIncludedShootouts: suspiciousIncludedShootouts.slice(0, 20).map(serializeEvent),
    },
    warnings,
  }
}
