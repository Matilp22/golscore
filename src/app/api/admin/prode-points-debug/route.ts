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
  points: number | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV !== 'production') return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const [
      predictionsResult,
      scoresResult,
    ] = await Promise.all([
      supabase.from('predictions').select('id, user_id, match_id'),
      supabase.from('prediction_scores').select('prediction_id, points'),
    ])

    if (predictionsResult.error) throw predictionsResult.error
    if (scoresResult.error) throw scoresResult.error

    const predictions = (predictionsResult.data ?? []) as PredictionRow[]
    const scores = (scoresResult.data ?? []) as PredictionScoreRow[]
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

    return NextResponse.json({
      ok: true,
      total_predictions: predictions.length,
      predictions_with_final_score: predictionsWithFinalScore.length,
      prediction_scores_generated: scores.length,
      missing_prediction_scores_count: missingPredictionScores.length,
      missing_prediction_scores: missingPredictionScores.slice(0, 50),
    })
  } catch (error) {
    console.error('[prode-points-debug] Error completo', error)

    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo diagnosticar puntos.',
    })
  }
}
