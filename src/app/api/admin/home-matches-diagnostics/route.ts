import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getMatchesByDate } from '@/lib/api-football'

type MatchRow = {
  id: string | number
  external_id: string | number | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  league_id: string | number | null
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

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function getBuenosAiresTodayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getBuenosAiresTodayISO()
    const supabase = getSupabaseAdminClient()
    const visibleMatches = await getMatchesByDate(date)
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
        .select('id, external_id, home_team_id, away_team_id, league_id')
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

    for (const chunk of chunkArray(internalMatchIds, 100)) {
      const response = await supabase
        .from('match_events')
        .select('match_id, team_id, player_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)

      if (response.error) throw response.error

      eventRows.push(...((response.data ?? []) as MatchEventRow[]))
    }

    const eventsByMatchId = eventRows.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const matchId = String(event.match_id)
      const current = accumulator.get(matchId) ?? []
      current.push(event)
      accumulator.set(matchId, current)

      return accumulator
    }, new Map())
    const diagnostics = visibleMatches.map((match) => {
      const externalId = match.externalId ?? match.id
      const matchRow = matchRowsByExternalId.get(String(externalId)) ?? null
      const events = matchRow ? eventsByMatchId.get(String(matchRow.id)) ?? [] : []

      return {
        home: match.home,
        away: match.away,
        league: match.league,
        date: match.date,
        external_id: externalId,
        home_team_external_id: match.homeId ?? null,
        away_team_external_id: match.awayId ?? null,
        exists_in_supabase: Boolean(matchRow),
        internal_match_id: matchRow?.id ?? null,
        home_team_id: matchRow?.home_team_id ?? null,
        away_team_id: matchRow?.away_team_id ?? null,
        events_count: events.length,
        events: events.map((event) => ({
          team_id: event.team_id,
          minute: event.extra_minute ? `${event.minute}+${event.extra_minute}` : event.minute,
          player: event.player_name,
          type: event.type,
          detail: event.detail,
        })),
      }
    })
    const missing = diagnostics.filter((match) => !match.exists_in_supabase)
    const withEvents = diagnostics.filter((match) => match.events_count > 0)

    return NextResponse.json({
      ok: true,
      date,
      visible_count: diagnostics.length,
      exists_in_supabase: diagnostics.length - missing.length,
      missing_in_supabase: missing.length,
      with_events: withEvents.length,
      visible_matches: diagnostics,
      missing_matches: missing,
      matches_with_events: withEvents,
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
