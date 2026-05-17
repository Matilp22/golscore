import { NextResponse } from 'next/server'

import { getHomeMatchesSourceSnapshot, type MatchListItem } from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  addDaysToISO,
  formatMatchDateTimeArgentina,
  getArgentinaDateISO,
  getArgentinaDayUtcRange,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'

type SupabaseAuditMatch = {
  id: string
  external_id: string | number | null
  match_date: string
  round: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  leagues: {
    name: string | null
    external_id: string | number | null
    country: string | null
  } | null
  home_team: {
    name: string | null
    external_id: string | number | null
  } | null
  away_team: {
    name: string | null
    external_id: string | number | null
  } | null
}

type CacheAuditRow = {
  date: string
  league_external_id: string | null
  fixture_external_id: string
  normalized_payload: unknown
  payload: unknown
}

type AuditReason =
  | 'included'
  | 'dateMismatch'
  | 'excludedCompetition'
  | 'unsupportedLeague'
  | 'missingLeagueGroup'
  | 'renderBug'
  | 'duplicate'
  | 'unknown'

type DateAuditRow = {
  external_id: number | string | null
  liga: string
  leagueExternalId: number | string | null
  local: string
  visitante: string
  source: 'supabase' | 'cache' | 'home'
  cacheDate: string | null
  match_date_original: string | null
  match_date_utc: string | null
  match_date_argentina: string | null
  argentina_date_iso: string | null
  status: string | null
  includedInHome: boolean
  excludedReason: AuditReason
  detail: string | null
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  })
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value: string | number | null | undefined) {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

function getExternalIdKey(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null

  return String(value)
}

function getStringValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

function serializeDate(value: string | null | undefined) {
  if (!value) {
    return {
      match_date_utc: null,
      match_date_argentina: null,
      argentina_date_iso: null,
    }
  }

  return {
    match_date_utc: toArgentinaDate(value).toISOString(),
    match_date_argentina: formatMatchDateTimeArgentina(value),
    argentina_date_iso: getArgentinaDateISO(value),
  }
}

function getVisibilityInfo(input: {
  leagueId?: number | null
  league: string
  country?: string | null
  home: string
  away: string
  round?: string | null
}) {
  if (!input.league || input.league === 'Sin liga') {
    return {
      included: false,
      reason: 'missingLeagueGroup' as const,
      detail: 'falta liga para agrupar en Home',
    }
  }

  const visibility = getHomeMatchVisibility(input)

  if (visibility.included) {
    return {
      included: true,
      reason: 'included' as const,
      detail: visibility.reason,
    }
  }

  return {
    included: false,
    reason:
      visibility.reason === 'excludedCompetition'
        ? ('excludedCompetition' as const)
        : ('unsupportedLeague' as const),
    detail: visibility.excludedReason ? String(visibility.excludedReason) : visibility.reason,
  }
}

async function fetchSupabaseMatchesForDate(date: string, leagueExternalId: string | null) {
  const supabase = getSupabaseAdminClient()
  const { startUtc, endUtc } = getArgentinaDayUtcRange(date)
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, external_id, match_date, round, status, home_score, away_score, leagues(name, external_id, country), home_team:teams!matches_home_team_id_fkey(name, external_id), away_team:teams!matches_away_team_id_fkey(name, external_id)'
    )
    .gte('match_date', startUtc)
    .lt('match_date', endUtc)
    .order('match_date', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as SupabaseAuditMatch[]).filter((match) => {
    if (!leagueExternalId) return true

    return String(match.leagues?.external_id ?? '') === leagueExternalId
  })
}

async function fetchCacheMatchesForDateWindow(date: string, leagueExternalId: string | null) {
  const supabase = getSupabaseAdminClient()
  const cacheDateWindow = [addDaysToISO(date, -1), date, addDaysToISO(date, 1)]
  let query = supabase
    .from('football_fixture_cache')
    .select('date, league_external_id, fixture_external_id, normalized_payload, payload')
    .in('date', cacheDateWindow)
    .order('date', { ascending: true })
    .order('fixture_external_id', { ascending: true })

  if (leagueExternalId) query = query.eq('league_external_id', leagueExternalId)

  const { data, error } = await query

  if (error) {
    const message = error.message.toLowerCase()
    const missingCacheTable =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      message.includes('football_fixture_cache') ||
      message.includes('schema cache')

    if (missingCacheTable) return []
    throw error
  }

  return (data ?? []) as CacheAuditRow[]
}

function serializeSupabaseMatch(
  match: SupabaseAuditMatch,
  selectedDate: string,
  homeVisibleIds: Set<string>
): DateAuditRow {
  const externalId = getExternalIdKey(match.external_id)
  const home = match.home_team?.name ?? 'Sin local'
  const away = match.away_team?.name ?? 'Sin visitante'
  const league = match.leagues?.name ?? 'Sin liga'
  const dateInfo = serializeDate(match.match_date)
  const visibility = getVisibilityInfo({
    leagueId: toFiniteNumber(match.leagues?.external_id),
    league,
    country: match.leagues?.country ?? '',
    home,
    away,
    round: match.round,
  })
  const includedInHome = externalId ? homeVisibleIds.has(externalId) : false
  let excludedReason: AuditReason = visibility.reason
  let detail: string | null = visibility.detail

  if (dateInfo.argentina_date_iso !== selectedDate) {
    excludedReason = 'dateMismatch'
    detail = 'match_date no pertenece al dia argentino seleccionado'
  } else if (visibility.included && !includedInHome) {
    excludedReason = 'renderBug'
    detail = 'partido valido en Supabase pero ausente en Home'
  }

  return {
    external_id: match.external_id,
    liga: league,
    leagueExternalId: match.leagues?.external_id ?? null,
    local: home,
    visitante: away,
    source: 'supabase',
    cacheDate: null,
    match_date_original: match.match_date,
    ...dateInfo,
    status: match.status,
    includedInHome,
    excludedReason: includedInHome ? 'included' : excludedReason,
    detail: includedInHome ? 'visible en Home' : detail,
  }
}

function readCacheFixture(row: CacheAuditRow) {
  const normalized = isRecord(row.normalized_payload) ? row.normalized_payload : {}
  const payload = isRecord(row.payload) ? row.payload : {}
  const fixture = isRecord(payload.fixture) ? payload.fixture : {}
  const league = isRecord(payload.league) ? payload.league : {}
  const teams = isRecord(payload.teams) ? payload.teams : {}
  const homeTeam = isRecord(teams.home) ? teams.home : {}
  const awayTeam = isRecord(teams.away) ? teams.away : {}
  const status = isRecord(fixture.status) ? fixture.status : {}

  return {
    externalId:
      getStringValue(normalized.externalId) ??
      getStringValue(normalized.id) ??
      row.fixture_external_id ??
      getStringValue(fixture.id),
    leagueExternalId:
      getStringValue(normalized.leagueId) ??
      row.league_external_id ??
      getStringValue(league.id),
    league:
      getStringValue(normalized.league) ??
      getStringValue(league.name) ??
      'Sin liga',
    country:
      getStringValue(normalized.country) ??
      getStringValue(league.country) ??
      null,
    round:
      getStringValue(normalized.round) ??
      getStringValue(league.round) ??
      null,
    home:
      getStringValue(normalized.home) ??
      getStringValue(homeTeam.name) ??
      'Sin local',
    away:
      getStringValue(normalized.away) ??
      getStringValue(awayTeam.name) ??
      'Sin visitante',
    date:
      getStringValue(normalized.date) ??
      getStringValue(fixture.date),
    status:
      getStringValue(normalized.statusShort) ??
      getStringValue(status.short),
  }
}

function serializeCacheMatch(
  row: CacheAuditRow,
  selectedDate: string,
  homeVisibleIds: Set<string>,
  duplicateCacheIds: Set<string>
): DateAuditRow {
  const fixture = readCacheFixture(row)
  const externalId = getExternalIdKey(fixture.externalId)
  const dateInfo = serializeDate(fixture.date)
  const visibility = getVisibilityInfo({
    leagueId: toFiniteNumber(fixture.leagueExternalId),
    league: fixture.league,
    country: fixture.country,
    home: fixture.home,
    away: fixture.away,
    round: fixture.round,
  })
  const includedInHome = externalId ? homeVisibleIds.has(externalId) : false
  let excludedReason: AuditReason = visibility.reason
  let detail: string | null = visibility.detail

  if (dateInfo.argentina_date_iso !== selectedDate) {
    excludedReason = 'dateMismatch'
    detail = 'fixture cacheado no pertenece al dia argentino seleccionado'
  } else if (externalId && duplicateCacheIds.has(externalId) && row.date !== selectedDate) {
    excludedReason = 'duplicate'
    detail = 'mismo fixture existe cacheado con mas de una fecha'
  } else if (visibility.included && !includedInHome) {
    excludedReason = 'renderBug'
    detail = 'partido valido en cache pero ausente en Home'
  }

  return {
    external_id: fixture.externalId,
    liga: fixture.league,
    leagueExternalId: fixture.leagueExternalId,
    local: fixture.home,
    visitante: fixture.away,
    source: 'cache',
    cacheDate: row.date,
    match_date_original: fixture.date,
    ...dateInfo,
    status: fixture.status,
    includedInHome,
    excludedReason: includedInHome ? 'included' : excludedReason,
    detail: includedInHome ? 'visible en Home' : detail,
  }
}

function serializeHomeMatch(match: MatchListItem): DateAuditRow {
  const dateInfo = serializeDate(match.date)

  return {
    external_id: match.externalId ?? match.id,
    liga: match.league,
    leagueExternalId: match.leagueId ?? null,
    local: match.home,
    visitante: match.away,
    source: 'home',
    cacheDate: null,
    match_date_original: match.date,
    ...dateInfo,
    status: match.statusShort,
    includedInHome: true,
    excludedReason: 'included',
    detail: 'renderizado por Home',
  }
}

function sortAuditRows(rows: DateAuditRow[]) {
  return [...rows].sort((a, b) => {
    const dateA = a.match_date_utc ?? ''
    const dateB = b.match_date_utc ?? ''

    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return String(a.external_id ?? '').localeCompare(String(b.external_id ?? ''), 'es-AR', {
      numeric: true,
    })
  })
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const selectedDate = searchParams.get('date') || getArgentinaTodayISO()
    const leagueExternalId = searchParams.get('leagueExternalId')
    const { startUtc, endUtc } = getArgentinaDayUtcRange(selectedDate)
    const [supabaseMatches, cacheRows, homeSnapshot] = await Promise.all([
      fetchSupabaseMatchesForDate(selectedDate, leagueExternalId),
      fetchCacheMatchesForDateWindow(selectedDate, leagueExternalId),
      getHomeMatchesSourceSnapshot(selectedDate),
    ])
    const homeVisibleIds = new Set(
      homeSnapshot.mergedMatches.map((match) => String(match.externalId ?? match.id))
    )
    const cacheIdCounts = new Map<string, number>()

    for (const row of cacheRows) {
      const fixture = readCacheFixture(row)
      const key = getExternalIdKey(fixture.externalId)
      if (!key) continue
      cacheIdCounts.set(key, (cacheIdCounts.get(key) ?? 0) + 1)
    }

    const duplicateCacheIds = new Set(
      [...cacheIdCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
    )
    const matchesFromSupabase = supabaseMatches.map((match) =>
      serializeSupabaseMatch(match, selectedDate, homeVisibleIds)
    )
    const allCacheRows = cacheRows.map((row) =>
      serializeCacheMatch(row, selectedDate, homeVisibleIds, duplicateCacheIds)
    )
    const matchesFromCache = allCacheRows.filter((row) =>
      row.argentina_date_iso === selectedDate || row.cacheDate === selectedDate
    )
    const visibleHomeMatches = homeSnapshot.mergedMatches
      .filter((match) => !leagueExternalId || String(match.leagueId ?? '') === leagueExternalId)
      .map(serializeHomeMatch)
    const allSourceRows = [...matchesFromSupabase, ...matchesFromCache]
    const missingFromHome = allSourceRows.filter((row) => row.excludedReason === 'renderBug')
    const excludedByFilters = allSourceRows.filter((row) =>
      row.excludedReason === 'excludedCompetition' ||
      row.excludedReason === 'unsupportedLeague' ||
      row.excludedReason === 'missingLeagueGroup'
    )
    const timezoneIssues = allCacheRows.filter((row) =>
      Boolean(
        row.cacheDate &&
        row.argentina_date_iso &&
        row.cacheDate !== row.argentina_date_iso &&
        (row.argentina_date_iso === selectedDate || row.cacheDate === selectedDate)
      )
    )

    return jsonNoStore({
      ok: true,
      selectedDateArgentina: selectedDate,
      startUtc,
      endUtc,
      leagueExternalId: leagueExternalId ?? null,
      cacheDateWindow: [addDaysToISO(selectedDate, -1), selectedDate, addDaysToISO(selectedDate, 1)],
      counts: {
        matchesFromSupabase: matchesFromSupabase.length,
        matchesFromCache: matchesFromCache.length,
        visibleHomeMatches: visibleHomeMatches.length,
        missingFromHome: missingFromHome.length,
        excludedByFilters: excludedByFilters.length,
        timezoneIssues: timezoneIssues.length,
      },
      matchesFromSupabase: sortAuditRows(matchesFromSupabase),
      matchesFromCache: sortAuditRows(matchesFromCache),
      visibleHomeMatches: sortAuditRows(visibleHomeMatches),
      missingFromHome: sortAuditRows(missingFromHome),
      excludedByFilters: sortAuditRows(excludedByFilters),
      timezoneIssues: sortAuditRows(timezoneIssues),
    })
  } catch (error) {
    console.error('[home-date-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar fechas del Home.',
      },
      { status: 500 }
    )
  }
}
