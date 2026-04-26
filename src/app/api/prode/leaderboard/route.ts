import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type LeaderboardRow = {
  user_id: string
  name?: string | null
  points: number | null
  total_points?: number | null
  played: number | null
  exact_hits: number | null
  partial_hits: number | null
  exact_predictions?: number | null
  partial_predictions?: number | null
}

type PredictionScoreRow = {
  user_id: string
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type ProfileRow = {
  id: string
  username?: string | null
}

type ApiError = {
  message?: string
  code?: string
  details?: string
}

type SupabaseListResult = {
  data: unknown[] | null
  error: ApiError | null
}

function getErrorPayload(error: unknown) {
  const value = error as ApiError

  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudo cargar la tabla de posiciones.',
    code: value?.code ?? null,
    detail: value?.details ?? null,
    leaderboard: [],
  }
}

function getDisplayName(userId: string, profilesById: Map<string, ProfileRow>) {
  const profile = profilesById.get(userId)

  return profile?.username ?? 'Usuario'
}

function normalizeRows(rows: LeaderboardRow[], profiles: ProfileRow[]) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

  return rows
    .map((row) => {
      const points = row.points ?? 0
      const totalPoints = row.total_points ?? points
      const exactHits = row.exact_predictions ?? row.exact_hits ?? 0
      const partialHits = row.partial_predictions ?? row.partial_hits ?? 0

      return {
        user_id: row.user_id,
        username: getDisplayName(row.user_id, profilesById),
        name: getDisplayName(row.user_id, profilesById),
        total_points: totalPoints,
        points: totalPoints,
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

function groupScoresByUser(scores: PredictionScoreRow[]): LeaderboardRow[] {
  const grouped = new Map<string, LeaderboardRow>()

  for (const score of scores) {
    const current = grouped.get(score.user_id) ?? {
      user_id: score.user_id,
      points: 0,
      played: 0,
      exact_hits: 0,
      partial_hits: 0,
    }

    current.points = (current.points ?? 0) + (score.points ?? 0)
    current.played = (current.played ?? 0) + 1
    current.exact_hits = (current.exact_hits ?? 0) + (score.exact_hit ? 1 : 0)
    current.partial_hits = (current.partial_hits ?? 0) + (score.partial_hit ? 1 : 0)
    grouped.set(score.user_id, current)
  }

  return [...grouped.values()]
}

function totalsDiffer(leaderboardRows: LeaderboardRow[], scoreRows: LeaderboardRow[]) {
  if (!leaderboardRows.length && scoreRows.length) return true

  const leaderboardTotals = new Map(
    leaderboardRows.map((row) => [row.user_id, row.total_points ?? row.points ?? 0])
  )

  return scoreRows.some((row) => leaderboardTotals.get(row.user_id) !== (row.points ?? 0))
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    let leaderboardResult: SupabaseListResult = await supabase
      .from('leaderboards')
      .select('user_id, total_points, exact_predictions, partial_predictions')
      .order('total_points', { ascending: false })
      .order('exact_predictions', { ascending: false })

    if (leaderboardResult.error?.code === '42703') {
      leaderboardResult = await supabase
        .from('leaderboards')
        .select('user_id, name, points, played, exact_hits, partial_hits')
        .order('points', { ascending: false })
        .order('exact_hits', { ascending: false })
    }

    const [
      scoresResult,
    ] = await Promise.all([
      supabase
        .from('prediction_scores')
        .select('user_id, points, exact_hit, partial_hit'),
    ])

    if (leaderboardResult.error) {
      console.error('[prode/leaderboard] Error leyendo leaderboards', leaderboardResult.error)
    }

    if (scoresResult.error) {
      console.error('[prode/leaderboard] Error leyendo prediction_scores', scoresResult.error)
    }

    const leaderboardRows = (leaderboardResult.error ? [] : leaderboardResult.data ?? []) as LeaderboardRow[]
    const groupedScoreRows = groupScoresByUser((scoresResult.error ? [] : scoresResult.data ?? []) as PredictionScoreRow[])
    const sourceRows = totalsDiffer(leaderboardRows, groupedScoreRows)
      ? groupedScoreRows
      : leaderboardRows
    const userIds = sourceRows.map((row) => row.user_id)
    const profilesResult = userIds.length
      ? await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)
      : { data: [], error: null }

    if (profilesResult.error) {
      console.error('[prode/leaderboard] Error leyendo profiles; usando fallback', profilesResult.error)
    }

    console.info('[prode/leaderboard] response debug', {
      leaderboardsRead: leaderboardRows.length,
      predictionScoresRead: scoresResult.error ? 0 : scoresResult.data?.length ?? 0,
      source: sourceRows === groupedScoreRows ? 'prediction_scores' : 'leaderboards',
    })

    return NextResponse.json({
      ok: !leaderboardResult.error && !scoresResult.error,
      leaderboard: normalizeRows(
        sourceRows,
        profilesResult.error ? [] : ((profilesResult.data ?? []) as ProfileRow[])
      ),
      error: leaderboardResult.error || scoresResult.error ? 'No se pudo leer una fuente del ranking.' : undefined,
    })
  } catch (error) {
    console.error('[prode/leaderboard] Error completo', error)

    return NextResponse.json(getErrorPayload(error))
  }
}
