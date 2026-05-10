import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getMatchDetail, type MatchLineup } from '@/lib/api-football'
import { getMatchWinner } from '@/shared/utils/copa-argentina'
import {
  getLeagueFinalPhaseKey,
  getLeagueRoundLabel,
  isLigaProfesionalKnockoutRound,
  isLigaProfesionalRegularSeasonRound,
} from '@/shared/utils/league-rounds'
import { normalizeFootballEventText, translateMatchEventDetail } from '@/shared/utils/football-events'
import { getEventElapsedMinute } from '@/shared/utils/match-minute'

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
  status: string | null
  elapsed?: number | null
  final_elapsed?: number | null
  home_score: number | null
  away_score: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
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
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
  comments?: string | null
}

function getAuthorizationError(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no esta configurado.' },
      { status: 401 }
    )
  }

  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  return null
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function isMissingOptionalColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('column')
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

async function fetchLigaProfesionalLeague(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const response = await supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .limit(500)

  if (response.error) throw response.error

  return ((response.data ?? []) as LeagueRow[])
    .filter((league) =>
      String(league.external_id) === '128' ||
      (league.name ?? '').toLowerCase().includes('liga profesional')
    )
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0] ?? null
}

async function fetchLigaMatches(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueId: DbId
) {
  const withAllOptional =
    'id, external_id, round, match_date, status, elapsed, final_elapsed, home_score, away_score, home_penalty_score, away_penalty_score, home_team_id, away_team_id'
  const withoutFinalElapsed =
    'id, external_id, round, match_date, status, elapsed, home_score, away_score, home_penalty_score, away_penalty_score, home_team_id, away_team_id'
  const baseColumns =
    'id, external_id, round, match_date, status, home_score, away_score, home_team_id, away_team_id'

  const primary = await supabase
    .from('matches')
    .select(withAllOptional)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true })

  if (!primary.error) {
    return {
      matches: (primary.data ?? []) as MatchRow[],
      columns: { elapsed: true, finalElapsed: true, penalties: true },
    }
  }

  if (!isMissingOptionalColumn(primary.error)) throw primary.error

  const secondary = await supabase
    .from('matches')
    .select(withoutFinalElapsed)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true })

  if (!secondary.error) {
    return {
      matches: (secondary.data ?? []) as MatchRow[],
      columns: { elapsed: true, finalElapsed: false, penalties: true },
    }
  }

  if (!isMissingOptionalColumn(secondary.error)) throw secondary.error

  const fallback = await supabase
    .from('matches')
    .select(baseColumns)
    .eq('league_id', leagueId)
    .order('match_date', { ascending: true })

  if (fallback.error) throw fallback.error

  return {
    matches: (fallback.data ?? []) as MatchRow[],
    columns: { elapsed: false, finalElapsed: false, penalties: false },
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
      .select('id, match_id, team_id, player_name, minute, extra_minute, type, detail')
      .in('match_id', chunk)

    if (response.error) {
      if (isMissingOptionalTable(response.error, 'match_events')) return []
      throw response.error
    }

    events.push(...((response.data ?? []) as MatchEventRow[]))
  }

  return events
}

function serializeRounds(matches: MatchRow[]) {
  const rounds = new Map<string, { round: string; matches: number; regular: number; knockout: number }>()

  for (const match of matches) {
    const round = match.round?.trim() || 'Sin ronda'
    const current = rounds.get(round) ?? {
      round,
      matches: 0,
      regular: 0,
      knockout: 0,
    }

    current.matches += 1
    if (isLigaProfesionalRegularSeasonRound(match.round)) current.regular += 1
    if (isLigaProfesionalKnockoutRound(match.round)) current.knockout += 1
    rounds.set(round, current)
  }

  return [...rounds.values()].map((entry) => ({
    ...entry,
    label: getLeagueRoundLabel(entry.round, 128),
    finalPhaseKey: getLeagueFinalPhaseKey(entry.round),
    excludedFromTables: entry.knockout > 0,
  }))
}

function getWinnerForAudit(match: MatchRow, teamsById: Map<string, TeamRow>) {
  const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
  const awayTeam = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null
  const winner = getMatchWinner({
    homePenaltyScore: match.home_penalty_score ?? null,
    awayPenaltyScore: match.away_penalty_score ?? null,
    participants: [
      {
        team: homeTeam?.name || 'Local',
        teamId: match.home_team_id,
        goals: match.home_score,
      },
      {
        team: awayTeam?.name || 'Visitante',
        teamId: match.away_team_id,
        goals: match.away_score,
      },
    ],
  })

  return winner
    ? {
        team: winner.team,
        teamId: winner.teamId ?? null,
      }
    : null
}

function serializeWinners(matches: MatchRow[], teamsById: Map<string, TeamRow>) {
  return matches
    .filter((match) => isLigaProfesionalKnockoutRound(match.round))
    .map((match) => {
      const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
      const awayTeam = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null

      return {
        fixtureId: match.external_id ?? match.id,
        round: match.round,
        phase: getLeagueRoundLabel(match.round, 128),
        home: homeTeam?.name ?? null,
        away: awayTeam?.name ?? null,
        score: match.home_score !== null && match.away_score !== null
          ? `${match.home_score}-${match.away_score}`
          : null,
        penalties:
          match.home_penalty_score !== null &&
          match.home_penalty_score !== undefined &&
          match.away_penalty_score !== null &&
          match.away_penalty_score !== undefined
            ? `${match.home_penalty_score}-${match.away_penalty_score}`
            : null,
        winner: getWinnerForAudit(match, teamsById),
      }
    })
}

function serializeElapsed(matches: MatchRow[], eventsByMatchId: Map<string, MatchEventRow[]>) {
  return matches.map((match) => {
    const maxEventElapsed = (eventsByMatchId.get(String(match.id)) ?? []).reduce<number | null>(
      (maxMinute, event) => {
        const eventMinute = getEventElapsedMinute(event.minute, event.extra_minute)

        if (eventMinute === null) return maxMinute
        if (maxMinute === null) return eventMinute

        return Math.max(maxMinute, eventMinute)
      },
      null
    )

    return {
      fixtureId: match.external_id ?? match.id,
      status: match.status,
      elapsed: match.elapsed ?? null,
      final_elapsed: match.final_elapsed ?? null,
      computedFinalElapsed:
        ['FT', 'AET', 'PEN'].includes(match.status ?? '')
          ? Math.max(match.elapsed ?? 0, match.final_elapsed ?? 0, maxEventElapsed ?? 0) || null
          : null,
      maxEventElapsed,
    }
  })
}

function serializeVarEvents(events: MatchEventRow[], matchesById: Map<string, MatchRow>) {
  return events
    .map((event) => {
      const normalized = [
        normalizeFootballEventText(event.type),
        normalizeFootballEventText(event.detail),
        normalizeFootballEventText(event.comments),
      ].join(' ')
      const translated = translateMatchEventDetail(event.type, event.detail, event.comments)
      const isVarLike =
        Boolean(translated) ||
        normalized.includes('var') ||
        normalized.includes('cancelled') ||
        normalized.includes('canceled') ||
        normalized.includes('disallowed')

      if (!isVarLike) return null

      const match = matchesById.get(String(event.match_id))

      return {
        fixtureId: match?.external_id ?? event.match_id,
        minute: event.minute,
        extraMinute: event.extra_minute,
        type: event.type,
        detail: event.detail,
        translated: translated ?? 'Revisión VAR',
        playerName: event.player_name,
      }
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
}

function isCaptainFlag(value: boolean | string | undefined) {
  if (value === true) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === 'yes' || normalized === '1'
}

function getCaptainsFromLineups(lineups: MatchLineup[]) {
  return lineups.flatMap((lineup) =>
    (lineup.startXI ?? [])
      .filter((playerWrap) =>
        isCaptainFlag(playerWrap.captain) ||
        isCaptainFlag(playerWrap.player?.captain)
      )
      .map((playerWrap) => ({
        team: lineup.team?.name ?? null,
        playerId: playerWrap.player?.id ?? null,
        playerName: playerWrap.player?.name ?? null,
      }))
  )
}

async function fetchCaptainSamples(matches: MatchRow[], limit: number) {
  const sampleMatches = matches
    .filter((match) => match.external_id !== null && match.external_id !== undefined)
    .slice(0, limit)

  const samples = []

  for (const match of sampleMatches) {
    try {
      const detail = await getMatchDetail(Number(match.external_id))
      const lineups = Array.isArray(detail.lineups) ? detail.lineups : []

      samples.push({
        fixtureId: match.external_id,
        captains: getCaptainsFromLineups(lineups),
      })
    } catch (error) {
      samples.push({
        fixtureId: match.external_id,
        captains: [],
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return samples
}

export async function GET(request: Request) {
  const authorizationError = getAuthorizationError(request)

  if (authorizationError) return authorizationError

  try {
    const supabase = getSupabaseAdminClient()
    const url = new URL(request.url)
    const captainSampleLimit = Math.max(
      0,
      Math.min(20, Number(url.searchParams.get('captainLimit') ?? 8) || 0)
    )
    const league = await fetchLigaProfesionalLeague(supabase)

    if (!league) {
      return NextResponse.json({
        ok: true,
        message: 'No se encontro Liga Profesional Argentina en leagues.',
      })
    }

    const { matches, columns } = await fetchLigaMatches(supabase, league.id)
    const teamIds = [
      ...new Set(
        matches
          .flatMap((match) => [match.home_team_id, match.away_team_id])
          .filter((id): id is DbId => id !== null && id !== undefined)
          .map(String)
      ),
    ]
    const matchIds = matches.map((match) => String(match.id))
    const [teamsById, events, captainSamples] = await Promise.all([
      fetchTeams(supabase, teamIds),
      fetchEvents(supabase, matchIds),
      fetchCaptainSamples(matches, captainSampleLimit),
    ])
    const eventsByMatchId = events.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const matchId = String(event.match_id)
      const current = accumulator.get(matchId) ?? []

      current.push(event)
      accumulator.set(matchId, current)

      return accumulator
    }, new Map())
    const matchesById = new Map(matches.map((match) => [String(match.id), match]))
    const regularMatches = matches.filter((match) => isLigaProfesionalRegularSeasonRound(match.round))
    const knockoutMatches = matches.filter((match) => isLigaProfesionalKnockoutRound(match.round))

    return NextResponse.json({
      ok: true,
      league: {
        id: league.id,
        external_id: league.external_id,
        name: league.name,
        season: league.season,
      },
      columns,
      roundsDetected: serializeRounds(matches),
      tableFiltering: {
        regularSeasonMatches: regularMatches.length,
        knockoutMatches: knockoutMatches.length,
        knockoutRoundsExcludedFromTables: true,
        tablesAffected: ['zonas', 'anual', 'promedios'],
      },
      winnersByPhase: serializeWinners(knockoutMatches, teamsById),
      elapsed: serializeElapsed(matches, eventsByMatchId),
      varEvents: serializeVarEvents(events, matchesById),
      captainSamples,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
