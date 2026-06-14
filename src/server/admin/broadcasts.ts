import 'server-only'

import {
  listCachedFixtures,
  getAdminClient,
  normalizeSearch,
  toAdminDataError,
  type AdminDataResult,
  type CachedFixture,
} from '@/server/admin/shared'

export type BroadcastOverrideRow = {
  id: string
  fixture_external_id: string
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
  active: boolean
  priority: number
  note: string | null
  created_at: string | null
  updated_at: string | null
}

export type BroadcastsPageData = {
  fixtures: CachedFixture[]
  overrides: BroadcastOverrideRow[]
}

export type BroadcastOverrideInput = {
  fixtureExternalId: string
  broadcasterName: string
  broadcasterLogoUrl?: string | null
  country?: string | null
  active: boolean
  priority: number
  note?: string | null
}

function matchesOverrideSearch(row: BroadcastOverrideRow, query: string) {
  const normalizedQuery = normalizeSearch(query)

  if (!normalizedQuery) return true

  const haystack = normalizeSearch([
    row.fixture_external_id,
    row.broadcaster_name,
    row.country,
    row.note,
  ].filter(Boolean).join(' '))

  return haystack.includes(normalizedQuery)
}

export async function getBroadcastsPageData(
  query?: string | null
): Promise<AdminDataResult<BroadcastsPageData>> {
  const fixturesResult = await listCachedFixtures({ query, limit: 80 })
  const fallback: BroadcastsPageData = {
    fixtures: fixturesResult.data,
    overrides: [],
  }

  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_broadcast_overrides')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200)

    if (error) {
      return {
        data: fallback,
        error: toAdminDataError(error, 'No se pudieron leer overrides de TV.'),
      }
    }

    const fixtureIds = new Set(fixturesResult.data.map((fixture) => fixture.fixtureExternalId))
    const normalizedQuery = normalizeSearch(query)
    const overrides = ((data ?? []) as BroadcastOverrideRow[]).filter((row) => (
      !normalizedQuery ||
      fixtureIds.has(row.fixture_external_id) ||
      matchesOverrideSearch(row, query ?? '')
    ))

    const pageData = {
      fixtures: fixturesResult.data,
      overrides,
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
      error: toAdminDataError(error, 'No se pudo cargar TV admin.'),
    }
  }
}

export async function createBroadcastOverride(input: BroadcastOverrideInput) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_broadcast_overrides')
    .insert({
      fixture_external_id: input.fixtureExternalId,
      broadcaster_name: input.broadcasterName,
      broadcaster_logo_url: input.broadcasterLogoUrl || null,
      country: input.country || null,
      active: input.active,
      priority: input.priority,
      note: input.note || null,
    })

  if (error) {
    throw new Error(`No se pudo crear el override de TV: ${error.message}`)
  }
}

export async function updateBroadcastOverride(
  id: string,
  input: Omit<BroadcastOverrideInput, 'fixtureExternalId'>
) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_broadcast_overrides')
    .update({
      broadcaster_name: input.broadcasterName,
      broadcaster_logo_url: input.broadcasterLogoUrl || null,
      country: input.country || null,
      active: input.active,
      priority: input.priority,
      note: input.note || null,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`No se pudo actualizar el override de TV: ${error.message}`)
  }
}

export async function deleteBroadcastOverride(id: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('admin_broadcast_overrides')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`No se pudo eliminar el override de TV: ${error.message}`)
  }
}
