import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getHomeMatchesSourceSnapshot } from '@/lib/api-football'
import { getFootballApiConfig } from '@/server/config/env'
import {
  addDaysToISO,
  formatMatchDateLabelArgentina,
  formatMatchDateTimeArgentina,
  getArgentinaDateISO,
  getArgentinaDayUtcRange,
  getArgentinaTodayISO,
  toArgentinaDate,
} from '@/shared/utils/argentina-time'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'

type ApiAuditFixture = {
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

type DateAuditReason =
  | 'included'
  | 'apiSupplemented'
  | 'supabaseOnly'
  | 'excludedCompetition'
  | 'dateMismatch'
  | 'unsupportedLeague'
  | 'noTeams'
  | 'missingLeagueConfig'
  | 'notInHome'

type DateAuditRow = {
  external_id: number | string | null
  liga: string
  local: string
  visitante: string
  source: 'supabase' | 'api' | 'home'
  match_date_original: string | null
  match_date_utc: string | null
  match_date_argentina: string | null
  argentinaDateISO: string | null
  diaMostrado: string | null
  status: string | null
  includedInHome: boolean
  reason: DateAuditReason
  detail: string | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return false
  return request.headers.get('x-cron-secret') === cronSecret
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

function toFiniteNumber(value: string | number | null | undefined) {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

function getExternalIdKey(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null

  return String(value)
}

function serializeDate(value: string | null | undefined) {
  if (!value) {
    return {
      match_date_utc: null,
      match_date_argentina: null,
      argentinaDateISO: null,
      diaMostrado: null,
    }
  }

  return {
    match_date_utc: toArgentinaDate(value).toISOString(),
    match_date_argentina: formatMatchDateTimeArgentina(value),
    argentinaDateISO: getArgentinaDateISO(value),
    diaMostrado: formatMatchDateLabelArgentina(value),
  }
}

async function fetchSupabaseMatchesForDate(date: string, leagueExternalId: string | null) {
  const supabase = getSupabaseAdminClient()
  const { startUtc, endUtc } = getArgentinaDayUtcRange(date)
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, external_id, match_date, status, home_score, away_score, leagues(name, external_id, country), home_team:teams!matches_home_team_id_fkey(name, external_id), away_team:teams!matches_away_team_id_fkey(name, external_id)'
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

async function fetchApiFixturesForDate(date: string) {
  const { apiKey, baseUrl } = getFootballApiConfig()
  const url = new URL(`${baseUrl}/fixtures`)

  url.searchParams.set('date', date)
  url.searchParams.set('timezone', 'America/Argentina/Buenos_Aires')

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'x-apisports-key': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`API-Football respondio ${response.status} para ${date}.`)
  }

  const payload = (await response.json()) as { response?: ApiAuditFixture[] }

  return payload.response ?? []
}

function getApiFixtureVisibility(fixture: ApiAuditFixture, selectedDate: string) {
  const home = fixture.teams?.home?.name ?? null
  const away = fixture.teams?.away?.name ?? null
  const fixtureDate = fixture.fixture?.date ?? null

  if (!home || !away) {
    return {
      included: false,
      reason: 'noTeams' as const,
      detail: 'fixture sin nombres de equipos',
    }
  }

  if (!fixtureDate || getArgentinaDateISO(fixtureDate) !== selectedDate) {
    return {
      included: false,
      reason: 'dateMismatch' as const,
      detail: 'fixture no pertenece al dia argentino seleccionado',
    }
  }

  const visibility = getHomeMatchVisibility({
    leagueId: fixture.league?.id ?? null,
    league: fixture.league?.name ?? '',
    country: fixture.league?.country ?? '',
    home,
    away,
    round: fixture.league?.round ?? null,
  })

  if (!visibility.included) {
    return {
      included: false,
      reason:
        visibility.reason === 'excludedCompetition'
          ? ('excludedCompetition' as const)
          : ('unsupportedLeague' as const),
      detail: visibility.excludedReason ? String(visibility.excludedReason) : visibility.reason,
    }
  }

  return {
    included: true,
    reason: 'included' as const,
    detail: visibility.reason,
  }
}

function serializeApiFixture(
  fixture: ApiAuditFixture,
  selectedDate: string,
  homeVisibleIds: Set<string>,
  reasonOverride?: DateAuditReason,
  detailOverride?: string | null
): DateAuditRow {
  const fixtureId = fixture.fixture?.id ?? null
  const dateInfo = serializeDate(fixture.fixture?.date)
  const visibility = getApiFixtureVisibility(fixture, selectedDate)
  const key = getExternalIdKey(fixtureId)
  const includedInHome = key ? homeVisibleIds.has(key) : false

  return {
    external_id: fixtureId,
    liga: fixture.league?.name ?? 'Sin liga',
    local: fixture.teams?.home?.name ?? 'Sin local',
    visitante: fixture.teams?.away?.name ?? 'Sin visitante',
    source: 'api',
    match_date_original: fixture.fixture?.date ?? null,
    ...dateInfo,
    status: fixture.fixture?.status?.short ?? null,
    includedInHome,
    reason: reasonOverride ?? (visibility.included ? 'included' : visibility.reason),
    detail: detailOverride ?? visibility.detail,
  }
}

function serializeSupabaseMatch(
  match: SupabaseAuditMatch,
  selectedDate: string,
  homeVisibleIds: Set<string>,
  apiFixtureByExternalId: Map<string, ApiAuditFixture>
): DateAuditRow {
  const externalId = getExternalIdKey(match.external_id)
  const apiFixture = externalId ? apiFixtureByExternalId.get(externalId) ?? null : null
  const dateInfo = serializeDate(match.match_date)
  const home = match.home_team?.name ?? 'Sin local'
  const away = match.away_team?.name ?? 'Sin visitante'
  const visibility = getHomeMatchVisibility({
    leagueId: toFiniteNumber(match.leagues?.external_id),
    league: match.leagues?.name ?? '',
    country: match.leagues?.country ?? '',
    home,
    away,
  })
  const includedInHome = externalId ? homeVisibleIds.has(externalId) : false
  let reason: DateAuditReason = includedInHome ? 'included' : 'notInHome'
  let detail: string | null = includedInHome ? 'visible en Home' : 'no visible en Home'

  if (!visibility.included) {
    reason = visibility.reason === 'excludedCompetition' ? 'excludedCompetition' : 'unsupportedLeague'
    detail = visibility.excludedReason ? String(visibility.excludedReason) : visibility.reason
  } else if (dateInfo.argentinaDateISO !== selectedDate) {
    reason = 'dateMismatch'
    detail = 'Supabase no pertenece al dia argentino seleccionado'
  } else if (apiFixture) {
    const apiDate = apiFixture.fixture?.date
      ? getArgentinaDateISO(apiFixture.fixture.date)
      : null

    if (apiDate !== selectedDate) {
      reason = 'dateMismatch'
      detail = apiDate
        ? `API-Football ubica este fixture en ${apiDate}`
        : 'API-Football no informa fecha para este fixture'
    }
  } else if (!includedInHome) {
    reason = 'supabaseOnly'
    detail = 'solo existe en Supabase para este dia; no vino en API-Football'
  }

  return {
    external_id: match.external_id,
    liga: match.leagues?.name ?? 'Sin liga',
    local: home,
    visitante: away,
    source: 'supabase',
    match_date_original: match.match_date,
    ...dateInfo,
    status: match.status,
    includedInHome,
    reason,
    detail,
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
    const [supabaseMatches, homeSnapshot] = await Promise.all([
      fetchSupabaseMatchesForDate(selectedDate, leagueExternalId),
      getHomeMatchesSourceSnapshot(selectedDate),
    ])
    const auditDates = [addDaysToISO(selectedDate, -1), selectedDate, addDaysToISO(selectedDate, 1)]
    const apiFixtures = (await Promise.all(auditDates.map(fetchApiFixturesForDate))).flat()
    const apiFixtureByExternalId = new Map(
      apiFixtures
        .filter((fixture) => fixture.fixture?.id)
        .map((fixture) => [String(fixture.fixture?.id), fixture] as const)
    )
    const homeVisibleIds = new Set(homeSnapshot.mergedMatches.map((match) => String(match.externalId ?? match.id)))
    const filteredApiFixtures = apiFixtures.filter((fixture) => {
      if (!leagueExternalId) return true

      return String(fixture.league?.id ?? '') === leagueExternalId
    })
    const apiRows = filteredApiFixtures
      .map((fixture) => serializeApiFixture(fixture, selectedDate, homeVisibleIds))
      .filter((row) => row.argentinaDateISO === selectedDate || row.reason !== 'included')
    const supabaseRows = supabaseMatches.map((match) =>
      serializeSupabaseMatch(match, selectedDate, homeVisibleIds, apiFixtureByExternalId)
    )

    return jsonNoStore({
      ok: true,
      selectedDateArgentina: selectedDate,
      startUtc,
      endUtc,
      leagueExternalId: leagueExternalId ?? null,
      home: {
        visibleCount: homeSnapshot.mergedMatches.length,
        supabaseCount: homeSnapshot.storedMatches.length,
        apiCount: homeSnapshot.apiMatches.length,
        apiAuthoritative: homeSnapshot.apiAuthoritative,
        apiError: homeSnapshot.apiError,
      },
      counts: {
        supabaseRows: supabaseRows.length,
        apiRows: apiRows.length,
        includedInHome: [...new Set([...supabaseRows, ...apiRows].filter((row) => row.includedInHome).map((row) => row.external_id))].length,
        excludedOrMismatch: [...supabaseRows, ...apiRows].filter((row) => row.reason !== 'included').length,
      },
      partidosEncontrados: sortAuditRows([...supabaseRows, ...apiRows]),
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
