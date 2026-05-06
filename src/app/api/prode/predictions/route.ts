import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { savePrediction } from '@/server/prode/service'
import { isFinalMatchStatus } from '@/shared/utils/match-status'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

async function getAuthenticatedUser(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      error: jsonNoStore(
        { error: 'Supabase no está configurado.' },
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

  return {
    supabase,
    user: null,
    error: jsonNoStore(
      { error: 'Necesitás iniciar sesión para guardar predicciones.' },
      { status: 401 }
    ),
  }
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser(request)

  if (error || !user) {
    return error
  }

  const body = await request.json().catch(() => null)
  const matchId = typeof body?.matchId === 'string' ? body.matchId : ''
  const predictedHomeScore = Number(body?.predictedHomeScore)
  const predictedAwayScore = Number(body?.predictedAwayScore)

  if (
    !matchId ||
    !Number.isInteger(predictedHomeScore) ||
    !Number.isInteger(predictedAwayScore) ||
    predictedHomeScore < 0 ||
    predictedAwayScore < 0
  ) {
    return jsonNoStore(
      { error: 'Datos inválidos para guardar la predicción.' },
      { status: 400 }
    )
  }

  const result = await savePrediction({
    userId: user.id,
    matchId,
    predictedHomeScore,
    predictedAwayScore,
  })

  if (!result.ok) {
    return jsonNoStore(
      { error: result.error },
      { status: result.status }
    )
  }

  const prediction = result.data as {
    id: string
    user_id: string
    match_id: string
    predicted_home_score: number
    predicted_away_score: number
    created_at: string
    updated_at: string
  }
  const { data: predictionScore, error: predictionScoreError } = await getSupabaseAdminClient()
    .from('prediction_scores')
    .select('points, exact_hit, partial_hit')
    .eq('prediction_id', prediction.id)
    .maybeSingle()
  const { data: match } = await getSupabaseAdminClient()
    .from('matches')
    .select('status, home_score, away_score')
    .eq('id', prediction.match_id)
    .maybeSingle()
  const hasFinalResult =
    isFinalMatchStatus(match?.status) &&
    match?.home_score !== null &&
    match?.away_score !== null
  const visiblePredictionScore = hasFinalResult ? predictionScore : null

  if (predictionScoreError) {
    console.error('[prode/predictions] Error leyendo prediction_scores', {
      predictionId: prediction.id,
      message: predictionScoreError.message,
      code: predictionScoreError.code ?? null,
      details: predictionScoreError.details ?? null,
    })
  }

  return jsonNoStore({
    prediction: {
      id: prediction.id,
      userId: prediction.user_id,
      matchId: String(prediction.match_id),
      predictedHomeScore: prediction.predicted_home_score,
      predictedAwayScore: prediction.predicted_away_score,
      points: visiblePredictionScore?.points ?? null,
      exactHit: visiblePredictionScore?.exact_hit ?? false,
      partialHit: visiblePredictionScore?.partial_hit ?? false,
      predictionScoreFound: Boolean(visiblePredictionScore),
      createdAt: prediction.created_at,
      updatedAt: prediction.updated_at,
    },
  })
}
