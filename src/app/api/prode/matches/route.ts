import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getAllowedProdeLeagueIds } from '@/server/prode/scope'
import { getAllowedProdeLeagueLabel } from '@/shared/config/prode-leagues'
import { normalizeLeagueRound } from '@/shared/utils/league-rounds'
import { parseMatchDate } from '@/shared/utils/prediction-lock'
import { pickLeagueLogoUrl, pickTeamLogoUrl } from '@/shared/utils/asset-urls'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type SportDbError = {
  message: string
  code?: string
  details?: string
}

type MatchRow = {
  id: string
  league_id: string | null
  round: string | number | null
  match_date: string | null
  home_team_id: string | null
  away_team_id: string | null
  status: string
  home_score: number | null
  away_score: number | null
}

type LeagueRow = {
  id: string
  name: string | null
  country: string | null
  external_id: string | number | null
  logo_url?: string | null
}

type TeamRow = {
  id: string
  name: string | null
  external_id?: string | number | null
  logo_url: string | null
}

type SupabaseServerClient = NonNullable<
  Awaited<ReturnType<typeof getSupabaseServerClient>>
>

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function prodeError(error: SportDbError, fallback: string) {
  const missingTable = error.code === '42P01'
  const missingColumn = error.code === '42703'

  return jsonNoStore(
    {
      error: missingTable
        ? 'La tabla esperada del prode no existe en Supabase. Ejecuta las migraciones.'
        : missingColumn
          ? 'Una columna esperada del prode no existe en Supabase. Ejecuta las migraciones.'
          : fallback,
      detail: error.message,
      code: error.code ?? null,
      matches: [],
    },
    { status: 500 }
  )
}

async function fetchTeamsWithLogos(
  supabase: SupabaseServerClient,
  teamIds: string[]
) {
  if (!teamIds.length) {
    return { data: [] as TeamRow[], error: null as SportDbError | null }
  }

  const primary = await supabase
    .from('teams')
    .select('id, name, external_id, logo_url')
    .in('id', teamIds)

  if (!primary.error) {
    return {
      data: (primary.data ?? []) as TeamRow[],
      error: null as SportDbError | null,
    }
  }

  const missingOptionalLogoColumn =
    primary.error.code === '42703' ||
    primary.error.message.toLowerCase().includes('logo_url') ||
    primary.error.message.toLowerCase().includes('schema cache')

  if (!missingOptionalLogoColumn) {
    return { data: [], error: primary.error as SportDbError }
  }

  console.info('[prode-matches] logo_url no disponible en teams; se usa fallback por external_id.', {
    code: primary.error.code ?? null,
    message: primary.error.message,
  })

  const fallback = await supabase
    .from('teams')
    .select('id, name, external_id')
    .in('id', teamIds)

  return {
    data: ((fallback.data ?? []) as Array<Omit<TeamRow, 'logo_url'>>).map((team) => ({
      ...team,
      logo_url: null,
    })),
    error: fallback.error as SportDbError | null,
  }
}

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return jsonNoStore(
      { error: 'Supabase no esta configurado.', matches: [] },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')
  const round = searchParams.get('round')
  const status = searchParams.get('status')
  const date = searchParams.get('date')

  let allowedLeagueIds: string[]
  try {
    allowedLeagueIds = await getAllowedProdeLeagueIds(supabase)
  } catch (error) {
    return prodeError(
      error as SportDbError,
      'No se pudieron cargar las ligas permitidas del prode.'
    )
  }

  if (!allowedLeagueIds.length) {
    return jsonNoStore({
      matches: [],
      meta: { emptyReason: 'allowed_leagues_empty' },
    })
  }

  if (leagueId && !allowedLeagueIds.includes(leagueId)) {
    return jsonNoStore({
      matches: [],
      meta: { emptyReason: 'league_not_allowed' },
    })
  }

  let query = supabase
    .from('matches')
    .select(
      'id, league_id, round, match_date, home_team_id, away_team_id, status, home_score, away_score'
    )
    .order('match_date', { ascending: true, nullsFirst: false })
    .limit(1000)

  if (leagueId) {
    query = query.eq('league_id', leagueId)
  } else {
    query = query.in('league_id', allowedLeagueIds)
  }

  if (status) query = query.eq('status', status)

  if (date) {
    const start = `${date}T00:00:00.000Z`
    const end = `${date}T23:59:59.999Z`
    query = query.gte('match_date', start).lte('match_date', end)
  }

  const { data, error } = await query

  if (error) {
    return prodeError(error, 'No se pudieron cargar los partidos del prode.')
  }

  const rows = (data ?? []) as MatchRow[]

  console.info('[prode-matches] filtros aplicados', {
    leagueId,
    round,
    status,
    date,
    allowedLeagueIds: allowedLeagueIds.length,
    rows: rows.length,
  })

  if (!rows.length) {
    return jsonNoStore({
      matches: [],
      meta: { emptyReason: 'matches_empty' },
    })
  }

  const leagueIds = [...new Set(rows.map((match) => match.league_id).filter(Boolean))] as string[]
  const teamIds = [
    ...new Set(
      rows
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter(Boolean)
    ),
  ] as string[]
  const [
    { data: leaguesData, error: leaguesError },
    { data: teamsData, error: teamsError },
  ] = await Promise.all([
    leagueIds.length
      ? supabase
          .from('leagues')
          .select('id, name, country, external_id, logo_url')
          .in('id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
    fetchTeamsWithLogos(supabase, teamIds),
  ])

  if (leaguesError) return prodeError(leaguesError, 'No se pudieron cargar las ligas.')
  if (teamsError) return prodeError(teamsError, 'No se pudieron cargar los equipos.')

  const leaguesById = new Map(
    ((leaguesData ?? []) as LeagueRow[]).map((league) => [league.id, league])
  )
  const teamsById = new Map(
    ((teamsData ?? []) as TeamRow[]).map((team) => [team.id, team])
  )
  const rowsForResponse = round
    ? rows.filter((match) => {
        const league = match.league_id ? leaguesById.get(match.league_id) : null
        const normalizedRound = normalizeLeagueRound(match.round, league?.external_id)

        return normalizedRound === round || String(match.round ?? '') === round
      })
    : rows

  if (!rowsForResponse.length) {
    return jsonNoStore({
      matches: [],
      meta: { emptyReason: 'matches_empty_for_round' },
    })
  }

  const matches = rowsForResponse.map((match) => {
    const league = match.league_id ? leaguesById.get(match.league_id) : null
    const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) : null
    const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) : null

    return {
      id: String(match.id),
      leagueId: match.league_id === null ? null : String(match.league_id),
      homeTeamId: match.home_team_id === null ? null : String(match.home_team_id),
      awayTeamId: match.away_team_id === null ? null : String(match.away_team_id),
      matchDate: match.match_date,
      status: match.status,
      round: match.round === null || match.round === undefined ? null : String(match.round),
      homeScore: match.home_score,
      awayScore: match.away_score,
      league: league
        ? {
            id: String(league.id),
            externalId: league.external_id === null ? null : Number(league.external_id),
            name: getAllowedProdeLeagueLabel(league.name),
            country: league.country,
            season: match.match_date
              ? parseMatchDate(match.match_date).getFullYear()
              : new Date().getFullYear(),
            logoUrl: pickLeagueLogoUrl(league.logo_url, league.external_id),
          }
        : null,
      homeTeam: homeTeam
        ? {
            id: String(homeTeam.id),
            name: homeTeam.name ?? 'Local',
            logo_url: homeTeam.logo_url,
            logoUrl: pickTeamLogoUrl(homeTeam.logo_url, homeTeam.external_id),
          }
        : null,
      awayTeam: awayTeam
        ? {
            id: String(awayTeam.id),
            name: awayTeam.name ?? 'Visitante',
            logo_url: awayTeam.logo_url,
            logoUrl: pickTeamLogoUrl(awayTeam.logo_url, awayTeam.external_id),
          }
        : null,
    }
  })

  return jsonNoStore({ matches })
}
