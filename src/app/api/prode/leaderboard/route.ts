import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { recalculateProdePoints } from '@/server/prode/points'

type LeaderboardDbError = {
  message: string
  code?: string
  details?: string
  detail?: string
  hint?: string
}

type LeaderboardSourceRow = {
  user_id: string
  name?: string | null
  username?: string | null
  points?: number | null
  played?: number | null
  exact_hits?: number | null
  partial_hits?: number | null
}

type PredictionScoreRow = {
  user_id: string
  points: number | null
  exact_hit: boolean | null
  partial_hit: boolean | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

function isMissingLeaderboardSource(error: LeaderboardDbError | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function shouldFallbackToPredictionScores(error: LeaderboardDbError | null) {
  return isMissingLeaderboardSource(error) || error?.code === '42703'
}

function sanitizeDiagnostic(value: unknown) {
  if (typeof value !== 'string') return value

  return value
    .replace(/(service_role|anon|apikey|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-jwt]')
}

function getFriendlyDetail(error: LeaderboardDbError | null) {
  if (!error) return 'Error inesperado al consultar la tabla de posiciones.'

  if (isMissingLeaderboardSource(error)) {
    return 'No existe la tabla leaderboards ni la tabla legacy leaderboard.'
  }

  if (error.code === '42703') {
    return 'Falta una columna requerida en leaderboards: points o exact_hits.'
  }

  return error.details ?? error.detail ?? error.hint ?? 'Supabase rechazo la consulta de leaderboard.'
}

async function fetchLeaderboardFrom(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  table: 'leaderboards' | 'leaderboard'
) {
  return supabase
    .from(table)
    .select('*')
    .order('points', { ascending: false })
    .order('exact_hits', { ascending: false })
}

function normalizeLeaderboardRows(rows: LeaderboardSourceRow[]) {
  return rows
    .map((row) => {
      const totalPoints = row.points ?? 0
      const exactPredictions = row.exact_hits ?? 0
      const partialPredictions = row.partial_hits ?? 0

      return {
        user_id: row.user_id,
        username: row.username ?? row.name ?? 'Usuario',
        name: row.name ?? row.username ?? 'Usuario',
        total_points: totalPoints,
        points: totalPoints,
        played: row.played ?? exactPredictions + partialPredictions,
        exact_predictions: exactPredictions,
        exact_hits: exactPredictions,
        partial_predictions: partialPredictions,
        partial_hits: partialPredictions,
      }
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return b.exact_predictions - a.exact_predictions
    })
}

async function fetchLeaderboardFromPredictionScores() {
  const supabase = getSupabaseAdminClient()
  const { data: scores, error: scoresError } = await supabase
    .from('prediction_scores')
    .select('user_id, points, exact_hit, partial_hit')

  if (scoresError) {
    console.error('[prode/leaderboard] Error leyendo prediction_scores', scoresError)
    throw scoresError
  }

  const scoreRows = (scores ?? []) as PredictionScoreRow[]

  if (!scoreRows.length) return []

  const userIds = [...new Set(scoreRows.map((row) => row.user_id))]
  const profilesResult = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds)
  const fallbackProfilesResult =
    profilesResult.error?.code === '42703'
      ? await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)
      : null
  const profiles = fallbackProfilesResult?.data ?? profilesResult.data
  const profilesError = fallbackProfilesResult?.error ?? profilesResult.error

  if (profilesError) {
    console.error('[prode/leaderboard] Error leyendo profiles para fallback', profilesError)
  }

  const profilesByUserId = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  )
  const grouped = new Map<string, LeaderboardSourceRow>()

  for (const score of scoreRows) {
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

    const profile = profilesByUserId.get(score.user_id)
    current.username = profile?.display_name ?? profile?.username ?? 'Usuario'
    current.name = current.username

    grouped.set(score.user_id, current)
  }

  return normalizeLeaderboardRows([...grouped.values()])
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Supabase no esta configurado.',
          detail: 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
          code: 'SUPABASE_CONFIG_MISSING',
          leaderboard: [],
        },
        { status: 500 }
      )
    }

    try {
      await recalculateProdePoints(getSupabaseAdminClient())
    } catch (recalculateError) {
      console.error('[prode/leaderboard] No se pudo recalcular antes de leer ranking', {
        message:
          recalculateError instanceof Error
            ? recalculateError.message
            : 'Error desconocido',
      })
    }

    const primary = await fetchLeaderboardFrom(supabase, 'leaderboards')
    const fallback = primary.error && isMissingLeaderboardSource(primary.error)
      ? await fetchLeaderboardFrom(supabase, 'leaderboard')
      : null

    const data = fallback?.data ?? primary.data
    const error = fallback?.error ?? primary.error

    if (error) {
      console.error('[prode/leaderboard] Error de Supabase', error)

      if (shouldFallbackToPredictionScores(error)) {
        const scoreLeaderboard = await fetchLeaderboardFromPredictionScores()

        return NextResponse.json({
          ok: true,
          leaderboard: scoreLeaderboard,
          meta: scoreLeaderboard.length
            ? { source: 'prediction_scores', fallbackReason: error.code }
            : { emptyReason: 'prediction_scores_empty', fallbackReason: error.code },
        })
      }

      return NextResponse.json(
        {
          ok: false,
          error: sanitizeDiagnostic(error.message),
          detail: sanitizeDiagnostic(getFriendlyDetail(error)),
          code: error.code ?? null,
          leaderboard: [],
        },
        { status: 500 }
      )
    }

    const normalizedLeaderboard = normalizeLeaderboardRows((data ?? []) as LeaderboardSourceRow[])

    if (normalizedLeaderboard.length) {
      return NextResponse.json({ ok: true, leaderboard: normalizedLeaderboard })
    }

    const scoreLeaderboard = await fetchLeaderboardFromPredictionScores()

    return NextResponse.json({
      ok: true,
      leaderboard: scoreLeaderboard,
      meta: scoreLeaderboard.length
        ? { source: 'prediction_scores' }
        : { emptyReason: 'no_points_calculated' },
    })
  } catch (error) {
    console.error('[prode/leaderboard] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: sanitizeDiagnostic(
          error instanceof Error ? error.message : 'No se pudo cargar el leaderboard.'
        ),
        detail: 'Error inesperado en /api/prode/leaderboard.',
        code: null,
        leaderboard: [],
      },
      { status: 500 }
    )
  }
}
