import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'
import { syncFixtureById } from '@/server/prode/sync-matches'
import { isScoreboardGoalEvent } from '@/shared/utils/football-events'
import { isFinishedStatus } from '@/shared/utils/match-status'
import { calculatePredictionPoints } from '@/shared/utils/prode-points'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
  status: string | null
}

type MatchEventRow = {
  id: string
  match_id: DbId
  team_id: DbId | null
  type: string | null
  detail: string | null
}

type PredictionRow = {
  id: string
  user_id: string
  match_id: DbId
  predicted_home_score: number
  predicted_away_score: number
}

type PredictionScoreRow = {
  prediction_id: string
  user_id: string
  match_id: DbId
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
  is_exact?: boolean | null
  is_partial?: boolean | null
}

type LeaderboardRow = {
  user_id: string
  total_points?: number | null
  points?: number | null
  exact_predictions?: number | null
  exact_hits?: number | null
  partial_predictions?: number | null
  partial_hits?: number | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }

  return String(error)
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

async function fetchAllRows<T>(
  table: string,
  select: string,
  orderColumn = 'id'
) {
  const supabase = getSupabaseAdminClient()
  const pageSize = 1000
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const response = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as T[]))

    if (!response.data || response.data.length < pageSize) break
  }

  return rows
}

async function fetchPredictionScores() {
  try {
    return await fetchAllRows<PredictionScoreRow>(
      'prediction_scores',
      'prediction_id, user_id, match_id, points, exact_hit, partial_hit, is_exact, is_partial',
      'prediction_id'
    )
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

    if (!message.includes('is_exact') && !message.includes('is_partial')) {
      throw error
    }

    return fetchAllRows<PredictionScoreRow>(
      'prediction_scores',
      'prediction_id, user_id, match_id, points, exact_hit, partial_hit',
      'prediction_id'
    )
  }
}

async function fetchLeaderboards() {
  try {
    return await fetchAllRows<LeaderboardRow>(
      'leaderboards',
      'user_id, total_points, points, exact_predictions, exact_hits, partial_predictions, partial_hits',
      'user_id'
    )
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase()

    if (!message.includes('points') && !message.includes('exact') && !message.includes('partial')) {
      throw error
    }

    return fetchAllRows<LeaderboardRow>(
      'leaderboards',
      'user_id, total_points, exact_predictions, partial_predictions',
      'user_id'
    ).catch(() =>
      fetchAllRows<LeaderboardRow>(
        'leaderboards',
        'user_id, name, points, played, exact_hits, partial_hits',
        'user_id'
      )
    )
  }
}

function scoreMatchesExpected(
  score: PredictionScoreRow | undefined,
  expected: ReturnType<typeof calculatePredictionPoints>
) {
  if (!score) return false

  const legacyExactMatches =
    score.is_exact === undefined ||
    score.is_exact === null ||
    score.is_exact === expected.is_exact
  const legacyPartialMatches =
    score.is_partial === undefined ||
    score.is_partial === null ||
    score.is_partial === expected.is_partial

  return (
    (score.points ?? 0) === expected.points &&
    Boolean(score.exact_hit) === expected.exact_hit &&
    Boolean(score.partial_hit) === expected.partial_hit &&
    legacyExactMatches &&
    legacyPartialMatches
  )
}

function getLeaderboardTotals(scores: PredictionScoreRow[]) {
  const grouped = new Map<string, {
    user_id: string
    total_points: number
    exact_predictions: number
    partial_predictions: number
  }>()

  for (const score of scores) {
    const current = grouped.get(score.user_id) ?? {
      user_id: score.user_id,
      total_points: 0,
      exact_predictions: 0,
      partial_predictions: 0,
    }

    current.total_points += score.points ?? 0
    current.exact_predictions += score.exact_hit ? 1 : 0
    current.partial_predictions += score.partial_hit ? 1 : 0
    grouped.set(score.user_id, current)
  }

  return [...grouped.values()]
}

async function collectAudit() {
  const [
    matches,
    events,
    predictions,
    scores,
    leaderboards,
  ] = await Promise.all([
    fetchAllRows<MatchRow>(
      'matches',
      'id, external_id, league_id, home_team_id, away_team_id, home_score, away_score, status'
    ),
    fetchAllRows<MatchEventRow>(
      'match_events',
      'id, match_id, team_id, type, detail'
    ),
    fetchAllRows<PredictionRow>(
      'predictions',
      'id, user_id, match_id, predicted_home_score, predicted_away_score'
    ),
    fetchPredictionScores(),
    fetchLeaderboards(),
  ])
  const matchesById = new Map(matches.map((match) => [String(match.id), match]))
  const goalEvents = events.filter((event) =>
    isScoreboardGoalEvent(event.type, event.detail)
  )
  const goalEventsByMatchId = goalEvents.reduce<Map<string, number>>((accumulator, event) => {
    const matchId = String(event.match_id)
    accumulator.set(matchId, (accumulator.get(matchId) ?? 0) + 1)

    return accumulator
  }, new Map())
  const scoredMatches = matches.filter((match) =>
    match.home_score !== null && match.away_score !== null
  )
  const finishedMatches = matches.filter((match) => isFinishedStatus(match.status))
  const matchesWithScoreButInsufficientEvents = scoredMatches
    .map((match) => {
      const expectedGoals = (match.home_score ?? 0) + (match.away_score ?? 0)
      const goalEventsCount = goalEventsByMatchId.get(String(match.id)) ?? 0

      return {
        match_id: match.id,
        external_id: match.external_id,
        home_score: match.home_score,
        away_score: match.away_score,
        status: match.status,
        expected_goals: expectedGoals,
        goal_events_count: goalEventsCount,
        missing_goal_events: expectedGoals - goalEventsCount,
      }
    })
    .filter((match) => match.missing_goal_events > 0)
  const eventsWithInvalidTeam = goalEvents.filter((event) => {
    const match = matchesById.get(String(event.match_id))

    if (!match) return true
    if (event.team_id === null) return false

    return (
      String(event.team_id) !== String(match.home_team_id) &&
      String(event.team_id) !== String(match.away_team_id)
    )
  })
  const duplicateExternalIds = [
    ...matches
      .filter((match) => match.external_id !== null)
      .reduce<Map<string, number>>((accumulator, match) => {
        const externalId = String(match.external_id)
        accumulator.set(externalId, (accumulator.get(externalId) ?? 0) + 1)

        return accumulator
      }, new Map())
      .entries(),
  ]
    .filter(([, count]) => count > 1)
    .map(([external_id, count]) => ({ external_id, count }))
  const scoresByPredictionId = new Map(scores.map((score) => [score.prediction_id, score]))
  const predictionsWithResult = predictions.filter((prediction) => {
    const match = matchesById.get(String(prediction.match_id))

    return match?.home_score !== null && match?.away_score !== null
  })
  const missingPredictionScores = predictionsWithResult.filter((prediction) =>
    !scoresByPredictionId.has(prediction.id)
  )
  const incorrectPredictionScores = predictionsWithResult
    .map((prediction) => {
      const match = matchesById.get(String(prediction.match_id))
      const score = scoresByPredictionId.get(prediction.id)

      if (!match || match.home_score === null || match.away_score === null) return null

      const expected = calculatePredictionPoints({
        predictedHomeScore: prediction.predicted_home_score,
        predictedAwayScore: prediction.predicted_away_score,
        realHomeScore: match.home_score,
        realAwayScore: match.away_score,
      })

      if (scoreMatchesExpected(score, expected)) return null

      return {
        prediction_id: prediction.id,
        user_id: prediction.user_id,
        match_id: prediction.match_id,
        predicted_home_score: prediction.predicted_home_score,
        predicted_away_score: prediction.predicted_away_score,
        real_home_score: match.home_score,
        real_away_score: match.away_score,
        expected_points: expected.points,
        stored_points: score?.points ?? null,
        expected_exact_hit: expected.exact_hit,
        stored_exact_hit: score?.exact_hit ?? null,
        expected_partial_hit: expected.partial_hit,
        stored_partial_hit: score?.partial_hit ?? null,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const expectedLeaderboardTotals = getLeaderboardTotals(scores)
  const leaderboardsByUser = new Map(leaderboards.map((leaderboard) => [leaderboard.user_id, leaderboard]))
  const staleLeaderboards = expectedLeaderboardTotals.filter((expected) => {
    const stored = leaderboardsByUser.get(expected.user_id)

    if (!stored) return true

    return (
      (stored.total_points ?? stored.points ?? 0) !== expected.total_points ||
      (stored.exact_predictions ?? stored.exact_hits ?? 0) !== expected.exact_predictions ||
      (stored.partial_predictions ?? stored.partial_hits ?? 0) !== expected.partial_predictions
    )
  })

  return {
    total_matches: matches.length,
    total_final_matches: finishedMatches.length,
    total_scored_matches: scoredMatches.length,
    total_matches_with_score_but_insufficient_events:
      matchesWithScoreButInsufficientEvents.length,
    matches_with_score_but_insufficient_events_sample:
      matchesWithScoreButInsufficientEvents.slice(0, 30),
    total_predictions: predictions.length,
    total_predictions_with_result: predictionsWithResult.length,
    total_prediction_scores: scores.length,
    missing_prediction_scores: missingPredictionScores.length,
    missing_prediction_scores_sample: missingPredictionScores.slice(0, 30).map((prediction) => ({
      prediction_id: prediction.id,
      user_id: prediction.user_id,
      match_id: prediction.match_id,
    })),
    incorrect_prediction_scores: incorrectPredictionScores.length,
    incorrect_prediction_scores_sample: incorrectPredictionScores.slice(0, 30),
    total_leaderboards: leaderboards.length,
    stale_leaderboards: staleLeaderboards.length,
    stale_leaderboards_sample: staleLeaderboards.slice(0, 30),
    duplicate_external_ids: duplicateExternalIds.length,
    duplicate_external_ids_sample: duplicateExternalIds.slice(0, 30),
    events_with_invalid_team_id: eventsWithInvalidTeam.length,
    events_with_invalid_team_id_sample: eventsWithInvalidTeam.slice(0, 30),
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const shouldFix =
      searchParams.get('fix') === 'true' ||
      searchParams.get('repair') === 'true'
    const shouldFixEvents =
      searchParams.get('fixEvents') === 'true' ||
      searchParams.get('repairEvents') === 'true'
    const eventFixLimit = Math.min(
      Math.max(Number(searchParams.get('eventFixLimit') ?? 20), 1),
      50
    )
    const before = await collectAudit()

    if (!shouldFix && !shouldFixEvents) {
      return NextResponse.json({ ok: true, ...before })
    }

    const supabase = getSupabaseAdminClient()
    const eventRepairResults = []

    if (shouldFixEvents) {
      const targets = before.matches_with_score_but_insufficient_events_sample
        .filter((match) => match.external_id !== null && match.external_id !== undefined)
        .slice(0, eventFixLimit)

      for (const match of targets) {
        const fixtureId = Number(match.external_id)

        if (!Number.isFinite(fixtureId)) continue

        eventRepairResults.push(
          await syncFixtureById(supabase, fixtureId, { debug: true }).catch((error) => ({
            fixtureId,
            ok: false,
            error: getErrorMessage(error),
          }))
        )
      }
    }

    const recalculateResult = shouldFix
      ? await recalculateProdePoints(supabase, null)
      : null
    const after = await collectAudit()

    return NextResponse.json({
      ok: true,
      fixed: true,
      before,
      eventRepairResults,
      recalculateResult,
      after,
      incorrectScoresFixed:
        before.incorrect_prediction_scores - after.incorrect_prediction_scores,
      missingScoresFixed:
        before.missing_prediction_scores - after.missing_prediction_scores,
    })
  } catch (error) {
    console.error('[data-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error) || 'No se pudo auditar datos.',
      },
      { status: 500 }
    )
  }
}
