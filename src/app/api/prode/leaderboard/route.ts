import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type LeaderboardDbError = {
  message: string
  code?: string
}

function isMissingLeaderboardSource(error: LeaderboardDbError | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function fetchLeaderboardFrom(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  table: 'leaderboards' | 'leaderboard'
) {
  return supabase
    .from(table)
    .select('*')
    .order('points', { ascending: false })
    .order('exact_hits', { ascending: false })
}

export async function GET() {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no esta configurado.', leaderboard: [] },
      { status: 500 }
    )
  }

  const primary = await fetchLeaderboardFrom(supabase, 'leaderboards')
  const fallback = primary.error && isMissingLeaderboardSource(primary.error)
    ? await fetchLeaderboardFrom(supabase, 'leaderboard')
    : null

  const data = fallback?.data ?? primary.data
  const error = fallback?.error ?? primary.error

  if (error) {
    if (isMissingLeaderboardSource(error)) {
      return NextResponse.json({
        leaderboard: [],
        meta: { emptyReason: 'leaderboard_source_missing' },
      })
    }

    return NextResponse.json(
      { error: error.message, leaderboard: [] },
      { status: 500 }
    )
  }

  return NextResponse.json({ leaderboard: data ?? [] })
}
