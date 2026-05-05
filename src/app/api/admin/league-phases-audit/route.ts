import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getLeagueFinalPhaseKey,
  getLeagueRoundLabel,
  normalizeLeagueRound,
  type LeagueFinalPhaseKey,
} from '@/shared/utils/league-rounds'

type LeagueRow = {
  id: string
  name: string | null
  country: string | null
  external_id: string | number | null
  season: number | null
}

type TeamRelation = {
  id: string
  name: string | null
  external_id: string | number | null
}

type MatchRow = {
  id: string
  external_id: string | number | null
  round: string | null
  status: string | null
  match_date: string | null
  home_score: number | null
  away_score: number | null
  home_team: TeamRelation | TeamRelation[] | null
  away_team: TeamRelation | TeamRelation[] | null
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
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  return null
}

function getSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null

  return value ?? null
}

function serializeMatch(match: MatchRow, leagueExternalId: string | number | null) {
  const homeTeam = getSingleRelation(match.home_team)
  const awayTeam = getSingleRelation(match.away_team)
  const finalPhase = getLeagueFinalPhaseKey(match.round)

  return {
    id: String(match.id),
    externalId: match.external_id === null ? null : String(match.external_id),
    round: match.round,
    normalizedRound: normalizeLeagueRound(match.round, leagueExternalId),
    roundLabel: getLeagueRoundLabel(match.round, leagueExternalId),
    finalPhase,
    status: match.status,
    matchDate: match.match_date,
    homeTeam: homeTeam?.name ?? null,
    awayTeam: awayTeam?.name ?? null,
    scores: {
      home: match.home_score,
      away: match.away_score,
    },
  }
}

function buildRoundCounts(matches: MatchRow[], leagueExternalId: string | number | null) {
  const rounds = new Map<
    string,
    {
      round: string
      normalizedRound: string | null
      label: string | null
      count: number
      statuses: Set<string>
      firstMatchDate: string | null
      lastMatchDate: string | null
    }
  >()

  for (const match of matches) {
    const round = match.round?.trim() || 'Sin fase'
    const current = rounds.get(round) ?? {
      round,
      normalizedRound: normalizeLeagueRound(match.round, leagueExternalId),
      label: getLeagueRoundLabel(match.round, leagueExternalId),
      count: 0,
      statuses: new Set<string>(),
      firstMatchDate: null,
      lastMatchDate: null,
    }

    current.count += 1
    current.statuses.add(match.status ?? 'Sin estado')

    if (match.match_date) {
      if (!current.firstMatchDate || match.match_date < current.firstMatchDate) {
        current.firstMatchDate = match.match_date
      }

      if (!current.lastMatchDate || match.match_date > current.lastMatchDate) {
        current.lastMatchDate = match.match_date
      }
    }

    rounds.set(round, current)
  }

  return [...rounds.values()]
    .map((round) => ({
      ...round,
      statuses: [...round.statuses].sort(),
    }))
    .sort((a, b) => {
      if (a.firstMatchDate && b.firstMatchDate) {
        return a.firstMatchDate.localeCompare(b.firstMatchDate)
      }

      return a.round.localeCompare(b.round, 'es-AR', { numeric: true })
    })
}

export async function GET(request: Request) {
  const authorizationError = getAuthorizationError(request)

  if (authorizationError) return authorizationError

  try {
    const { searchParams } = new URL(request.url)
    const leagueExternalId = searchParams.get('leagueExternalId') ?? '128'

    if (!Number.isFinite(Number(leagueExternalId))) {
      return NextResponse.json(
        { ok: false, error: 'leagueExternalId invalido.' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, country, external_id, season')
      .eq('external_id', leagueExternalId)
      .maybeSingle()

    if (leagueError) {
      return NextResponse.json(
        { ok: false, error: leagueError.message, code: leagueError.code ?? null },
        { status: 500 }
      )
    }

    const league = leagueData as LeagueRow | null

    if (!league) {
      return NextResponse.json({
        ok: true,
        league: null,
        totalMatches: 0,
        roundsDetected: [],
        roundCounts: [],
        finalPhasesDetected: [],
        matchesWithoutRound: { count: 0, matches: [] },
        finalPhaseMatches: [],
      })
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        external_id,
        round,
        status,
        match_date,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey(id, name, external_id),
        away_team:teams!matches_away_team_id_fkey(id, name, external_id)
      `)
      .eq('league_id', league.id)
      .order('match_date', { ascending: true })

    if (matchesError) {
      return NextResponse.json(
        { ok: false, error: matchesError.message, code: matchesError.code ?? null },
        { status: 500 }
      )
    }

    const matches = (matchesData ?? []) as MatchRow[]
    const roundCounts = buildRoundCounts(matches, league.external_id)
    const matchesWithoutRound = matches.filter(
      (match) => !match.round || !match.round.trim()
    )
    const finalPhaseMatches = matches
      .map((match) => ({
        phase: getLeagueFinalPhaseKey(match.round),
        match,
      }))
      .filter(
        (entry): entry is { phase: LeagueFinalPhaseKey; match: MatchRow } =>
          Boolean(entry.phase)
      )

    const finalPhaseCounts = finalPhaseMatches.reduce(
      (counts, entry) => {
        counts[entry.phase] = (counts[entry.phase] ?? 0) + 1
        return counts
      },
      {} as Partial<Record<LeagueFinalPhaseKey, number>>
    )

    return NextResponse.json({
      ok: true,
      league: {
        id: league.id,
        name: league.name,
        country: league.country,
        externalId: league.external_id,
        season: league.season,
      },
      totalMatches: matches.length,
      roundsDetected: roundCounts.map((round) => round.round),
      roundCounts,
      finalPhasesDetected: Object.entries(finalPhaseCounts).map(([phase, count]) => ({
        phase,
        label: getLeagueRoundLabel(phase, league.external_id),
        count,
      })),
      matchesWithoutRound: {
        count: matchesWithoutRound.length,
        matches: matchesWithoutRound
          .slice(0, 50)
          .map((match) => serializeMatch(match, league.external_id)),
      },
      finalPhaseMatches: finalPhaseMatches.map((entry) =>
        serializeMatch(entry.match, league.external_id)
      ),
    })
  } catch (error) {
    console.error('[league-phases-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar las fases de la liga.',
      },
      { status: 500 }
    )
  }
}
