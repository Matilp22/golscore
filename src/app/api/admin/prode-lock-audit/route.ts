import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { formatMatchDateTimeArgentina } from '@/shared/utils/argentina-time'
import { normalizeLeagueRound } from '@/shared/utils/league-rounds'
import { getPredictionLockState } from '@/shared/utils/prediction-lock'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type LeagueRow = {
  id: string
  name: string | null
  country: string | null
  external_id: string | number | null
  season: number | null
}

type MatchRow = {
  id: string
  external_id: string | number | null
  round: string | null
  match_date: string | null
  status: string | null
  league_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  is_derived?: boolean | null
  bracket_phase?: string | null
  bracket_slot?: number | null
}

type TeamRow = {
  id: string
  name: string | null
  external_id: string | number | null
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
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return getAuthorizationToken(request) === cronSecret
}

function getLockReason(state: ReturnType<typeof getPredictionLockState>) {
  if (state.invalidDate) return 'invalid-date'
  if (state.statusStarted) return 'status-started'
  if (state.minutesUntilMatch <= 0) return 'started-by-time'
  if (state.minutesUntilMatch <= 15) return 'within-15-minutes'

  return 'open'
}

function roundMinutes(value: number) {
  if (!Number.isFinite(value)) return null

  return Math.round(value * 10) / 10
}

function formatArgentinaDate(value: string | Date | null) {
  if (!value) return null

  return formatMatchDateTimeArgentina(value)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const leagueExternalId = Number(searchParams.get('leagueExternalId') ?? 128)
    const round = searchParams.get('round')
    const requestedRound = round
      ? normalizeLeagueRound(round, leagueExternalId)
      : null
    const supabase = getSupabaseAdminClient()
    const { data: leagueRows, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, country, external_id, season')
      .eq('external_id', leagueExternalId)
      .order('season', { ascending: false })
      .limit(1)

    if (leagueError) throw leagueError

    const league = ((leagueRows ?? []) as LeagueRow[])[0] ?? null

    if (!league) {
      return jsonNoStore({
        ok: true,
        leagueExternalId,
        round: requestedRound,
        matches: [],
        emptyReason: 'league_not_found',
      })
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(
        'id, external_id, round, match_date, status, league_id, home_team_id, away_team_id, is_derived, bracket_phase, bracket_slot'
      )
      .eq('league_id', league.id)
      .order('match_date', { ascending: true, nullsFirst: false })

    if (matchesError) throw matchesError

    const matches = ((matchesData ?? []) as MatchRow[]).filter((match) => {
      if (!requestedRound) return true

      return normalizeLeagueRound(match.round, league.external_id) === requestedRound
    })
    const teamIds = [
      ...new Set(
        matches
          .flatMap((match) => [match.home_team_id, match.away_team_id])
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const { data: teamsData, error: teamsError } = teamIds.length
      ? await supabase
          .from('teams')
          .select('id, name, external_id')
          .in('id', teamIds)
      : { data: [], error: null }

    if (teamsError) throw teamsError

    const teamsById = new Map(
      ((teamsData ?? []) as TeamRow[]).map((team) => [team.id, team])
    )
    const now = new Date()
    const auditedMatches = matches.map((match) => {
      const state = getPredictionLockState(match.match_date, match.status ?? 'scheduled', now)
      const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) : null
      const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) : null

      return {
        match_id: match.id,
        external_id: match.external_id,
        round: match.round,
        normalizedRound: normalizeLeagueRound(match.round, league.external_id),
        local: homeTeam?.name ?? null,
        visitante: awayTeam?.name ?? null,
        home_team_external_id: homeTeam?.external_id ?? null,
        away_team_external_id: awayTeam?.external_id ?? null,
        match_date: match.match_date,
        match_date_argentina: formatArgentinaDate(match.match_date),
        status: match.status,
        now_argentina: formatArgentinaDate(now),
        lockReason: getLockReason(state),
        canPredict: !state.locked,
        minutesUntilKickoff: roundMinutes(state.minutesUntilMatch),
        is_derived: match.is_derived ?? null,
        bracket_phase: match.bracket_phase ?? null,
        bracket_slot: match.bracket_slot ?? null,
      }
    })

    return jsonNoStore({
      ok: true,
      league: {
        id: league.id,
        name: league.name,
        country: league.country,
        external_id: league.external_id,
        season: league.season,
      },
      requestedRound,
      count: auditedMatches.length,
      matches: auditedMatches,
    })
  } catch (error) {
    console.error('[prode-lock-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar el bloqueo del Prode.',
      },
      { status: 500 }
    )
  }
}
