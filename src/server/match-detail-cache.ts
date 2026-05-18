import type { SupabaseClient } from '@supabase/supabase-js'

import { requestFootballApi } from '@/server/integrations/football-api-client'
import { getArgentinaDateISO } from '@/shared/utils/argentina-time'

type DbId = string | number

type ApiFixtureDetail = {
  fixture?: {
    id?: number
    date?: string
  }
  league?: {
    id?: number
    season?: number
  }
}

type ApiFixtureEvent = {
  id?: number | string | null
  time?: {
    elapsed?: number | null
    extra?: number | null
  } | null
  team?: {
    id?: number | null
    name?: string | null
  } | null
  player?: {
    id?: number | null
    name?: string | null
  } | null
  assist?: {
    id?: number | null
    name?: string | null
  } | null
  type?: string | null
  detail?: string | null
  comments?: string | null
}

type StoredMatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
}

type StoredTeamRow = {
  id: DbId
  external_id: DbId | null
}

type StoredLeagueRow = {
  id: DbId
  external_id: DbId | null
  season: number | null
}

type DetailCacheRow = {
  events: unknown
  lineups: unknown
  statistics: unknown
}

type FixtureCacheDetailRow = {
  date: string | null
  league_external_id: string | null
  fixture_external_id: string
  payload: unknown
  normalized_payload: unknown
}

export type SyncMatchDetailResult = {
  fixtureExternalId: number
  matchId: DbId | null
  before: MatchDetailAuditSnapshot
  after: MatchDetailAuditSnapshot
  fetched: {
    fixture: boolean
    events: number
    lineups: number
    statistics: number
  }
  cacheUpserted: boolean
  matchEventsUpserted: number
  warnings: string[]
  errors: string[]
}

export type MatchDetailAuditSnapshot = {
  hasEvents: boolean
  eventsCount: number
  hasLineups: boolean
  lineupsHomeCount: number
  lineupsAwayCount: number
  substitutesHomeCount: number
  substitutesAwayCount: number
  hasStatistics: boolean
  statisticsCount: number
  hasCaptainData: boolean
  missingSections: string[]
  warnings: string[]
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isMissingOptionalTable(error: { code?: string; message?: string } | null | undefined, table: string) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes(table) ||
    message.includes('schema cache')
  )
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function hasDetailItems(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

function mergeDetailCacheRows(
  primary: DetailCacheRow | null,
  fallback: DetailCacheRow | null
): DetailCacheRow | null {
  if (!primary) return fallback
  if (!fallback) return primary

  return {
    events: hasDetailItems(primary.events) ? primary.events : fallback.events,
    lineups: hasDetailItems(primary.lineups) ? primary.lineups : fallback.lineups,
    statistics: hasDetailItems(primary.statistics) ? primary.statistics : fallback.statistics,
  }
}

async function fetchApiArray<T>(
  path: string,
  params: Record<string, string | number>,
  logContext: string
) {
  const { payload } = await requestFootballApi<T[]>(path, params, { logContext })
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) throw new Error(apiErrors.join(' | '))

  return payload.response ?? []
}

async function fetchFixtureDetail(fixtureExternalId: number) {
  const fixtures = await fetchApiArray<ApiFixtureDetail>(
    '/fixtures',
    {
      id: fixtureExternalId,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    `sync-match-detail:${fixtureExternalId}:fixture`
  )

  return fixtures[0] ?? null
}

async function fetchStoredMatchByFixture(supabase: SupabaseClient, fixtureExternalId: number) {
  const candidates = [fixtureExternalId, String(fixtureExternalId)]

  for (const candidate of candidates) {
    const response = await supabase
      .from('matches')
      .select('id, external_id, league_id, home_team_id, away_team_id')
      .eq('external_id', candidate)
      .maybeSingle()

    if (response.error) throw response.error
    if (response.data) return response.data as StoredMatchRow
  }

  return null
}

async function fetchStoredMatchById(supabase: SupabaseClient, matchId: string) {
  const response = await supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id')
    .eq('id', matchId)
    .maybeSingle()

  if (response.error) throw response.error

  return (response.data as StoredMatchRow | null) ?? null
}

async function resolveStoredMatch(
  supabase: SupabaseClient,
  input: { fixtureExternalId?: number | null; matchId?: string | null }
) {
  if (input.fixtureExternalId) {
    return fetchStoredMatchByFixture(supabase, input.fixtureExternalId)
  }

  const numericMatchId = toNumber(input.matchId)

  if (numericMatchId) {
    const byExternalId = await fetchStoredMatchByFixture(supabase, numericMatchId)
    if (byExternalId) return byExternalId
  }

  if (input.matchId) {
    return fetchStoredMatchById(supabase, input.matchId)
  }

  return null
}

async function fetchStoredTeamsByIds(
  supabase: SupabaseClient,
  teamIds: Array<DbId | null | undefined>
) {
  const ids = [...new Set(teamIds.filter((id): id is DbId => id !== null && id !== undefined).map(String))]

  if (!ids.length) return new Map<string, StoredTeamRow>()

  const response = await supabase
    .from('teams')
    .select('id, external_id')
    .in('id', ids)

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as StoredTeamRow[]).map((team) => [String(team.id), team])
  )
}

async function fetchStoredLeagueById(
  supabase: SupabaseClient,
  leagueId: DbId | null | undefined
) {
  if (leagueId === null || leagueId === undefined) return null

  const response = await supabase
    .from('leagues')
    .select('id, external_id, season')
    .eq('id', String(leagueId))
    .maybeSingle()

  if (response.error) throw response.error

  return (response.data as StoredLeagueRow | null) ?? null
}

function getEventExternalId(fixtureExternalId: number, event: ApiFixtureEvent, index: number) {
  if (event.id !== undefined && event.id !== null) return String(event.id)

  return [
    fixtureExternalId,
    event.time?.elapsed ?? 'minute',
    event.time?.extra ?? 'no-extra',
    event.team?.id ?? 'team',
    event.player?.name ?? 'player',
    event.assist?.name ?? 'assist',
    event.type ?? 'type',
    event.detail ?? 'detail',
    index,
  ].join(':')
}

async function upsertStoredMatchEvents(
  supabase: SupabaseClient,
  input: {
    fixtureExternalId: number
    match: StoredMatchRow
    events: ApiFixtureEvent[]
    teamsById: Map<string, StoredTeamRow>
  }
) {
  const homeTeam = input.match.home_team_id !== null && input.match.home_team_id !== undefined
    ? input.teamsById.get(String(input.match.home_team_id))
    : null
  const awayTeam = input.match.away_team_id !== null && input.match.away_team_id !== undefined
    ? input.teamsById.get(String(input.match.away_team_id))
    : null
  const homeExternalId = toNumber(homeTeam?.external_id)
  const awayExternalId = toNumber(awayTeam?.external_id)

  const deleteResponse = await supabase
    .from('match_events')
    .delete()
    .eq('match_id', String(input.match.id))

  if (deleteResponse.error) {
    if (isMissingOptionalTable(deleteResponse.error, 'match_events')) return 0
    throw deleteResponse.error
  }

  const rows = input.events
    .filter((event) => event.time?.elapsed !== null && event.time?.elapsed !== undefined)
    .map((event, index) => {
      const apiTeamId = toNumber(event.team?.id)
      const teamId =
        apiTeamId !== null && homeExternalId !== null && apiTeamId === homeExternalId
          ? input.match.home_team_id
          : apiTeamId !== null && awayExternalId !== null && apiTeamId === awayExternalId
            ? input.match.away_team_id
            : null

      return {
        match_id: input.match.id,
        external_event_id: getEventExternalId(input.fixtureExternalId, event, index),
        team_id: teamId,
        player_name:
          event.player?.name?.trim() ||
          event.team?.name?.trim() ||
          event.detail ||
          event.type ||
          'Evento',
        assist_name: event.assist?.name ?? null,
        minute: event.time?.elapsed ?? 0,
        extra_minute: event.time?.extra ?? null,
        type: event.type ?? 'Event',
        detail: event.detail ?? null,
      }
    })

  if (!rows.length) return 0

  const response = await supabase
    .from('match_events')
    .upsert(rows, { onConflict: 'match_id,external_event_id' })

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'match_events')) return 0
    throw response.error
  }

  return rows.length
}

async function readDetailCacheByFixture(
  supabase: SupabaseClient,
  fixtureExternalId: number
) {
  const response = await supabase
    .from('football_match_detail_cache')
    .select('events, lineups, statistics')
    .eq('fixture_external_id', String(fixtureExternalId))
    .maybeSingle()

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'football_match_detail_cache')) {
      return readFixtureCacheDetailByFixture(supabase, fixtureExternalId)
    }
    throw response.error
  }

  const primary = (response.data as DetailCacheRow | null) ?? null
  const fallback = await readFixtureCacheDetailByFixture(supabase, fixtureExternalId)

  return mergeDetailCacheRows(primary, fallback)
}

function extractMatchDetailFromFixtureCache(row: FixtureCacheDetailRow | null) {
  const normalizedPayload = asRecord(row?.normalized_payload)
  const detail = asRecord(normalizedPayload?.matchDetail)

  if (!detail) return null

  return {
    events: detail.events,
    lineups: detail.lineups,
    statistics: detail.statistics,
  } satisfies DetailCacheRow
}

async function readFixtureCacheDetailByFixture(
  supabase: SupabaseClient,
  fixtureExternalId: number
) {
  const response = await supabase
    .from('football_fixture_cache')
    .select('date, league_external_id, fixture_external_id, payload, normalized_payload')
    .eq('fixture_external_id', String(fixtureExternalId))
    .limit(1)
    .maybeSingle()

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'football_fixture_cache')) return null
    throw response.error
  }

  return extractMatchDetailFromFixtureCache((response.data as FixtureCacheDetailRow | null) ?? null)
}

function buildMatchDetailPayload(input: {
  fixturePayload: ApiFixtureDetail | null
  events: unknown[]
  lineups: unknown[]
  statistics: unknown[]
}) {
  return {
    fixture: input.fixturePayload,
    events: input.events,
    lineups: input.lineups,
    statistics: input.statistics,
    syncedAt: new Date().toISOString(),
  }
}

async function upsertFixtureCacheDetailFallback(
  supabase: SupabaseClient,
  input: {
    fixtureExternalId: number
    fixturePayload: ApiFixtureDetail | null
    events: unknown[]
    lineups: unknown[]
    statistics: unknown[]
  }
) {
  const existing = await supabase
    .from('football_fixture_cache')
    .select('date, league_external_id, fixture_external_id, payload, normalized_payload')
    .eq('fixture_external_id', String(input.fixtureExternalId))
    .limit(1)
    .maybeSingle()

  if (existing.error && !isMissingOptionalTable(existing.error, 'football_fixture_cache')) {
    throw existing.error
  }

  if (existing.error) return false

  const existingRow = (existing.data as FixtureCacheDetailRow | null) ?? null
  const normalizedPayload = {
    ...(asRecord(existingRow?.normalized_payload) ?? {}),
    matchDetail: buildMatchDetailPayload(input),
  }
  const fixtureDate = input.fixturePayload?.fixture?.date ?? null
  const cacheDate = existingRow?.date ?? (fixtureDate ? getArgentinaDateISO(fixtureDate) : null)

  if (!cacheDate) return false

  const response = await supabase
    .from('football_fixture_cache')
    .upsert(
      {
        date: cacheDate,
        league_external_id:
          existingRow?.league_external_id ??
          (input.fixturePayload?.league?.id ? String(input.fixturePayload.league.id) : null),
        fixture_external_id: String(input.fixtureExternalId),
        payload: existingRow?.payload ?? input.fixturePayload ?? {},
        normalized_payload: normalizedPayload,
      },
      { onConflict: 'date,fixture_external_id' }
    )

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'football_fixture_cache')) return false
    throw response.error
  }

  return true
}

function countLineupPlayers(lineup: unknown, key: 'startXI' | 'substitutes') {
  if (!lineup || typeof lineup !== 'object') return 0
  const players = (lineup as Record<string, unknown>)[key]

  return Array.isArray(players) ? players.length : 0
}

function hasCaptain(lineup: unknown) {
  if (!lineup || typeof lineup !== 'object') return false
  const values = [
    ...(asArray((lineup as Record<string, unknown>).startXI)),
    ...(asArray((lineup as Record<string, unknown>).substitutes)),
  ]

  return values.some((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const player = (entry as Record<string, unknown>).player
    const captain =
      (entry as Record<string, unknown>).captain ??
      (player && typeof player === 'object' ? (player as Record<string, unknown>).captain : null)

    return captain === true || captain === 'true'
  })
}

function buildAuditSnapshot(cache: DetailCacheRow | null): MatchDetailAuditSnapshot {
  const events = asArray(cache?.events)
  const lineups = asArray(cache?.lineups)
  const statistics = asArray(cache?.statistics)
  const homeLineup = lineups[0]
  const awayLineup = lineups[1]
  const missingSections: string[] = []

  if (!events.length) missingSections.push('events')
  if (!lineups.length) missingSections.push('lineups')
  if (!statistics.length) missingSections.push('statistics')

  return {
    hasEvents: events.length > 0,
    eventsCount: events.length,
    hasLineups: lineups.length > 0,
    lineupsHomeCount: countLineupPlayers(homeLineup, 'startXI'),
    lineupsAwayCount: countLineupPlayers(awayLineup, 'startXI'),
    substitutesHomeCount: countLineupPlayers(homeLineup, 'substitutes'),
    substitutesAwayCount: countLineupPlayers(awayLineup, 'substitutes'),
    hasStatistics: statistics.length > 0,
    statisticsCount: statistics.reduce((sum, entry) => {
      if (!entry || typeof entry !== 'object') return sum
      const values = (entry as Record<string, unknown>).statistics
      return sum + (Array.isArray(values) ? values.length : 0)
    }, 0),
    hasCaptainData: lineups.some(hasCaptain),
    missingSections,
    warnings: missingSections.length
      ? [`Faltan secciones de detalle: ${missingSections.join(', ')}.`]
      : [],
  }
}

async function countStoredMatchEvents(
  supabase: SupabaseClient,
  matchId: DbId | null | undefined
) {
  if (matchId === null || matchId === undefined) return 0

  const response = await supabase
    .from('match_events')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', String(matchId))

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'match_events')) return 0
    throw response.error
  }

  return response.count ?? 0
}

function mergeStoredEventsIntoAudit(
  snapshot: MatchDetailAuditSnapshot,
  storedEventsCount: number
): MatchDetailAuditSnapshot {
  if (storedEventsCount <= snapshot.eventsCount) return snapshot

  const missingSections = snapshot.missingSections.filter(
    (section) => section !== 'events'
  )

  return {
    ...snapshot,
    hasEvents: true,
    eventsCount: storedEventsCount,
    missingSections,
    warnings: missingSections.length
      ? [`Faltan secciones de detalle: ${missingSections.join(', ')}.`]
      : [],
  }
}

export async function auditMatchDetailCache(
  supabase: SupabaseClient,
  input: { fixtureExternalId?: number | null; matchId?: string | null }
) {
  const match = await resolveStoredMatch(supabase, input)
  const fixtureExternalId =
    input.fixtureExternalId ??
    toNumber(match?.external_id) ??
    toNumber(input.matchId)

  if (!fixtureExternalId) {
    return {
      fixtureExternalId: null,
      matchId: match?.id ?? null,
      ...buildAuditSnapshot(null),
      warnings: ['No se pudo resolver fixture externo para auditar detalle.'],
    }
  }

  const cache = await readDetailCacheByFixture(supabase, fixtureExternalId)
  const storedEventsCount = await countStoredMatchEvents(supabase, match?.id)

  return {
    fixtureExternalId,
    matchId: match?.id ?? null,
    ...mergeStoredEventsIntoAudit(buildAuditSnapshot(cache), storedEventsCount),
  }
}

export async function syncMatchDetail(
  supabase: SupabaseClient,
  input: { fixtureExternalId?: number | null; matchId?: string | null }
): Promise<SyncMatchDetailResult> {
  const warnings: string[] = []
  const errors: string[] = []
  const match = await resolveStoredMatch(supabase, input)
  const fixtureExternalId =
    input.fixtureExternalId ??
    toNumber(match?.external_id) ??
    toNumber(input.matchId)

  if (!fixtureExternalId) {
    throw new Error('Debe indicar fixture o un matchId que tenga external_id.')
  }

  const before = buildAuditSnapshot(await readDetailCacheByFixture(supabase, fixtureExternalId))
  const [fixturePayload, events, lineups, statistics] = await Promise.all([
    fetchFixtureDetail(fixtureExternalId),
    fetchApiArray<ApiFixtureEvent>(
      '/fixtures/events',
      { fixture: fixtureExternalId },
      `sync-match-detail:${fixtureExternalId}:events`
    ),
    fetchApiArray<unknown>(
      '/fixtures/lineups',
      { fixture: fixtureExternalId },
      `sync-match-detail:${fixtureExternalId}:lineups`
    ),
    fetchApiArray<unknown>(
      '/fixtures/statistics',
      { fixture: fixtureExternalId },
      `sync-match-detail:${fixtureExternalId}:statistics`
    ),
  ])

  const resolvedLeague = match
    ? await fetchStoredLeagueById(supabase, match.league_id)
    : null
  const leagueExternalId =
    toNumber(resolvedLeague?.external_id) ??
    toNumber(fixturePayload?.league?.id)
  const season =
    resolvedLeague?.season ??
    toNumber(fixturePayload?.league?.season)

  const cacheResponse = await supabase
    .from('football_match_detail_cache')
    .upsert(
      {
        fixture_external_id: String(fixtureExternalId),
        match_id: match?.id !== undefined && match?.id !== null ? String(match.id) : null,
        league_external_id: leagueExternalId !== null ? String(leagueExternalId) : null,
        season,
        fixture_payload: fixturePayload,
        events,
        lineups,
        statistics,
      },
      { onConflict: 'fixture_external_id' }
    )
  let cacheUpserted = !cacheResponse.error

  if (cacheResponse.error) {
    if (isMissingOptionalTable(cacheResponse.error, 'football_match_detail_cache')) {
      const fallbackCached = await upsertFixtureCacheDetailFallback(supabase, {
        fixtureExternalId,
        fixturePayload,
        events,
        lineups,
        statistics,
      })

      if (fallbackCached) {
        cacheUpserted = true
        warnings.push('football_match_detail_cache no existe; se uso football_fixture_cache como fallback.')
      } else {
        warnings.push('football_match_detail_cache no existe y no se pudo usar football_fixture_cache como fallback.')
      }
    } else {
      throw cacheResponse.error
    }
  }

  let matchEventsUpserted = 0

  if (match) {
    const teamsById = await fetchStoredTeamsByIds(supabase, [
      match.home_team_id,
      match.away_team_id,
    ])

    try {
      matchEventsUpserted = await upsertStoredMatchEvents(supabase, {
        fixtureExternalId,
        match,
        events,
        teamsById,
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  } else {
    warnings.push('El fixture existe en API-Football pero no esta sincronizado en matches.')
  }

  const after = buildAuditSnapshot(await readDetailCacheByFixture(supabase, fixtureExternalId))

  return {
    fixtureExternalId,
    matchId: match?.id ?? null,
    before,
    after,
    fetched: {
      fixture: Boolean(fixturePayload),
      events: events.length,
      lineups: lineups.length,
      statistics: statistics.length,
    },
    cacheUpserted,
    matchEventsUpserted,
    warnings,
    errors,
  }
}
