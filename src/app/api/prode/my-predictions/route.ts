import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isFinalMatchStatus } from '@/shared/utils/match-status'

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number
  predicted_home_score: number
  predicted_away_score: number
  created_at: string
  updated_at: string
}

type PredictionScoreRow = {
  prediction_id: string
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type MatchRow = {
  id: string | number
  league_id: string | number | null
  match_date: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  home_team_id: string | number | null
  away_team_id: string | number | null
}

type ApiError = {
  message?: string
  code?: string
  details?: string
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getErrorPayload(error: unknown) {
  const value = error as ApiError

  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudieron cargar tus predicciones.',
    code: value?.code ?? null,
    detail: value?.details ?? null,
    predictions: [],
  }
}

async function getAuthenticatedUser(request: Request) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      error: NextResponse.json({
        ok: false,
        error: 'Supabase no está configurado.',
        predictions: [],
      }),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return { supabase, user, error: null }

  const authorization = request.headers.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()

    if (token) {
      const {
        data: { user: tokenUser },
      } = await supabase.auth.getUser(token)

      if (tokenUser) return { supabase, user: tokenUser, error: null }
    }
  }

  return { supabase, user: null, error: null }
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request)
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')

  if (authError) return authError

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      error: 'Supabase no está configurado.',
      predictions: [],
    })
  }

  if (!user) {
    return NextResponse.json({ ok: true, predictions: [] })
  }

  try {
    const adminSupabase = getSupabaseAdminClient()
    let matchIdsForLeague: string[] | null = null

    if (leagueId) {
      const { data: leagueMatchesData, error: leagueMatchesError } = await adminSupabase
        .from('matches')
        .select('id')
        .eq('league_id', leagueId)

      if (leagueMatchesError) throw leagueMatchesError

      matchIdsForLeague = (leagueMatchesData ?? []).map((match) => String(match.id))

      if (!matchIdsForLeague.length) {
        return NextResponse.json({ ok: true, predictions: [] })
      }
    }

    let predictionRows: PredictionRow[] = []

    if (matchIdsForLeague) {
      for (const chunk of chunkArray(matchIdsForLeague, 80)) {
        const { data: predictionsData, error: predictionsError } = await adminSupabase
          .from('predictions')
          .select('id, user_id, match_id, predicted_home_score, predicted_away_score, created_at, updated_at')
          .eq('user_id', user.id)
          .in('match_id', chunk)
          .order('created_at', { ascending: false })

        if (predictionsError) throw predictionsError

        predictionRows.push(...((predictionsData ?? []) as PredictionRow[]))
      }

      predictionRows = predictionRows.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } else {
      const { data: predictionsData, error: predictionsError } = await adminSupabase
        .from('predictions')
        .select('id, user_id, match_id, predicted_home_score, predicted_away_score, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (predictionsError) throw predictionsError

      predictionRows = (predictionsData ?? []) as PredictionRow[]
    }
    const predictionIds = predictionRows.map((prediction) => prediction.id)
    const matchIds = [...new Set(predictionRows.map((prediction) => String(prediction.match_id)))]
    const scoresByPredictionId = new Map<string, PredictionScoreRow>()
    const matchesById = new Map<string, MatchRow>()

    for (const chunk of chunkArray(predictionIds, 100)) {
      const { data: scoresData, error: scoresError } = await adminSupabase
        .from('prediction_scores')
        .select('prediction_id, points, exact_hit, partial_hit')
        .in('prediction_id', chunk)

      if (scoresError) throw scoresError

      for (const score of (scoresData ?? []) as PredictionScoreRow[]) {
        scoresByPredictionId.set(score.prediction_id, score)
      }
    }

    for (let index = 0; index < matchIds.length; index += 100) {
      const { data: matchesData, error: matchesError } = await adminSupabase
        .from('matches')
        .select('id, league_id, match_date, status, home_score, away_score, home_team_id, away_team_id')
        .in('id', matchIds.slice(index, index + 100))

      if (matchesError) throw matchesError

      for (const match of (matchesData ?? []) as MatchRow[]) {
        matchesById.set(String(match.id), match)
      }
    }

    console.info('[prode/my-predictions] response debug', {
      userId: user.id,
      leagueId,
      predictions: predictionRows.length,
      predictionScoresRead: scoresByPredictionId.size,
      pointsByPredictionId: predictionRows.map((prediction) => ({
        prediction_id: prediction.id,
        match_id: String(prediction.match_id),
        points: scoresByPredictionId.get(prediction.id)?.points ?? null,
        exact_hit: scoresByPredictionId.get(prediction.id)?.exact_hit ?? false,
        partial_hit: scoresByPredictionId.get(prediction.id)?.partial_hit ?? false,
      })),
    })

    const predictions = predictionRows.map((prediction) => {
      const score = scoresByPredictionId.get(prediction.id)
      const match = matchesById.get(String(prediction.match_id)) ?? null
      const hasFinalResult =
        Boolean(match) &&
        isFinalMatchStatus(match?.status) &&
        match?.home_score !== null &&
        match?.away_score !== null
      const visibleScore = hasFinalResult ? score : undefined

      return {
        prediction_id: prediction.id,
        match_id: String(prediction.match_id),
        league_id: match?.league_id === null || match?.league_id === undefined
          ? null
          : String(match.league_id),
        predicted_home_score: prediction.predicted_home_score,
        predicted_away_score: prediction.predicted_away_score,
        real_home_score: match?.home_score ?? null,
        real_away_score: match?.away_score ?? null,
        points: visibleScore?.points ?? null,
        exact_hit: visibleScore?.exact_hit ?? false,
        partial_hit: visibleScore?.partial_hit ?? false,
        prediction_score_found: Boolean(visibleScore),
        match: match
          ? {
              id: String(match.id),
              league_id: match.league_id === null ? null : String(match.league_id),
              match_date: match.match_date,
              status: match.status,
              home_score: match.home_score,
              away_score: match.away_score,
              home_team_id: match.home_team_id === null ? null : String(match.home_team_id),
              away_team_id: match.away_team_id === null ? null : String(match.away_team_id),
            }
          : null,
        id: prediction.id,
        userId: prediction.user_id,
        matchId: String(prediction.match_id),
        leagueId: match?.league_id === null || match?.league_id === undefined
          ? null
          : String(match.league_id),
        predictedHomeScore: prediction.predicted_home_score,
        predictedAwayScore: prediction.predicted_away_score,
        realHomeScore: match?.home_score ?? null,
        realAwayScore: match?.away_score ?? null,
        predictionScoreFound: Boolean(visibleScore),
        exactHit: visibleScore?.exact_hit ?? false,
        partialHit: visibleScore?.partial_hit ?? false,
        createdAt: prediction.created_at,
        updatedAt: prediction.updated_at,
      }
    })

    return NextResponse.json({ ok: true, predictions })
  } catch (error) {
    console.error('[prode/my-predictions] Error completo', error)

    return NextResponse.json(getErrorPayload(error))
  }
}
