import type { SupabaseClient } from '@supabase/supabase-js'

import { requestFootballApi } from '@/server/integrations/football-api-client'
import { pickTeamLogoUrl } from '@/shared/utils/asset-urls'

type ApiStandingTeam = {
  id?: number
  name?: string
  logo?: string | null
}

type ApiStandingStats = {
  played?: number | null
  win?: number | null
  draw?: number | null
  lose?: number | null
  goals?: {
    for?: number | null
    against?: number | null
  } | null
}

type ApiStandingRow = {
  rank?: number | null
  team?: ApiStandingTeam | null
  group?: string | null
  points?: number | null
  goalsDiff?: number | null
  form?: string | null
  status?: string | null
  description?: string | null
  all?: ApiStandingStats | null
}

type ApiStandingsResponse = {
  league?: {
    id?: number
    name?: string
    country?: string
    season?: number
    standings?: ApiStandingRow[][]
  }
}

type CachedStandingRow = {
  rank: number
  teamId?: number
  teamName: string
  teamLogo?: string
  points: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  form?: string
  description?: string | null
}

export type CachedStandingGroup = {
  name: string
  rows: CachedStandingRow[]
}

export type SyncLeagueStandingsCacheResult = {
  standingsChecked: number
  standingsSynced: number
  groupsDetected: string[]
  warnings: string[]
  errors: string[]
}

type StandingCacheRow = {
  group_name: string
  payload: unknown
}

const API_STANDINGS_MEMORY_CACHE_TTL_MS = 10 * 60 * 1000
const apiStandingsMemoryCache = new Map<string, {
  expiresAt: number
  groups: CachedStandingGroup[]
}>()

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getGroupLetter(value: string) {
  const normalized = normalizeText(value)
  const match =
    normalized.match(/\b(?:group|grupo)\s+([a-z])\b/) ??
    normalized.match(/\b(?:zone|zona)\s+([a-z])\b/)

  return match?.[1]?.toUpperCase() ?? null
}

function normalizeGroupName(rawName: string | null | undefined, index: number) {
  const raw = rawName?.trim()

  if (!raw) return index === 0 ? 'Tabla' : `Grupo ${index + 1}`

  const letter = getGroupLetter(raw)
  if (letter) return `Grupo ${letter}`

  const normalized = normalizeText(raw)
  if (normalized.includes('league phase') || normalized.includes('league stage')) {
    return 'Fase liga'
  }
  if (normalized.includes('fase liga')) return 'Fase liga'
  if (normalized.includes('overall') || normalized.includes('total')) return 'Tabla'

  const afterColon = raw.split(':').map((part) => part.trim()).filter(Boolean).at(-1)
  return afterColon || raw
}

function getStandingGroupName(rows: ApiStandingRow[], index: number) {
  const rowWithGroup = rows.find((row) => row.group?.trim())
  return normalizeGroupName(rowWithGroup?.group, index)
}

function mapStandingRow(row: ApiStandingRow, index: number): CachedStandingRow | null {
  const teamName = row.team?.name?.trim()

  if (!teamName) return null

  const teamId = toNumber(row.team?.id)
  const played = toNumber(row.all?.played) ?? 0
  const won = toNumber(row.all?.win) ?? 0
  const drawn = toNumber(row.all?.draw) ?? 0
  const lost = toNumber(row.all?.lose) ?? 0
  const goalsFor = toNumber(row.all?.goals?.for) ?? 0
  const goalsAgainst = toNumber(row.all?.goals?.against) ?? 0
  const goalDifference = toNumber(row.goalsDiff) ?? goalsFor - goalsAgainst

  return {
    rank: toNumber(row.rank) ?? index + 1,
    teamId: teamId ?? undefined,
    teamName,
    teamLogo: pickTeamLogoUrl(null, teamId ?? undefined, row.team?.logo ?? undefined) ?? undefined,
    points: toNumber(row.points) ?? 0,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference,
    form: row.form ?? undefined,
    description: row.description ?? row.status ?? null,
  }
}

function mapPayloadToRows(payload: unknown) {
  if (!Array.isArray(payload)) return []

  return payload
    .map((row, index) => mapStandingRow(row as ApiStandingRow, index))
    .filter((row): row is CachedStandingRow => Boolean(row))
}

function getGroupSortValue(name: string) {
  const letter = getGroupLetter(name)

  if (letter) return letter.charCodeAt(0) - 'A'.charCodeAt(0)
  if (normalizeText(name).includes('fase liga')) return 0
  if (normalizeText(name) === 'tabla') return 0

  return 1000
}

function sortCachedGroups(groups: CachedStandingGroup[]) {
  return [...groups].sort((a, b) => {
    const sortA = getGroupSortValue(a.name)
    const sortB = getGroupSortValue(b.name)

    if (sortA !== sortB) return sortA - sortB

    return a.name.localeCompare(b.name, 'es-AR', { numeric: true })
  })
}

function isMissingStandingsCacheTable(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('football_standings_cache') ||
    message.includes('schema cache')
  )
}

export async function readCachedLeagueStandings(
  supabase: SupabaseClient,
  leagueExternalId: number,
  season: number
): Promise<CachedStandingGroup[]> {
  const response = await supabase
    .from('football_standings_cache')
    .select('group_name, payload')
    .eq('league_external_id', String(leagueExternalId))
    .eq('season', season)

  if (response.error) {
    if (isMissingStandingsCacheTable(response.error)) return []
    throw response.error
  }

  return sortCachedGroups(
    ((response.data ?? []) as StandingCacheRow[])
      .map((row) => ({
        name: row.group_name,
        rows: mapPayloadToRows(row.payload),
      }))
      .filter((group) => group.rows.length > 0)
  )
}

export async function readApiLeagueStandings(
  leagueExternalId: number,
  season: number,
  options: { logContext?: string } = {}
): Promise<CachedStandingGroup[]> {
  const cacheKey = `${leagueExternalId}:${season}`
  const cached = apiStandingsMemoryCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) return cached.groups

  try {
    const { payload } = await requestFootballApi<ApiStandingsResponse[]>(
      '/standings',
      {
        league: leagueExternalId,
        season,
      },
      { logContext: options.logContext ?? `read-api-standings:${leagueExternalId}` }
    )
    const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

    if (apiErrors.length) throw new Error(apiErrors.join(' | '))

    const standingsSets = (payload.response ?? [])
      .flatMap((entry) => entry.league?.standings ?? [])
      .filter((rows) => Array.isArray(rows) && rows.length > 0)
    const groupsByName = new Map<string, ApiStandingRow[]>()

    standingsSets.forEach((rows, index) => {
      const groupName = getStandingGroupName(rows, index)
      const current = groupsByName.get(groupName) ?? []

      current.push(...rows)
      groupsByName.set(groupName, current)
    })

    const groups = sortCachedGroups(
      [...groupsByName.entries()]
        .map(([name, rows]) => ({
          name,
          rows: rows
            .map((row, index) => mapStandingRow(row, index))
            .filter((row): row is CachedStandingRow => Boolean(row)),
        }))
        .filter((group) => group.rows.length > 0)
    )

    apiStandingsMemoryCache.set(cacheKey, {
      expiresAt: Date.now() + API_STANDINGS_MEMORY_CACHE_TTL_MS,
      groups,
    })

    return groups
  } catch (error) {
    console.warn('[football-standings-cache] No se pudieron leer standings oficiales.', {
      leagueExternalId,
      season,
      message: error instanceof Error ? error.message : String(error),
    })

    return []
  }
}

export async function syncLeagueStandingsCache(
  supabase: SupabaseClient,
  input: {
    leagueExternalId: number
    season: number
    logContext?: string
  }
): Promise<SyncLeagueStandingsCacheResult> {
  const result: SyncLeagueStandingsCacheResult = {
    standingsChecked: 0,
    standingsSynced: 0,
    groupsDetected: [],
    warnings: [],
    errors: [],
  }

  try {
    const { payload } = await requestFootballApi<ApiStandingsResponse[]>(
      '/standings',
      {
        league: input.leagueExternalId,
        season: input.season,
      },
      { logContext: input.logContext ?? `sync-standings:${input.leagueExternalId}` }
    )
    const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

    if (apiErrors.length) throw new Error(apiErrors.join(' | '))

    const standingsSets = (payload.response ?? [])
      .flatMap((entry) => entry.league?.standings ?? [])
      .filter((rows) => Array.isArray(rows) && rows.length > 0)

    result.standingsChecked = standingsSets.reduce((sum, rows) => sum + rows.length, 0)

    if (!standingsSets.length) {
      result.warnings.push('API-Football no devolvio standings para esta liga/temporada.')
      return result
    }

    const groupsByName = new Map<string, ApiStandingRow[]>()

    standingsSets.forEach((rows, index) => {
      const groupName = getStandingGroupName(rows, index)
      const current = groupsByName.get(groupName) ?? []

      current.push(...rows)
      groupsByName.set(groupName, current)
    })

    for (const [groupName, rows] of groupsByName.entries()) {
      const response = await supabase
        .from('football_standings_cache')
        .upsert(
          {
            league_external_id: String(input.leagueExternalId),
            season: input.season,
            group_name: groupName,
            payload: rows,
          },
          { onConflict: 'league_external_id,season,group_name' }
        )

      if (response.error) {
        if (isMissingStandingsCacheTable(response.error)) {
          result.warnings.push('football_standings_cache no existe; se omite cache de standings.')
          return result
        }

        throw response.error
      }

      result.standingsSynced += rows.length
      result.groupsDetected.push(groupName)
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  result.groupsDetected = [...new Set(result.groupsDetected)]

  return result
}
