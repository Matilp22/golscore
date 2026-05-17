import { NextResponse } from 'next/server'

import { getHomeMatchesSourceSnapshot, type MatchListItem } from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import {
  ARGENTINA_TIME_ZONE,
  addDaysToISO,
  formatMatchDateTimeArgentina,
  getArgentinaDateISO,
  getArgentinaDayUtcRange,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type AuditFixture = {
  fixture?: {
    id?: number
    date?: string
    status?: {
      short?: string
      long?: string
    }
  }
  league?: {
    id?: number
    name?: string
    country?: string
    round?: string
  }
  teams?: {
    home?: {
      id?: number
      name?: string
    }
    away?: {
      id?: number
      name?: string
    }
  }
}

type SupabaseAuditMatch = {
  id: string
  external_id: string | number | null
  match_date: string
  round: string | null
  status: string | null
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

type LayerRow = {
  external_id: string | null
  liga: string
  leagueExternalId: string | number | null
  local: string
  visitante: string
  match_date_utc: string | null
  match_date_argentina: string | null
  argentina_date_iso: string | null
  status: string | null
  source: 'api-football' | 'supabase' | 'cache' | 'home'
  apiRequestedDate?: string | null
  cacheDate?: string | null
  includedInHome: boolean
  reasonIncluded: string | null
  reasonExcluded: string | null
  reason: string | null
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

function toKey(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null

  return String(value)
}

function toFiniteNumber(value: string | number | null | undefined) {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
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

function getVisibility(input: {
  leagueId?: number | null
  league: string
  country?: string | null
  home: string
  away: string
  round?: string | null
}) {
  if (!input.home || input.home === 'Sin local' || !input.away || input.away === 'Sin visitante') {
    return {
      included: false,
      reasonIncluded: null,
      reasonExcluded: 'noTeams',
    }
  }

  if (!input.league || input.league === 'Sin liga') {
    return {
      included: false,
      reasonIncluded: null,
      reasonExcluded: 'missingLeagueGroup',
    }
  }

  const visibility = getHomeMatchVisibility(input)

  if (visibility.included) {
    return {
      included: true,
      reasonIncluded: visibility.reason,
      reasonExcluded: null,
    }
  }

  return {
    included: false,
    reasonIncluded: null,
    reasonExcluded: visibility.excludedReason
      ? `excludedCompetition:${visibility.excludedReason}`
      : visibility.reason,
  }
}

function sortRows(rows: LayerRow[]) {
  return [...rows].sort((a, b) => {
    const dateA = a.match_date_utc ?? ''
    const dateB = b.match_date_utc ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)

    return String(a.external_id ?? '').localeCompare(String(b.external_id ?? ''), 'es-AR', {
      numeric: true,
    })
  })
}

function findDuplicateRows(rows: LayerRow[], source: LayerRow['source']) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (!row.external_id) continue
    counts.set(row.external_id, (counts.get(row.external_id) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([externalId, count]) => ({
      source,
      external_id: externalId,
      count,
    }))
}

async function fetchApiFixturesForAudit(dateArgentina: string) {
  const apiDates = [addDaysToISO(dateArgentina, -1), dateArgentina, addDaysToISO(dateArgentina, 1)]
  const rows: LayerRow[] = []
  const errors: Array<{ apiDate: string; message: string }> = []

  for (const apiDate of apiDates) {
    try {
      const { payload } = await requestFootballApi<AuditFixture[]>(
        '/fixtures',
        {
          date: apiDate,
          timezone: ARGENTINA_TIME_ZONE,
        },
        { logContext: `admin:home-full-audit:${dateArgentina}:api-date:${apiDate}` }
      )
      const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

      if (apiErrors.length) {
        errors.push({ apiDate, message: apiErrors.join(' | ') })
        continue
      }

      for (const fixture of payload.response ?? []) {
        const dateInfo = serializeDate(fixture.fixture?.date)
        const local = fixture.teams?.home?.name ?? 'Sin local'
        const visitante = fixture.teams?.away?.name ?? 'Sin visitante'
        const visibility = getVisibility({
          leagueId: fixture.league?.id ?? null,
          league: fixture.league?.name ?? 'Sin liga',
          country: fixture.league?.country ?? null,
          home: local,
          away: visitante,
          round: fixture.league?.round ?? null,
        })
        const dateMismatch = dateInfo.argentina_date_iso !== dateArgentina

        rows.push({
          external_id: toKey(fixture.fixture?.id),
          liga: fixture.league?.name ?? 'Sin liga',
          leagueExternalId: fixture.league?.id ?? null,
          local,
          visitante,
          ...dateInfo,
          status: fixture.fixture?.status?.short ?? null,
          source: 'api-football',
          apiRequestedDate: apiDate,
          includedInHome: false,
          reasonIncluded: !dateMismatch && visibility.included ? visibility.reasonIncluded : null,
          reasonExcluded: dateMismatch ? 'dateMismatch' : visibility.reasonExcluded,
          reason: dateMismatch
            ? `API date ${apiDate}; fecha Argentina real ${dateInfo.argentina_date_iso ?? 'sin fecha'}`
            : visibility.reasonExcluded,
        })
      }
    } catch (error) {
      errors.push({
        apiDate,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { rows, errors, apiDates }
}

async function fetchSupabaseRows(dateArgentina: string) {
  const supabase = getSupabaseAdminClient()
  const { startUtc, endUtc } = getArgentinaDayUtcRange(dateArgentina)
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, external_id, match_date, round, status, leagues(name, external_id, country), home_team:teams!matches_home_team_id_fkey(name, external_id), away_team:teams!matches_away_team_id_fkey(name, external_id)'
    )
    .gte('match_date', startUtc)
    .lt('match_date', endUtc)
    .order('match_date', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as SupabaseAuditMatch[]).map((match): LayerRow => {
    const local = match.home_team?.name ?? 'Sin local'
    const visitante = match.away_team?.name ?? 'Sin visitante'
    const dateInfo = serializeDate(match.match_date)
    const visibility = getVisibility({
      leagueId: toFiniteNumber(match.leagues?.external_id),
      league: match.leagues?.name ?? 'Sin liga',
      country: match.leagues?.country,
      home: local,
      away: visitante,
      round: match.round,
    })

    return {
      external_id: toKey(match.external_id),
      liga: match.leagues?.name ?? 'Sin liga',
      leagueExternalId: match.leagues?.external_id ?? null,
      local,
      visitante,
      ...dateInfo,
      status: match.status,
      source: 'supabase',
      includedInHome: false,
      reasonIncluded: visibility.included ? visibility.reasonIncluded : null,
      reasonExcluded: visibility.reasonExcluded,
      reason: visibility.reasonExcluded,
    }
  })
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
      getStringValue(league.country),
    round:
      getStringValue(normalized.round) ??
      getStringValue(league.round),
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

async function fetchCacheRows(dateArgentina: string) {
  const supabase = getSupabaseAdminClient()
  const cacheDates = [addDaysToISO(dateArgentina, -1), dateArgentina, addDaysToISO(dateArgentina, 1)]
  const { data, error } = await supabase
    .from('football_fixture_cache')
    .select('date, league_external_id, fixture_external_id, normalized_payload, payload')
    .in('date', cacheDates)
    .order('date', { ascending: true })
    .order('fixture_external_id', { ascending: true })

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

  return ((data ?? []) as CacheAuditRow[]).map((row): LayerRow => {
    const fixture = readCacheFixture(row)
    const dateInfo = serializeDate(fixture.date)
    const visibility = getVisibility({
      leagueId: toFiniteNumber(fixture.leagueExternalId),
      league: fixture.league,
      country: fixture.country,
      home: fixture.home,
      away: fixture.away,
      round: fixture.round,
    })
    const dateMismatch = dateInfo.argentina_date_iso !== dateArgentina

    return {
      external_id: toKey(fixture.externalId),
      liga: fixture.league,
      leagueExternalId: fixture.leagueExternalId,
      local: fixture.home,
      visitante: fixture.away,
      ...dateInfo,
      status: fixture.status,
      source: 'cache',
      cacheDate: row.date,
      includedInHome: false,
      reasonIncluded: !dateMismatch && visibility.included ? visibility.reasonIncluded : null,
      reasonExcluded: dateMismatch ? 'dateMismatch' : visibility.reasonExcluded,
      reason: dateMismatch
        ? `cache.date ${row.date}; fecha Argentina real ${dateInfo.argentina_date_iso ?? 'sin fecha'}`
        : visibility.reasonExcluded,
    }
  })
}

function serializeHomeMatch(match: MatchListItem, source: string): LayerRow {
  return {
    external_id: toKey(match.externalId ?? match.id),
    liga: match.league,
    leagueExternalId: match.leagueId ?? null,
    local: match.home,
    visitante: match.away,
    ...serializeDate(match.date),
    status: match.statusShort,
    source: 'home',
    includedInHome: true,
    reasonIncluded: source,
    reasonExcluded: null,
    reason: 'renderizado por Home',
  }
}

function getValidCandidateRows(rows: LayerRow[], dateArgentina: string) {
  return rows.filter((row) =>
    row.argentina_date_iso === dateArgentina &&
    Boolean(row.reasonIncluded) &&
    Boolean(row.external_id)
  )
}

function missingRows(candidates: LayerRow[], targetIds: Set<string>, reason: string) {
  return sortRows(
    candidates
      .filter((row) => row.external_id && !targetIds.has(row.external_id))
      .map((row) => ({
        ...row,
        includedInHome: false,
        reasonExcluded: reason,
        reason,
      }))
  )
}

function countByReason(rows: LayerRow[]) {
  return rows.reduce<Record<string, number>>((accumulator, row) => {
    const reason = row.reasonExcluded ?? row.reason ?? 'unknown'
    accumulator[reason] = (accumulator[reason] ?? 0) + 1

    return accumulator
  }, {})
}

function groupByCompetition(rows: LayerRow[]) {
  return Object.values(
    rows.reduce<Record<string, { liga: string; leagueExternalId: string | number | null; count: number }>>(
      (accumulator, row) => {
        const key = `${row.leagueExternalId ?? 'unknown'}:${row.liga}`
        const current = accumulator[key] ?? {
          liga: row.liga,
          leagueExternalId: row.leagueExternalId,
          count: 0,
        }

        current.count += 1
        accumulator[key] = current

        return accumulator
      },
      {}
    )
  ).sort((a, b) => b.count - a.count || a.liga.localeCompare(b.liga, 'es-AR'))
}

function wantsApi(searchParams: URLSearchParams) {
  return ['1', 'true', 'yes', 'si', 'sí'].includes(
    (searchParams.get('includeApi') ?? '').toLowerCase()
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const dateArgentina = searchParams.get('date') || getArgentinaTodayISO()
    const includeApi = wantsApi(searchParams)
    const { startUtc, endUtc } = getArgentinaDayUtcRange(dateArgentina)
    const [apiResult, supabaseRows, cacheRows, homeSnapshot] = await Promise.all([
      includeApi
        ? fetchApiFixturesForAudit(dateArgentina)
        : Promise.resolve({
            rows: [] as LayerRow[],
            errors: [] as Array<{ apiDate: string; message: string }>,
            apiDates: [] as string[],
          }),
      fetchSupabaseRows(dateArgentina),
      fetchCacheRows(dateArgentina),
      getHomeMatchesSourceSnapshot(dateArgentina),
    ])
    const storedIds = new Set(homeSnapshot.storedMatches.map((match) => String(match.externalId ?? match.id)))
    const cacheIds = new Set(homeSnapshot.cacheMatches.map((match) => String(match.externalId ?? match.id)))
    const homeIds = new Set(homeSnapshot.mergedMatches.map((match) => String(match.externalId ?? match.id)))
    const cacheMatchesForSelectedDate = cacheRows.filter((row) =>
      row.cacheDate === dateArgentina || row.argentina_date_iso === dateArgentina
    )
    const cacheWindowOutsideSelectedDate = cacheRows.filter((row) =>
      row.cacheDate !== dateArgentina && row.argentina_date_iso !== dateArgentina
    )
    const apiRowsForArgentinaDate = apiResult.rows.filter(
      (row) => row.argentina_date_iso === dateArgentina
    )
    const apiVisibleCandidates = getValidCandidateRows(apiRowsForArgentinaDate, dateArgentina)
    const supabaseVisibleCandidates = getValidCandidateRows(supabaseRows, dateArgentina)
    const cacheVisibleCandidates = getValidCandidateRows(cacheRows, dateArgentina)
    const homeRender = sortRows([
      ...homeSnapshot.mergedMatches.map((match) => {
        const key = String(match.externalId ?? match.id)
        const source =
          storedIds.has(key) && cacheIds.has(key)
            ? 'supabase+cache'
            : storedIds.has(key)
              ? 'supabase'
              : cacheIds.has(key)
                ? 'cache'
                : 'unknown'

        return serializeHomeMatch(match, source)
      }),
    ])
    const homeCandidateRows = homeRender
    const missingInSupabase = includeApi
      ? missingRows(apiVisibleCandidates, storedIds, 'missingInSupabase')
      : []
    const missingInCache = includeApi
      ? missingRows(apiVisibleCandidates, cacheIds, 'missingInCache')
      : []
    const supabaseButNotRendered = missingRows(
      supabaseVisibleCandidates,
      homeIds,
      'supabaseButNotRendered'
    )
    const cacheButNotRendered = missingRows(
      cacheVisibleCandidates,
      homeIds,
      'cacheButNotRendered'
    )
    const missingInHome = sortRows([
      ...(includeApi ? missingRows(apiVisibleCandidates, homeIds, 'missingInHomeFromApi') : []),
      ...supabaseButNotRendered,
      ...cacheButNotRendered,
    ])
    const excludedByFilters = sortRows(
      [...apiRowsForArgentinaDate, ...supabaseRows, ...cacheRows].filter((row) =>
        row.argentina_date_iso === dateArgentina &&
        Boolean(row.reasonExcluded) &&
        row.reasonExcluded !== 'dateMismatch'
      )
    )
    const timezoneMismatches = sortRows(
      [...apiResult.rows, ...cacheRows].filter((row) =>
        (row.source === 'api-football' &&
          row.argentina_date_iso === dateArgentina &&
          row.apiRequestedDate !== dateArgentina) ||
        (row.source === 'cache' &&
          row.argentina_date_iso === dateArgentina &&
          row.cacheDate !== dateArgentina)
      )
    )
    const duplicateMatches = [
      ...findDuplicateRows(apiRowsForArgentinaDate, 'api-football'),
      ...findDuplicateRows(supabaseRows, 'supabase'),
      ...findDuplicateRows(cacheMatchesForSelectedDate, 'cache'),
      ...findDuplicateRows(homeRender, 'home'),
    ]
    const apiFootballError = apiResult.errors.length
      ? apiResult.errors.map((error) => `${error.apiDate}: ${error.message}`).join(' | ')
      : null

    if (process.env.NODE_ENV === 'development') {
      console.info('[home-date-debug]', {
        selectedDate: dateArgentina,
        startUtc,
        endUtc,
        supabaseCount: supabaseRows.length,
        cacheCount: cacheMatchesForSelectedDate.length,
        visibleCount: homeRender.length,
      })

      for (const row of missingInHome.slice(0, 20)) {
        console.info('[home-missing-match]', {
          externalId: row.external_id,
          league: row.liga,
          home: row.local,
          away: row.visitante,
          reason: row.reason,
        })
      }
    }

    return jsonNoStore({
      ok: true,
      selectedDateArgentina: dateArgentina,
      dateArgentina,
      timezone: ARGENTINA_TIME_ZONE,
      startUtc,
      endUtc,
      apiFootballSkipped: !includeApi,
      apiFootballError,
      apiRequestedDates: apiResult.apiDates,
      apiErrors: apiResult.errors,
      apiFootballCount: apiRowsForArgentinaDate.length,
      apiFootballVisibleCandidateCount: apiVisibleCandidates.length,
      supabaseCount: supabaseRows.length,
      cacheCount: cacheMatchesForSelectedDate.length,
      cacheWindowCount: cacheRows.length,
      homeCandidateCount: homeCandidateRows.length,
      homeVisibleCount: homeRender.length,
      missingInSupabase,
      missingInCache,
      missingInHome,
      cacheButNotRendered,
      supabaseButNotRendered,
      excludedByFilters,
      excludedReasons: countByReason(excludedByFilters),
      timezoneMismatches,
      duplicateMatches,
      competitions: {
        apiFootball: groupByCompetition(apiVisibleCandidates),
        homeCandidates: groupByCompetition(homeCandidateRows),
        homeVisible: groupByCompetition(homeRender),
        missingInHome: groupByCompetition(missingInHome),
      },
      cacheWindowOutsideSelectedDate: sortRows(cacheWindowOutsideSelectedDate),
      layers: {
        apiFootball: sortRows(apiRowsForArgentinaDate),
        supabaseMatches: sortRows(supabaseRows),
        cacheMatches: sortRows(cacheMatchesForSelectedDate),
        cacheWindowMatches: sortRows(cacheRows),
        homeCandidates: homeCandidateRows,
        fixtureCache: sortRows(cacheMatchesForSelectedDate),
        homeRender,
      },
      supabaseMatches: sortRows(supabaseRows),
      cacheMatches: sortRows(cacheMatchesForSelectedDate),
      cacheWindowMatches: sortRows(cacheRows),
      homeCandidateMatches: homeCandidateRows,
      homeVisibleMatches: homeRender,
      sample: {
        missingInHome: missingInHome[0] ?? null,
        missingInSupabase: missingInSupabase[0] ?? null,
        missingInCache: missingInCache[0] ?? null,
        cacheButNotRendered: cacheButNotRendered[0] ?? null,
        supabaseButNotRendered: supabaseButNotRendered[0] ?? null,
        timezoneMismatch: timezoneMismatches[0] ?? null,
        excludedByFilters: excludedByFilters[0] ?? null,
      },
    })
  } catch (error) {
    console.error('[home-full-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar Home punta a punta.',
      },
      { status: 500 }
    )
  }
}
