import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'
import { getPredictionLockState } from '@/shared/utils/prediction-lock'
import { getPredictionLockMinutesForMatch } from '@/shared/utils/prode-lock-exceptions'

type SavePredictionInput = {
  userId: string
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
}

function safeDateIso(value: Date) {
  const time = value.getTime()

  return Number.isFinite(time) ? value.toISOString() : null
}

export async function savePrediction(input: SavePredictionInput) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      ok: false,
      status: 500,
      error: 'Supabase no está configurado.',
    }
  }

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, match_date, status, home_score, away_score, home_team_id, away_team_id')
    .eq('id', input.matchId)
    .single()

  if (matchError || !match) {
    return {
      ok: false,
      status: 404,
      error: 'Partido no encontrado.',
    }
  }

  if (!match.match_date) {
    return {
      ok: false,
      status: 403,
      error: 'El partido todavia no tiene fecha y hora oficial para pronosticar.',
    }
  }

  const lockMinutes = getPredictionLockMinutesForMatch({
    id: match.id,
    matchDate: match.match_date,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
  })
  const lockState = getPredictionLockState(match.match_date, match.status, new Date(), {
    lockMinutes,
  })

  console.info('[prode/save-prediction] lock check', {
    matchId: input.matchId,
    match_date: match.match_date,
    status: match.status,
    now: safeDateIso(lockState.now),
    matchStart: safeDateIso(lockState.matchStart),
    lockAt: safeDateIso(lockState.lockAt),
    lockMinutes,
    minutesUntilMatch: Math.round(lockState.minutesUntilMatch * 10) / 10,
    locked: lockState.locked,
  })

  if (lockState.locked) {
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

  if (match.home_score !== null && match.away_score !== null) {
    try {
      await recalculateProdePoints(getSupabaseAdminClient(), input.matchId)
    } catch (recalculateError) {
      console.error('[prode/save-prediction] No se pudieron recalcular puntos', {
        matchId: input.matchId,
        error:
          recalculateError instanceof Error
            ? recalculateError.message
            : 'Error desconocido',
      })
    }
  }

  return {
    ok: true,
    status: 200,
    data,
  }
}
