import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  COPA_ARGENTINA_STAGE_ORDER,
  getCopaArgentinaStageKey,
  getCopaArgentinaStageLabel,
  getLatestActiveCopaArgentinaRound,
  getMatchWinner,
} from '@/shared/utils/copa-argentina'
import { isScoreboardGoalEvent, normalizeFootballEventText } from '@/shared/utils/football-events'

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
  round: string | null
  match_date: string | null
  home_score: number | null
  away_score: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  status: string | null
  home_team_id: DbId | null
  away_team_id: DbId | null
}

type TeamRow = {
  id: DbId
  name: string | null
}

type MatchEventRow = {
  id: DbId
  match_id: DbId
  team_id: DbId | null
  player_name: string | null
  assist_name: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function isMissingPenaltyColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('home_penalty_score') ||
    message.includes('away_penalty_score') ||
    message.includes('schema cache')
  )
}

function isMissingOptionalTable(error: { code?: string; message?: string } | null | undefined, table: string) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes(table) ||
    message.includes('schema cache')
  )
}

function isYellowCardEvent(event: MatchEventRow) {
  const type = normalizeFootballEventText(event.type)
  const detail = normalizeFootballEventText(event.detail)

  return (
    type.includes('card') &&
    detail.includes('yellow') &&
    !detail.includes('second yellow') &&
    !detail.includes('red')
  )
}

function isRedCardEvent(event: MatchEventRow) {
  const type = normalizeFootballEventText(event.type)
  const detail = normalizeFootballEventText(event.detail)

  return (
    type.includes('card') &&
    (
      detail.includes('red') ||
      detail.includes('second yellow') ||
      detail.includes('roja')
    )
  )
}

async function fetchCopaArgentinaLeague(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const response = await supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .limit(500)

  if (response.error) throw response.error

  return ((response.data ?? []) as LeagueRow[])
    .filter((league) =>
      String(league.external_id) === '130' ||
      (league.name ?? '').toLowerCase().includes('copa argentina')
    )
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0] ?? null
}

async function fetchCopaArgentinaMatches(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueId: DbId
) {
  const withPenaltyColumns =
    'id, external_id, round, match_date, home_score, away_score, home_penalty_score, away_penalty_score, status, home_team_id, away_team_id'
  const baseColumns =
    'id, external_id, round, match_date, home_score, away_score, status, home_team_id, away_team_id'
  const primary = await supabase
    .from('matches')
    .select(withPenaltyColumns)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true })

  if (!primary.error) {
    return {
      matches: (primary.data ?? []) as MatchRow[],
      hasPenaltyColumns: true,
    }
  }

  if (!isMissingPenaltyColumn(primary.error)) throw primary.error

  const fallback = await supabase
    .from('matches')
    .select(baseColumns)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true })

  if (fallback.error) throw fallback.error

  return {
    matches: (fallback.data ?? []) as MatchRow[],
    hasPenaltyColumns: false,
  }
}

async function fetchTeams(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  teamIds: string[]
) {
  const teams: TeamRow[] = []

  for (const chunk of chunkArray([...new Set(teamIds)], 100)) {
    const response = await supabase
      .from('teams')
      .select('id, name')
      .in('id', chunk)

    if (response.error) throw response.error
    teams.push(...((response.data ?? []) as TeamRow[]))
  }

  return new Map(teams.map((team) => [String(team.id), team]))
}

async function fetchEvents(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const events: MatchEventRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_events')
      .select('id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
      .in('match_id', chunk)

    if (response.error) {
      if (isMissingOptionalTable(response.error, 'match_events')) return []
      throw response.error
    }

    events.push(...((response.data ?? []) as MatchEventRow[]))
  }

  return events
}

async function fetchChampionsCount(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const response = await supabase
    .from('copa_argentina_champions')
    .select('id', { count: 'exact', head: true })

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'copa_argentina_champions')) return 0
    throw response.error
  }

  return response.count ?? 0
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const league = await fetchCopaArgentinaLeague(supabase)

    if (!league) {
      return NextResponse.json({
        ok: true,
        total_matches: 0,
        message: 'No se encontro Copa Argentina en leagues.',
      })
    }

    const [{ matches, hasPenaltyColumns }, championsLoaded] = await Promise.all([
      fetchCopaArgentinaMatches(supabase, league.id),
      fetchChampionsCount(supabase),
    ])
    const teamIds = [
      ...new Set(
        matches
          .flatMap((match) => [match.home_team_id, match.away_team_id])
          .filter((id): id is DbId => id !== null && id !== undefined)
          .map(String)
      ),
    ]
    const matchIds = matches.map((match) => String(match.id))
    const [teamsById, events] = await Promise.all([
      fetchTeams(supabase, teamIds),
      fetchEvents(supabase, matchIds),
    ])
    const eventsByMatchId = events.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const matchId = String(event.match_id)
      const current = accumulator.get(matchId) ?? []

      current.push(event)
      accumulator.set(matchId, current)

      return accumulator
    }, new Map())
    const roundsDetected = [...new Set(matches.map((match) => match.round || 'Sin ronda'))]
    const matchesByRound = [...matches.reduce<Map<string, MatchRow[]>>((accumulator, match) => {
      const round = match.round || 'Sin ronda'
      const current = accumulator.get(round) ?? []

      current.push(match)
      accumulator.set(round, current)

      return accumulator
    }, new Map()).entries()].map(([round, roundMatches]) => ({
      round,
      matches: roundMatches.length,
    }))
    const phasesExisting = COPA_ARGENTINA_STAGE_ORDER
      .filter((stageKey) =>
        matches.some((match) => getCopaArgentinaStageKey(match.round || '') === stageKey)
      )
      .map((stageKey) => ({
        key: stageKey,
        label: getCopaArgentinaStageLabel(stageKey),
      }))
    const winners = []
    const withoutWinner = []
    const eventsByMatch = []
    const matchesWithoutEventsAlthoughHaveGoals = []

    for (const match of matches) {
      const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
      const awayTeam = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null
      const matchEvents = eventsByMatchId.get(String(match.id)) ?? []
      const goalEvents = matchEvents.filter((event) =>
        isScoreboardGoalEvent(event.type, event.detail)
      )
      const yellowCards = matchEvents.filter(isYellowCardEvent)
      const redCards = matchEvents.filter(isRedCardEvent)
      const winner = getMatchWinner({
        participants: [
          {
            team: homeTeam?.name ?? 'Local',
            teamId: match.home_team_id,
            goals: match.home_score,
          },
          {
            team: awayTeam?.name ?? 'Visitante',
            teamId: match.away_team_id,
            goals: match.away_score,
          },
        ],
        homePenaltyScore: match.home_penalty_score ?? null,
        awayPenaltyScore: match.away_penalty_score ?? null,
      })
      const expectedGoals =
        match.home_score !== null && match.away_score !== null
          ? match.home_score + match.away_score
          : null

      if (winner) {
        winners.push({
          match_id: match.id,
          external_id: match.external_id,
          round: match.round,
          winner: winner.team,
        })
      } else {
        withoutWinner.push({
          match_id: match.id,
          external_id: match.external_id,
          round: match.round,
          home: homeTeam?.name ?? null,
          away: awayTeam?.name ?? null,
          score: {
            home: match.home_score,
            away: match.away_score,
          },
          penalties: {
            home: match.home_penalty_score ?? null,
            away: match.away_penalty_score ?? null,
          },
        })
      }

      if (expectedGoals !== null && expectedGoals > 0 && goalEvents.length === 0) {
        matchesWithoutEventsAlthoughHaveGoals.push({
          match_id: match.id,
          external_id: match.external_id,
          round: match.round,
          home: homeTeam?.name ?? null,
          away: awayTeam?.name ?? null,
          expected_goals: expectedGoals,
          events: matchEvents.length,
        })
      }

      eventsByMatch.push({
        match_id: match.id,
        external_id: match.external_id,
        round: match.round,
        home: homeTeam?.name ?? null,
        away: awayTeam?.name ?? null,
        events: matchEvents.length,
        goals: goalEvents.length,
        yellow_cards: yellowCards.length,
        red_cards: redCards.length,
      })
    }

    return NextResponse.json({
      ok: true,
      league,
      total_matches: matches.length,
      rounds_detected: roundsDetected,
      matches_by_round: matchesByRound,
      matches_with_winner_detected: winners.length,
      matches_without_winner: withoutWinner.length,
      matches_without_winner_sample: withoutWinner.slice(0, 30),
      phases_existing: phasesExisting,
      latest_active_round: getLatestActiveCopaArgentinaRound(
        matches.map((match) => ({
          round: match.round || '',
          date: match.match_date,
          statusShort: match.status,
        }))
      ),
      events_total: events.length,
      events_by_match: eventsByMatch,
      matches_without_events_although_have_goals:
        matchesWithoutEventsAlthoughHaveGoals.length,
      matches_without_events_although_have_goals_sample:
        matchesWithoutEventsAlthoughHaveGoals.slice(0, 30),
      penalties: {
        columns_present: hasPenaltyColumns,
        matches_with_penalties_loaded: matches.filter(
          (match) =>
            match.home_penalty_score !== null &&
            match.home_penalty_score !== undefined &&
            match.away_penalty_score !== null &&
            match.away_penalty_score !== undefined
        ).length,
      },
      champions_loaded: championsLoaded,
      winners_sample: winners.slice(0, 30),
    })
  } catch (error) {
    console.error('[copa-argentina-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar Copa Argentina.',
      },
      { status: 500 }
    )
  }
}
