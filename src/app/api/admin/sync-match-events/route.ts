import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncFixtureById } from '@/server/prode/sync-matches'
import { formatEventMinute } from '@/shared/utils/event-minute'
import { isScoreboardGoalEvent } from '@/shared/utils/football-events'

type DbId = string | number

type MatchEventRow = {
  id: string
  match_id: DbId
  team_id: DbId | null
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

function getFixtureId(request: Request) {
  const { searchParams } = new URL(request.url)
  const fixture = searchParams.get('fixture') ?? searchParams.get('fixtureId')
  const fixtureId = Number(fixture)

  if (!fixtureId || !Number.isFinite(fixtureId)) {
    throw new Error('fixture requerido e invalido. Usar /api/admin/sync-match-events?fixture=1491952')
  }

  return fixtureId
}

async function fetchGoalEventsByMatchId(
  matchId: DbId | null | undefined
) {
  if (!matchId) return []

  const response = await getSupabaseAdminClient()
    .from('match_events')
    .select('id, match_id, team_id, player_name, minute, extra_minute, type, detail')
    .eq('match_id', matchId)

  if (response.error) throw response.error

  return ((response.data ?? []) as MatchEventRow[])
    .filter((event) => isScoreboardGoalEvent(event.type, event.detail))
    .sort((a, b) =>
      a.minute - b.minute ||
      (a.extra_minute ?? 0) - (b.extra_minute ?? 0) ||
      a.player_name.localeCompare(b.player_name)
    )
}

function serializeEvent(event: MatchEventRow) {
  return {
    id: event.id,
    match_id: event.match_id,
    team_id: event.team_id,
    minute: formatEventMinute(event.minute, event.extra_minute),
    player: event.player_name,
    type: event.type,
    detail: event.detail,
  }
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const fixtureId = getFixtureId(request)
    const debug = new URL(request.url).searchParams.get('debug') === 'true'
    const supabase = getSupabaseAdminClient()
    const beforeMatch = await supabase
      .from('matches')
      .select('id, external_id, home_score, away_score, status')
      .eq('external_id', String(fixtureId))
      .maybeSingle()

    if (beforeMatch.error) throw beforeMatch.error

    const beforeEvents = await fetchGoalEventsByMatchId(beforeMatch.data?.id)
    const result = await syncFixtureById(supabase, fixtureId, { debug })
    const afterEvents = await fetchGoalEventsByMatchId(result.after?.id)

    return NextResponse.json({
      ok: true,
      fixtureId,
      before: {
        match: beforeMatch.data ?? null,
        goalEventsCount: beforeEvents.length,
        events: beforeEvents.map(serializeEvent),
      },
      after: {
        match: result.after,
        goalEventsCount: afterEvents.length,
        events: afterEvents.map(serializeEvent),
      },
      eventSync: result.eventSync ?? null,
      matchSync: result,
    })
  } catch (error) {
    console.error('[sync-match-events] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron sincronizar eventos.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
