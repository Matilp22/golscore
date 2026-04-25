import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getAllowedProdeLeagueIds } from '@/server/prode/scope'
import { getAllowedProdeLeagueLabel } from '@/shared/config/prode-leagues'
import { parseMatchDate } from '@/shared/utils/prediction-lock'

type SportDbError = {
  message: string
  code?: string
  details?: string
}

type MatchRow = {
  id: string
  league_id: string | null
  round: string | number | null
  match_date: string
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
}

type TeamRow = {
  id: string
  name: string | null
  logo_url: string | null
}

type ResultRow = {
  match_id: string
  home_score: number | null
  away_score: number | null
  status: string | null
}

type SupabaseServerClient = NonNullable<
  Awaited<ReturnType<typeof getSupabaseServerClient>>
>

function prodeError(error: SportDbError, fallback: string) {
  const missingTable = error.code === '42P01'
  const missingColumn = error.code === '42703'

  return NextResponse.json(
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

function isMissingOptionalRelation(error: SportDbError | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function fetchResultsInChunks(
  supabase: SupabaseServerClient,
  matchIds: string[]
) {
  if (!matchIds.length) {
    return { data: [] as ResultRow[], error: null as SportDbError | null }
  }

  const chunkSize = 200
  const chunks: string[][] = []

  for (let index = 0; index < matchIds.length; index += chunkSize) {
    chunks.push(matchIds.slice(index, index + chunkSize))
  }

  const chunkResponses = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from('results')
        .select('match_id, home_score, away_score, status')
        .in('match_id', chunk)
    )
  )

  const data: ResultRow[] = []

  for (const response of chunkResponses) {
    if (response.error) {
      return { data: [] as ResultRow[], error: response.error as SportDbError }
    }

    data.push(...((response.data ?? []) as ResultRow[]))
  }

  return { data, error: null as SportDbError | null }
}

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return NextResponse.json(
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
    return NextResponse.json({
      matches: [],
      meta: { emptyReason: 'allowed_leagues_empty' },
    })
  }

  if (leagueId && !allowedLeagueIds.includes(leagueId)) {
    return NextResponse.json({
      matches: [],
      meta: { emptyReason: 'league_not_allowed' },
    })
  }

  let query = supabase
    .from('matches')
    .select(
      'id, league_id, round, match_date, home_team_id, away_team_id, status, home_score, away_score'
    )
    .order('match_date', { ascending: true })
    .limit(1000)

  if (leagueId) {
    query = query.eq('league_id', leagueId)
  } else {
    query = query.in('league_id', allowedLeagueIds)
  }

  if (round) query = query.eq('round', round)
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
    return NextResponse.json({
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
  const matchIds = rows.map((match) => match.id)
  const [
    { data: leaguesData, error: leaguesError },
    { data: teamsData, error: teamsError },
    { data: resultsData, error: resultsError },
  ] = await Promise.all([
    leagueIds.length
      ? supabase
          .from('leagues')
          .select('id, name, country, external_id')
          .in('id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from('teams').select('id, name').in('id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    fetchResultsInChunks(supabase, matchIds),
  ])

  if (leaguesError) return prodeError(leaguesError, 'No se pudieron cargar las ligas.')
  if (teamsError) return prodeError(teamsError, 'No se pudieron cargar los equipos.')
  if (resultsError && !isMissingOptionalRelation(resultsError)) {
    return prodeError(resultsError, 'No se pudieron cargar los resultados.')
  }

  const { data: teamLogosData, error: teamLogosError } = teamIds.length
    ? await supabase.from('teams').select('id, logo_url').in('id', teamIds)
    : { data: [], error: null }

  if (teamLogosError) {
    console.info('[prode-matches] logo_url no disponible en teams; se usan iniciales.', {
      code: teamLogosError.code ?? null,
      message: teamLogosError.message,
    })
  }

  const leaguesById = new Map(
    ((leaguesData ?? []) as LeagueRow[]).map((league) => [league.id, league])
  )
  const teamsById = new Map(
    ((teamsData ?? []) as TeamRow[]).map((team) => [team.id, team])
  )
  const teamLogosById = new Map(
    ((teamLogosError ? [] : teamLogosData ?? []) as Array<{ id: string; logo_url: string | null }>).map((team) => [
      team.id,
      team.logo_url,
    ])
  )
  const resultsByMatchId = new Map(
    ((resultsError ? [] : resultsData ?? []) as ResultRow[]).map((result) => [
      result.match_id,
      result,
    ])
  )

  const matches = rows.map((match) => {
    const result = resultsByMatchId.get(match.id)
    const league = match.league_id ? leaguesById.get(match.league_id) : null
    const homeTeam = match.home_team_id ? teamsById.get(match.home_team_id) : null
    const awayTeam = match.away_team_id ? teamsById.get(match.away_team_id) : null
    const homeScore = result?.home_score ?? match.home_score
    const awayScore = result?.away_score ?? match.away_score
    const statusValue = result?.status ?? match.status

    return {
      id: String(match.id),
      leagueId: match.league_id === null ? null : String(match.league_id),
      homeTeamId: match.home_team_id === null ? null : String(match.home_team_id),
      awayTeamId: match.away_team_id === null ? null : String(match.away_team_id),
      matchDate: match.match_date,
      status: statusValue,
      round: match.round === null || match.round === undefined ? null : String(match.round),
      homeScore,
      awayScore,
      league: league
        ? {
            id: String(league.id),
            externalId: league.external_id === null ? null : Number(league.external_id),
            name: getAllowedProdeLeagueLabel(league.name),
            country: league.country,
            season: parseMatchDate(match.match_date).getFullYear(),
            logoUrl: null,
          }
        : null,
      homeTeam: homeTeam
        ? {
            id: String(homeTeam.id),
            name: homeTeam.name ?? 'Local',
            logoUrl: teamLogosById.get(homeTeam.id) ?? null,
          }
        : null,
      awayTeam: awayTeam
        ? {
            id: String(awayTeam.id),
            name: awayTeam.name ?? 'Visitante',
            logoUrl: teamLogosById.get(awayTeam.id) ?? null,
          }
        : null,
    }
  })

  return NextResponse.json({ matches })
}
