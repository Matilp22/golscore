import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'

export type LeagueRecord = {
  id: string
  name: string
  country: string | null
}

export type MatchRecord = {
  id: string
  league_id: string | null
  round: string | null
  match_date: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  status: string
}

export type PredictionRecord = {
  id: string
  user_id: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  created_at: string
  updated_at: string
}

type PredictionUpsertQuery = {
  upsert: (
    values: {
      user_id: string
      match_id: string
      predicted_home_score: number
      predicted_away_score: number
    },
    options: { onConflict: string }
  ) => {
    select: () => {
      single: () => PromiseLike<{
        data: unknown
        error: { message: string } | null
      }>
    }
  }
}

export async function getLeagues() {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, country')
    .order('country', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as Array<{
    id: string | number
    name: string
    country: string | null
  }>).map((league) => ({
    ...league,
    id: String(league.id),
  }))
}

export async function getMatches(params?: { leagueId?: string }) {
  const supabase = getSupabaseBrowserClient()
  let query = (supabase.from('matches') as unknown as {
    select: (columns: string) => {
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => {
        eq: (column: string, value: string) => unknown
      } & PromiseLike<{
        data: unknown[] | null
        error: { message: string } | null
      }>
    }
  })
    .select('id, league_id, round, match_date, home_team_id, away_team_id, home_score, away_score, status')
    .order('match_date', { ascending: true })

  if (params?.leagueId) {
    query = query.eq('league_id', params.leagueId) as typeof query
  }

  const { data, error } = await query

  if (error) throw error

  return ((data ?? []) as unknown as Array<Omit<MatchRecord, 'id' | 'league_id' | 'home_team_id' | 'away_team_id'> & {
    id: string | number
    league_id: string | number | null
    home_team_id: string | number | null
    away_team_id: string | number | null
  }>).map((match) => ({
    ...match,
    id: String(match.id),
    league_id: match.league_id === null ? null : String(match.league_id),
    home_team_id: match.home_team_id === null ? null : String(match.home_team_id),
    away_team_id: match.away_team_id === null ? null : String(match.away_team_id),
  }))
}

export async function getMyPredictions() {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) return []

  const { data, error } = await supabase
    .from('predictions')
    .select('id, user_id, match_id, predicted_home_score, predicted_away_score, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as Array<Omit<PredictionRecord, 'match_id'> & {
    match_id: string | number
  }>).map((prediction) => ({
    ...prediction,
    match_id: String(prediction.match_id),
  }))
}

export async function saveMyPrediction(input: {
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
}) {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Necesitás iniciar sesión para guardar predicciones.')

  const predictionsQuery = supabase.from('predictions') as unknown as PredictionUpsertQuery

  const { data, error } = await predictionsQuery
    .upsert(
      {
        user_id: user.id,
        match_id: input.matchId,
        predicted_home_score: input.predictedHomeScore,
        predicted_away_score: input.predictedAwayScore,
      },
      { onConflict: 'user_id,match_id' }
    )
    .select()
    .single()

  if (error) throw error

  const prediction = data as PredictionRecord & { match_id: string | number }

  return {
    ...prediction,
    match_id: String(prediction.match_id),
  }
}
