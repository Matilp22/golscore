import type { SupabaseClient } from '@supabase/supabase-js'

import { requestFootballApi } from '@/server/integrations/football-api-client'
import { getArgentinaDateISO } from '@/shared/utils/argentina-time'
import {
  formatMatchEventStableKey,
  normalizeFootballEventText,
  normalizeMatchEvent,
} from '@/shared/utils/football-events'

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

type StoredMatchAuditRow = StoredMatchRow & {
  match_date: string | null
  status: string | null
  home_score?: number | null
  away_score?: number | null
}

type StoredTeamRow = {
  id: DbId
  external_id: DbId | null
  name?: string | null
}

type StoredMatchEventRow = {
  id?: DbId | null
  external_event_id?: string | null
  match_id: DbId
  team_id: DbId | null
  player_name: string | null
  assist_name: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
  comments?: string | null
}

type StoredLeagueRow = {
  id: DbId
  external_id: DbId | null
  name?: string | null
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
  match: {
    id: DbId | null
    externalId: number
  }
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
  eventsByType: Record<string, number>
  hasGoals: boolean
  hasCards: boolean
  hasMissedPenalty: boolean
  missedPenaltyEvents: MatchDetailAuditEvent[]
  hasVarEvents: boolean
  varEvents: MatchDetailAuditEvent[]
  hasSubstitutions: boolean
  substitutionEvents: MatchDetailAuditEvent[]
  hasLineups: boolean
  homeStartersCount: number
  awayStartersCount: number
  lineupsHomeCount: number
  lineupsAwayCount: number
  substitutesHomeCount: number
  substitutesAwayCount: number
  homeSubstitutesCount: number
  awaySubstitutesCount: number
  hasStatistics: boolean
  statisticsCount: number
  statisticsNames: string[]
  hasCaptainData: boolean
  captains: MatchDetailAuditCaptain[]
  missingSections: string[]
  warnings: string[]
}

export type MatchDetailAuditEvent = {
  minute: number | null
  extraMinute: number | null
  teamName: string | null
  playerName: string | null
  assistName: string | null
  type: string | null
  detail: string | null
  comments: string | null
  label: string
}

export type MatchDetailAuditCaptain = {
  teamName: string | null
  playerId: number | null
  playerName: string | null
}

export type MatchDetailGeneralAuditItem = {
  fixtureExternalId: number | null
  matchId: DbId
  matchDate: string | null
  status: string | null
  league: {
    id: DbId | null
    externalId: number | null
    name: string | null
    season: number | null
  }
  teams: {
    home: string | null
    away: string | null
  }
  score: {
    home: number | null
    away: number | null
  }
  audit: MatchDetailAuditSnapshot
  completenessScore: number
  missingRequiredSections: string[]
  syncRecommended: boolean
  syncUrl: string | null
}

export type MatchDetailGeneralAuditResult = {
  checked: number
  limit: number
  filters: {
    leagueExternalId: number | null
    dateFrom: string | null
    dateTo: string | null
    statuses: string[]
    missingOnly: boolean
  }
  summary: {
    complete: number
    missingEvents: number
    missingLineups: number
    missingStatistics: number
    missingAnyRequired: number
    syncRecommended: number
  }
  examplesMissing: MatchDetailGeneralAuditItem[]
  items: MatchDetailGeneralAuditItem[]
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

  const primaryResponse = await supabase
    .from('teams')
    .select('id, external_id, name')
    .in('id', ids)
  let response: {
    data: unknown
    error: { code?: string; message: string } | null
  } = primaryResponse

  if (
    primaryResponse.error &&
    (
      primaryResponse.error.code === '42703' ||
      primaryResponse.error.code === 'PGRST204' ||
      primaryResponse.error.message.toLowerCase().includes('schema cache')
    )
  ) {
    response = await supabase
      .from('teams')
      .select('id, external_id')
      .in('id', ids)
  }

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

  const primaryResponse = await supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .eq('id', String(leagueId))
    .maybeSingle()
  let response: {
    data: unknown
    error: { code?: string; message: string } | null
  } = primaryResponse

  if (
    primaryResponse.error &&
    (
      primaryResponse.error.code === '42703' ||
      primaryResponse.error.code === 'PGRST204' ||
      primaryResponse.error.message.toLowerCase().includes('schema cache')
    )
  ) {
    response = await supabase
      .from('leagues')
      .select('id, external_id, season')
      .eq('id', String(leagueId))
      .maybeSingle()
  }

  if (response.error) throw response.error

  return (response.data as StoredLeagueRow | null) ?? null
}

function getEventExternalId(
  existingExternalId: string | null | undefined,
  stableKey: string,
  event: ApiFixtureEvent
) {
  if (existingExternalId) return existingExternalId
  if (event.id !== undefined && event.id !== null) return String(event.id)

  return stableKey
}

function getStoredMatchEventStableKey(row: StoredMatchEventRow) {
  return formatMatchEventStableKey(
    {
      time: {
        elapsed: row.minute,
        extra: row.extra_minute,
      },
      team: row.team_id !== null && row.team_id !== undefined
        ? {
            id: row.team_id,
          }
        : null,
      player: row.player_name
        ? {
            name: row.player_name,
          }
        : null,
      assist: row.assist_name
        ? {
            name: row.assist_name,
          }
        : null,
      type: row.type,
      detail: row.detail,
      comments: row.comments ?? null,
    },
    row.match_id
  )
}

async function deleteDuplicateStoredMatchEvents(
  supabase: SupabaseClient,
  rows: StoredMatchEventRow[]
) {
  const rowsByKey = new Map<string, StoredMatchEventRow[]>()

  for (const row of rows) {
    const key = getStoredMatchEventStableKey(row)
    const groupedRows = rowsByKey.get(key) ?? []

    groupedRows.push(row)
    rowsByKey.set(key, groupedRows)
  }

  const duplicateIds = [...rowsByKey.values()]
    .flatMap((groupedRows) =>
      groupedRows.slice(1).map((row) => row.id).filter((id): id is DbId => id !== null && id !== undefined)
    )

  if (!duplicateIds.length) return 0

  const response = await supabase
    .from('match_events')
    .delete()
    .in('id', duplicateIds.map(String))

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'match_events')) return 0
    throw response.error
  }

  return duplicateIds.length
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
  if (!input.events.length) return 0

  const homeTeam = input.match.home_team_id !== null && input.match.home_team_id !== undefined
    ? input.teamsById.get(String(input.match.home_team_id))
    : null
  const awayTeam = input.match.away_team_id !== null && input.match.away_team_id !== undefined
    ? input.teamsById.get(String(input.match.away_team_id))
    : null
  const homeExternalId = toNumber(homeTeam?.external_id)
  const awayExternalId = toNumber(awayTeam?.external_id)

  const existingRows = await fetchStoredMatchEventRows(supabase, input.match.id)
  await deleteDuplicateStoredMatchEvents(supabase, existingRows)
  const existingExternalIdByKey = new Map<string, string>()

  for (const row of existingRows) {
    const stableKey = getStoredMatchEventStableKey(row)

    if (row.external_event_id && !existingExternalIdByKey.has(stableKey)) {
      existingExternalIdByKey.set(stableKey, row.external_event_id)
    }
  }

  const rows = input.events
    .filter((event) => event.time?.elapsed !== null && event.time?.elapsed !== undefined)
    .map((event) => {
      const apiTeamId = toNumber(event.team?.id)
      const teamId =
        apiTeamId !== null && homeExternalId !== null && apiTeamId === homeExternalId
          ? input.match.home_team_id
          : apiTeamId !== null && awayExternalId !== null && apiTeamId === awayExternalId
            ? input.match.away_team_id
            : null
      const stableKey = formatMatchEventStableKey(
        {
          time: event.time ?? null,
          team: teamId !== null && teamId !== undefined
            ? {
                id: teamId,
              }
            : null,
          player: event.player,
          assist: event.assist,
          type: event.type,
          detail: event.detail,
          comments: event.comments,
        },
        input.match.id
      )

      return {
        match_id: input.match.id,
        external_event_id: getEventExternalId(
          existingExternalIdByKey.get(stableKey),
          stableKey,
          event
        ),
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
        comments: event.comments ?? null,
      }
    })

  if (!rows.length) return 0

  const existingNullIdsToDelete = existingRows
    .filter((row) => !row.external_event_id)
    .filter((row) => rows.some((nextRow) => (
      getStoredMatchEventStableKey({
        id: row.id,
        external_event_id: row.external_event_id,
        match_id: row.match_id,
        team_id: row.team_id,
        player_name: row.player_name,
        assist_name: row.assist_name,
        minute: row.minute,
        extra_minute: row.extra_minute,
        type: row.type,
        detail: row.detail,
      }) === formatMatchEventStableKey(
        {
          time: {
            elapsed: nextRow.minute as number | null,
            extra: nextRow.extra_minute as number | null,
          },
          team: nextRow.team_id !== null && nextRow.team_id !== undefined
            ? {
                id: nextRow.team_id as DbId,
              }
            : null,
          player: nextRow.player_name
            ? {
                name: nextRow.player_name as string,
              }
            : null,
          assist: nextRow.assist_name
            ? {
                name: nextRow.assist_name as string,
              }
            : null,
          type: nextRow.type as string | null,
          detail: nextRow.detail as string | null,
        },
        input.match.id
      )
    )))
    .map((row) => row.id)
    .filter((id): id is DbId => id !== null && id !== undefined)

  if (existingNullIdsToDelete.length) {
    const deleteNullResponse = await supabase
      .from('match_events')
      .delete()
      .in('id', existingNullIdsToDelete.map(String))

    if (deleteNullResponse.error && !isMissingOptionalTable(deleteNullResponse.error, 'match_events')) {
      throw deleteNullResponse.error
    }
  }

  const response = await supabase
    .from('match_events')
    .upsert(rows, { onConflict: 'match_id,external_event_id' })

  if (response.error) {
    if (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('comments') ||
      response.error.message.toLowerCase().includes('schema cache')
    ) {
      const fallbackRows = rows.map((row) => {
        const rowWithoutComments: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row)) {
          if (key !== 'comments') rowWithoutComments[key] = value
        }
        return rowWithoutComments
      })
      const fallbackResponse = await supabase
        .from('match_events')
        .upsert(fallbackRows, { onConflict: 'match_id,external_event_id' })

      if (fallbackResponse.error) {
        if (isMissingOptionalTable(fallbackResponse.error, 'match_events')) return 0
        throw fallbackResponse.error
      }

      return rows.length
    }

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

function eventField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberField(value: unknown) {
  const numeric = toNumber(value)
  return numeric === null ? null : numeric
}

function toAuditEventLike(event: unknown): ApiFixtureEvent {
  const record = asRecord(event) ?? {}
  const time = asRecord(record.time)
  const team = asRecord(record.team)
  const player = asRecord(record.player)
  const assist = asRecord(record.assist)

  return {
    time: {
      elapsed: numberField(time?.elapsed),
      extra: numberField(time?.extra),
    },
    team: {
      id: numberField(team?.id),
      name: eventField(team?.name),
    },
    player: {
      id: numberField(player?.id),
      name: eventField(player?.name),
    },
    assist: {
      id: numberField(assist?.id),
      name: eventField(assist?.name),
    },
    type: eventField(record.type),
    detail: eventField(record.detail),
    comments: eventField(record.comments),
  }
}

function toAuditEvent(event: unknown): MatchDetailAuditEvent {
  const eventLike = toAuditEventLike(event)
  const normalized = normalizeMatchEvent(eventLike)

  return {
    minute: eventLike.time?.elapsed ?? null,
    extraMinute: eventLike.time?.extra ?? null,
    teamName: eventLike.team?.name ?? null,
    playerName: eventLike.player?.name ?? null,
    assistName: eventLike.assist?.name ?? null,
    type: eventLike.type ?? null,
    detail: eventLike.detail ?? null,
    comments: eventLike.comments ?? null,
    label: normalized.label,
  }
}

function getAuditEventKind(event: unknown) {
  return normalizeMatchEvent(toAuditEventLike(event)).kind
}

function buildEventsByType(events: unknown[]) {
  return events.reduce<Record<string, number>>((accumulator, event) => {
    const kind = getAuditEventKind(event)
    accumulator[kind] = (accumulator[kind] ?? 0) + 1
    return accumulator
  }, {})
}

function buildStatisticsNames(statistics: unknown[]) {
  const names = new Set<string>()

  for (const entry of statistics) {
    const values = asRecord(entry)?.statistics

    if (!Array.isArray(values)) continue

    for (const value of values) {
      const type = eventField(asRecord(value)?.type)
      if (type) names.add(type)
    }
  }

  return [...names]
}

function extractCaptains(lineups: unknown[]): MatchDetailAuditCaptain[] {
  return lineups.flatMap((lineup) => {
    const lineupRecord = asRecord(lineup)
    const team = asRecord(lineupRecord?.team)
    const teamName = eventField(team?.name)
    const players = [
      ...asArray(lineupRecord?.startXI),
      ...asArray(lineupRecord?.substitutes),
    ]

    return players.flatMap((entry) => {
      const entryRecord = asRecord(entry)
      const player = asRecord(entryRecord?.player)
      const captain = entryRecord?.captain ?? player?.captain

      if (!(captain === true || captain === 'true' || captain === 'yes' || captain === '1')) {
        return []
      }

      return [{
        teamName,
        playerId: numberField(player?.id),
        playerName: eventField(player?.name),
      }]
    })
  })
}

function getAuditEventMergeKey(event: unknown) {
  const eventLike = toAuditEventLike(event)

  return [
    eventLike.team?.id ?? eventLike.team?.name,
    eventLike.time?.elapsed,
    eventLike.time?.extra,
    eventLike.type,
    eventLike.detail,
    eventLike.player?.id ?? eventLike.player?.name,
    eventLike.assist?.id ?? eventLike.assist?.name,
  ].map((part) => normalizeFootballEventText(String(part ?? ''))).join('|')
}

function mergeAuditEvents(primary: unknown[], fallback: unknown[]) {
  const merged = new Map<string, unknown>()

  for (const event of fallback) {
    merged.set(getAuditEventMergeKey(event), event)
  }

  for (const event of primary) {
    merged.set(getAuditEventMergeKey(event), event)
  }

  return [...merged.values()]
}

function buildAuditSnapshot(
  cache: DetailCacheRow | null,
  mergedEvents?: unknown[]
): MatchDetailAuditSnapshot {
  const events = mergedEvents ?? asArray(cache?.events)
  const lineups = asArray(cache?.lineups)
  const statistics = asArray(cache?.statistics)
  const homeLineup = lineups[0]
  const awayLineup = lineups[1]
  const missedPenaltyEvents = events
    .filter((event) => getAuditEventKind(event) === 'penalty-missed')
    .map(toAuditEvent)
  const varEvents = events
    .filter((event) => getAuditEventKind(event) === 'var')
    .map(toAuditEvent)
  const substitutionEvents = events
    .filter((event) => getAuditEventKind(event) === 'substitution')
    .map(toAuditEvent)
  const eventKinds = events.map(getAuditEventKind)
  const captains = extractCaptains(lineups)
  const statisticsNames = buildStatisticsNames(statistics)
  const statisticsCount = statistics.reduce((sum, entry) => {
    if (!entry || typeof entry !== 'object') return sum
    const values = (entry as Record<string, unknown>).statistics
    return sum + (Array.isArray(values) ? values.length : 0)
  }, 0)
  const missingSections: string[] = []

  if (!events.length) missingSections.push('events')
  if (!lineups.length) missingSections.push('lineups')
  if (!statisticsCount) missingSections.push('statistics')

  return {
    hasEvents: events.length > 0,
    eventsCount: events.length,
    eventsByType: buildEventsByType(events),
    hasGoals: eventKinds.some((kind) => (
      kind === 'goal' ||
      kind === 'penalty-goal' ||
      kind === 'own-goal'
    )),
    hasCards: eventKinds.some((kind) => (
      kind === 'yellow-card' ||
      kind === 'red-card' ||
      kind === 'second-yellow'
    )),
    hasMissedPenalty: missedPenaltyEvents.length > 0,
    missedPenaltyEvents,
    hasVarEvents: varEvents.length > 0,
    varEvents,
    hasSubstitutions: substitutionEvents.length > 0,
    substitutionEvents,
    hasLineups: lineups.length > 0,
    homeStartersCount: countLineupPlayers(homeLineup, 'startXI'),
    awayStartersCount: countLineupPlayers(awayLineup, 'startXI'),
    lineupsHomeCount: countLineupPlayers(homeLineup, 'startXI'),
    lineupsAwayCount: countLineupPlayers(awayLineup, 'startXI'),
    substitutesHomeCount: countLineupPlayers(homeLineup, 'substitutes'),
    substitutesAwayCount: countLineupPlayers(awayLineup, 'substitutes'),
    homeSubstitutesCount: countLineupPlayers(homeLineup, 'substitutes'),
    awaySubstitutesCount: countLineupPlayers(awayLineup, 'substitutes'),
    hasStatistics: statisticsCount > 0,
    statisticsCount,
    statisticsNames,
    hasCaptainData: lineups.some(hasCaptain),
    captains,
    missingSections,
    warnings: missingSections.length
      ? [`Faltan secciones de detalle: ${missingSections.join(', ')}.`]
      : [],
  }
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function isDetailRequiredForStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status)

  if (!normalized) return false

  return !['NS', 'TBD', 'TBA', 'PST', 'CANC', 'ABD'].includes(normalized)
}

function getCompletenessScore(snapshot: MatchDetailAuditSnapshot, requiresDetail: boolean) {
  const checks = [
    snapshot.hasEvents,
    snapshot.hasLineups,
    snapshot.hasStatistics,
  ]
  const base = checks.filter(Boolean).length / checks.length
  const bonus =
    snapshot.lineupsHomeCount >= 11 && snapshot.lineupsAwayCount >= 11
      ? 0.1
      : 0

  return requiresDetail ? Math.min(1, base + bonus) : 1
}

function getMissingRequiredSections(snapshot: MatchDetailAuditSnapshot, requiresDetail: boolean) {
  if (!requiresDetail) return []

  const missing: string[] = []
  if (!snapshot.hasEvents) missing.push('events')
  if (!snapshot.hasLineups) missing.push('lineups')
  if (!snapshot.hasStatistics) missing.push('statistics')
  if (snapshot.hasLineups && snapshot.lineupsHomeCount < 11) missing.push('home_start_xi')
  if (snapshot.hasLineups && snapshot.lineupsAwayCount < 11) missing.push('away_start_xi')

  return missing
}

function readDateParam(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : value
}

async function fetchAuditLeagueRowsByExternalId(
  supabase: SupabaseClient,
  leagueExternalId: number
) {
  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', String(leagueExternalId))

  if (response.error) throw response.error

  return ((response.data ?? []) as Array<{ id: DbId }>).map((league) => String(league.id))
}

async function fetchAuditMatches(
  supabase: SupabaseClient,
  input: {
    limit: number
    leagueExternalId?: number | null
    dateFrom?: string | null
    dateTo?: string | null
    statuses?: string[]
  }
) {
  let query = supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, match_date, status, home_score, away_score')
    .not('external_id', 'is', null)
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(input.limit)

  if (input.dateFrom) query = query.gte('match_date', input.dateFrom)
  if (input.dateTo) query = query.lte('match_date', input.dateTo)
  if (input.statuses?.length) query = query.in('status', input.statuses)

  if (input.leagueExternalId) {
    const leagueIds = await fetchAuditLeagueRowsByExternalId(supabase, input.leagueExternalId)
    if (!leagueIds.length) return []
    query = query.in('league_id', leagueIds)
  }

  const response = await query

  if (response.error) throw response.error

  return (response.data ?? []) as StoredMatchAuditRow[]
}

async function fetchAuditLeagueMap(supabase: SupabaseClient, leagueIds: Array<DbId | null | undefined>) {
  const ids = [...new Set(leagueIds.filter((id): id is DbId => id !== null && id !== undefined).map(String))]
  if (!ids.length) return new Map<string, StoredLeagueRow>()

  const primaryResponse = await supabase
    .from('leagues')
    .select('id, external_id, name, season')
    .in('id', ids)
  let response: {
    data: unknown
    error: { code?: string; message: string } | null
  } = primaryResponse

  if (
    primaryResponse.error &&
    (
      primaryResponse.error.code === '42703' ||
      primaryResponse.error.code === 'PGRST204' ||
      primaryResponse.error.message.toLowerCase().includes('schema cache')
    )
  ) {
    response = await supabase
      .from('leagues')
      .select('id, external_id, season')
      .in('id', ids)
  }

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as StoredLeagueRow[]).map((league) => [String(league.id), league])
  )
}

async function fetchStoredMatchEventRows(
  supabase: SupabaseClient,
  matchId: DbId | null | undefined
) {
  if (matchId === null || matchId === undefined) return []

  const response = await supabase
    .from('match_events')
    .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
    .eq('match_id', String(matchId))
    .order('minute', { ascending: true })
    .order('extra_minute', { ascending: true })

  if (response.error) {
    if (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('comments') ||
      response.error.message.toLowerCase().includes('schema cache')
    ) {
      const fallbackResponse = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
        .eq('match_id', String(matchId))
        .order('minute', { ascending: true })
        .order('extra_minute', { ascending: true })

      if (fallbackResponse.error) {
        if (isMissingOptionalTable(fallbackResponse.error, 'match_events')) return []
        throw fallbackResponse.error
      }

      return (fallbackResponse.data ?? []) as StoredMatchEventRow[]
    }

    if (isMissingOptionalTable(response.error, 'match_events')) return []
    throw response.error
  }

  return (response.data ?? []) as StoredMatchEventRow[]
}

function mapStoredAuditEvent(
  row: StoredMatchEventRow,
  teamsById: Map<string, StoredTeamRow>
): ApiFixtureEvent {
  const team = row.team_id !== null && row.team_id !== undefined
    ? teamsById.get(String(row.team_id))
    : null

  return {
    team: team
      ? {
          id: toNumber(team.external_id),
          name: team.name ?? null,
        }
      : null,
    player: row.player_name
      ? {
          name: row.player_name,
        }
      : null,
    assist: row.assist_name
      ? {
          name: row.assist_name,
        }
      : null,
    time: {
      elapsed: row.minute,
      extra: row.extra_minute,
    },
    type: row.type ?? 'Event',
    detail: row.detail,
    comments: row.comments ?? null,
  }
}

function getAuditTeamSide(
  event: unknown,
  match: StoredMatchRow | null,
  teamsById: Map<string, StoredTeamRow>
) {
  if (!match) return null

  const eventLike = toAuditEventLike(event)
  const homeTeam = match.home_team_id !== null && match.home_team_id !== undefined
    ? teamsById.get(String(match.home_team_id))
    : null
  const awayTeam = match.away_team_id !== null && match.away_team_id !== undefined
    ? teamsById.get(String(match.away_team_id))
    : null
  const eventTeamId = numberField(eventLike.team?.id)
  const eventTeamName = normalizeFootballEventText(eventLike.team?.name)
  const homeExternalId = numberField(homeTeam?.external_id)
  const awayExternalId = numberField(awayTeam?.external_id)
  const homeName = normalizeFootballEventText(homeTeam?.name)
  const awayName = normalizeFootballEventText(awayTeam?.name)

  if (eventTeamId !== null && homeExternalId !== null && eventTeamId === homeExternalId) return 'home'
  if (eventTeamId !== null && awayExternalId !== null && eventTeamId === awayExternalId) return 'away'
  if (eventTeamName && homeName && (eventTeamName === homeName || eventTeamName.includes(homeName) || homeName.includes(eventTeamName))) {
    return 'home'
  }
  if (eventTeamName && awayName && (eventTeamName === awayName || eventTeamName.includes(awayName) || awayName.includes(eventTeamName))) {
    return 'away'
  }

  return null
}

function getOfficialDisciplineStats(statistics: unknown[]) {
  const result = {
    yellowCards: {
      home: null as number | null,
      away: null as number | null,
    },
    redCards: {
      home: null as number | null,
      away: null as number | null,
    },
  }

  statistics.slice(0, 2).forEach((entry, index) => {
    const side = index === 0 ? 'home' : 'away'
    const values = asArray(asRecord(entry)?.statistics)

    for (const value of values) {
      const stat = asRecord(value)
      const type = normalizeFootballEventText(eventField(stat?.type))
      const numeric = numberField(stat?.value)

      if (type === 'yellow cards') result.yellowCards[side] = numeric
      if (type === 'red cards') result.redCards[side] = numeric
    }
  })

  return result
}

function buildDetailedAuditSections(input: {
  cache: DetailCacheRow | null
  events: unknown[]
  match: StoredMatchRow | null
  teamsById: Map<string, StoredTeamRow>
}) {
  const statistics = asArray(input.cache?.statistics)
  const lineups = asArray(input.cache?.lineups)
  const eventSummary = {
    total: input.events.length,
    goals: 0,
    cards: 0,
    yellowCardsHome: 0,
    yellowCardsAway: 0,
    redCardsHome: 0,
    redCardsAway: 0,
    substitutions: 0,
    varEvents: 0,
    missedPenalties: 0,
  }

  for (const event of input.events) {
    const kind = getAuditEventKind(event)
    const side = getAuditTeamSide(event, input.match, input.teamsById)

    if (kind === 'goal' || kind === 'penalty-goal' || kind === 'own-goal') {
      eventSummary.goals += 1
    }
    if (kind === 'yellow-card') {
      eventSummary.cards += 1
      if (side === 'home') eventSummary.yellowCardsHome += 1
      if (side === 'away') eventSummary.yellowCardsAway += 1
    }
    if (kind === 'red-card' || kind === 'second-yellow') {
      eventSummary.cards += 1
      if (side === 'home') eventSummary.redCardsHome += 1
      if (side === 'away') eventSummary.redCardsAway += 1
    }
    if (kind === 'substitution') eventSummary.substitutions += 1
    if (kind === 'var') eventSummary.varEvents += 1
    if (kind === 'penalty-missed') eventSummary.missedPenalties += 1
  }

  const official = getOfficialDisciplineStats(statistics)
  const mismatches = [
    {
      type: 'Yellow Cards',
      official: official.yellowCards,
      derivedFromEvents: {
        home: eventSummary.yellowCardsHome,
        away: eventSummary.yellowCardsAway,
      },
    },
    {
      type: 'Red Cards',
      official: official.redCards,
      derivedFromEvents: {
        home: eventSummary.redCardsHome,
        away: eventSummary.redCardsAway,
      },
    },
  ].filter((item) =>
    (item.official.home !== null && item.official.home !== item.derivedFromEvents.home) ||
    (item.official.away !== null && item.official.away !== item.derivedFromEvents.away)
  )

  return {
    events: eventSummary,
    statistics: {
      official: {
        count: statistics.reduce((sum, entry) => {
          const values = asArray(asRecord(entry)?.statistics)
          return sum + values.length
        }, 0),
        names: buildStatisticsNames(statistics),
        discipline: official,
      },
      derivedFromEvents: {
        yellowCards: {
          home: eventSummary.yellowCardsHome,
          away: eventSummary.yellowCardsAway,
        },
        redCards: {
          home: eventSummary.redCardsHome,
          away: eventSummary.redCardsAway,
        },
      },
      merged: {
        yellowCards: {
          home: eventSummary.yellowCardsHome,
          away: eventSummary.yellowCardsAway,
        },
        redCards: {
          home: eventSummary.redCardsHome,
          away: eventSummary.redCardsAway,
        },
      },
      mismatches,
    },
    lineups: {
      hasLineups: lineups.length > 0,
      homeStarters: countLineupPlayers(lineups[0], 'startXI'),
      awayStarters: countLineupPlayers(lineups[1], 'startXI'),
      homeSubstitutes: countLineupPlayers(lineups[0], 'substitutes'),
      awaySubstitutes: countLineupPlayers(lineups[1], 'substitutes'),
      captains: extractCaptains(lineups),
    },
  }
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
      match: {
        id: match?.id ?? null,
        externalId: null,
      },
      ...buildAuditSnapshot(null),
      warnings: ['No se pudo resolver fixture externo para auditar detalle.'],
    }
  }

  const [cache, storedEventRows, teamsById] = await Promise.all([
    readDetailCacheByFixture(supabase, fixtureExternalId),
    fetchStoredMatchEventRows(supabase, match?.id),
    match
      ? fetchStoredTeamsByIds(supabase, [match.home_team_id, match.away_team_id])
      : Promise.resolve(new Map<string, StoredTeamRow>()),
  ])
  const storedEvents = storedEventRows.map((event) => mapStoredAuditEvent(event, teamsById))
  const mergedEvents = mergeAuditEvents(asArray(cache?.events), storedEvents)
  const storedEventsCount = storedEventRows.length
  const detailedSections = buildDetailedAuditSections({
    cache,
    events: mergedEvents,
    match,
    teamsById,
  })

  return {
    fixtureExternalId,
    matchId: match?.id ?? null,
    match: {
      id: match?.id ?? null,
      externalId: fixtureExternalId,
    },
    ...mergeStoredEventsIntoAudit(buildAuditSnapshot(cache, mergedEvents), storedEventsCount),
    ...detailedSections,
  }
}

export async function auditMatchDetailsGeneral(
  supabase: SupabaseClient,
  input: {
    limit?: number | null
    leagueExternalId?: number | null
    dateFrom?: string | null
    dateTo?: string | null
    statuses?: string[]
    missingOnly?: boolean
  } = {}
): Promise<MatchDetailGeneralAuditResult> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const statuses = input.statuses?.length
    ? input.statuses.map((status) => status.trim().toUpperCase()).filter(Boolean)
    : ['FT', 'AET', 'PEN', 'LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT']
  const dateFrom = readDateParam(input.dateFrom ?? null)
  const dateTo = readDateParam(input.dateTo ?? null)
  const matches = await fetchAuditMatches(supabase, {
    limit,
    leagueExternalId: input.leagueExternalId ?? null,
    dateFrom,
    dateTo,
    statuses,
  })
  const [teamsById, leaguesById] = await Promise.all([
    fetchStoredTeamsByIds(
      supabase,
      matches.flatMap((match) => [match.home_team_id, match.away_team_id])
    ),
    fetchAuditLeagueMap(supabase, matches.map((match) => match.league_id)),
  ])
  const items: MatchDetailGeneralAuditItem[] = []
  const warnings: string[] = []

  for (const match of matches) {
    const fixtureExternalId = toNumber(match.external_id)
    const league = match.league_id !== null && match.league_id !== undefined
      ? leaguesById.get(String(match.league_id))
      : undefined
    const home = match.home_team_id !== null && match.home_team_id !== undefined
      ? teamsById.get(String(match.home_team_id))
      : undefined
    const away = match.away_team_id !== null && match.away_team_id !== undefined
      ? teamsById.get(String(match.away_team_id))
      : undefined

    if (!fixtureExternalId) {
      warnings.push(`El match ${match.id} no tiene external_id numerico.`)
      continue
    }

    const detailAudit = await auditMatchDetailCache(supabase, {
      fixtureExternalId,
      matchId: String(match.id),
    })
    const requiresDetail = isDetailRequiredForStatus(match.status)
    const snapshot = {
      hasEvents: detailAudit.hasEvents,
      eventsCount: detailAudit.eventsCount,
      eventsByType: detailAudit.eventsByType,
      hasGoals: detailAudit.hasGoals,
      hasCards: detailAudit.hasCards,
      hasMissedPenalty: detailAudit.hasMissedPenalty,
      missedPenaltyEvents: detailAudit.missedPenaltyEvents,
      hasVarEvents: detailAudit.hasVarEvents,
      varEvents: detailAudit.varEvents,
      hasSubstitutions: detailAudit.hasSubstitutions,
      substitutionEvents: detailAudit.substitutionEvents,
      hasLineups: detailAudit.hasLineups,
      homeStartersCount: detailAudit.homeStartersCount,
      awayStartersCount: detailAudit.awayStartersCount,
      lineupsHomeCount: detailAudit.lineupsHomeCount,
      lineupsAwayCount: detailAudit.lineupsAwayCount,
      substitutesHomeCount: detailAudit.substitutesHomeCount,
      substitutesAwayCount: detailAudit.substitutesAwayCount,
      homeSubstitutesCount: detailAudit.homeSubstitutesCount,
      awaySubstitutesCount: detailAudit.awaySubstitutesCount,
      hasStatistics: detailAudit.hasStatistics,
      statisticsCount: detailAudit.statisticsCount,
      statisticsNames: detailAudit.statisticsNames,
      hasCaptainData: detailAudit.hasCaptainData,
      captains: detailAudit.captains,
      missingSections: detailAudit.missingSections,
      warnings: detailAudit.warnings,
    }
    const missingRequiredSections = getMissingRequiredSections(snapshot, requiresDetail)
    const syncRecommended = missingRequiredSections.length > 0
    const item: MatchDetailGeneralAuditItem = {
      fixtureExternalId,
      matchId: match.id,
      matchDate: match.match_date,
      status: match.status,
      league: {
        id: match.league_id ?? null,
        externalId: toNumber(league?.external_id),
        name: league?.name ?? null,
        season: league?.season ?? null,
      },
      teams: {
        home: home?.name ?? null,
        away: away?.name ?? null,
      },
      score: {
        home: match.home_score ?? null,
        away: match.away_score ?? null,
      },
      audit: snapshot,
      completenessScore: getCompletenessScore(snapshot, requiresDetail),
      missingRequiredSections,
      syncRecommended,
      syncUrl: syncRecommended
        ? `/api/admin/sync-match-detail?fixture=${fixtureExternalId}`
        : null,
    }

    if (!input.missingOnly || item.missingRequiredSections.length > 0) {
      items.push(item)
    }
  }

  const summary = items.reduce(
    (accumulator, item) => {
      const missingEvents = item.missingRequiredSections.includes('events')
      const missingLineups =
        item.missingRequiredSections.includes('lineups') ||
        item.missingRequiredSections.includes('home_start_xi') ||
        item.missingRequiredSections.includes('away_start_xi')
      const missingStatistics = item.missingRequiredSections.includes('statistics')
      const missingAnyRequired = item.missingRequiredSections.length > 0

      return {
        complete: accumulator.complete + (missingAnyRequired ? 0 : 1),
        missingEvents: accumulator.missingEvents + (missingEvents ? 1 : 0),
        missingLineups: accumulator.missingLineups + (missingLineups ? 1 : 0),
        missingStatistics: accumulator.missingStatistics + (missingStatistics ? 1 : 0),
        missingAnyRequired: accumulator.missingAnyRequired + (missingAnyRequired ? 1 : 0),
        syncRecommended: accumulator.syncRecommended + (item.syncRecommended ? 1 : 0),
      }
    },
    {
      complete: 0,
      missingEvents: 0,
      missingLineups: 0,
      missingStatistics: 0,
      missingAnyRequired: 0,
      syncRecommended: 0,
    }
  )

  return {
    checked: matches.length,
    limit,
    filters: {
      leagueExternalId: input.leagueExternalId ?? null,
      dateFrom,
      dateTo,
      statuses,
      missingOnly: Boolean(input.missingOnly),
    },
    summary,
    examplesMissing: items
      .filter((item) => item.missingRequiredSections.length > 0)
      .slice(0, 20),
    items,
    warnings,
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

  const beforeCache = await readDetailCacheByFixture(supabase, fixtureExternalId)
  const before = buildAuditSnapshot(beforeCache)
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

  const eventsForCache = events.length ? events : asArray(beforeCache?.events)
  const lineupsForCache = lineups.length ? lineups : asArray(beforeCache?.lineups)
  const statisticsForCache = statistics.length ? statistics : asArray(beforeCache?.statistics)

  if (!events.length && before.hasEvents) {
    warnings.push('API-Football no devolvio eventos; se conservaron los eventos cacheados.')
  }
  if (!lineups.length && before.hasLineups) {
    warnings.push('API-Football no devolvio alineaciones; se conservaron las alineaciones cacheadas.')
  }
  if (!statistics.length && before.hasStatistics) {
    warnings.push('API-Football no devolvio estadisticas; se conservaron las estadisticas cacheadas.')
  }

  const cacheResponse = await supabase
    .from('football_match_detail_cache')
    .upsert(
      {
        fixture_external_id: String(fixtureExternalId),
        match_id: match?.id !== undefined && match?.id !== null ? String(match.id) : null,
        league_external_id: leagueExternalId !== null ? String(leagueExternalId) : null,
        season,
        fixture_payload: fixturePayload,
        events: eventsForCache,
        lineups: lineupsForCache,
        statistics: statisticsForCache,
      },
      { onConflict: 'fixture_external_id' }
    )
  let cacheUpserted = !cacheResponse.error

  if (cacheResponse.error) {
    if (isMissingOptionalTable(cacheResponse.error, 'football_match_detail_cache')) {
      const fallbackCached = await upsertFixtureCacheDetailFallback(supabase, {
        fixtureExternalId,
        fixturePayload,
        events: eventsForCache,
        lineups: lineupsForCache,
        statistics: statisticsForCache,
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
    match: {
      id: match?.id ?? null,
      externalId: fixtureExternalId,
    },
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
