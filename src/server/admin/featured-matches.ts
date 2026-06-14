import 'server-only'

import {
  listCachedFixtures,
  getAdminClient,
  normalizeSearch,
  toAdminDataError,
  type AdminDataResult,
  type CachedFixture,
} from '@/server/admin/shared'

export type FeaturedMatchRow = {
  id: string
  fixture_external_id: string
  title: string | null
  home_team: string | null
  away_team: string | null
  league_name: string | null
  match_date: string | null
  featured: boolean
  priority: number
  note: string | null
  created_at: string | null
  updated_at: string | null
}

export type FeaturedMatchesPageData = {
  fixtures: CachedFixture[]
  featuredMatches: FeaturedMatchRow[]
}

export type FeaturedMatchInput = {
  fixtureExternalId: string
  title?: string | null
  homeTeam?: string | null
  awayTeam?: string | null
  leagueName?: string | null
  matchDate?: string | null
  featured: boolean
  priority: number
  note?: string | null
}

function matchesFeaturedSearch(row: FeaturedMatchRow, query: string) {
  const normalizedQuery = normalizeSearch(query)

  if (!normalizedQuery) return true

  const haystack = normalizeSearch([
    row.fixture_external_id,
    row.title,
    row.home_team,
    row.away_team,
    row.league_name,
    row.note,
  ].filter(Boolean).join(' '))

  return haystack.includes(normalizedQuery)
}

export async function getFeaturedMatchesPageData(
  query?: string | null
): Promise<AdminDataResult<FeaturedMatchesPageData>> {
  const fixturesResult = await listCachedFixtures({ query, limit: 80 })
  const fallback: FeaturedMatchesPageData = {
    fixtures: fixturesResult.data,
    featuredMatches: [],
  }

  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_featured_matches')
      .select('*')
      .order('priority', { ascending: true })
      .order('match_date', { ascending: true })
      .limit(200)

    if (error) {
      return {
        data: fallback,
        error: toAdminDataError(error, 'No se pudieron leer partidos destacados.'),
      }
    }

    const featuredMatches = ((data ?? []) as FeaturedMatchRow[])
      .filter((row) => matchesFeaturedSearch(row, query ?? ''))

    const pageData = {
      fixtures: fixturesResult.data,
      featuredMatches,
    }

    if (fixturesResult.error) {
      return {
        data: pageData,
        error: fixturesResult.error,
      }
    }

    return {
      data: pageData,
      error: null,
    }
  } catch (error) {
    return {
      data: fallback,
      error: toAdminDataError(error, 'No se pudo cargar destacados.'),
    }
  }
}

export async function upsertFeaturedMatch(input: FeaturedMatchInput) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_featured_matches')
    .upsert(
      {
        fixture_external_id: input.fixtureExternalId,
        title: input.title || null,
        home_team: input.homeTeam || null,
        away_team: input.awayTeam || null,
        league_name: input.leagueName || null,
        match_date: input.matchDate || null,
        featured: input.featured,
        priority: input.priority,
        note: input.note || null,
      },
      { onConflict: 'fixture_external_id' }
    )

  if (error) {
    throw new Error(`No se pudo guardar el destacado: ${error.message}`)
  }
}
