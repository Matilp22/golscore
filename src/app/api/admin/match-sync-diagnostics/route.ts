import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAllowedTournamentBySlug } from '@/shared/config/prode-leagues'
import { isFinishedStatus, isLiveStatus } from '@/shared/utils/match-status'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

type MatchRow = {
  id: string | number
  external_id: string | number | null
  league_id: string | number | null
  match_date: string
  status: string | null
  home_score: number | null
  away_score: number | null
}

type LeagueRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function statusKey(status: string | null | undefined) {
  return (status ?? '').trim().toUpperCase() || 'SIN_STATUS'
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') ?? 'liga-profesional-argentina'
    const tournament = getAllowedTournamentBySlug(competition)

    if (!tournament) {
      return NextResponse.json(
        { ok: false, error: `Competencia no permitida: ${competition}` },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const { data: leaguesData, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, external_id, name')
      .eq('external_id', tournament.externalLeagueId)

    if (leaguesError) throw leaguesError

    const leagues = (leaguesData ?? []) as LeagueRow[]
    const leagueIds = leagues.map((league) => league.id)

    if (!leagueIds.length) {
      return NextResponse.json({
        ok: true,
        competition,
        leagueExternalId: tournament.externalLeagueId,
        total_matches: 0,
        total_NS: 0,
        total_LIVE: 0,
        total_FT: 0,
        past_not_finished: [],
        past_score_null: [],
        duplicate_external_ids: [],
        zero_score_matches: [],
      })
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('id, external_id, league_id, match_date, status, home_score, away_score')
      .in('league_id', leagueIds)
      .order('match_date', { ascending: true })

    if (matchesError) throw matchesError

    const matches = (matchesData ?? []) as MatchRow[]
    const now = new Date()
    const pastMatches = matches.filter((match) => parseMatchDate(match.match_date).getTime() < now.getTime())
    const pastNotFinished = pastMatches.filter((match) => !isFinishedStatus(match.status))
    const pastScoreNull = pastMatches.filter(
      (match) => match.home_score === null || match.away_score === null
    )
    const externalIdGroups = matches.reduce((groups, match) => {
      if (match.external_id === null || match.external_id === undefined) return groups

      const key = String(match.external_id)
      const current = groups.get(key) ?? []
      current.push(match)
      groups.set(key, current)

      return groups
    }, new Map<string, MatchRow[]>())
    const duplicateExternalIds = [...externalIdGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([externalId, rows]) => ({
        external_id: externalId,
        count: rows.length,
        match_ids: rows.map((row) => String(row.id)),
      }))
    const zeroScoreMatches = matches.filter(
      (match) =>
        (match.home_score === 0 || match.away_score === 0) &&
        match.home_score !== null &&
        match.away_score !== null
    )
    const byStatus = matches.reduce<Record<string, number>>((totals, match) => {
      const key = statusKey(match.status)
      totals[key] = (totals[key] ?? 0) + 1
      return totals
    }, {})

    return NextResponse.json({
      ok: true,
      competition,
      leagueExternalId: tournament.externalLeagueId,
      leagues: leagues.map((league) => ({
        id: String(league.id),
        external_id: league.external_id,
        name: league.name,
      })),
      total_matches: matches.length,
      total_NS: matches.filter((match) => statusKey(match.status) === 'NS').length,
      total_LIVE: matches.filter((match) => isLiveStatus(match.status)).length,
      total_FT: matches.filter((match) => isFinishedStatus(match.status)).length,
      by_status: byStatus,
      past_not_finished_count: pastNotFinished.length,
      past_not_finished: pastNotFinished.slice(0, 50).map((match) => ({
        id: String(match.id),
        external_id: match.external_id,
        match_date: match.match_date,
        status: match.status,
        home_score: match.home_score,
        away_score: match.away_score,
      })),
      past_score_null_count: pastScoreNull.length,
      past_score_null: pastScoreNull.slice(0, 50).map((match) => ({
        id: String(match.id),
        external_id: match.external_id,
        match_date: match.match_date,
        status: match.status,
        home_score: match.home_score,
        away_score: match.away_score,
      })),
      duplicate_external_ids_count: duplicateExternalIds.length,
      duplicate_external_ids: duplicateExternalIds.slice(0, 50),
      zero_score_matches_count: zeroScoreMatches.length,
      zero_score_matches: zeroScoreMatches.slice(0, 50).map((match) => ({
        id: String(match.id),
        external_id: match.external_id,
        status: match.status,
        home_score: match.home_score,
        away_score: match.away_score,
      })),
    })
  } catch (error) {
    console.error('[match-sync-diagnostics] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo diagnosticar sync de partidos.',
      },
      { status: 500 }
    )
  }
}
