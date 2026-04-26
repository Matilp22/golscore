import type { SupabaseClient } from '@supabase/supabase-js'

export type RecalculateProdePointsResult = {
  matchId: string | number | null
  calculated: number
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

  if (!uniqueUserIds.length) return

  const { data: scores, error: scoresError } = await supabase
    .from('prediction_scores')
    .select('user_id, points, exact_hit, partial_hit')
    .in('user_id', uniqueUserIds)

  if (scoresError) {
    console.error('[prode/points] No se pudieron leer prediction_scores para leaderboards', {
      message: scoresError.message,
      code: scoresError.code ?? null,
      details: scoresError.details ?? null,
    })
    return
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', uniqueUserIds)

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

  for (const score of (scores ?? []) as Array<{
    user_id: string
    points: number | null
    exact_hit: boolean | null
    partial_hit: boolean | null
  }>) {
    const profile = profilesById.get(score.user_id)
    const current = grouped.get(score.user_id) ?? {
      user_id: score.user_id,
      name: profile?.display_name ?? profile?.username ?? 'Usuario',
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

  const leaderboardRows = uniqueUserIds.map((userId) => {
    const profile = profilesById.get(userId)

    return grouped.get(userId) ?? {
      user_id: userId,
      name: profile?.display_name ?? profile?.username ?? 'Usuario',
      points: 0,
      played: 0,
      exact_hits: 0,
      partial_hits: 0,
      updated_at: now,
    }
  })

  const { error } = await supabase
    .from('leaderboards')
    .upsert(leaderboardRows, { onConflict: 'user_id' })

  if (error) {
    console.error('[prode/points] No se pudo actualizar leaderboards', {
      message: error.message,
      code: error.code ?? null,
      details: error.details ?? null,
    })
  }
}

async function recalculateProdePointsInApp(
  supabase: SupabaseClient,
  targetMatchId: number | null
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

  for (const prediction of predictionRows) {
    const matchId = String(prediction.match_id)
    const match = matchesById.get(matchId)
    const result = resultsByMatchId.get(matchId)
    const homeScore = result?.home_score ?? match?.home_score ?? null
    const awayScore = result?.away_score ?? match?.away_score ?? null

    if (homeScore === null || awayScore === null) continue

    scoreRows.push({
      prediction_id: prediction.id,
      user_id: prediction.user_id,
      match_id: prediction.match_id,
      ...calculatePredictionScore(prediction, homeScore, awayScore),
      calculated_at: now,
    })
  }

  if (!scoreRows.length) return 0

  const { error: scoreError } = await supabase
    .from('prediction_scores')
    .upsert(scoreRows, { onConflict: 'prediction_id' })

  if (scoreError) {
    throw new ProdePointsRecalculationError(scoreError)
  }

  const { error: pointsError } = await supabase
    .from('points')
    .upsert(scoreRows, { onConflict: 'prediction_id' })

  if (pointsError && pointsError.code !== '42P01' && pointsError.code !== 'PGRST205') {
    throw new ProdePointsRecalculationError(pointsError)
  }

  await refreshLeaderboards(
    supabase,
    scoreRows.map((score) => score.user_id)
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
      : Number(matchId)

  if (targetMatchId !== null && !Number.isFinite(targetMatchId)) {
    throw new Error('matchId invalido para recalcular puntos.')
  }

  const calculated = await recalculateProdePointsInApp(supabase, targetMatchId)

  return {
    matchId: targetMatchId,
    calculated,
  }
}
