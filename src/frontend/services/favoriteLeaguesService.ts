import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'

type FavoriteLeagueRow = {
  user_id: string
  league_id: string
}

export type FavoriteLeagueError = Error & {
  code?: string
  details?: string
  hint?: string
}

type FavoriteLeagueSelectQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (
        column: string,
        options: { ascending: boolean }
      ) => Promise<{
        data: Array<Pick<FavoriteLeagueRow, 'league_id'>> | null
        error: FavoriteLeagueError | null
      }>
    }
  }
}

type FavoriteLeagueWriteQuery = {
  insert: (
    value: FavoriteLeagueRow,
    options?: { count?: 'exact' | 'planned' | 'estimated' }
  ) => Promise<{ error: FavoriteLeagueError | null }>
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: FavoriteLeagueError | null }>
    }
  }
}

function favoriteLeagueQuery() {
  return getSupabaseBrowserClient().from('user_favorite_leagues' as 'leagues') as unknown as
    FavoriteLeagueSelectQuery & FavoriteLeagueWriteQuery
}

export function getFavoriteLeagueErrorInfo(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {
      message: error instanceof Error ? error.message : 'Error desconocido',
      code: null,
      details: null,
      hint: null,
    }
  }

  const value = error as Partial<FavoriteLeagueError>

  return {
    message: value.message ?? 'Error desconocido',
    code: value.code ?? null,
    details: value.details ?? null,
    hint: value.hint ?? null,
  }
}

export async function getUserFavoriteLeagues(userId: string) {
  const { data, error } = await favoriteLeagueQuery()
    .select('league_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as Array<Pick<FavoriteLeagueRow, 'league_id'>>).map(
    (row) => row.league_id
  )
}

export async function addFavoriteLeague(userId: string, leagueId: string) {
  const { error } = await favoriteLeagueQuery().insert({
    user_id: userId,
    league_id: leagueId,
  })

  if (error && error.code !== '23505') throw error
}

export async function removeFavoriteLeague(userId: string, leagueId: string) {
  const { error } = await favoriteLeagueQuery()
    .delete()
    .eq('user_id', userId)
    .eq('league_id', leagueId)

  if (error) throw error
}

export async function toggleFavoriteLeague(
  userId: string,
  leagueId: string,
  isFavorite: boolean
) {
  if (isFavorite) {
    await removeFavoriteLeague(userId, leagueId)
    return false
  }

  await addFavoriteLeague(userId, leagueId)
  return true
}
