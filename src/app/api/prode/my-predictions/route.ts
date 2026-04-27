import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number
  predicted_home_score: number
  predicted_away_score: number
  created_at: string
  updated_at: string
}

type PredictionScoreRow = {
  prediction_id: string
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type ApiError = {
  message?: string
  code?: string
  details?: string
}

const DEBUG_PREDICTION_ID = '6890a62d-fb55-40cd-867f-96981a09122f'

function getErrorPayload(error: unknown) {
  const value = error as ApiError

  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudieron cargar tus predicciones.',
    code: value?.code ?? null,
    detail: value?.details ?? null,
    predictions: [],
  }
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

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request)
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')

  if (authError) return authError

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      error: 'Supabase no está configurado.',
      predictions: [],
    })
  }

  if (!user) {
    return NextResponse.json({ ok: true, predictions: [] })
  }

  try {
    const adminSupabase = getSupabaseAdminClient()
    let matchIdsForLeague: string[] | null = null

    if (leagueId) {
      const { data: leagueMatchesData, error: leagueMatchesError } = await adminSupabase
        .from('matches')
        .select('id')
        .eq('league_id', leagueId)

      if (leagueMatchesError) throw leagueMatchesError

      matchIdsForLeague = (leagueMatchesData ?? []).map((match) => String(match.id))

      if (!matchIdsForLeague.length) {
        return NextResponse.json({ ok: true, predictions: [] })
      }
    }

    let predictionsQuery = adminSupabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (matchIdsForLeague) {
      predictionsQuery = predictionsQuery.in('match_id', matchIdsForLeague)
    }

    const { data: predictionsData, error: predictionsError } = await predictionsQuery

    if (predictionsError) throw predictionsError

    const predictionRows = (predictionsData ?? []) as PredictionRow[]
    const predictionIds = predictionRows.map((prediction) => prediction.id)
    const scoresByPredictionId = new Map<string, PredictionScoreRow>()

    if (predictionIds.length) {
      const { data: scoresData, error: scoresError } = await adminSupabase
        .from('prediction_scores')
        .select('prediction_id, points, exact_hit, partial_hit')
        .in('prediction_id', predictionIds)

      if (scoresError) throw scoresError

      for (const score of (scoresData ?? []) as PredictionScoreRow[]) {
        scoresByPredictionId.set(score.prediction_id, score)
      }
    }

    console.info('[prode/my-predictions] response debug', {
      userId: user.id,
      leagueId,
      predictions: predictionRows.length,
      predictionScoresRead: scoresByPredictionId.size,
      debugPrediction: scoresByPredictionId.get(DEBUG_PREDICTION_ID) ?? null,
      pointsByPredictionId: predictionRows.map((prediction) => ({
        prediction_id: prediction.id,
        match_id: String(prediction.match_id),
        points: scoresByPredictionId.get(prediction.id)?.points ?? 0,
        exact_hit: scoresByPredictionId.get(prediction.id)?.exact_hit ?? false,
        partial_hit: scoresByPredictionId.get(prediction.id)?.partial_hit ?? false,
      })),
    })

    const predictions = predictionRows.map((prediction) => {
      const score = scoresByPredictionId.get(prediction.id)

      return {
        prediction_id: prediction.id,
        match_id: String(prediction.match_id),
        predicted_home_score: prediction.predicted_home_score,
        predicted_away_score: prediction.predicted_away_score,
        points: score?.points ?? 0,
        exact_hit: score?.exact_hit ?? false,
        partial_hit: score?.partial_hit ?? false,
        id: prediction.id,
        userId: prediction.user_id,
        matchId: String(prediction.match_id),
        predictedHomeScore: prediction.predicted_home_score,
        predictedAwayScore: prediction.predicted_away_score,
        exactHit: score?.exact_hit ?? false,
        partialHit: score?.partial_hit ?? false,
        createdAt: prediction.created_at,
        updatedAt: prediction.updated_at,
      }
    })

    return NextResponse.json({ ok: true, predictions })
  } catch (error) {
    console.error('[prode/my-predictions] Error completo', error)

    return NextResponse.json(getErrorPayload(error))
  }
}
