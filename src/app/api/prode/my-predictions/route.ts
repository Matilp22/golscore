import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { recalculateProdePoints } from '@/server/prode/points'

type PredictionRow = {
  id: string
  user_id: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  created_at: string
  updated_at: string
}

type PredictionScoreRow = {
  prediction_id: string
  user_id: string
  match_id: string
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

async function getAuthenticatedUser(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      error: NextResponse.json(
        { error: 'Supabase no está configurado.', predictions: [] },
        { status: 500 }
      ),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return { supabase, user, error: null }
  }

  const authorization = request.headers.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()

    if (token) {
      const {
        data: { user: tokenUser },
      } = await supabase.auth.getUser(token)

      if (tokenUser) {
        return { supabase, user: tokenUser, error: null }
      }
    }
  }

  return { supabase, user: null, error: null }
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request)

  if (authError) {
    return authError
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no está configurado.', predictions: [] },
      { status: 500 }
    )
  }

  if (!user) {
    return NextResponse.json({ predictions: [] })
  }

  const { data, error: predictionsError } = await supabase
    .from('predictions')
    .select('id, user_id, match_id, predicted_home_score, predicted_away_score, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (predictionsError) {
    return NextResponse.json(
      { error: predictionsError.message, predictions: [] },
      { status: 500 }
    )
  }

  const predictionIds = ((data ?? []) as PredictionRow[]).map((prediction) => prediction.id)
  const predictedMatchIds = [
    ...new Set(((data ?? []) as PredictionRow[]).map((prediction) => prediction.match_id)),
  ]
  const scoresByPredictionId = new Map<string, PredictionScoreRow>()
  const scoresByUserAndMatchId = new Map<string, PredictionScoreRow>()

  if (predictedMatchIds.length) {
    try {
      const adminSupabase = getSupabaseAdminClient()

      await Promise.all(
        predictedMatchIds.map((matchId) => recalculateProdePoints(adminSupabase, matchId))
      )
    } catch (recalculateError) {
      console.error('[prode/my-predictions] No se pudieron recalcular puntos antes de leerlos', {
        message:
          recalculateError instanceof Error
            ? recalculateError.message
            : 'Error desconocido',
      })
    }
  }

  if (predictionIds.length) {
    const primaryScores = await supabase
      .from('prediction_scores')
      .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
      .in('prediction_id', predictionIds)
    const fallbackScores = predictedMatchIds.length
      ? await supabase
          .from('prediction_scores')
          .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
          .eq('user_id', user.id)
          .in('match_id', predictedMatchIds)
      : { data: [], error: null }
    const pointsScores = await supabase
      .from('points')
      .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
      .in('prediction_id', predictionIds)
    const scoresError = primaryScores.error ?? fallbackScores.error
    const scores = [
      ...(primaryScores.data ?? []),
      ...(fallbackScores.data ?? []),
      ...(pointsScores.error ? [] : pointsScores.data ?? []),
    ]

    if (scoresError) {
      console.error('[prode/my-predictions] Error leyendo prediction_scores', scoresError)
    }

    if (pointsScores.error && pointsScores.error.code !== '42P01' && pointsScores.error.code !== 'PGRST205') {
      console.error('[prode/my-predictions] Error leyendo points', pointsScores.error)
    }

    for (const score of scores as PredictionScoreRow[]) {
      scoresByPredictionId.set(score.prediction_id, score)
      scoresByUserAndMatchId.set(`${score.user_id}:${String(score.match_id)}`, score)
    }
  }

  const predictions = ((data ?? []) as PredictionRow[]).map((prediction) => {
    const score =
      scoresByPredictionId.get(prediction.id) ??
      scoresByUserAndMatchId.get(`${prediction.user_id}:${String(prediction.match_id)}`)

    return {
      prediction_id: prediction.id,
      match_id: String(prediction.match_id),
      points: score?.points ?? 0,
      exact_hit: score?.exact_hit ?? false,
      partial_hit: score?.partial_hit ?? false,
      exactHit: score?.exact_hit ?? false,
      partialHit: score?.partial_hit ?? false,
      id: prediction.id,
      userId: prediction.user_id,
      matchId: String(prediction.match_id),
      predictedHomeScore: prediction.predicted_home_score,
      predictedAwayScore: prediction.predicted_away_score,
      createdAt: prediction.created_at,
      updatedAt: prediction.updated_at,
    }
  })

  return NextResponse.json({ predictions })
}
