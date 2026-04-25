import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { savePrediction } from '@/server/prode/service'

async function getAuthenticatedUser(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      error: NextResponse.json(
        { error: 'Supabase no esta configurado.' },
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
    error: NextResponse.json(
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
    return NextResponse.json(
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
    return NextResponse.json(
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

  return NextResponse.json({
    prediction: {
      id: prediction.id,
      userId: prediction.user_id,
      matchId: prediction.match_id,
      predictedHomeScore: prediction.predicted_home_score,
      predictedAwayScore: prediction.predicted_away_score,
      createdAt: prediction.created_at,
      updatedAt: prediction.updated_at,
    },
  })
}
