import { getAllowedTournamentByExternalId } from '@/shared/config/prode-leagues'

type LeagueRow = {
  id: string
  name: string
  country: string | null
  external_id: number | string | null
  season: number | null
}

type SupabaseLeagueClient = {
  from: (table: 'leagues') => {
    select: (columns: string) => {
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => PromiseLike<{
        data: unknown[] | null
        error: { message: string } | null
      }>
    }
  }
}

export type AllowedLeagueRow = LeagueRow

export async function getAllowedProdeLeagues(supabase: SupabaseLeagueClient) {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, country, external_id, season')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as LeagueRow[]).filter((league) => {
    const tournament = getAllowedTournamentByExternalId(league.external_id)

    return Boolean(tournament && league.season === tournament.season)
  })
}

export async function getAllowedProdeLeagueIds(supabase: SupabaseLeagueClient) {
  const leagues = await getAllowedProdeLeagues(supabase)

  return leagues.map((league) => league.id)
}

export function isAllowedLeagueId(
  allowedLeagueIds: string[],
  leagueId: string | null
) {
  return typeof leagueId === 'string' && allowedLeagueIds.includes(leagueId)
}
