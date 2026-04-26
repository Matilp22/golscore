import type { SupabaseClient } from '@supabase/supabase-js'

export type RecalculateProdePointsResult = {
  matchId: string | number | null
  calculated: number
  finalizedPredictions: number
}

type SupabaseRpcError = {
  message?: string
  details?: string
  detail?: string
  hint?: string
  code?: string
}

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number
  predicted_home_score: number
  predicted_away_score: number
}

type MatchScoreRow = {
  id: string | number
  home_score: number | null
  away_score: number | null
}

type ResultScoreRow = {
  match_id: string | number
  home_score: number | null
  away_score: number | null
}

type ScoreUpsertRow = {
  prediction_id: string
  user_id: string
  match_id: string | number
  points: number
  exact_hit: boolean
  partial_hit: boolean
  calculated_at: string
}

function omitCalculatedAt(rows: ScoreUpsertRow[]) {
  return rows.map((row) => {
    const { calculated_at: calculatedAt, ...withoutCalculatedAt } = row
    void calculatedAt

    return withoutCalculatedAt
  })
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
}

export class ProdePointsRecalculationError extends Error {
  code?: string
  detail?: string

  constructor(error: SupabaseRpcError) {
    const detail = error.details ?? error.detail ?? error.hint

    super(error.message ?? 'No se pudieron recalcular los puntos del prode.')

    this.name = 'ProdePointsRecalculationError'
    this.code = error.code
    this.detail = detail
  }
}

const FINAL_MATCH_STATUSES = new Set([
  'final',
  'ft',
  'aet',
  'pen',
  'finished',
  'match finished',
])

export function isFinalProdeStatus(status: string | null | undefined) {
  return FINAL_MATCH_STATUSES.has((status || '').trim().toLowerCase())
}

function getOutcome(homeScore: number, awayScore: number) {
  return Math.sign(homeScore - awayScore)
}

function calculatePredictionScore(prediction: PredictionRow, homeScore: number, awayScore: number) {
  const exactHit =
    prediction.predicted_home_score === homeScore &&
    prediction.predicted_away_score === awayScore
  const partialHit =
    !exactHit &&
    getOutcome(prediction.predicted_home_score, prediction.predicted_away_score) ===
      getOutcome(homeScore, awayScore)

  return {
    points: exactHit ? 3 : partialHit ? 1 : 0,
    exact_hit: exactHit,
    partial_hit: partialHit,
  }
}

async function refreshLeaderboards(supabase: SupabaseClient, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)]
  const isFullRefresh = uniqueUserIds.length === 0

  let scoresQuery = supabase
    .from('prediction_scores')
    .select('user_id, points, exact_hit, partial_hit')

  if (!isFullRefresh) {
    scoresQuery = scoresQuery.in('user_id', uniqueUserIds)
  }

  const { data: scores, error: scoresError } = await scoresQuery

  if (scoresError) {
    console.error('[prode/points] No se pudieron leer prediction_scores para leaderboards', {
      message: scoresError.message,
      code: scoresError.code ?? null,
      details: scoresError.details ?? null,
    })
    return
  }

  const scoreRows = (scores ?? []) as Array<{
    user_id: string
    points: number | null
    exact_hit: boolean | null
    partial_hit: boolean | null
  }>
  const leaderboardUserIds = isFullRefresh
    ? [...new Set(scoreRows.map((score) => score.user_id))]
    : uniqueUserIds

  if (isFullRefresh) {
    const { error: deleteError } = await supabase
      .from('leaderboards')
      .delete()
      .not('user_id', 'is', null)

    if (deleteError) {
      console.error('[prode/points] No se pudo limpiar leaderboards', {
        message: deleteError.message,
        code: deleteError.code ?? null,
        details: deleteError.details ?? null,
      })
    }
  } else {
    const { error: deleteError } = await supabase
      .from('leaderboards')
      .delete()
      .in('user_id', uniqueUserIds)

    if (deleteError) {
      console.error('[prode/points] No se pudieron limpiar leaderboards afectados', {
        message: deleteError.message,
        code: deleteError.code ?? null,
        details: deleteError.details ?? null,
      })
    }
  }

  if (!leaderboardUserIds.length) return

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', leaderboardUserIds)

  if (profilesError) {
    console.error('[prode/points] No se pudieron leer profiles para leaderboards', {
      message: profilesError.message,
      code: profilesError.code ?? null,
      details: profilesError.details ?? null,
    })
  }

  const profilesById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  )
  const grouped = new Map<
    string,
    {
      user_id: string
      name: string
      points: number
      played: number
      exact_hits: number
      partial_hits: number
      updated_at: string
    }
  >()
  const now = new Date().toISOString()

  for (const score of scoreRows) {
    const profile = profilesById.get(score.user_id)
    const current = grouped.get(score.user_id) ?? {
      user_id: score.user_id,
      name: profile?.username ?? profile?.display_name ?? 'Usuario',
      points: 0,
      played: 0,
      exact_hits: 0,
      partial_hits: 0,
      updated_at: now,
    }

    current.points += score.points ?? 0
    current.played += 1
    current.exact_hits += score.exact_hit ? 1 : 0
    current.partial_hits += score.partial_hit ? 1 : 0
    grouped.set(score.user_id, current)
  }

  const leaderboardRows = leaderboardUserIds.map((userId) => {
    const profile = profilesById.get(userId)

    return grouped.get(userId) ?? {
      user_id: userId,
      name: profile?.username ?? profile?.display_name ?? 'Usuario',
      points: 0,
      played: 0,
      exact_hits: 0,
      partial_hits: 0,
      updated_at: now,
    }
  })

  const canonicalRows = leaderboardRows.map((row) => ({
    user_id: row.user_id,
    total_points: row.points,
    exact_predictions: row.exact_hits,
    partial_predictions: row.partial_hits,
    updated_at: row.updated_at,
  }))
  const { error } = await supabase
    .from('leaderboards')
    .upsert(canonicalRows, { onConflict: 'user_id' })

  if (error) {
    if (error.code === '42703') {
      const { error: legacyError } = await supabase
        .from('leaderboards')
        .upsert(leaderboardRows, { onConflict: 'user_id' })

      if (!legacyError) return

      console.error('[prode/points] No se pudo actualizar leaderboards legacy', {
        message: legacyError.message,
        code: legacyError.code ?? null,
        details: legacyError.details ?? null,
      })
      return
    }

    console.error('[prode/points] No se pudo actualizar leaderboards', {
      message: error.message,
      code: error.code ?? null,
      details: error.details ?? null,
    })
  }
}

async function recalculateProdePointsInApp(
  supabase: SupabaseClient,
  targetMatchId: string | number | null
) {
  let predictionsQuery = supabase
    .from('predictions')
    .select('id, user_id, match_id, predicted_home_score, predicted_away_score')

  if (targetMatchId !== null) {
    predictionsQuery = predictionsQuery.eq('match_id', targetMatchId)
  }

  const { data: predictions, error: predictionsError } = await predictionsQuery

  if (predictionsError) {
    throw new ProdePointsRecalculationError(predictionsError)
  }

  const predictionRows = (predictions ?? []) as PredictionRow[]

  if (!predictionRows.length) {
    if (targetMatchId === null) {
      await refreshLeaderboards(supabase, [])
    }

    return 0
  }

  const matchIds = [...new Set(predictionRows.map((prediction) => String(prediction.match_id)))]
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, home_score, away_score')
    .in('id', matchIds)

  if (matchesError) {
    throw new ProdePointsRecalculationError(matchesError)
  }

  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('match_id, home_score, away_score')
    .in('match_id', matchIds)

  if (resultsError && resultsError.code !== '42P01' && resultsError.code !== 'PGRST205') {
    throw new ProdePointsRecalculationError(resultsError)
  }

  const matchesById = new Map(
    ((matches ?? []) as MatchScoreRow[]).map((match) => [String(match.id), match])
  )
  const resultsByMatchId = new Map(
    ((resultsError ? [] : results ?? []) as ResultScoreRow[]).map((result) => [
      String(result.match_id),
      result,
    ])
  )
  const now = new Date().toISOString()
  const scoreRows: ScoreUpsertRow[] = []
  const stalePredictionIds: string[] = []
  const affectedUserIds = [...new Set(predictionRows.map((prediction) => prediction.user_id))]

  for (const prediction of predictionRows) {
    const matchId = String(prediction.match_id)
    const match = matchesById.get(matchId)
    const result = resultsByMatchId.get(matchId)
    const homeScore = result?.home_score ?? match?.home_score ?? null
    const awayScore = result?.away_score ?? match?.away_score ?? null

    if (homeScore === null || awayScore === null) {
      stalePredictionIds.push(prediction.id)
      continue
    }

    scoreRows.push({
      prediction_id: prediction.id,
      user_id: prediction.user_id,
      match_id: prediction.match_id,
      ...calculatePredictionScore(prediction, homeScore, awayScore),
      calculated_at: now,
    })
  }

  if (stalePredictionIds.length) {
    const { error: staleScoreError } = await supabase
      .from('prediction_scores')
      .delete()
      .in('prediction_id', stalePredictionIds)

    if (staleScoreError) {
      throw new ProdePointsRecalculationError(staleScoreError)
    }

    const { error: stalePointsError } = await supabase
      .from('points')
      .delete()
      .in('prediction_id', stalePredictionIds)

    if (
      stalePointsError &&
      stalePointsError.code !== '42P01' &&
      stalePointsError.code !== 'PGRST205' &&
      stalePointsError.code !== '42703'
    ) {
      throw new ProdePointsRecalculationError(stalePointsError)
    }
  }

  if (!scoreRows.length) {
    await refreshLeaderboards(supabase, targetMatchId === null ? [] : affectedUserIds)
    return 0
  }

  let { error: scoreError } = await supabase
    .from('prediction_scores')
    .upsert(scoreRows, { onConflict: 'prediction_id' })

  if (scoreError?.code === 'PGRST204' && scoreError.message.includes('calculated_at')) {
    const retry = await supabase
      .from('prediction_scores')
      .upsert(omitCalculatedAt(scoreRows), { onConflict: 'prediction_id' })

    scoreError = retry.error
  }

  if (scoreError) {
    throw new ProdePointsRecalculationError(scoreError)
  }

  let { error: pointsError } = await supabase
    .from('points')
    .upsert(scoreRows, { onConflict: 'prediction_id' })

  if (pointsError?.code === 'PGRST204' && pointsError.message.includes('calculated_at')) {
    const retry = await supabase
      .from('points')
      .upsert(omitCalculatedAt(scoreRows), { onConflict: 'prediction_id' })

    pointsError = retry.error
  }

  if (
    pointsError &&
    pointsError.code !== '42P01' &&
    pointsError.code !== 'PGRST205' &&
    pointsError.code !== '42703' &&
    pointsError.code !== 'PGRST204'
  ) {
    throw new ProdePointsRecalculationError(pointsError)
  }

  await refreshLeaderboards(
    supabase,
    targetMatchId === null ? [] : affectedUserIds
  )

  return scoreRows.length
}

export async function recalculateProdePoints(
  supabase: SupabaseClient,
  matchId: string | number | null = null
): Promise<RecalculateProdePointsResult> {
  const targetMatchId =
    matchId === null || matchId === undefined || matchId === ''
      ? null
      : typeof matchId === 'number'
        ? matchId
        : String(matchId)

  if (typeof targetMatchId === 'number' && !Number.isFinite(targetMatchId)) {
    throw new Error('matchId invalido para recalcular puntos.')
  }

  const calculated = await recalculateProdePointsInApp(supabase, targetMatchId)

  return {
    matchId: targetMatchId,
    calculated,
    finalizedPredictions: calculated,
  }
}
