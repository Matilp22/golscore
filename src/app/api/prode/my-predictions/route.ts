import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { recalculateProdePoints } from '@/server/prode/points'

type PredictionScoreRow = {
  prediction_id: string
  user_id?: string | null
  match_id?: string | number | null
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number
  predicted_home_score: number
  predicted_away_score: number
  created_at: string
  updated_at: string
  prediction_scores?: PredictionScoreRow | PredictionScoreRow[] | null
}

type ApiError = {
  message?: string
  code?: string
  details?: string
}

function errorInfo(error: unknown) {
  const value = error as ApiError

  return {
    message:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudieron cargar tus predicciones.',
    code: value?.code ?? null,
    detail: value?.details ?? null,
  }
}

function normalizeScore(score: PredictionScoreRow | PredictionScoreRow[] | null | undefined) {
  if (Array.isArray(score)) return score[0] ?? null

  return score ?? null
}

async function getAuthenticatedUser(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      error: NextResponse.json({
        ok: false,
        error: 'Supabase no está configurado.',
        predictions: [],
      }),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return { supabase, user, error: null }

  const authorization = request.headers.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()

    if (token) {
      const {
        data: { user: tokenUser },
      } = await supabase.auth.getUser(token)

      if (tokenUser) return { supabase, user: tokenUser, error: null }
    }
  }

  return { supabase, user: null, error: null }
}

async function fetchScoresFallback(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  userId: string,
  predictionIds: string[],
  matchIds: string[]
) {
  const scoresByPredictionId = new Map<string, PredictionScoreRow>()
  const scoresByUserAndMatchId = new Map<string, PredictionScoreRow>()

  if (!predictionIds.length) return { scoresByPredictionId, scoresByUserAndMatchId }

  const [byPrediction, byMatch] = await Promise.all([
    supabase
      .from('prediction_scores')
      .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
      .in('prediction_id', predictionIds),
    matchIds.length
      ? supabase
          .from('prediction_scores')
          .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
          .eq('user_id', userId)
          .in('match_id', matchIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const scores = [
    ...(byPrediction.error ? [] : byPrediction.data ?? []),
    ...(byMatch.error ? [] : byMatch.data ?? []),
  ] as PredictionScoreRow[]

  if (byPrediction.error) {
    console.error('[prode/my-predictions] Error fallback prediction_scores por prediction_id', byPrediction.error)
  }

  if (byMatch.error) {
    console.error('[prode/my-predictions] Error fallback prediction_scores por match_id', byMatch.error)
  }

  for (const score of scores) {
    scoresByPredictionId.set(score.prediction_id, score)

    if (score.user_id && score.match_id !== null && score.match_id !== undefined) {
      scoresByUserAndMatchId.set(`${score.user_id}:${String(score.match_id)}`, score)
    }
  }

  return { scoresByPredictionId, scoresByUserAndMatchId }
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request)

  if (authError) return authError

  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Supabase no está configurado.', predictions: [] })
  }

  if (!user) {
    return NextResponse.json({ ok: true, predictions: [] })
  }

  try {
    const { data: basePredictions, error: baseError } = await supabase
      .from('predictions')
      .select('id, user_id, match_id')
      .eq('user_id', user.id)

    if (baseError) throw baseError

    const matchIds = [
      ...new Set(((basePredictions ?? []) as Array<{ match_id: string | number }>).map((row) => String(row.match_id))),
    ]

    if (matchIds.length) {
      try {
        const adminSupabase = getSupabaseAdminClient()
        await Promise.all(matchIds.map((matchId) => recalculateProdePoints(adminSupabase, matchId)))
      } catch (recalculateError) {
        console.error('[prode/my-predictions] No se pudieron recalcular puntos antes de leerlos', errorInfo(recalculateError))
      }
    }

    const joined = await supabase
      .from('predictions')
      .select(`
        id,
        user_id,
        match_id,
        predicted_home_score,
        predicted_away_score,
        created_at,
        updated_at,
        prediction_scores (
          prediction_id,
          user_id,
          match_id,
          points,
          exact_hit,
          partial_hit
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const fallback = joined.error
      ? await supabase
          .from('predictions')
          .select('id, user_id, match_id, predicted_home_score, predicted_away_score, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      : null

    if (joined.error && fallback?.error) throw fallback.error

    if (joined.error) {
      console.error('[prode/my-predictions] LEFT JOIN prediction_scores falló; usando fallback', joined.error)
    }

    const rows = ((fallback?.data ?? joined.data ?? []) as PredictionRow[])
    const predictionIds = rows.map((prediction) => prediction.id)
    const rowMatchIds = [...new Set(rows.map((prediction) => String(prediction.match_id)))]
    const { scoresByPredictionId, scoresByUserAndMatchId } = await fetchScoresFallback(
      supabase,
      user.id,
      predictionIds,
      rowMatchIds
    )

    const predictions = rows.map((prediction) => {
      const joinedScore = normalizeScore(prediction.prediction_scores)
      const score =
        scoresByPredictionId.get(prediction.id) ??
        scoresByUserAndMatchId.get(`${prediction.user_id}:${String(prediction.match_id)}`) ??
        joinedScore

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

    return NextResponse.json({ ok: true, predictions })
  } catch (error) {
    console.error('[prode/my-predictions] Error completo', error)

    return NextResponse.json({
      ok: false,
      ...errorInfo(error),
      predictions: [],
    })
  }
}
