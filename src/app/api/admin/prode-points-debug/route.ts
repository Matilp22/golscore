import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number
}

type MatchRow = {
  id: string | number
  home_score: number | null
  away_score: number | null
}

type PredictionScoreRow = {
  prediction_id: string
  user_id: string
  match_id: string | number
  points: number | null
  exact_hit?: boolean | null
  partial_hit?: boolean | null
}

type LeaderboardRow = {
  user_id: string
  points: number | null
  total_points?: number | null
  played: number | null
  exact_hits: number | null
  partial_hits: number | null
  exact_predictions?: number | null
  partial_predictions?: number | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV !== 'production') return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function getErrorDetail(error: unknown) {
  const value = error as {
    message?: string
    code?: string
    details?: string
    detail?: string
    hint?: string
  }

  return {
    message:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudo diagnosticar puntos.',
    code: value?.code ?? null,
    detail: value?.details ?? value?.detail ?? value?.hint ?? null,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    let leaderboardsResult = await supabase
      .from('leaderboards')
      .select('user_id, total_points, exact_predictions, partial_predictions')

    if (leaderboardsResult.error?.code === '42703') {
      leaderboardsResult = await supabase
        .from('leaderboards')
        .select('user_id, points, played, exact_hits, partial_hits')
    }

    const [
      predictionsResult,
      scoresResult,
    ] = await Promise.all([
      supabase.from('predictions').select('id, user_id, match_id'),
      supabase
        .from('prediction_scores')
        .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit'),
    ])

    if (predictionsResult.error) throw predictionsResult.error
    if (scoresResult.error) throw scoresResult.error
    if (leaderboardsResult.error) throw leaderboardsResult.error

    const predictions = (predictionsResult.data ?? []) as PredictionRow[]
    const scores = (scoresResult.data ?? []) as PredictionScoreRow[]
    const leaderboards = (leaderboardsResult.data ?? []) as LeaderboardRow[]
    const matchIds = [...new Set(predictions.map((prediction) => String(prediction.match_id)))]
    const matchesResult = matchIds.length
      ? await supabase
          .from('matches')
          .select('id, home_score, away_score')
          .in('id', matchIds)
      : { data: [], error: null }

    if (matchesResult.error) throw matchesResult.error

    const matchesById = new Map(
      ((matchesResult.data ?? []) as MatchRow[]).map((match) => [String(match.id), match])
    )
    const scoreIds = new Set(scores.map((score) => score.prediction_id))
    const predictionsWithFinalScore = predictions.filter((prediction) => {
      const match = matchesById.get(String(prediction.match_id))

      return match?.home_score !== null && match?.away_score !== null
    })
    const missingPredictionScores = predictionsWithFinalScore
      .filter((prediction) => !scoreIds.has(prediction.id))
      .map((prediction) => ({
        prediction_id: prediction.id,
        user_id: prediction.user_id,
        match_id: String(prediction.match_id),
      }))
    const sumByUser = [...scores.reduce((grouped, score) => {
      const current = grouped.get(score.user_id) ?? {
        user_id: score.user_id,
        total_points: 0,
        scored_predictions: 0,
        exact_predictions: 0,
        partial_predictions: 0,
      }

      current.total_points += score.points ?? 0
      current.scored_predictions += 1
      current.exact_predictions += score.exact_hit ? 1 : 0
      current.partial_predictions += score.partial_hit ? 1 : 0
      grouped.set(score.user_id, current)

      return grouped
    }, new Map<string, {
      user_id: string
      total_points: number
      scored_predictions: number
      exact_predictions: number
      partial_predictions: number
    }>()).values()].sort((a, b) => b.total_points - a.total_points)

    return NextResponse.json({
      ok: true,
      total_predictions: predictions.length,
      predictions_with_final_score: predictionsWithFinalScore.length,
      total_prediction_scores: scores.length,
      prediction_scores_generated: scores.length,
      total_leaderboards: leaderboards.length,
      sum_by_user: sumByUser,
      leaderboards: leaderboards.map((row) => ({
        user_id: row.user_id,
        total_points: row.total_points ?? row.points ?? 0,
        played: row.played ?? 0,
        exact_predictions: row.exact_predictions ?? row.exact_hits ?? 0,
        partial_predictions: row.partial_predictions ?? row.partial_hits ?? 0,
      })),
      missing_prediction_scores_count: missingPredictionScores.length,
      missing_prediction_scores: missingPredictionScores.slice(0, 50),
    })
  } catch (error) {
    const diagnostic = getErrorDetail(error)

    console.error('[prode-points-debug] Error completo', {
      error,
      ...diagnostic,
    })

    return NextResponse.json({
      ok: false,
      error: diagnostic.message,
      code: diagnostic.code,
      detail: diagnostic.detail,
    })
  }
}
