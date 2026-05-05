import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'
import { isFinalMatchStatus } from '@/shared/utils/match-status'
import { calculatePredictionPoints } from '@/shared/utils/prode-points'

type DiagnosticError = Error & {
  code?: string
  detail?: string
  details?: string
  hint?: string
}

function sanitizeDiagnostic(value: unknown) {
  if (typeof value !== 'string') return value

  return value
    .replace(/(service_role|anon|apikey|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-jwt]')
}

function getDiagnosticPayload(error: unknown) {
  const diagnosticError = error as DiagnosticError
  const message =
    error instanceof Error ? error.message : 'No se pudieron recalcular puntos.'
  const detail =
    diagnosticError.detail ??
    diagnosticError.details ??
    diagnosticError.hint ??
    getFriendlyDetail(diagnosticError.code)

  return {
    ok: false,
    error: sanitizeDiagnostic(message),
    detail: sanitizeDiagnostic(detail ?? 'Error inesperado en recalculate-points.'),
    code: diagnosticError.code ?? null,
  }
}

function getFriendlyDetail(code: string | undefined) {
  if (code === 'PGRST202') {
    return 'No existe la funcion SQL public.recalculate_prediction_scores(target_match_id). Ejecutar migraciones de Supabase.'
  }

  if (code === '42P01' || code === 'PGRST205') {
    return 'Falta una tabla requerida del prode: predictions, prediction_scores, points o leaderboards.'
  }

  if (code === '42703') {
    return 'Falta una columna requerida para calcular puntos del prode.'
  }

  return null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    if (!cronSecret) {
      console.info('[recalculate-points] Ejecucion local autorizada sin CRON_SECRET.')
    }

    return true
  }

  if (!cronSecret) {
    console.warn('[recalculate-points] Rechazado: CRON_SECRET no esta configurado en produccion.')
    return false
  }

  const authorized = request.headers.get('x-cron-secret') === cronSecret

  if (!authorized) {
    console.warn('[recalculate-points] Rechazado: x-cron-secret faltante o invalido.')
  }

  return authorized
}

async function getMatchId(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => null) : null
  const matchId =
    searchParams.get('matchId') ??
    searchParams.get('match_id') ??
    body?.matchId ??
    body?.match_id ??
    null

  if (matchId === null || matchId === undefined || matchId === '') return null

  return String(matchId)
}

async function getRecalculateDiagnostics(
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const [
    predictionsResult,
    scoresResult,
    leaderboardsResult,
  ] = await Promise.all([
    supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score'),
    supabase
      .from('prediction_scores')
      .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit'),
    supabase.from('leaderboards').select('*'),
  ])

  if (predictionsResult.error) throw predictionsResult.error
  if (scoresResult.error) throw scoresResult.error
  if (leaderboardsResult.error) throw leaderboardsResult.error

  const predictions = predictionsResult.data ?? []
  const scores = scoresResult.data ?? []
  const matchIds = [...new Set(predictions.map((prediction) => String(prediction.match_id)))]
  const matches: Array<{
    id: string | number
    home_score: number | null
    away_score: number | null
    league_id: string | number | null
    status: string | null
  }> = []

  for (let index = 0; index < matchIds.length; index += 100) {
    const chunk = matchIds.slice(index, index + 100)
    const response = await supabase
      .from('matches')
      .select('id, home_score, away_score, league_id, status')
      .in('id', chunk)

    if (response.error) throw response.error
    matches.push(...(response.data ?? []))
  }

  const matchesById = new Map(matches.map((match) => [String(match.id), match]))
  const scoreIds = new Set(scores.map((score) => score.prediction_id))
  const scoresByPredictionId = new Map(scores.map((score) => [score.prediction_id, score]))
  const isScorableFinalMatch = (match: (typeof matches)[number] | undefined) =>
    Boolean(
      match &&
      isFinalMatchStatus(match.status) &&
      match.home_score !== null &&
      match.away_score !== null
    )
  const predictionsFinal = predictions.filter((prediction) => {
    const match = matchesById.get(String(prediction.match_id))

    return isScorableFinalMatch(match)
  })
  const scoreRowsOnNonFinalMatches = scores.filter((score) => {
    const match = matchesById.get(String(score.match_id))

    return !isScorableFinalMatch(match)
  })
  const validScores = scores.filter((score) => {
    const match = matchesById.get(String(score.match_id))

    return isScorableFinalMatch(match)
  })
  const wrongScoresDetected = predictionsFinal.filter((prediction) => {
    const match = matchesById.get(String(prediction.match_id))
    const score = scoresByPredictionId.get(prediction.id)

    if (
      !match ||
      !score ||
      !isFinalMatchStatus(match.status) ||
      match.home_score === null ||
      match.away_score === null
    ) {
      return true
    }

    const expected = calculatePredictionPoints({
      predictedHomeScore: prediction.predicted_home_score,
      predictedAwayScore: prediction.predicted_away_score,
      realHomeScore: match.home_score,
      realAwayScore: match.away_score,
    })

    return (
      (score.points ?? 0) !== expected.points ||
      Boolean(score.exact_hit) !== expected.exact_hit ||
      Boolean(score.partial_hit) !== expected.partial_hit
    )
  })
  const missingPredictionScores = predictionsFinal.filter(
    (prediction) => !scoreIds.has(prediction.id)
  )
  const totalsByUser = [
    ...validScores
      .reduce((grouped, score) => {
        const current = grouped.get(score.user_id) ?? {
          user_id: score.user_id,
          total_points: 0,
          prediction_scores: 0,
          exact_predictions: 0,
          partial_predictions: 0,
        }

        current.total_points += score.points ?? 0
        current.prediction_scores += 1
        current.exact_predictions += score.exact_hit ? 1 : 0
        current.partial_predictions += score.partial_hit ? 1 : 0
        grouped.set(score.user_id, current)

        return grouped
      }, new Map<string, {
        user_id: string
        total_points: number
        prediction_scores: number
        exact_predictions: number
        partial_predictions: number
      }>())
      .values(),
  ].sort((a, b) => b.total_points - a.total_points)

  return {
    predictionsTotal: predictions.length,
    predictionsFinal: predictionsFinal.length,
    predictionsPending: predictions.length - predictionsFinal.length,
    predictionsWithResult: predictionsFinal.length,
    predictionScoresTotal: validScores.length,
    rawPredictionScoresTotal: scores.length,
    scoreRowsOnNonFinalMatches: scoreRowsOnNonFinalMatches.length,
    leaderboardsTotal: leaderboardsResult.data?.length ?? 0,
    wrongScoresDetected: wrongScoresDetected.length,
    wrongScoresSample: wrongScoresDetected.slice(0, 30).map((prediction) => ({
      prediction_id: prediction.id,
      user_id: prediction.user_id,
      match_id: prediction.match_id,
      predicted_home_score: prediction.predicted_home_score,
      predicted_away_score: prediction.predicted_away_score,
      real_home_score: matchesById.get(String(prediction.match_id))?.home_score ?? null,
      real_away_score: matchesById.get(String(prediction.match_id))?.away_score ?? null,
      stored_points: scoresByPredictionId.get(prediction.id)?.points ?? null,
      stored_exact_hit: scoresByPredictionId.get(prediction.id)?.exact_hit ?? null,
      stored_partial_hit: scoresByPredictionId.get(prediction.id)?.partial_hit ?? null,
    })),
    missingPredictionScoresTotal: missingPredictionScores.length,
    missingPredictionScores: missingPredictionScores.slice(0, 30).map((prediction) => ({
      prediction_id: prediction.id,
      user_id: prediction.user_id,
      match_id: prediction.match_id,
    })),
    totalsByUser,
  }
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const matchId = await getMatchId(request)
    const supabase = getSupabaseAdminClient()
    const beforeDiagnostics = await getRecalculateDiagnostics(supabase)
    const result = await recalculateProdePoints(supabase, matchId)
    const afterDiagnostics = await getRecalculateDiagnostics(supabase)

    return NextResponse.json({
      ok: true,
      ...result,
      recalculatedCount: result.calculated,
      predictionsTotal: afterDiagnostics.predictionsTotal,
      predictionsFinal: afterDiagnostics.predictionsFinal,
      predictionsPending: afterDiagnostics.predictionsPending,
      predictionsWithResult: afterDiagnostics.predictionsWithResult,
      predictionScoresBefore: beforeDiagnostics.predictionScoresTotal,
      predictionScoresAfter: afterDiagnostics.predictionScoresTotal,
      rawPredictionScoresBefore: beforeDiagnostics.rawPredictionScoresTotal,
      rawPredictionScoresAfter: afterDiagnostics.rawPredictionScoresTotal,
      scoresDeletedForNonFinalMatches:
        beforeDiagnostics.scoreRowsOnNonFinalMatches -
        afterDiagnostics.scoreRowsOnNonFinalMatches,
      scoresCreatedOrUpdated: result.calculated,
      missingScoresFixed:
        beforeDiagnostics.missingPredictionScoresTotal -
        afterDiagnostics.missingPredictionScoresTotal,
      incorrectScoresFixed:
        beforeDiagnostics.wrongScoresDetected - afterDiagnostics.wrongScoresDetected,
      wrongScoresFixed:
        beforeDiagnostics.wrongScoresDetected - afterDiagnostics.wrongScoresDetected,
      leaderboardsRecalculated: true,
      totalsByUser: afterDiagnostics.totalsByUser,
      diagnostics: afterDiagnostics,
      beforeDiagnostics,
    })
  } catch (error) {
    console.error('[recalculate-points] Error completo', error)

    return NextResponse.json(
      getDiagnosticPayload(error),
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
