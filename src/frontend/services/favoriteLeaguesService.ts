import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'

type FavoriteLeagueRow = {
  user_id: string
  league_id: string
}

type FavoriteLeagueSelectQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (
        column: string,
        options: { ascending: boolean }
      ) => Promise<{
        data: Array<Pick<FavoriteLeagueRow, 'league_id'>> | null
        error: Error | null
      }>
    }
  }
}

type FavoriteLeagueWriteQuery = {
  upsert: (
    value: FavoriteLeagueRow,
    options: { onConflict: string }
  ) => Promise<{ error: Error | null }>
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>
    }
  }
}

function favoriteLeagueQuery() {
  return getSupabaseBrowserClient().from('user_favorite_leagues' as 'leagues') as unknown as
    FavoriteLeagueSelectQuery & FavoriteLeagueWriteQuery
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
  const { error } = await favoriteLeagueQuery()
    .upsert(
      { user_id: userId, league_id: leagueId },
      { onConflict: 'user_id,league_id' }
    )

  if (error) throw error
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
