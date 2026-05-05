import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { recalculateProdePoints } from '@/server/prode/points'
import { isFinalMatchStatus, isLiveStatus } from '@/shared/utils/match-status'
import { calculatePredictionPoints } from '@/shared/utils/prode-points'

type DbId = string | number
type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>

type PredictionRow = {
  id: string
  user_id: string
  match_id: DbId
  predicted_home_score: number
  predicted_away_score: number
}

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
  status: string | null
  match_date: string | null
}

type PredictionScoreRow = {
  prediction_id: string
  user_id: string
  match_id: DbId
  points: number | null
  exact_hit?: boolean | null
  partial_hit?: boolean | null
  is_exact?: boolean | null
  is_partial?: boolean | null
}

type TeamRow = {
  id: DbId
  name: string
}

type LeagueRow = {
  id: DbId
  name: string
  external_id: DbId | null
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
  email?: string | null
}

type AuditedPrediction = {
  predictionId: string
  userId: string
  username: string | null
  matchId: DbId
  externalId: DbId | null
  league: string | null
  leagueId: string | null
  homeTeam: string | null
  awayTeam: string | null
  matchDate: string | null
  matchStatus: string | null
  predictedHomeScore: number
  predictedAwayScore: number
  realHomeScore: number | null
  realAwayScore: number | null
  storedPoints: number | null
  expectedPoints: number | null
  storedExactHit: boolean | null
  expectedExactHit: boolean | null
  storedPartialHit: boolean | null
  expectedPartialHit: boolean | null
  storedIsExact: boolean | null
  expectedIsExact: boolean | null
  storedIsPartial: boolean | null
  expectedIsPartial: boolean | null
  status:
    | 'OK'
    | 'WRONG'
    | 'MISSING_SCORE'
    | 'FUTURE'
    | 'LIVE'
    | 'OVERDUE_WITHOUT_RESULT'
    | 'OVERDUE_WITHOUT_FINAL_STATUS'
    | 'OPEN_WITH_STALE_SCORE'
}

const OVERDUE_RESULT_GRACE_MS = 3 * 60 * 60 * 1000

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }

  return String(error)
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getProfileName(profile: ProfileRow | undefined) {
  return profile?.display_name ?? profile?.username ?? profile?.email ?? null
}

function getMatchDateMs(match: MatchRow) {
  if (!match.match_date) return null

  const ms = new Date(match.match_date).getTime()

  return Number.isNaN(ms) ? null : ms
}

function hasCompleteScore(match: MatchRow) {
  return match.home_score !== null && match.away_score !== null
}

function hasFinalResultForProde(match: MatchRow) {
  return isFinalMatchStatus(match.status) && hasCompleteScore(match)
}

function isFuturePrediction(match: MatchRow, nowMs: number) {
  const matchDateMs = getMatchDateMs(match)

  return (
    matchDateMs !== null &&
    matchDateMs > nowMs &&
    !isFinalMatchStatus(match.status)
  )
}

function isOverdueWithoutResult(match: MatchRow, nowMs: number) {
  const matchDateMs = getMatchDateMs(match)

  return (
    matchDateMs !== null &&
    matchDateMs < nowMs - OVERDUE_RESULT_GRACE_MS &&
    !isFinalMatchStatus(match.status) &&
    !hasCompleteScore(match)
  )
}

function isOverdueWithoutFinalStatus(match: MatchRow, nowMs: number) {
  const matchDateMs = getMatchDateMs(match)

  return (
    matchDateMs !== null &&
    matchDateMs < nowMs - OVERDUE_RESULT_GRACE_MS &&
    !isFinalMatchStatus(match.status)
  )
}

function getExpectedScore(prediction: PredictionRow, match: MatchRow) {
  if (!hasFinalResultForProde(match)) return null

  return calculatePredictionPoints({
    predictedHomeScore: prediction.predicted_home_score,
    predictedAwayScore: prediction.predicted_away_score,
    realHomeScore: match.home_score as number,
    realAwayScore: match.away_score as number,
  })
}

function scoreMatchesExpected(
  score: PredictionScoreRow | undefined,
  expected: NonNullable<ReturnType<typeof getExpectedScore>>
) {
  if (!score) return false

  const legacyExactMatches =
    score.is_exact === undefined ||
    score.is_exact === null ||
    score.is_exact === expected.exact_hit
  const legacyPartialMatches =
    score.is_partial === undefined ||
    score.is_partial === null ||
    score.is_partial === expected.partial_hit

  return (
    (score.points ?? 0) === expected.points &&
    Boolean(score.exact_hit) === expected.exact_hit &&
    Boolean(score.partial_hit) === expected.partial_hit &&
    legacyExactMatches &&
    legacyPartialMatches
  )
}

async function fetchRowsByIds<T>(
  supabase: SupabaseAdminClient,
  table: string,
  select: string,
  ids: string[],
  column = 'id'
) {
  const rows: T[] = []

  for (const chunk of chunkArray([...new Set(ids)], 100)) {
    const response = await supabase.from(table).select(select).in(column, chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as T[]))
  }

  return rows
}

async function resolveLeagueIds(
  supabase: SupabaseAdminClient,
  leagueId: string | null,
  leagueExternalId: string | null
) {
  if (leagueId) return [leagueId]
  if (!leagueExternalId) return null

  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', leagueExternalId)

  if (response.error) throw response.error

  return (response.data ?? []).map((league) => String(league.id))
}

async function fetchPredictionsByMatchIds(
  supabase: SupabaseAdminClient,
  matchIds: string[]
) {
  const rows: PredictionRow[] = []

  for (const chunk of chunkArray(matchIds, 80)) {
    const response = await supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score')
      .in('match_id', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as PredictionRow[]))
  }

  return rows
}

async function fetchPredictionScores(
  supabase: SupabaseAdminClient,
  predictionIds: string[]
) {
  if (!predictionIds.length) return []

  return fetchRowsByIds<PredictionScoreRow>(
    supabase,
    'prediction_scores',
    'prediction_id, user_id, match_id, points, exact_hit, partial_hit, is_exact, is_partial',
    predictionIds,
    'prediction_id'
  ).catch(async (error) => {
    const message = getErrorMessage(error).toLowerCase()

    if (!message.includes('is_exact') && !message.includes('is_partial')) {
      throw error
    }

    return fetchRowsByIds<PredictionScoreRow>(
      supabase,
      'prediction_scores',
      'prediction_id, user_id, match_id, points, exact_hit, partial_hit',
      predictionIds,
      'prediction_id'
    )
  })
}

async function fetchProfilesByUserIds(
  supabase: SupabaseAdminClient,
  userIds: string[]
) {
  if (!userIds.length) return []

  return fetchRowsByIds<ProfileRow>(
    supabase,
    'profiles',
    'id, username, display_name, email',
    userIds
  ).catch(async (error) => {
    const message = getErrorMessage(error).toLowerCase()

    if (
      !message.includes('display_name') &&
      !message.includes('email') &&
      !message.includes('schema cache')
    ) {
      throw error
    }

    return fetchRowsByIds<ProfileRow>(supabase, 'profiles', 'id, username', userIds)
  })
}

function buildAuditedPrediction(input: {
  prediction: PredictionRow
  match: MatchRow
  score: PredictionScoreRow | undefined
  expected: ReturnType<typeof getExpectedScore>
  status: AuditedPrediction['status']
  teamsById: Map<string, TeamRow>
  leaguesById: Map<string, LeagueRow>
  profilesById: Map<string, ProfileRow>
}): AuditedPrediction {
  const { prediction, match, score, expected, status, teamsById, leaguesById, profilesById } = input
  const league = match.league_id === null ? null : leaguesById.get(String(match.league_id))
  const home = match.home_team_id === null ? null : teamsById.get(String(match.home_team_id))
  const away = match.away_team_id === null ? null : teamsById.get(String(match.away_team_id))

  return {
    predictionId: prediction.id,
    userId: prediction.user_id,
    username: getProfileName(profilesById.get(prediction.user_id)),
    matchId: prediction.match_id,
    externalId: match.external_id,
    league: league?.name ?? null,
    leagueId: match.league_id === null ? null : String(match.league_id),
    homeTeam: home?.name ?? null,
    awayTeam: away?.name ?? null,
    matchDate: match.match_date,
    matchStatus: match.status,
    predictedHomeScore: prediction.predicted_home_score,
    predictedAwayScore: prediction.predicted_away_score,
    realHomeScore: match.home_score,
    realAwayScore: match.away_score,
    storedPoints: score?.points ?? null,
    expectedPoints: expected?.points ?? null,
    storedExactHit: score?.exact_hit ?? null,
    expectedExactHit: expected?.exact_hit ?? null,
    storedPartialHit: score?.partial_hit ?? null,
    expectedPartialHit: expected?.partial_hit ?? null,
    storedIsExact: score?.is_exact ?? null,
    expectedIsExact: expected?.is_exact ?? null,
    storedIsPartial: score?.is_partial ?? null,
    expectedIsPartial: expected?.is_partial ?? null,
    status,
  }
}

async function collectAudit(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')
  const leagueExternalId = searchParams.get('leagueExternalId')
  const userId = searchParams.get('userId')
  const nowMs = Date.now()
  const supabase = getSupabaseAdminClient()
  const leagueIds = await resolveLeagueIds(supabase, leagueId, leagueExternalId)
  let predictions: PredictionRow[]

  if (leagueIds) {
    const scopedMatches = await fetchRowsByIds<MatchRow>(
      supabase,
      'matches',
      'id',
      leagueIds,
      'league_id'
    )
    const scopedMatchIds = scopedMatches.map((match) => String(match.id))

    predictions = scopedMatchIds.length
      ? await fetchPredictionsByMatchIds(supabase, scopedMatchIds)
      : []
  } else {
    const predictionsResponse = await supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score')

    if (predictionsResponse.error) throw predictionsResponse.error

    predictions = (predictionsResponse.data ?? []) as PredictionRow[]
  }

  if (userId) {
    predictions = predictions.filter((prediction) => prediction.user_id === userId)
  }

  const predictionIds = predictions.map((prediction) => prediction.id)
  const matchIds = [...new Set(predictions.map((prediction) => String(prediction.match_id)))]
  const [matches, scores] = await Promise.all([
    fetchRowsByIds<MatchRow>(
      supabase,
      'matches',
      'id, external_id, league_id, home_team_id, away_team_id, home_score, away_score, status, match_date',
      matchIds
    ),
    fetchPredictionScores(supabase, predictionIds),
  ])
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [
          match.home_team_id === null ? null : String(match.home_team_id),
          match.away_team_id === null ? null : String(match.away_team_id),
        ])
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const leagueRowIds = [
    ...new Set(
      matches
        .map((match) => (match.league_id === null ? null : String(match.league_id)))
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const userIds = [...new Set(predictions.map((prediction) => prediction.user_id))]
  const [teams, leagues, profiles] = await Promise.all([
    fetchRowsByIds<TeamRow>(supabase, 'teams', 'id, name', teamIds),
    fetchRowsByIds<LeagueRow>(supabase, 'leagues', 'id, name, external_id', leagueRowIds),
    fetchProfilesByUserIds(supabase, userIds),
  ])
  const matchesById = new Map(matches.map((match) => [String(match.id), match]))
  const scoresByPredictionId = new Map(scores.map((score) => [score.prediction_id, score]))
  const teamsById = new Map(teams.map((team) => [String(team.id), team]))
  const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const futurePredictions: AuditedPrediction[] = []
  const livePredictions: AuditedPrediction[] = []
  const finalPredictions: AuditedPrediction[] = []
  const overduePredictionsWithoutResult: AuditedPrediction[] = []
  const overduePredictionsWithoutFinalStatus: AuditedPrediction[] = []
  const missingScoresForFinalMatches: AuditedPrediction[] = []
  const wrongScores: AuditedPrediction[] = []
  const openPredictionsWithStaleScore: AuditedPrediction[] = []
  const totalsByUser = new Map<string, {
    user_id: string
    username: string | null
    total_points: number
    scored_predictions: number
    exact_predictions: number
    partial_predictions: number
  }>()

  for (const prediction of predictions) {
    const match = matchesById.get(String(prediction.match_id))
    if (!match) continue

    const score = scoresByPredictionId.get(prediction.id)
    const expected = getExpectedScore(prediction, match)

    if (expected) {
      const isOk = scoreMatchesExpected(score, expected)
      const auditedPrediction = buildAuditedPrediction({
        prediction,
        match,
        score,
        expected,
        status: !score ? 'MISSING_SCORE' : isOk ? 'OK' : 'WRONG',
        teamsById,
        leaguesById,
        profilesById,
      })

      finalPredictions.push(auditedPrediction)

      if (score) {
        const current = totalsByUser.get(score.user_id) ?? {
          user_id: score.user_id,
          username: getProfileName(profilesById.get(score.user_id)),
          total_points: 0,
          scored_predictions: 0,
          exact_predictions: 0,
          partial_predictions: 0,
        }

        current.total_points += score.points ?? 0
        current.scored_predictions += 1
        current.exact_predictions += score.exact_hit ? 1 : 0
        current.partial_predictions += score.partial_hit ? 1 : 0
        totalsByUser.set(score.user_id, current)
      }

      if (!score) {
        missingScoresForFinalMatches.push(auditedPrediction)
      } else if (!isOk) {
        wrongScores.push(auditedPrediction)
      }

      continue
    }

    const overdueWithoutFinalStatus = isOverdueWithoutFinalStatus(match, nowMs)
    const nonFinalStatus = overdueWithoutFinalStatus
      ? 'OVERDUE_WITHOUT_RESULT'
      : isLiveStatus(match.status)
      ? 'LIVE'
      : isFuturePrediction(match, nowMs)
        ? 'FUTURE'
        : 'OK'
    const auditedPrediction = buildAuditedPrediction({
      prediction,
      match,
      score,
      expected: null,
      status: score
        ? overdueWithoutFinalStatus
          ? 'OVERDUE_WITHOUT_FINAL_STATUS'
          : 'OPEN_WITH_STALE_SCORE'
        : nonFinalStatus,
      teamsById,
      leaguesById,
      profilesById,
    })

    if (score) {
      if (auditedPrediction.status === 'OVERDUE_WITHOUT_FINAL_STATUS') {
        overduePredictionsWithoutFinalStatus.push(auditedPrediction)
      }

      openPredictionsWithStaleScore.push(auditedPrediction)
      continue
    }

    if (auditedPrediction.status === 'LIVE') {
      livePredictions.push(auditedPrediction)
    } else if (
      auditedPrediction.status === 'OVERDUE_WITHOUT_RESULT' ||
      isOverdueWithoutResult(match, nowMs)
    ) {
      overduePredictionsWithoutResult.push(auditedPrediction)
    } else {
      futurePredictions.push(auditedPrediction)
    }
  }

  const concreteCases = {
    barracasBanfield: finalPredictions.filter(
      (prediction) =>
        prediction.homeTeam === 'Barracas Central' &&
        prediction.awayTeam === 'Banfield'
    ),
    exactSamples: finalPredictions
      .filter((prediction) => prediction.expectedPoints === 3)
      .slice(0, 5),
    partialSamples: finalPredictions
      .filter((prediction) => prediction.expectedPoints === 1)
      .slice(0, 5),
    incorrectSamples: finalPredictions
      .filter((prediction) => prediction.expectedPoints === 0)
      .slice(0, 5),
  }
  const totals = {
    predictionsTotal: predictions.length,
    futurePredictions: futurePredictions.length,
    futurePendingPredictions: futurePredictions.length,
    livePredictions: livePredictions.length,
    predictionsWithFinalResult: finalPredictions.length,
    predictionsWithResult: finalPredictions.length,
    overduePredictionsWithoutResult: overduePredictionsWithoutResult.length,
    predictionScoresTotal: scores.length,
    missingScoresForFinalMatches: missingScoresForFinalMatches.length,
    missingScores: missingScoresForFinalMatches.length,
    wrongScores: wrongScores.length,
    openPredictionsWithStaleScore: openPredictionsWithStaleScore.length,
    scoredButNotFinal: openPredictionsWithStaleScore.length,
    overduePredictionsWithoutFinalStatus: overduePredictionsWithoutFinalStatus.length,
    staleLiveMatches:
      overduePredictionsWithoutResult.length + overduePredictionsWithoutFinalStatus.length,
    usersWithPoints: totalsByUser.size,
  }

  return {
    ok: true,
    filters: {
      leagueId,
      leagueExternalId,
      userId,
    },
    totals,
    predictionsTotal: totals.predictionsTotal,
    futurePredictions: totals.futurePredictions,
    futurePendingPredictions: totals.futurePendingPredictions,
    livePredictions: totals.livePredictions,
    predictionsWithFinalResult: totals.predictionsWithFinalResult,
    predictionsWithResult: totals.predictionsWithResult,
    overduePredictionsWithoutResult: totals.overduePredictionsWithoutResult,
    predictionScoresTotal: totals.predictionScoresTotal,
    missingScoresForFinalMatches: totals.missingScoresForFinalMatches,
    finalWithoutScore: totals.missingScoresForFinalMatches,
    missingPredictionScores: totals.missingScoresForFinalMatches,
    missingScoresCount: totals.missingScoresForFinalMatches,
    incorrectPredictionScores: totals.wrongScores,
    wrongScoresCount: totals.wrongScores,
    openPredictionsWithStaleScore: totals.openPredictionsWithStaleScore,
    scoredButNotFinal: totals.scoredButNotFinal,
    overduePredictionsWithoutFinalStatus: totals.overduePredictionsWithoutFinalStatus,
    staleLiveMatches: totals.staleLiveMatches,
    leaderboardsRecalculated: false,
    totalsByUser: [...totalsByUser.values()].sort((a, b) => b.total_points - a.total_points),
    futurePredictionSamples: futurePredictions.slice(0, 50),
    futurePendingPredictionsSamples: futurePredictions.slice(0, 50),
    livePredictionSamples: livePredictions.slice(0, 50),
    overduePredictionsWithoutResultSamples: overduePredictionsWithoutResult.slice(0, 50),
    overduePredictionsWithoutFinalStatusSamples:
      overduePredictionsWithoutFinalStatus.slice(0, 50),
    missingScoresForFinalMatchesSamples: missingScoresForFinalMatches.slice(0, 50),
    finalWithoutScoreSamples: missingScoresForFinalMatches.slice(0, 50),
    wrongScores,
    openPredictionsWithStaleScoreSamples: openPredictionsWithStaleScore.slice(0, 50),
    scoredButNotFinalSamples: openPredictionsWithStaleScore.slice(0, 50),
    auditedPredictions: [
      ...finalPredictions,
      ...livePredictions,
      ...futurePredictions,
      ...overduePredictionsWithoutResult,
      ...openPredictionsWithStaleScore,
    ].slice(0, 250),
    concreteCases,
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
    const before = await collectAudit(request)

    if (!shouldFix) return NextResponse.json(before)

    await recalculateProdePoints(getSupabaseAdminClient(), null)

    const after = await collectAudit(request)

    return NextResponse.json({
      ok: true,
      fixed: true,
      before,
      after: {
        ...after,
        leaderboardsRecalculated: true,
      },
      missingScoresFixed:
        before.missingScoresForFinalMatches - after.missingScoresForFinalMatches,
      missingScoresForFinalMatchesFixed:
        before.missingScoresForFinalMatches - after.missingScoresForFinalMatches,
      wrongScoresFixed: before.wrongScoresCount - after.wrongScoresCount,
      staleOpenScoresFixed:
        before.openPredictionsWithStaleScore - after.openPredictionsWithStaleScore,
    })
  } catch (error) {
    console.error('[prode-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error) || 'No se pudo auditar Prode.',
      },
      { status: 500 }
    )
  }
}
