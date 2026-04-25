import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isPredictionLocked } from '@/server/prode/rules'

type SavePredictionInput = {
  userId: string
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
}

export async function savePrediction(input: SavePredictionInput) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      ok: false,
      status: 500,
      error: 'Supabase no esta configurado.',
    }
  }

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, match_date, status')
    .eq('id', input.matchId)
    .single()

  if (matchError || !match) {
    return {
      ok: false,
      status: 404,
      error: 'Partido no encontrado.',
    }
  }

  if (isPredictionLocked(match.match_date)) {
    return {
      ok: false,
      status: 403,
      error: 'La predicción ya está bloqueada para este partido.',
    }
  }

  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: input.userId,
        match_id: input.matchId,
        predicted_home_score: input.predictedHomeScore,
        predicted_away_score: input.predictedAwayScore,
      },
      { onConflict: 'user_id,match_id' }
    )
    .select()
    .single()

  if (error) {
    return {
      ok: false,
      status: 500,
      error: error.message,
    }
  }

  return {
    ok: true,
    status: 200,
    data,
  }
}
