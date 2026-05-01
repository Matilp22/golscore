import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { formatEventMinute } from '@/shared/utils/event-minute'

type MatchEventRow = {
  id: string
  match_id: string
  team_id: string | null
  player_name: string
  assist_name: string | null
  minute: number
  extra_minute: number | null
  type: string
  detail: string | null
  created_at: string
}

type MatchRow = {
  id: string
  external_id: string | number | null
  league_id: string | number | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  match_date: string | null
}

type LeagueRow = {
  id: string | number
  name: string | null
  external_id: string | number | null
  season: number | null
}

type TeamRow = {
  id: string | number
  name: string | null
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

async function fetchAllMatchEvents(
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const pageSize = 1000
  const rows: MatchEventRow[] = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const response = await supabase
      .from('match_events')
      .select('id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, created_at')
      .range(from, to)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as MatchEventRow[]))

    if (!response.data || response.data.length < pageSize) break
  }

  return rows
}

async function fetchRowsByIds<T>(
  table: string,
  select: string,
  ids: string[],
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const rows: T[] = []

  for (const chunk of chunkArray(ids, 100)) {
    const response = await supabase.from(table).select(select).in('id', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as T[]))
  }

  return rows
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()

    const [totalResult, latestResult, groupedEvents] = await Promise.all([
      supabase
        .from('match_events')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('match_events')
        .select('id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      fetchAllMatchEvents(supabase),
    ])

    if (totalResult.error) throw totalResult.error
    if (latestResult.error) throw latestResult.error

    const latestEvents = (latestResult.data ?? []) as MatchEventRow[]
    const matchIds = [
      ...new Set(
        [...latestEvents, ...groupedEvents]
          .map((event) => String(event.match_id))
          .filter(Boolean)
      ),
    ]
    const teamIds = [
      ...new Set(
        [...latestEvents, ...groupedEvents]
          .map((event) => (event.team_id === null ? null : String(event.team_id)))
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const [matches, teams] = await Promise.all([
      matchIds.length
        ? fetchRowsByIds<MatchRow>(
            'matches',
            'id, external_id, league_id, home_team_id, away_team_id, match_date',
            matchIds,
            supabase
          )
        : Promise.resolve([]),
      teamIds.length
        ? fetchRowsByIds<TeamRow>('teams', 'id, name', teamIds, supabase)
        : Promise.resolve([]),
    ])
    const leagueIds = [
      ...new Set(
        matches
          .map((match) => (match.league_id === null ? null : String(match.league_id)))
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const leagues = leagueIds.length
      ? await fetchRowsByIds<LeagueRow>(
          'leagues',
          'id, name, external_id, season',
          leagueIds,
          supabase
        )
      : []

    const matchesById = new Map(matches.map((match) => [String(match.id), match]))
    const leaguesById = new Map(
      leagues.map((league) => [String(league.id), league])
    )
    const teamsById = new Map(
      teams.map((team) => [String(team.id), team])
    )
    const eventsByMatchId = groupedEvents.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.match_id] = (accumulator[event.match_id] ?? 0) + 1
      return accumulator
    }, {})
    const eventsByLeague = groupedEvents.reduce<Record<string, {
      league: string
      league_id: string | number | null
      external_id: string | number | null
      season: number | null
      events: number
    }>>((accumulator, event) => {
      const match = matchesById.get(String(event.match_id))
      const league = match?.league_id ? leaguesById.get(String(match.league_id)) : null
      const key = String(league?.id ?? match?.league_id ?? 'sin-liga')
      const current = accumulator[key] ?? {
        league: league?.name ?? 'Sin liga',
        league_id: league?.id ?? match?.league_id ?? null,
        external_id: league?.external_id ?? null,
        season: league?.season ?? null,
        events: 0,
      }

      current.events += 1
      accumulator[key] = current

      return accumulator
    }, {})
    const latestEventsWithContext = latestEvents.map((event) => {
      const match = matchesById.get(String(event.match_id))
      const league = match?.league_id ? leaguesById.get(String(match.league_id)) : null
      const team = event.team_id ? teamsById.get(String(event.team_id)) : null

      return {
        id: event.id,
        match_id: event.match_id,
        external_fixture_id: match?.external_id ?? null,
        league: league?.name ?? null,
        league_external_id: league?.external_id ?? null,
        match_date: match?.match_date ?? null,
        team: team?.name ?? null,
        minute: formatEventMinute(event.minute, event.extra_minute),
        player: event.player_name,
        assist: event.assist_name,
        type: event.type,
        detail: event.detail,
        created_at: event.created_at,
      }
    })

    return NextResponse.json({
      ok: true,
      total_match_events: totalResult.count ?? 0,
      total_by_league: Object.values(eventsByLeague).sort((a, b) => b.events - a.events),
      latest_events: latestEventsWithContext,
      events_by_match_id: eventsByMatchId,
    })
  } catch (error) {
    console.error('[match-events-diagnostics] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo diagnosticar match_events.',
      },
      { status: 500 }
    )
  }
}
