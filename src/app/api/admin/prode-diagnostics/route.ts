import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type DbId = string | number

type PredictionRow = {
  id: string
  user_id: string
  match_id: DbId
}

type MatchRow = {
  id: DbId
  league_id: DbId | null
  home_score: number | null
  away_score: number | null
  status: string | null
}

type PredictionScoreRow = {
  prediction_id: string
  user_id: string
  match_id: DbId
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
  email?: string | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function hasResult(match: MatchRow | undefined) {
  return match?.home_score !== null && match?.away_score !== null
}

async function fetchProfiles(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userIds: string[]
) {
  if (!userIds.length) return { data: [] as ProfileRow[], error: null }

  const primary = await supabase
    .from('profiles')
    .select('id, username, display_name, email')
    .in('id', userIds)

  if (!primary.error) {
    return { data: (primary.data ?? []) as ProfileRow[], error: null }
  }

  const message = primary.error.message.toLowerCase()
  const missingOptionalProfileColumn =
    primary.error.code === '42703' ||
    primary.error.code === 'PGRST204' ||
    message.includes('display_name') ||
    message.includes('email') ||
    message.includes('schema cache')

  if (!missingOptionalProfileColumn) {
    return { data: [] as ProfileRow[], error: primary.error }
  }

  const withEmail = await supabase
    .from('profiles')
    .select('id, username, email')
    .in('id', userIds)

  if (!withEmail.error) {
    return { data: (withEmail.data ?? []) as ProfileRow[], error: null }
  }

  const fallback = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds)

  return {
    data: (fallback.data ?? []) as ProfileRow[],
    error: fallback.error,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const supabase = getSupabaseAdminClient()
    const [
      predictionsResponse,
      scoresResponse,
      leaderboardsResponse,
    ] = await Promise.all([
      supabase.from('predictions').select('id, user_id, match_id'),
      supabase
        .from('prediction_scores')
        .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit'),
      supabase.from('leaderboards').select('*'),
    ])

    if (predictionsResponse.error) throw predictionsResponse.error
    if (scoresResponse.error) throw scoresResponse.error
    if (leaderboardsResponse.error) throw leaderboardsResponse.error

    const allPredictions = (predictionsResponse.data ?? []) as PredictionRow[]
    const allScores = (scoresResponse.data ?? []) as PredictionScoreRow[]
    const allMatchIds = [
      ...new Set([
        ...allPredictions.map((prediction) => String(prediction.match_id)),
        ...allScores.map((score) => String(score.match_id)),
      ]),
    ]
    const matches: MatchRow[] = []

    for (const chunk of chunkArray(allMatchIds, 100)) {
      const response = await supabase
        .from('matches')
        .select('id, league_id, home_score, away_score, status')
        .in('id', chunk)

      if (response.error) throw response.error
      matches.push(...((response.data ?? []) as MatchRow[]))
    }

    const matchesById = new Map(matches.map((match) => [String(match.id), match]))
    const scopedMatchIds = new Set(
      matches
        .filter((match) => !leagueId || String(match.league_id) === leagueId)
        .map((match) => String(match.id))
    )
    const predictions = leagueId
      ? allPredictions.filter((prediction) => scopedMatchIds.has(String(prediction.match_id)))
      : allPredictions
    const scores = leagueId
      ? allScores.filter((score) => scopedMatchIds.has(String(score.match_id)))
      : allScores
    const scoreIds = new Set(scores.map((score) => score.prediction_id))
    const predictionsWithResult = predictions.filter((prediction) =>
      hasResult(matchesById.get(String(prediction.match_id)))
    )
    const predictionsWithoutMatch = predictions.filter((prediction) =>
      !matchesById.has(String(prediction.match_id))
    )
    const predictionsWithResultMissingScore = predictionsWithResult.filter(
      (prediction) => !scoreIds.has(prediction.id)
    )
    const matchesWithScoreButMissingPredictionScore = [
      ...new Set(
        predictionsWithResultMissingScore.map((prediction) => String(prediction.match_id))
      ),
    ]
    const userIds = [...new Set(scores.map((score) => score.user_id))]
    const profilesResponse = await fetchProfiles(supabase, userIds)

    if (profilesResponse.error) {
      console.warn('[prode-diagnostics] No se pudieron leer profiles.', profilesResponse.error)
    }

    const profilesById = new Map(
      ((profilesResponse.error ? [] : profilesResponse.data ?? []) as ProfileRow[])
        .map((profile) => [profile.id, profile])
    )
    const totalsByUser = [
      ...scores
        .reduce((grouped, score) => {
          const profile = profilesById.get(score.user_id)
          const current = grouped.get(score.user_id) ?? {
            user_id: score.user_id,
            username: profile?.display_name ?? profile?.username ?? profile?.email ?? 'Usuario',
            total_points: 0,
            scored_predictions: 0,
            exact_predictions: 0,
            partial_predictions: 0,
          }

          current.total_points += score.points ?? 0
          current.scored_predictions += 1
          current.exact_predictions += score.exact_hit ? 1 : 0
          current.partial_predictions += score.partial_hit ? 1 : 0
          grouped.set(score.user_id, current)

          return grouped
        }, new Map<string, {
          user_id: string
          username: string
          total_points: number
          scored_predictions: number
          exact_predictions: number
          partial_predictions: number
        }>())
        .values(),
    ].sort((a, b) => b.total_points - a.total_points)

    return NextResponse.json({
      ok: true,
      leagueId,
      predictionsTotal: predictions.length,
      predictionsWithResult: predictionsWithResult.length,
      predictionScoresTotal: scores.length,
      leaderboardsTotal: leaderboardsResponse.data?.length ?? 0,
      totalsByUser,
      matchesWithScoreButMissingPredictionScore: matchesWithScoreButMissingPredictionScore.length,
      matchesWithScoreButMissingPredictionScoreSample:
        matchesWithScoreButMissingPredictionScore.slice(0, 30),
      predictionsWithoutMatch: predictionsWithoutMatch.length,
      predictionsWithoutMatchSample: predictionsWithoutMatch.slice(0, 30).map((prediction) => ({
        prediction_id: prediction.id,
        user_id: prediction.user_id,
        match_id: prediction.match_id,
      })),
      predictionsWithResultMissingScore: predictionsWithResultMissingScore.length,
      predictionsWithResultMissingScoreSample:
        predictionsWithResultMissingScore.slice(0, 30).map((prediction) => ({
          prediction_id: prediction.id,
          user_id: prediction.user_id,
          match_id: prediction.match_id,
          match: matchesById.get(String(prediction.match_id)) ?? null,
        })),
    })
  } catch (error) {
    console.error('[prode-diagnostics] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo diagnosticar Prode.',
      },
      { status: 500 }
    )
  }
}
