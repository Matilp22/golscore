import 'server-only'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export type AdminDataError = {
  message: string
  setupRequired?: boolean
}

export type AdminDataResult<T> =
  | {
      data: T
      error: null
    }
  | {
      data: T
      error: AdminDataError
    }

export type CachedFixture = {
  cacheId: string
  cacheDate: string
  fixtureExternalId: string
  leagueExternalId: string | null
  leagueName: string | null
  homeTeam: string | null
  awayTeam: string | null
  matchDate: string | null
  statusShort: string | null
  updatedAt: string | null
}

type FixtureCacheRow = {
  id: string
  date: string
  fixture_external_id: string
  league_external_id: string | null
  normalized_payload: unknown
  payload: unknown
  updated_at: string | null
  created_at: string | null
}

type SupabaseErrorLike = {
  code?: string
  message?: string
}

export function getAdminClient() {
  return getSupabaseAdminClient()
}

export function isMissingRelationError(error: SupabaseErrorLike | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('no existe')
  )
}

export function toAdminDataError(error: unknown, fallback: string): AdminDataError {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as SupabaseErrorLike
    const message = maybeError.message || fallback

    return {
      message,
      setupRequired: isMissingRelationError(maybeError),
    }
  }

  return {
    message: error instanceof Error ? error.message : fallback,
  }
}

export function normalizeSearch(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readText(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key]

  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

function firstText(source: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = readText(source, key)

    if (value) return value
  }

  return null
}

function parseFixturePayload(row: FixtureCacheRow) {
  const normalized = asRecord(row.normalized_payload)
  const raw = asRecord(row.payload)
  const fixture = asRecord(raw?.fixture)
  const league = asRecord(raw?.league)
  const teams = asRecord(raw?.teams)
  const home = asRecord(teams?.home)
  const away = asRecord(teams?.away)

  return {
    leagueName:
      firstText(normalized, ['league', 'leagueName']) ||
      firstText(league, ['name']),
    homeTeam:
      firstText(normalized, ['home', 'homeTeam']) ||
      firstText(home, ['name']),
    awayTeam:
      firstText(normalized, ['away', 'awayTeam']) ||
      firstText(away, ['name']),
    matchDate:
      firstText(normalized, ['date', 'matchDate']) ||
      firstText(fixture, ['date']),
    statusShort:
      firstText(normalized, ['statusShort', 'status']) ||
      firstText(asRecord(fixture?.status), ['short']),
  }
}

export function serializeCachedFixture(row: FixtureCacheRow): CachedFixture {
  const parsed = parseFixturePayload(row)

  return {
    cacheId: row.id,
    cacheDate: row.date,
    fixtureExternalId: String(row.fixture_external_id),
    leagueExternalId: row.league_external_id ? String(row.league_external_id) : null,
    leagueName: parsed.leagueName,
    homeTeam: parsed.homeTeam,
    awayTeam: parsed.awayTeam,
    matchDate: parsed.matchDate,
    statusShort: parsed.statusShort,
    updatedAt: row.updated_at ?? row.created_at,
  }
}

export function matchesFixtureSearch(fixture: CachedFixture, query: string) {
  const normalizedQuery = normalizeSearch(query)

  if (!normalizedQuery) return true

  const haystack = normalizeSearch([
    fixture.fixtureExternalId,
    fixture.leagueExternalId,
    fixture.leagueName,
    fixture.homeTeam,
    fixture.awayTeam,
    fixture.cacheDate,
  ].filter(Boolean).join(' '))

  return haystack.includes(normalizedQuery)
}

export async function listCachedFixtures(options: {
  query?: string | null
  limit?: number
}) {
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 250)
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('football_fixture_cache')
    .select('id, date, fixture_external_id, league_external_id, normalized_payload, payload, updated_at, created_at')
    .order('date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(300)

  if (error) {
    return {
      data: [] as CachedFixture[],
      error: toAdminDataError(error, 'No se pudieron leer fixtures cacheados.'),
    }
  }

  const fixtures = ((data ?? []) as FixtureCacheRow[])
    .map(serializeCachedFixture)
    .filter((fixture) => matchesFixtureSearch(fixture, options.query ?? ''))
    .slice(0, limit)

  return {
    data: fixtures,
    error: null,
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin dato'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

export function clampInteger(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback

  return Math.min(Math.max(Math.trunc(value), min), max)
}
