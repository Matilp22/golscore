import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type PredictionRow = {
  id: string
  user_id: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  created_at: string
  updated_at: string
}

async function getAuthenticatedUser(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      error: NextResponse.json(
        { error: 'Supabase no esta configurado.', predictions: [] },
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
      { error: 'Supabase no esta configurado.', predictions: [] },
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

  const predictions = ((data ?? []) as PredictionRow[]).map((prediction) => ({
    id: prediction.id,
    userId: prediction.user_id,
    matchId: prediction.match_id,
    predictedHomeScore: prediction.predicted_home_score,
    predictedAwayScore: prediction.predicted_away_score,
    createdAt: prediction.created_at,
    updatedAt: prediction.updated_at,
  }))

  return NextResponse.json({ predictions })
}
