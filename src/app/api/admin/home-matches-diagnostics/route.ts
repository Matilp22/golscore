import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getMatchesByDate } from '@/lib/api-football'
import { TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'
import {
  getExcludedCompetitionReason,
  isExcludedCompetition,
} from '@/shared/utils/competition-filter'
import { getArgentinaTodayISO } from '@/shared/utils/argentina-time'
import { formatEventMinute } from '@/shared/utils/event-minute'
import { isScoreboardGoalEvent } from '@/shared/utils/football-events'

type MatchRow = {
  id: string | number
  external_id: string | number | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  league_id: string | number | null
  home_score: number | null
  away_score: number | null
  status: string | null
}

type MatchEventRow = {
  match_id: string | number
  team_id: string | number | null
  player_name: string
  minute: number
  extra_minute: number | null
  type: string
  detail: string | null
}

type MatchBroadcastRow = {
  match_id: string | number
  broadcaster_name: string
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function containsNormalizedPhrase(value: string, phrase: string) {
  if (!value || !phrase) return false

  return ` ${value} `.includes(` ${phrase} `)
}

function getScorerAuditState(params: {
  existsInSupabase: boolean
  expectedGoals: number | null
  goalEventsCount: number
}) {
  if (!params.existsInSupabase) return 'MISSING_MATCH'
  if (params.expectedGoals === null) return 'PENDING'
  if (params.expectedGoals === 0) return 'NO_GOALS'
  if (params.goalEventsCount < params.expectedGoals) return 'INCOMPLETE_EVENTS'
  return 'OK'
}

function isVisibleHomeCompetition(match: Awaited<ReturnType<typeof getMatchesByDate>>[number]) {
  const excludedReason = getExcludedCompetitionReason({
    league: match.league,
    leagueName: match.league,
    country: match.country,
    home: match.home,
    away: match.away,
  })

  if (excludedReason) return false

  return TOURNAMENT_PAGE_CONFIGS.some((tournament) => {
    if (isExcludedCompetition(tournament)) return false

    const country = normalizeText(match.country)
    const tournamentCountry = normalizeText(tournament.country)
    const countryMatches =
      !tournamentCountry ||
      tournamentCountry === country ||
      tournamentCountry === 'world'

    if (!countryMatches) return false

    const league = normalizeText(match.league)

    return tournament.searchTerms.some((term) => {
      const normalizedTerm = normalizeText(term)

      return league === normalizedTerm || containsNormalizedPhrase(league, normalizedTerm)
    })
  })
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getArgentinaTodayISO()
    const supabase = getSupabaseAdminClient()
    const apiMatches = await getMatchesByDate(date)
    const visibleMatches = apiMatches.filter(isVisibleHomeCompetition)
    const externalIds = [
      ...new Set(
        visibleMatches
          .map((match) => match.externalId ?? match.id)
          .filter((id) => Number.isFinite(id))
      ),
    ]
    const externalIdsForQuery = [
      ...new Set(externalIds.flatMap((id) => [id, String(id)])),
    ]
    const matchRows: MatchRow[] = []

    for (const chunk of chunkArray(externalIdsForQuery, 100)) {
      const response = await supabase
        .from('matches')
        .select('id, external_id, home_team_id, away_team_id, league_id, home_score, away_score, status')
        .in('external_id', chunk)

      if (response.error) throw response.error

      matchRows.push(...((response.data ?? []) as MatchRow[]))
    }

    const matchRowsByExternalId = new Map(
      matchRows
        .filter((row) => row.external_id !== null)
        .map((row) => [String(row.external_id), row])
    )
    const internalMatchIds = [...new Set(matchRows.map((row) => String(row.id)))]
    const eventRows: MatchEventRow[] = []
    const broadcastRows: MatchBroadcastRow[] = []

    for (const chunk of chunkArray(internalMatchIds, 100)) {
      const response = await supabase
        .from('match_events')
        .select('match_id, team_id, player_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)

      if (response.error) throw response.error

      eventRows.push(...((response.data ?? []) as MatchEventRow[]))
    }

    for (const chunk of chunkArray(internalMatchIds, 100)) {
      const response = await supabase
        .from('match_broadcasts')
        .select('match_id, broadcaster_name')
        .in('match_id', chunk)

      if (response.error) {
        const message = response.error.message.toLowerCase()
        const missingOptionalBroadcasts =
          response.error.code === '42P01' ||
          response.error.code === 'PGRST205' ||
          message.includes('match_broadcasts') ||
          message.includes('schema cache')

        if (!missingOptionalBroadcasts) throw response.error
      } else {
        broadcastRows.push(...((response.data ?? []) as MatchBroadcastRow[]))
      }
    }

    const eventsByMatchId = eventRows.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const matchId = String(event.match_id)
      const current = accumulator.get(matchId) ?? []
      current.push(event)
      accumulator.set(matchId, current)

      return accumulator
    }, new Map())
    const broadcastersByMatchId = broadcastRows.reduce<Map<string, MatchBroadcastRow[]>>(
      (accumulator, broadcast) => {
        const matchId = String(broadcast.match_id)
        const current = accumulator.get(matchId) ?? []
        current.push(broadcast)
        accumulator.set(matchId, current)

        return accumulator
      },
      new Map()
    )
    const diagnostics = visibleMatches.map((match) => {
      const externalId = match.externalId ?? match.id
      const matchRow = matchRowsByExternalId.get(String(externalId)) ?? null
      const events = matchRow ? eventsByMatchId.get(String(matchRow.id)) ?? [] : []
      const goalEvents = events.filter((event) =>
        isScoreboardGoalEvent(event.type, event.detail)
      )
      const broadcasterRows = matchRow
        ? broadcastersByMatchId.get(String(matchRow.id)) ?? []
        : []
      const visibleHomeScore = match.goalsHome
      const visibleAwayScore = match.goalsAway
      const storedHomeScore = matchRow?.home_score ?? null
      const storedAwayScore = matchRow?.away_score ?? null
      const expectedGoals =
        visibleHomeScore !== null && visibleAwayScore !== null
          ? visibleHomeScore + visibleAwayScore
          : storedHomeScore !== null && storedAwayScore !== null
            ? storedHomeScore + storedAwayScore
            : null
      const missingGoalEvents =
        expectedGoals === null ? null : expectedGoals - goalEvents.length
      const state = getScorerAuditState({
        existsInSupabase: Boolean(matchRow),
        expectedGoals,
        goalEventsCount: goalEvents.length,
      })

      return {
        home: match.home,
        away: match.away,
        visibleHomeTeam: match.home,
        visibleAwayTeam: match.away,
        league: match.league,
        date: match.date,
        status: match.statusShort,
        visible_score: {
          home: match.goalsHome,
          away: match.goalsAway,
        },
        external_id: externalId,
        visibleExternalId: externalId,
        home_team_external_id: match.homeId ?? null,
        away_team_external_id: match.awayId ?? null,
        exists_in_supabase: Boolean(matchRow),
        existsInSupabase: Boolean(matchRow),
        internal_match_id: matchRow?.id ?? null,
        supabaseMatchId: matchRow?.id ?? null,
        home_team_id: matchRow?.home_team_id ?? null,
        away_team_id: matchRow?.away_team_id ?? null,
        stored_score: matchRow
          ? {
              home: matchRow.home_score,
              away: matchRow.away_score,
              status: matchRow.status,
            }
          : null,
        events_count: events.length,
        goal_events_count: goalEvents.length,
        goalEventsCount: goalEvents.length,
        expected_goals: expectedGoals,
        expectedGoals,
        missing_goals: missingGoalEvents,
        missingGoalEvents,
        state,
        broadcastersCount: broadcasterRows.length,
        has_score_without_goal_events:
          expectedGoals !== null && expectedGoals > 0 && goalEvents.length === 0,
        hasIncompleteScorers:
          matchRow !== null && missingGoalEvents !== null && missingGoalEvents > 0,
        events: goalEvents.map((event) => ({
          team_id: event.team_id,
          minute: formatEventMinute(event.minute, event.extra_minute),
          player: event.player_name,
          type: event.type,
          detail: event.detail,
        })),
      }
    })
    const missing = diagnostics.filter((match) => !match.exists_in_supabase)
    const withEvents = diagnostics.filter((match) => match.goal_events_count > 0)
    const withScoreWithoutEvents = diagnostics.filter(
      (match) => match.has_score_without_goal_events
    )
    const incompleteScorers = diagnostics.filter(
      (match) => match.exists_in_supabase && match.hasIncompleteScorers
    )
    const stateCounts = diagnostics.reduce<Record<string, number>>((accumulator, match) => {
      accumulator[match.state] = (accumulator[match.state] ?? 0) + 1
      return accumulator
    }, {})

    return NextResponse.json({
      ok: true,
      date,
      states: stateCounts,
      visible_count: diagnostics.length,
      exists_in_supabase: diagnostics.length - missing.length,
      missing_in_supabase: missing.length,
      with_events: withEvents.length,
      with_score_without_goal_events: withScoreWithoutEvents.length,
      matches_with_complete_scorers:
        diagnostics.length - missing.length - incompleteScorers.length,
      incomplete_scorers_count: incompleteScorers.length,
      visible_matches: diagnostics,
      missing_matches: missing,
      matches_with_events: withEvents,
      matches_with_score_without_goal_events: withScoreWithoutEvents,
      matches_with_incomplete_scorers: incompleteScorers,
    })
  } catch (error) {
    console.error('[home-matches-diagnostics] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo diagnosticar partidos del Home.',
      },
      { status: 500 }
    )
  }
}
