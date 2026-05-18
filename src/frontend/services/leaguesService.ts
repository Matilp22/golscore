import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'
import type { TournamentOption } from '@/frontend/types/prode'
import {
  ALLOWED_TOURNAMENTS,
  getAllowedTournamentByExternalId,
  getAllowedProdeLeagueLabel,
  getAllowedTournamentExternalIds,
} from '@/shared/config/prode-leagues'
import { pickLeagueLogoUrl } from '@/shared/utils/asset-urls'

export async function getLeagues(): Promise<TournamentOption[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, country, external_id, season, logo_url')
    .in('external_id', getAllowedTournamentExternalIds())
    .order('country', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  const leagues = (data ?? []) as unknown as Array<{
    id: string | number
    name: string
    country: string | null
    external_id: string | number | null
    season: number | null
    logo_url: string | null
  }>

  const tournaments = leagues
    .filter((league) => {
      const tournament = getAllowedTournamentByExternalId(league.external_id)

      return Boolean(tournament && league.season === tournament.season)
    })
    .map((league): TournamentOption => ({
      id: String(league.id),
      externalId: league.external_id === null ? null : Number(league.external_id),
      slug: getAllowedTournamentByExternalId(league.external_id)?.slug ?? String(league.id),
      name: getAllowedProdeLeagueLabel(league.name),
      country: league.country,
      season: league.season ?? new Date().getFullYear(),
      logoUrl: pickLeagueLogoUrl(league.logo_url, league.external_id),
    }))
    .sort((a, b) => {
      const aIndex = ALLOWED_TOURNAMENTS.findIndex((tournament) => tournament.slug === a.slug)
      const bIndex = ALLOWED_TOURNAMENTS.findIndex((tournament) => tournament.slug === b.slug)

      return aIndex - bIndex
    })

  console.info('[prode-leagues] torneos detectados', {
    count: tournaments.length,
    tournaments: tournaments.map((tournament) => ({
      id: tournament.id,
      externalId: tournament.externalId,
      name: tournament.name,
    })),
  })

  return tournaments
}

export const getTournaments = getLeagues
