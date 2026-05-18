import type { SupabaseClient } from '@supabase/supabase-js'

export type TeamLogoLookupRow = {
  id: string
  name: string | null
  logo_url: string | null
}

const TEAM_LOGO_PAGE_SIZE = 1000

export async function fetchAllTeamLogoRows(
  supabase: SupabaseClient
): Promise<TeamLogoLookupRow[]> {
  const teams: TeamLogoLookupRow[] = []

  for (let from = 0; ; from += TEAM_LOGO_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .order('id', { ascending: true })
      .range(from, from + TEAM_LOGO_PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as TeamLogoLookupRow[]
    teams.push(...page)

    if (page.length < TEAM_LOGO_PAGE_SIZE) break
  }

  return teams
}
