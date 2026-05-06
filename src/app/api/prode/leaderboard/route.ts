import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isFinalMatchStatus } from '@/shared/utils/match-status'
import { normalizeLeagueRound } from '@/shared/utils/league-rounds'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type LeaderboardRow = {
  user_id: string
  name?: string | null
  points: number | null
  total_points?: number | null
  played: number | null
  exact_hits: number | null
  partial_hits: number | null
  exact_predictions?: number | null
  partial_predictions?: number | null
}

type PredictionScoreRow = {
  user_id: string
  match_id?: string | null
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type LeagueRow = {
  external_id: string | number | null
}

type LeagueMatchRow = {
  id: string
  round: string | number | null
  status: string | null
  home_score: number | null
  away_score: number | null
}

type ProfileRow = {
  id: string
  username?: string | null
  display_name?: string | null
  email?: string | null
}

type ApiError = {
  message?: string
  code?: string
  details?: string
}

type SupabaseListResult = {
  data: unknown[] | null
  error: ApiError | null
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function getErrorPayload(error: unknown) {
  const value = error as ApiError

  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : value?.message ?? 'No se pudo cargar la tabla de posiciones.',
    code: value?.code ?? null,
    detail: value?.details ?? null,
    leaderboard: [],
  }
}

function getDisplayName(userId: string, profilesById: Map<string, ProfileRow>) {
  const profile = profilesById.get(userId)

  return profile?.display_name ?? profile?.username ?? profile?.email ?? 'Usuario'
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

function normalizeRows(rows: LeaderboardRow[], profiles: ProfileRow[]) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))

  return rows
    .map((row) => {
      const points = row.points ?? 0
      const totalPoints = row.total_points ?? points
      const exactHits = row.exact_predictions ?? row.exact_hits ?? 0
      const partialHits = row.partial_predictions ?? row.partial_hits ?? 0

      return {
        userId: row.user_id,
        user_id: row.user_id,
        username: getDisplayName(row.user_id, profilesById),
        name: getDisplayName(row.user_id, profilesById),
        totalPoints,
        total_points: totalPoints,
        points: totalPoints,
        playedPredictions: row.played ?? exactHits + partialHits,
        played: row.played ?? exactHits + partialHits,
        exactPredictions: exactHits,
        exact_predictions: exactHits,
        exact_hits: exactHits,
        partialPredictions: partialHits,
        partial_predictions: partialHits,
        partial_hits: partialHits,
      }
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return b.exact_predictions - a.exact_predictions
    })
}

function groupScoresByUser(scores: PredictionScoreRow[]): LeaderboardRow[] {
  const grouped = new Map<string, LeaderboardRow>()

  for (const score of scores) {
    const current = grouped.get(score.user_id) ?? {
      user_id: score.user_id,
      points: 0,
      played: 0,
      exact_hits: 0,
      partial_hits: 0,
    }

    current.points = (current.points ?? 0) + (score.points ?? 0)
    current.played = (current.played ?? 0) + 1
    current.exact_hits = (current.exact_hits ?? 0) + (score.exact_hit ? 1 : 0)
    current.partial_hits = (current.partial_hits ?? 0) + (score.partial_hit ? 1 : 0)
    grouped.set(score.user_id, current)
  }

  return [...grouped.values()]
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

async function fetchScoresByMatchIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const scores: PredictionScoreRow[] = []

  for (const chunk of chunkArray(matchIds, 80)) {
    const { data, error } = await supabase
      .from('prediction_scores')
      .select('user_id, match_id, points, exact_hit, partial_hit')
      .in('match_id', chunk)

    if (error) return { data: [] as PredictionScoreRow[], error }

    scores.push(...((data ?? []) as PredictionScoreRow[]))
  }

  return { data: scores, error: null }
}

function totalsDiffer(leaderboardRows: LeaderboardRow[], scoreRows: LeaderboardRow[]) {
  if (!leaderboardRows.length && scoreRows.length) return true

  const leaderboardTotals = new Map(
    leaderboardRows.map((row) => [row.user_id, row.total_points ?? row.points ?? 0])
  )

  return scoreRows.some((row) => leaderboardTotals.get(row.user_id) !== (row.points ?? 0))
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const round = searchParams.get('round')

    if (leagueId) {
      let leagueExternalId: string | number | null = null

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('external_id')
        .eq('id', leagueId)
        .maybeSingle()

      if (leagueError) {
        console.info('[prode/leaderboard] No se pudo leer external_id de liga; se sigue sin normalizacion especifica', {
          leagueId,
          code: leagueError.code ?? null,
          message: leagueError.message,
        })
      } else {
        leagueExternalId = ((leagueData ?? null) as LeagueRow | null)?.external_id ?? null
      }

      const { data: leagueMatchesData, error: leagueMatchesError } = await supabase
        .from('matches')
        .select('id, round, status, home_score, away_score')
        .eq('league_id', leagueId)

      if (leagueMatchesError) {
        console.error('[prode/leaderboard] Error leyendo partidos por liga', leagueMatchesError)

        return jsonNoStore({
          ok: false,
          error: leagueMatchesError.message ?? 'No se pudieron leer los partidos del torneo.',
          code: leagueMatchesError.code ?? null,
          detail: leagueMatchesError.details ?? null,
          leaderboard: [],
        })
      }

      const requestedRound = round
        ? normalizeLeagueRound(round, leagueExternalId) ?? round
        : null

      const matchIds = ((leagueMatchesData ?? []) as LeagueMatchRow[])
        .filter(
          (match) =>
            isFinalMatchStatus(match.status) &&
            match.home_score !== null &&
            match.away_score !== null &&
            (!requestedRound ||
              normalizeLeagueRound(match.round, leagueExternalId) === requestedRound ||
              String(match.round ?? '') === round)
        )
        .map((match) => String(match.id))

      if (!matchIds.length) {
        return jsonNoStore({ ok: true, leaderboard: [] })
      }

      const { data: scoresData, error: scoresError } = await fetchScoresByMatchIds(
        supabase,
        matchIds
      )

      if (scoresError) {
        console.error('[prode/leaderboard] Error leyendo prediction_scores por liga', scoresError)

        return jsonNoStore({
          ok: false,
          error: scoresError.message ?? 'No se pudo leer el ranking del torneo.',
          code: scoresError.code ?? null,
          detail: scoresError.details ?? null,
          leaderboard: [],
        })
      }

      const sourceRows = groupScoresByUser((scoresData ?? []) as PredictionScoreRow[])
      const userIds = sourceRows.map((row) => row.user_id)
      const profilesResult = await fetchProfiles(supabase, userIds)

      if (profilesResult.error) {
        console.error('[prode/leaderboard] Error leyendo profiles; usando fallback', profilesResult.error)
      }

      console.info('[prode/leaderboard] response debug', {
        leagueId,
        round,
        normalizedRound: requestedRound,
        matchesForLeague: matchIds.length,
        predictionScoresRead: scoresData?.length ?? 0,
        source: requestedRound ? 'prediction_scores_by_league_round' : 'prediction_scores_by_league',
      })

      return jsonNoStore({
        ok: !profilesResult.error,
        leaderboard: normalizeRows(
          sourceRows,
          profilesResult.error ? [] : ((profilesResult.data ?? []) as ProfileRow[])
        ),
      })
    }

    let leaderboardResult: SupabaseListResult = await supabase
      .from('leaderboards')
      .select('user_id, total_points, played, exact_predictions, partial_predictions')
      .order('total_points', { ascending: false })
      .order('exact_predictions', { ascending: false })

    if (
      leaderboardResult.error?.code === '42703' ||
      leaderboardResult.error?.code === 'PGRST204'
    ) {
      const canonicalWithoutPlayed = await supabase
        .from('leaderboards')
        .select('user_id, total_points, exact_predictions, partial_predictions')
        .order('total_points', { ascending: false })
        .order('exact_predictions', { ascending: false })

      leaderboardResult =
        canonicalWithoutPlayed.error?.code === '42703' ||
        canonicalWithoutPlayed.error?.code === 'PGRST204'
        ? await supabase
            .from('leaderboards')
            .select('user_id, name, points, played, exact_hits, partial_hits')
            .order('points', { ascending: false })
            .order('exact_hits', { ascending: false })
        : canonicalWithoutPlayed
    }

    const [
      scoresResult,
    ] = await Promise.all([
      supabase
        .from('prediction_scores')
        .select('user_id, points, exact_hit, partial_hit'),
    ])

    if (leaderboardResult.error) {
      console.error('[prode/leaderboard] Error leyendo leaderboards', leaderboardResult.error)
    }

    if (scoresResult.error) {
      console.error('[prode/leaderboard] Error leyendo prediction_scores', scoresResult.error)
    }

    const leaderboardRows = (leaderboardResult.error ? [] : leaderboardResult.data ?? []) as LeaderboardRow[]
    const groupedScoreRows = groupScoresByUser((scoresResult.error ? [] : scoresResult.data ?? []) as PredictionScoreRow[])
    const leaderboardMissingPlayed = leaderboardRows.some((row) => row.played === null || row.played === undefined)
    const sourceRows = totalsDiffer(leaderboardRows, groupedScoreRows) || leaderboardMissingPlayed
      ? groupedScoreRows
      : leaderboardRows
    const userIds = sourceRows.map((row) => row.user_id)
    const profilesResult = await fetchProfiles(supabase, userIds)

    if (profilesResult.error) {
      console.error('[prode/leaderboard] Error leyendo profiles; usando fallback', profilesResult.error)
    }

    console.info('[prode/leaderboard] response debug', {
      leaderboardsRead: leaderboardRows.length,
      predictionScoresRead: scoresResult.error ? 0 : scoresResult.data?.length ?? 0,
      source: sourceRows === groupedScoreRows ? 'prediction_scores' : 'leaderboards',
    })

    const usingScoreFallback = sourceRows === groupedScoreRows

    return jsonNoStore({
      ok: !scoresResult.error && (usingScoreFallback || !leaderboardResult.error),
      leaderboard: normalizeRows(
        sourceRows,
        profilesResult.error ? [] : ((profilesResult.data ?? []) as ProfileRow[])
      ),
      error:
        scoresResult.error || (!usingScoreFallback && leaderboardResult.error)
          ? 'No se pudo leer una fuente del ranking.'
          : undefined,
    })
  } catch (error) {
    console.error('[prode/leaderboard] Error completo', error)

    return jsonNoStore(getErrorPayload(error))
  }
}
