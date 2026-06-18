import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isFinalMatchStatus } from '@/shared/utils/match-status'
import { normalizeLeagueRound } from '@/shared/utils/league-rounds'
import { isPredictionLocked } from '@/shared/utils/prediction-lock'
import { getPredictionLockMinutesForMatch } from '@/shared/utils/prode-lock-exceptions'

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
  prediction_id?: string | null
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
  match_date: string | null
  home_score: number | null
  away_score: number | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  prediction_lock_override?: string | null
}

type PredictionRow = {
  id: string
  user_id: string
  match_id: string | number
  predicted_home_score: number
  predicted_away_score: number
}

type TeamRow = {
  id: string | number
  name: string | null
  logo_url?: string | null
}

type LeaderboardPredictionDetail = {
  predictionId: string
  matchId: string
  matchDate: string
  status: string | null
  homeTeamName: string
  awayTeamName: string
  homeLogoUrl: string | null
  awayLogoUrl: string | null
  predictedHomeScore: number
  predictedAwayScore: number
  realHomeScore: number | null
  realAwayScore: number | null
  points: number | null
  exactHit: boolean
  partialHit: boolean
  scoreCalculated: boolean
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

function normalizeRows(
  rows: LeaderboardRow[],
  profiles: ProfileRow[],
  predictionsByUserId = new Map<string, LeaderboardPredictionDetail[]>()
) {
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
        predictions: predictionsByUserId.get(row.user_id) ?? [],
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
      .select('prediction_id, user_id, match_id, points, exact_hit, partial_hit')
      .in('match_id', chunk)

    if (error) return { data: [] as PredictionScoreRow[], error }

    scores.push(...((data ?? []) as PredictionScoreRow[]))
  }

  return { data: scores, error: null }
}

async function fetchPredictionsByMatchIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const predictions: PredictionRow[] = []

  for (const chunk of chunkArray(matchIds, 80)) {
    const { data, error } = await supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score')
      .in('match_id', chunk)

    if (error) return { data: [] as PredictionRow[], error }

    predictions.push(...((data ?? []) as PredictionRow[]))
  }

  return { data: predictions, error: null }
}

async function fetchTeamsByIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  teamIds: string[]
) {
  const teamsById = new Map<string, TeamRow>()
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))]

  for (const chunk of chunkArray(uniqueTeamIds, 100)) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .in('id', chunk)

    if (error) return { data: teamsById, error }

    for (const team of (data ?? []) as TeamRow[]) {
      teamsById.set(String(team.id), team)
    }
  }

  return { data: teamsById, error: null }
}

function buildPredictionDetailsByUserId({
  predictions,
  scores,
  matchesById,
  teamsById,
}: {
  predictions: PredictionRow[]
  scores: PredictionScoreRow[]
  matchesById: Map<string, LeagueMatchRow>
  teamsById: Map<string, TeamRow>
}) {
  const scoresByPredictionId = new Map(
    scores
      .filter((score) => score.prediction_id)
      .map((score) => [String(score.prediction_id), score])
  )
  const scoresByUserMatch = new Map<string, PredictionScoreRow>()
  const detailsByUserId = new Map<string, LeaderboardPredictionDetail[]>()

  for (const score of scores) {
    if (score.match_id) {
      scoresByUserMatch.set(`${score.user_id}:${String(score.match_id)}`, score)
    }
  }

  for (const prediction of predictions) {
    const matchId = String(prediction.match_id)
    const match = matchesById.get(matchId)

    if (!match) continue

    const homeTeam = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
    const awayTeam = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null
    const score =
      scoresByPredictionId.get(prediction.id) ??
      scoresByUserMatch.get(`${prediction.user_id}:${matchId}`) ??
      null
    const current = detailsByUserId.get(prediction.user_id) ?? []

    current.push({
      predictionId: prediction.id,
      matchId,
      matchDate: match.match_date ?? '',
      status: match.status,
      homeTeamName: homeTeam?.name?.trim() || 'Local',
      awayTeamName: awayTeam?.name?.trim() || 'Visitante',
      homeLogoUrl: homeTeam?.logo_url ?? null,
      awayLogoUrl: awayTeam?.logo_url ?? null,
      predictedHomeScore: prediction.predicted_home_score,
      predictedAwayScore: prediction.predicted_away_score,
      realHomeScore: match.home_score,
      realAwayScore: match.away_score,
      points: score?.points ?? null,
      exactHit: Boolean(score?.exact_hit),
      partialHit: Boolean(score?.partial_hit),
      scoreCalculated: Boolean(score),
    })
    detailsByUserId.set(prediction.user_id, current)
  }

  for (const details of detailsByUserId.values()) {
    details.sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
  }

  return detailsByUserId
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
        .select('id, round, status, match_date, home_score, away_score, home_team_id, away_team_id, prediction_lock_override')
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

      const relevantMatches = ((leagueMatchesData ?? []) as LeagueMatchRow[])
        .filter(
          (match) =>
            !requestedRound ||
              normalizeLeagueRound(match.round, leagueExternalId) === requestedRound ||
              String(match.round ?? '') === round
        )
      const matchesById = new Map(relevantMatches.map((match) => [String(match.id), match]))
      const now = new Date()
      const scoredMatchIds = relevantMatches
        .filter(
          (match) =>
            isFinalMatchStatus(match.status) &&
            match.home_score !== null &&
            match.away_score !== null
        )
        .map((match) => String(match.id))
      const lockedMatchIds = requestedRound
        ? relevantMatches
            .filter((match) => {
              const lockMinutes = getPredictionLockMinutesForMatch({
                id: match.id,
                matchDate: match.match_date,
                homeTeamId: match.home_team_id,
                awayTeamId: match.away_team_id,
              })

              return isPredictionLocked(
                match.match_date,
                match.status ?? 'scheduled',
                now,
                {
                  lockMinutes,
                  lockOverride: match.prediction_lock_override,
                }
              )
            })
            .map((match) => String(match.id))
        : []

      if (!scoredMatchIds.length && !lockedMatchIds.length) {
        return jsonNoStore({ ok: true, leaderboard: [] })
      }

      const [
        { data: scoresData, error: scoresError },
        { data: predictionRows, error: predictionsError },
        teamsResult,
      ] = await Promise.all([
        scoredMatchIds.length
          ? fetchScoresByMatchIds(supabase, scoredMatchIds)
          : Promise.resolve({ data: [] as PredictionScoreRow[], error: null }),
        lockedMatchIds.length
          ? fetchPredictionsByMatchIds(supabase, lockedMatchIds)
          : Promise.resolve({ data: [] as PredictionRow[], error: null }),
        requestedRound
          ? fetchTeamsByIds(
              supabase,
              relevantMatches
                .flatMap((match) => [match.home_team_id, match.away_team_id])
                .filter(Boolean)
                .map((teamId) => String(teamId))
            )
          : Promise.resolve({ data: new Map<string, TeamRow>(), error: null }),
      ])

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

      if (predictionsError) {
        console.error('[prode/leaderboard] Error leyendo predictions por fecha', predictionsError)

        return jsonNoStore({
          ok: false,
          error: predictionsError.message ?? 'No se pudieron leer los pronósticos de la fecha.',
          code: predictionsError.code ?? null,
          detail: predictionsError.details ?? null,
          leaderboard: [],
        })
      }

      if (teamsResult.error) {
        console.error('[prode/leaderboard] Error leyendo equipos por fecha', teamsResult.error)
      }

      const sourceRows = groupScoresByUser((scoresData ?? []) as PredictionScoreRow[])
      const predictionsByUserId = requestedRound
        ? buildPredictionDetailsByUserId({
            predictions: (predictionRows ?? []) as PredictionRow[],
            scores: (scoresData ?? []) as PredictionScoreRow[],
            matchesById,
            teamsById: teamsResult.error ? new Map<string, TeamRow>() : teamsResult.data,
          })
        : new Map<string, LeaderboardPredictionDetail[]>()
      const rowsByUserId = new Map(sourceRows.map((row) => [row.user_id, row]))

      for (const userId of predictionsByUserId.keys()) {
        if (!rowsByUserId.has(userId)) {
          rowsByUserId.set(userId, {
            user_id: userId,
            points: 0,
            played: 0,
            exact_hits: 0,
            partial_hits: 0,
          })
        }
      }

      const mergedRows = [...rowsByUserId.values()]
      const userIds = mergedRows.map((row) => row.user_id)
      const profilesResult = await fetchProfiles(supabase, userIds)

      if (profilesResult.error) {
        console.error('[prode/leaderboard] Error leyendo profiles; usando fallback', profilesResult.error)
      }

      console.info('[prode/leaderboard] response debug', {
        leagueId,
        round,
        normalizedRound: requestedRound,
        scoredMatchesForLeague: scoredMatchIds.length,
        lockedMatchesForRound: lockedMatchIds.length,
        predictionScoresRead: scoresData?.length ?? 0,
        lockedPredictionsRead: predictionRows?.length ?? 0,
        source: requestedRound ? 'prediction_scores_by_league_round' : 'prediction_scores_by_league',
      })

      return jsonNoStore({
        ok: !profilesResult.error,
        leaderboard: normalizeRows(
          mergedRows,
          profilesResult.error ? [] : ((profilesResult.data ?? []) as ProfileRow[]),
          predictionsByUserId
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
