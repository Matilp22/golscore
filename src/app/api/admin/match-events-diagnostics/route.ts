import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

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

    const [totalResult, latestResult, groupedResult] = await Promise.all([
      supabase
        .from('match_events')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('match_events')
        .select('id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('match_events')
        .select('match_id')
        .limit(10000),
    ])

    if (totalResult.error) throw totalResult.error
    if (latestResult.error) throw latestResult.error
    if (groupedResult.error) throw groupedResult.error

    const latestEvents = (latestResult.data ?? []) as MatchEventRow[]
    const eventsByMatchId = ((groupedResult.data ?? []) as Array<Pick<MatchEventRow, 'match_id'>>).reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.match_id] = (accumulator[event.match_id] ?? 0) + 1
      return accumulator
    }, {})

    return NextResponse.json({
      ok: true,
      total_match_events: totalResult.count ?? 0,
      latest_events: latestEvents,
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
