import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'

type LeaderboardRow = {
  user_id: string
  name?: string | null
  points: number | null
  played: number | null
  exact_hits: number | null
  partial_hits: number | null
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
}

type ApiError = {
  message?: string
  code?: string
  details?: string
}

function errorInfo(error: unknown) {
  const value = error as ApiError

  return {
    error:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudo cargar la tabla de posiciones.',
    code: value?.code ?? null,
    detail: value?.details ?? null,
  }
}

function normalizeLeaderboardRows(rows: LeaderboardRow[], profiles: ProfileRow[]) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

  return rows
    .map((row) => {
      const profile = profilesById.get(row.user_id)
      const name =
        profile?.display_name ??
        profile?.username ??
        row.name ??
        `Usuario ${row.user_id.slice(0, 8)}`
      const points = row.points ?? 0
      const exactHits = row.exact_hits ?? 0
      const partialHits = row.partial_hits ?? 0

      return {
        user_id: row.user_id,
        username: name,
        name,
        total_points: points,
        points,
        played: row.played ?? exactHits + partialHits,
        exact_predictions: exactHits,
        exact_hits: exactHits,
        partial_predictions: partialHits,
        partial_hits: partialHits,
      }
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return b.exact_predictions - a.exact_predictions
    })
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()

    try {
      await recalculateProdePoints(supabase)
    } catch (recalculateError) {
      console.error('[prode/leaderboard] No se pudo recalcular antes de leer ranking', errorInfo(recalculateError))
    }

    const { data: leaderboardRows, error: leaderboardError } = await supabase
      .from('leaderboards')
      .select('user_id, name, points, played, exact_hits, partial_hits')
      .order('points', { ascending: false })
      .order('exact_hits', { ascending: false })

    if (leaderboardError) {
      console.error('[prode/leaderboard] Error leyendo leaderboards', leaderboardError)

      return NextResponse.json({
        ok: false,
        ...errorInfo(leaderboardError),
        leaderboard: [],
      })
    }

    const rows = (leaderboardRows ?? []) as LeaderboardRow[]

    if (!rows.length) {
      return NextResponse.json({ ok: true, leaderboard: [] })
    }

    const userIds = rows.map((row) => row.user_id)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds)

    if (profilesError) {
      console.error('[prode/leaderboard] Error leyendo profiles; usando user_id/name fallback', profilesError)
    }

    return NextResponse.json({
      ok: true,
      leaderboard: normalizeLeaderboardRows(rows, profilesError ? [] : ((profiles ?? []) as ProfileRow[])),
    })
  } catch (error) {
    console.error('[prode/leaderboard] Error completo', error)

    return NextResponse.json({
      ok: false,
      ...errorInfo(error),
      leaderboard: [],
    })
  }
}
