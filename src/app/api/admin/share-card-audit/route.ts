import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401, headers: JSON_HEADERS })
  }

  const { searchParams } = new URL(request.url)
  const fixture = searchParams.get('fixture')?.trim()

  if (!fixture) {
    return NextResponse.json(
      { ok: false, error: 'Parámetro fixture requerido.' },
      { status: 400, headers: JSON_HEADERS }
    )
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('matches')
    .select('id, external_id, match_date, status, home_team_id, away_team_id, league_id')
    .eq('external_id', fixture)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: JSON_HEADERS }
    )
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Partido no encontrado.' },
      { status: 404, headers: JSON_HEADERS }
    )
  }

  const row = data as {
    id: string
    external_id: string | number | null
    match_date: string | null
    status: string | null
    home_team_id: string | null
    away_team_id: string | null
    league_id: string | null
  }
  const teamIds = [row.home_team_id, row.away_team_id].filter((id): id is string => Boolean(id))
  const [{ data: teamsData }, { data: leagueData }] = await Promise.all([
    teamIds.length
      ? supabase.from('teams').select('id, name, logo_url').in('id', teamIds)
      : Promise.resolve({ data: [] }),
    row.league_id
      ? supabase.from('leagues').select('id, name').eq('id', row.league_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const teamsById = new Map(
    ((teamsData ?? []) as Array<{ id: string; name?: string | null; logo_url?: string | null }>)
      .map((team) => [team.id, team])
  )
  const homeTeam = row.home_team_id ? teamsById.get(row.home_team_id) : null
  const awayTeam = row.away_team_id ? teamsById.get(row.away_team_id) : null
  const league = leagueData as { name?: string | null } | null

  return NextResponse.json(
    {
      ok: true,
      match: {
        id: row.id,
        fixtureExternalId: row.external_id,
        league: league?.name ?? null,
        home: homeTeam?.name ?? null,
        away: awayTeam?.name ?? null,
        matchDate: row.match_date,
        status: row.status,
      },
      readiness: {
        hasLeague: Boolean(league?.name),
        hasHomeTeam: Boolean(homeTeam?.name),
        hasAwayTeam: Boolean(awayTeam?.name),
        hasHomeLogo: Boolean(homeTeam?.logo_url),
        hasAwayLogo: Boolean(awayTeam?.logo_url),
        canRenderShareCard: Boolean(league?.name && homeTeam?.name && awayTeam?.name),
      },
    },
    { headers: JSON_HEADERS }
  )
}
