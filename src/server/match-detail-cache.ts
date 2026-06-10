import type { SupabaseClient } from '@supabase/supabase-js'

import { requestFootballApi } from '@/server/integrations/football-api-client'
import {
  addDaysToISO,
  getArgentinaDateISO,
  getArgentinaDayUtcRange,
} from '@/shared/utils/argentina-time'
import {
  formatMatchEventSemanticKey,
  formatMatchEventStableKey,
  getMatchEventExternalIdPriority,
  getTimelineEvents,
  normalizeFootballEventText,
  normalizeMatchEvent,
} from '@/shared/utils/football-events'
import { getFixtureStatusElapsedMinute } from '@/shared/utils/match-minute'
import {
  getCanonicalMatchStatusFromApi,
  isFinishedStatus,
  isLiveStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { normalizeMatchStatistics } from '@/shared/utils/match-statistics'

type DbId = string | number

type ApiFixtureDetail = {
  fixture?: {
    id?: number
    date?: string
    timezone?: string | null
    referee?: string | null
    status?: {
      short?: string | null
      long?: string | null
      elapsed?: number | null
      extra?: number | null
    } | null
    venue?: {
      id?: number | string | null
      name?: string | null
      city?: string | null
      country?: string | null
    } | null
  }
  league?: {
    id?: number
    name?: string | null
    country?: string | null
    season?: number
  }
  goals?: {
    home?: number | null
    away?: number | null
  } | null
  score?: {
    halftime?: {
      home?: number | null
      away?: number | null
    } | null
    fulltime?: {
      home?: number | null
      away?: number | null
    } | null
    penalty?: {
      home?: number | null
      away?: number | null
    } | null
  } | null
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
  elapsed?: number | null
  final_elapsed?: number | null
  home_score?: number | null
  away_score?: number | null
  venue_name?: string | null
  venue_id?: string | number | null
  venue_city?: string | null
  venue_country?: string | null
  timezone?: string | null
  broadcast_channel?: string | null
  broadcast_logo_url?: string | null
  highlights_url?: string | null
  highlights_title?: string | null
  referee?: string | null
  detail_last_synced_at?: string | null
  final_detail_synced_at?: string | null
}

type StoredMatchBulkRow = StoredMatchAuditRow & {
  detail_last_synced_at?: string | null
  final_detail_synced_at?: string | null
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

type StoredMatchBroadcasterRow = {
  broadcaster_name?: string | null
  broadcaster_logo_url?: string | null
  country?: string | null
  source?: string | null
  confidence?: string | null
  verified?: boolean | null
}

type DetailCacheRow = {
  fixture_payload?: unknown
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

export type SerializedSyncError = {
  message: string
  code: string | null
  detail: string | null
  hint: string | null
  source: 'api-football' | 'supabase' | 'validation' | 'unknown'
}

export type MatchDetailCounts = {
  events: number
  lineups: number
  statistics: number
}

export type MatchDetailRenderCounts = {
  timelineEvents: number
  formationPlayers: number
  statisticsRows: number
  startersCount: number
  substitutesCount: number
}

export type MatchDetailRenderStatus =
  | 'ready'
  | 'partial'
  | 'render-problem'
  | 'not-renderable'
  | 'future-no-details-yet'

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
  matchUpdated: boolean
  matchEventsUpserted: number
  persistence: SyncMatchDetailPersistenceInfo
  updatedSections: string[]
  missingFromApi: string[]
  renderCounts: MatchDetailRenderCounts
  renderStatus: MatchDetailRenderStatus
  warnings: string[]
  errors: SerializedSyncError[]
}

export type SyncMatchDetailPersistenceInfo = {
  detailTable: 'football_match_detail_cache' | 'football_fixture_cache' | null
  matchEventsTable: 'match_events' | null
  cacheUpserted: boolean
  usedFixtureCacheFallback: boolean
  matchEventsUpserted: number
  received: {
    events: number
    lineupTeams: number
    lineupPlayers: number
    statisticsTeams: number
    statisticsValues: number
  }
  stored: MatchDetailCounts
}

type SyncMatchDetailSections = {
  fixture?: boolean
  events?: boolean
  lineups?: boolean
  statistics?: boolean
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
  hasEvents: boolean
  eventsCount: number
  hasSubstitutions: boolean
  substitutionsCount: number
  hasVarEvents: boolean
  hasMissedPenalty: boolean
  hasLineups: boolean
  homeStartersCount: number
  awayStartersCount: number
  homeSubstitutesCount: number
  awaySubstitutesCount: number
  hasCaptainData: boolean
  hasStatistics: boolean
  statisticsCount: number
  statisticsMismatches: unknown[]
  providerCounts: MatchDetailCounts | null
  dbCounts: MatchDetailCounts
  renderCounts: MatchDetailRenderCounts
  renderStatus: MatchDetailRenderStatus
  missingSections: string[]
  warnings: string[]
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
    includeProvider?: boolean
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

export type SyncMatchDetailsBulkOptions = {
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  leagueExternalId?: number | null
  statuses?: string[]
  liveOnly?: boolean
  recentFinishedOnly?: boolean
  missingDetailsOnly?: boolean
  futureDays?: number | null
  lookbackDays?: number | null
  limit?: number | null
  force?: boolean
}

type SyncMatchDetailsBulkStatus =
  | 'complete'
  | 'updated'
  | 'unchanged'
  | 'skipped'
  | 'fixture-updated'
  | 'future-no-details-yet'
  | 'provider-no-lineups'
  | 'provider-no-statistics'
  | 'provider-no-detail-data'
  | 'render-problem'
  | 'partial'
  | 'failed'

type SyncMatchDetailsDataStatus =
  | 'complete'
  | 'partial'
  | 'missing'
  | 'future-no-details-yet'

type SyncMatchDetailsProviderStatus =
  | 'complete'
  | 'provider-no-lineups'
  | 'provider-no-statistics'
  | 'provider-no-events'
  | 'provider-no-detail-data'
  | 'not-requested'
  | 'unknown'
  | 'error'

type SyncMatchDetailsCounts = MatchDetailCounts

export type SyncMatchDetailsBulkItem = {
  matchId: DbId
  fixtureExternalId: number
  matchDate: string | null
  status: SyncMatchDetailsBulkStatus
  dataStatus: SyncMatchDetailsDataStatus
  providerStatus: SyncMatchDetailsProviderStatus
  matchStatus: string | null
  reasons: string[]
  plan: {
    fixture: boolean
    events: boolean
    lineups: boolean
    statistics: boolean
  }
  skipped: boolean
  skipReason: string | null
  ok: boolean
  eventsBefore?: number
  eventsAfter?: number
  lineupsBefore?: number
  lineupsAfter?: number
  statisticsBefore?: number
  statisticsAfter?: number
  providerCounts: SyncMatchDetailsCounts
  dbCountsBefore: SyncMatchDetailsCounts
  dbCountsAfter: SyncMatchDetailsCounts
  renderCounts: MatchDetailRenderCounts
  renderStatus: MatchDetailRenderStatus
  persistence: SyncMatchDetailPersistenceInfo | null
  warnings: string[]
  errors: SerializedSyncError[]
}

export type SyncMatchDetailsBulkResult = {
  ok: boolean
  selected: number
  processed: number
  updated: number
  fixtureUpdated: number
  unchanged: number
  skipped: number
  futureNoDetailsYet: number
  complete: number
  partial: number
  providerNoLineups: number
  providerNoStatistics: number
  renderProblems: number
  failed: number
  limit: number
  filters: {
    date: string | null
    dateFrom: string | null
    dateTo: string | null
    leagueExternalId: number | null
    statuses: string[]
    liveOnly: boolean
    recentFinishedOnly: boolean
    missingDetailsOnly: boolean
    futureDays: number | null
    lookbackDays: number | null
    force: boolean
  }
  estimatedApiRequests: number
  requestPolicy: {
    defaultLimit: number
    maxLimit: number
    fixture: string
    events: string
    statistics: string
    lineups: string
    finalSkip: string
  }
  items: SyncMatchDetailsBulkItem[]
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
    error?.code === 'PGRST205' ||
    (
      message.includes(table) &&
      (
        message.includes('does not exist') ||
        message.includes('could not find the table') ||
        message.includes('not found')
      )
    )
  )
}

function readErrorField(error: unknown, field: string) {
  if (typeof error !== 'object' || error === null) return null
  const value = (error as Record<string, unknown>)[field]

  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function serializeError(
  error: unknown,
  source: SerializedSyncError['source'] = 'unknown'
): SerializedSyncError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: readErrorField(error, 'code'),
      detail: readErrorField(error, 'detail') ?? readErrorField(error, 'details'),
      hint: readErrorField(error, 'hint'),
      source,
    }
  }

  if (typeof error === 'object' && error !== null) {
    let jsonMessage = 'Error desconocido'
    try {
      jsonMessage = JSON.stringify(error)
    } catch {
      jsonMessage = Object.prototype.toString.call(error)
    }
    const message =
      readErrorField(error, 'message') ??
      readErrorField(error, 'error') ??
      jsonMessage

    return {
      message,
      code: readErrorField(error, 'code'),
      detail: readErrorField(error, 'detail') ?? readErrorField(error, 'details'),
      hint: readErrorField(error, 'hint'),
      source,
    }
  }

  return {
    message: String(error ?? 'Error desconocido'),
    code: null,
    detail: null,
    hint: null,
    source,
  }
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

function hasDetailLineupPlayers(value: unknown) {
  return countApiLineupPlayers(asArray(value)) > 0
}

function hasDetailStatisticsValues(value: unknown) {
  return countApiStatisticsValues(asArray(value)) > 0
}

function mergeDetailCacheRows(
  primary: DetailCacheRow | null,
  fallback: DetailCacheRow | null
): DetailCacheRow | null {
  if (!primary) return fallback
  if (!fallback) return primary

  return {
    fixture_payload: hasDetailRecord(primary.fixture_payload)
      ? primary.fixture_payload
      : fallback.fixture_payload,
    events: hasDetailItems(primary.events) ? primary.events : fallback.events,
    lineups: hasDetailLineupPlayers(primary.lineups)
      ? primary.lineups
      : hasDetailLineupPlayers(fallback.lineups)
        ? fallback.lineups
        : hasDetailItems(primary.lineups)
          ? primary.lineups
          : fallback.lineups,
    statistics: hasDetailStatisticsValues(primary.statistics)
      ? primary.statistics
      : hasDetailStatisticsValues(fallback.statistics)
        ? fallback.statistics
        : hasDetailItems(primary.statistics)
          ? primary.statistics
          : fallback.statistics,
  }
}

function hasDetailRecord(value: unknown) {
  return Boolean(asRecord(value))
}

function isMissingDetailFixturePayloadColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    (error?.code === '42703' || error?.code === 'PGRST204') &&
    message.includes('fixture_payload')
  )
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

export async function fetchMatchDetailProviderCounts(
  fixtureExternalId: number,
  sections: {
    events?: boolean
    lineups?: boolean
    statistics?: boolean
  } = {}
): Promise<MatchDetailCounts> {
  const shouldFetch = {
    events: sections.events ?? true,
    lineups: sections.lineups ?? true,
    statistics: sections.statistics ?? true,
  }
  const [events, lineups, statistics] = await Promise.all([
    shouldFetch.events
      ? fetchApiArray<ApiFixtureEvent>(
          '/fixtures/events',
          { fixture: fixtureExternalId },
          `match-detail-provider-counts:${fixtureExternalId}:events`
        )
      : Promise.resolve([]),
    shouldFetch.lineups
      ? fetchApiArray<unknown>(
          '/fixtures/lineups',
          { fixture: fixtureExternalId },
          `match-detail-provider-counts:${fixtureExternalId}:lineups`
        )
      : Promise.resolve([]),
    shouldFetch.statistics
      ? fetchApiArray<unknown>(
          '/fixtures/statistics',
          { fixture: fixtureExternalId },
          `match-detail-provider-counts:${fixtureExternalId}:statistics`
        )
      : Promise.resolve([]),
  ])

  return {
    events: events.length,
    lineups: countApiLineupPlayers(lineups),
    statistics: countApiStatisticsValues(statistics),
  }
}

export async function fetchMatchInfoProviderSnapshot(fixtureExternalId: number) {
  const [fixturePayload, counts] = await Promise.all([
    fetchFixtureDetail(fixtureExternalId),
    fetchMatchDetailProviderCounts(fixtureExternalId, {
      events: false,
      lineups: true,
      statistics: true,
    }),
  ])
  const fixture = fixturePayload?.fixture ?? null
  const venue = fixture?.venue ?? null

  return {
    stadium: cleanPatchText(venue?.name),
    venue: cleanPatchText(venue?.name),
    venueId:
      venue?.id !== null && venue?.id !== undefined && String(venue.id).trim()
        ? String(venue.id)
        : null,
    city: cleanPatchText(venue?.city),
    country: cleanPatchText(venue?.country) ?? cleanPatchText(fixturePayload?.league?.country),
    referee: cleanPatchText(fixture?.referee),
    timezone: cleanPatchText(fixture?.timezone),
    hasLineups: counts.lineups > 0,
    lineupsCount: counts.lineups,
    hasStatistics: counts.statistics > 0,
    statisticsCount: counts.statistics,
  }
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

function getStoredMatchEventSemanticKey(row: StoredMatchEventRow) {
  return formatMatchEventSemanticKey(
    {
      id: row.id,
      external_event_id: row.external_event_id,
      match_id: row.match_id,
      team_id: row.team_id,
      player_name: row.player_name,
      assist_name: row.assist_name,
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

function getStoredMatchEventCompletenessScore(row: StoredMatchEventRow) {
  return [
    row.external_event_id,
    row.team_id,
    row.player_name,
    row.assist_name,
    row.minute,
    row.extra_minute,
    row.type,
    row.detail,
    row.comments,
  ].reduce<number>((score, value) => {
    if (value === null || value === undefined) return score
    const text = String(value).trim()
    if (!text) return score

    return score + 1 + Math.min(text.length, 40) / 40
  }, getMatchEventExternalIdPriority(row.external_event_id) * 100)
}

function getStoredDuplicateIdsToDelete(rows: StoredMatchEventRow[]) {
  const [keep, ...toDelete] = [...rows].sort((a, b) => {
    const score = getStoredMatchEventCompletenessScore(b) - getStoredMatchEventCompletenessScore(a)
    if (score !== 0) return score

    return String(a.id ?? '').localeCompare(String(b.id ?? ''))
  })

  if (!keep) return []

  return toDelete
    .map((row) => row.id)
    .filter((id): id is DbId => id !== null && id !== undefined)
}

async function deleteDuplicateStoredMatchEvents(
  supabase: SupabaseClient,
  rows: StoredMatchEventRow[]
) {
  const rowsByKey = new Map<string, StoredMatchEventRow[]>()

  for (const row of rows) {
    const key = getStoredMatchEventSemanticKey(row)
    const groupedRows = rowsByKey.get(key) ?? []

    groupedRows.push(row)
    rowsByKey.set(key, groupedRows)
  }

  const duplicateIds = [...rowsByKey.values()]
    .flatMap((groupedRows) =>
      getStoredDuplicateIdsToDelete(groupedRows)
    )

  if (!duplicateIds.length) return []

  const response = await supabase
    .from('match_events')
    .delete()
    .in('id', duplicateIds.map(String))

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'match_events')) return []
    throw response.error
  }

  return duplicateIds.map(String)
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
  const deletedExistingIds = new Set(
    await deleteDuplicateStoredMatchEvents(supabase, existingRows)
  )
  const remainingExistingRows = existingRows.filter((row) =>
    row.id === null || row.id === undefined || !deletedExistingIds.has(String(row.id))
  )
  const existingExternalIdByKey = new Map<string, string>()

  for (const row of remainingExistingRows) {
    const semanticKey = getStoredMatchEventSemanticKey(row)

    if (
      row.external_event_id &&
      (
        !existingExternalIdByKey.has(semanticKey) ||
        getMatchEventExternalIdPriority(row.external_event_id) >
          getMatchEventExternalIdPriority(existingExternalIdByKey.get(semanticKey))
      )
    ) {
      existingExternalIdByKey.set(semanticKey, row.external_event_id)
    }
  }

  const mappedRows = input.events
    .map((event) => {
      const apiTeamId = toNumber(event.team?.id)
      const teamId =
        apiTeamId !== null && homeExternalId !== null && apiTeamId === homeExternalId
          ? input.match.home_team_id
          : apiTeamId !== null && awayExternalId !== null && apiTeamId === awayExternalId
          ? input.match.away_team_id
            : null
      const playerName =
        event.player?.name?.trim() ||
        event.team?.name?.trim() ||
        event.detail ||
        event.type ||
        'Evento'
      const assistName = event.assist?.name ?? null
      const stableKey = formatMatchEventStableKey(
        {
          time: event.time ?? null,
          team: teamId !== null && teamId !== undefined
            ? {
                id: teamId,
              }
            : null,
          player: playerName
            ? {
                name: playerName,
              }
            : null,
          assist: assistName
            ? {
                name: assistName,
              }
            : null,
          type: event.type,
          detail: event.detail,
          comments: event.comments,
        },
        input.match.id
      )
      const semanticKey = formatMatchEventSemanticKey(
        {
          time: event.time ?? null,
          team: teamId !== null && teamId !== undefined
          ? {
              id: teamId,
            }
          : null,
          player: playerName
            ? {
                name: playerName,
              }
            : null,
          assist: assistName
            ? {
                name: assistName,
              }
            : null,
          type: event.type,
          detail: event.detail,
          comments: event.comments,
        },
        input.match.id
      )

      return {
        match_id: input.match.id,
        external_event_id: getEventExternalId(
          existingExternalIdByKey.get(semanticKey),
          stableKey,
          event
        ),
        team_id: teamId,
        player_name: playerName,
        assist_name: assistName,
        minute: event.time?.elapsed ?? null,
        extra_minute: event.time?.extra ?? null,
        type: event.type ?? 'Event',
        detail: event.detail ?? null,
        comments: event.comments ?? null,
      }
    })
  const rowsByKey = new Map<string, (typeof mappedRows)[number]>()

  for (const row of mappedRows) {
    const key = formatMatchEventSemanticKey(
      {
        time: {
          elapsed: row.minute as number | null,
          extra: row.extra_minute as number | null,
        },
        team: row.team_id !== null && row.team_id !== undefined
          ? {
              id: row.team_id as DbId,
            }
          : null,
        player: row.player_name
          ? {
              name: row.player_name as string,
            }
          : null,
        assist: row.assist_name
          ? {
              name: row.assist_name as string,
            }
          : null,
        type: row.type as string | null,
        detail: row.detail as string | null,
        comments: row.comments as string | null,
      },
      input.match.id
    )
    const current = rowsByKey.get(key)

    if (!current) {
      rowsByKey.set(key, row)
      continue
    }

    const currentHasRealExternalId =
      current.external_event_id &&
      !String(current.external_event_id).includes(':')
    const rowHasRealExternalId =
      row.external_event_id &&
      !String(row.external_event_id).includes(':')
    const currentScore = getStoredMatchEventCompletenessScore({
      id: null,
      external_event_id: current.external_event_id,
      match_id: current.match_id,
      team_id: current.team_id,
      player_name: current.player_name,
      assist_name: current.assist_name,
      minute: current.minute,
      extra_minute: current.extra_minute,
      type: current.type,
      detail: current.detail,
      comments: current.comments,
    })
    const rowScore = getStoredMatchEventCompletenessScore({
      id: null,
      external_event_id: row.external_event_id,
      match_id: row.match_id,
      team_id: row.team_id,
      player_name: row.player_name,
      assist_name: row.assist_name,
      minute: row.minute,
      extra_minute: row.extra_minute,
      type: row.type,
      detail: row.detail,
      comments: row.comments,
    })

    if (
      (!currentHasRealExternalId && rowHasRealExternalId) ||
      (currentHasRealExternalId === rowHasRealExternalId && rowScore > currentScore)
    ) {
      rowsByKey.set(key, row)
    }
  }

  const rows = [...rowsByKey.values()]

  if (!rows.length) return 0

  const existingNullIdsToDelete = remainingExistingRows
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
        comments: row.comments ?? null,
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
          comments: nextRow.comments as string | null,
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
    .select('fixture_payload, events, lineups, statistics')
    .eq('fixture_external_id', String(fixtureExternalId))
    .maybeSingle()

  if (response.error) {
    if (isMissingDetailFixturePayloadColumn(response.error)) {
      const legacyResponse = await supabase
        .from('football_match_detail_cache')
        .select('events, lineups, statistics')
        .eq('fixture_external_id', String(fixtureExternalId))
        .maybeSingle()

      if (legacyResponse.error) {
        if (isMissingOptionalTable(legacyResponse.error, 'football_match_detail_cache')) {
          return readFixtureCacheDetailByFixture(supabase, fixtureExternalId)
        }
        throw legacyResponse.error
      }

      const primary = (legacyResponse.data as DetailCacheRow | null) ?? null
      const fallback = await readFixtureCacheDetailByFixture(supabase, fixtureExternalId)

      return mergeDetailCacheRows(primary, fallback)
    }

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
    fixture_payload: detail.fixture,
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

function getFixtureDetailScore(fixturePayload: ApiFixtureDetail | null | undefined) {
  const home =
    toNumber(fixturePayload?.goals?.home) ??
    toNumber(fixturePayload?.score?.fulltime?.home)
  const away =
    toNumber(fixturePayload?.goals?.away) ??
    toNumber(fixturePayload?.score?.fulltime?.away)

  return {
    home,
    away,
    halftimeHome: toNumber(fixturePayload?.score?.halftime?.home),
    halftimeAway: toNumber(fixturePayload?.score?.halftime?.away),
    penaltyHome: toNumber(fixturePayload?.score?.penalty?.home),
    penaltyAway: toNumber(fixturePayload?.score?.penalty?.away),
  }
}

function cleanPatchText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getStoredStatusLong(status?: string | null) {
  const short = getCanonicalMatchStatusFromApi({ short: status ?? null }) ?? status

  if (short === 'NS') return 'Not Started'
  if (short === 'TBD') return 'Time to be defined'
  if (short === '1H') return 'First Half'
  if (short === 'HT') return 'Halftime'
  if (short === '2H') return 'Second Half'
  if (short === 'ET') return 'Extra Time'
  if (short === 'BT') return 'Break Time'
  if (short === 'P') return 'Penalty In Progress'
  if (short === 'FT') return 'Match Finished'
  if (short === 'AET') return 'Match Finished'
  if (short === 'PEN') return 'Match Finished'
  if (short === 'PST') return 'Match Postponed'
  if (short === 'CANC') return 'Match Cancelled'
  if (short === 'SUSP') return 'Match Suspended'
  if (short === 'INT') return 'Interrupted'

  return status ?? null
}

function buildMatchPatchFromFixtureDetail(fixturePayload: ApiFixtureDetail | null) {
  if (!fixturePayload?.fixture) return {}

  const status = getCanonicalMatchStatusFromApi(fixturePayload.fixture.status ?? null)
  const elapsed = getFixtureStatusElapsedMinute(fixturePayload.fixture.status ?? null)
  const score = getFixtureDetailScore(fixturePayload)
  const patch: Record<string, unknown> = {}

  if (fixturePayload.fixture.date) patch.match_date = fixturePayload.fixture.date
  if (status) patch.status = status
  if (elapsed !== null) patch.elapsed = elapsed
  if (isFinishedStatus(status) && elapsed !== null) patch.final_elapsed = elapsed
  if (score.home !== null) patch.home_score = score.home
  if (score.away !== null) patch.away_score = score.away
  if (score.penaltyHome !== null) patch.home_penalty_score = score.penaltyHome
  if (score.penaltyAway !== null) patch.away_penalty_score = score.penaltyAway

  const venueName = cleanPatchText(fixturePayload.fixture.venue?.name)
  const venueId = fixturePayload.fixture.venue?.id
  const venueCity = cleanPatchText(fixturePayload.fixture.venue?.city)
  const venueCountry =
    cleanPatchText(fixturePayload.fixture.venue?.country) ??
    cleanPatchText(fixturePayload.league?.country)
  const referee = cleanPatchText(fixturePayload.fixture.referee)
  const timezone = cleanPatchText(fixturePayload.fixture.timezone)

  if (venueName) patch.venue_name = venueName
  if (venueId !== null && venueId !== undefined && String(venueId).trim()) {
    patch.venue_id = String(venueId)
  }
  if (venueCity) patch.venue_city = venueCity
  if (venueCountry) patch.venue_country = venueCountry
  if (referee) patch.referee = referee
  if (timezone) patch.timezone = timezone

  return patch
}

function findMissingPatchColumn(
  error: { code?: string; message?: string } | null | undefined,
  patch: Record<string, unknown>
) {
  const message = (error?.message ?? '').toLowerCase()

  if (!(error?.code === '42703' || error?.code === 'PGRST204' || message.includes('schema cache'))) {
    return null
  }

  return Object.keys(patch).find((key) => message.includes(key.toLowerCase())) ?? null
}

async function updateStoredMatchFromFixtureDetail(
  supabase: SupabaseClient,
  match: StoredMatchRow | null,
  fixturePayload: ApiFixtureDetail | null,
  sections: SyncMatchDetailSections = {},
  controlColumns?: MatchDetailControlColumnStatus,
  options: { markFinalDetailSynced?: boolean; markLineupsSynced?: boolean } = {}
) {
  if (!match?.id) return false

  const patch = buildMatchPatchFromFixtureDetail(fixturePayload)
  const nowIso = new Date().toISOString()
  patch.detail_last_synced_at = nowIso

  if (options.markFinalDetailSynced) {
    patch.final_detail_synced_at = nowIso
  }

  if (sections.events) patch.last_events_synced_at = nowIso
  if (sections.statistics) patch.last_statistics_synced_at = nowIso
  if (sections.lineups && options.markLineupsSynced !== false) {
    patch.last_lineups_synced_at = nowIso
  }

  const optionalColumns = new Set([
    'final_elapsed',
    'home_penalty_score',
    'away_penalty_score',
    'venue_name',
    'venue_id',
    'venue_city',
    'venue_country',
    'timezone',
    'referee',
    'detail_last_synced_at',
    'last_events_synced_at',
    'last_statistics_synced_at',
    'last_lineups_synced_at',
    'final_detail_synced_at',
  ])
  const currentPatch = { ...patch }

  if (controlColumns) {
    for (const column of controlColumns.missing) {
      delete currentPatch[column]
    }
  }

  while (Object.keys(currentPatch).length > 0) {
    const response = await supabase
      .from('matches')
      .update(currentPatch)
      .eq('id', String(match.id))

    if (!response.error) return true

    const missingColumn = findMissingPatchColumn(response.error, currentPatch)

    if (missingColumn && optionalColumns.has(missingColumn)) {
      delete currentPatch[missingColumn]
      continue
    }

    const removableOptionalColumns = Object.keys(currentPatch).filter((key) => optionalColumns.has(key))

    if (
      removableOptionalColumns.length &&
      (
        response.error.code === '42703' ||
        response.error.code === 'PGRST204' ||
        response.error.message.toLowerCase().includes('schema cache')
      )
    ) {
      for (const key of removableOptionalColumns) delete currentPatch[key]
      continue
    }

    throw response.error
  }

  return false
}

function countLineupPlayers(lineup: unknown, key: 'startXI' | 'substitutes') {
  if (!lineup || typeof lineup !== 'object') return 0
  const players = (lineup as Record<string, unknown>)[key]

  return Array.isArray(players) ? players.length : 0
}

function countApiLineupPlayers(lineups: unknown[]): number {
  return lineups.reduce<number>(
    (sum, lineup) =>
      sum +
      countLineupPlayers(lineup, 'startXI') +
      countLineupPlayers(lineup, 'substitutes'),
    0
  )
}

function countApiStatisticsValues(statistics: unknown[]): number {
  return statistics.reduce<number>((sum, entry) => {
    const record = asRecord(entry)
    const values = asArray(record?.statistics)

    return sum + values.length
  }, 0)
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

function normalizeBroadcastTrustText(value?: string | number | null) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function isTrustedStoredBroadcaster(row: StoredMatchBroadcasterRow) {
  return (
    row.verified === true &&
    (
      ['manual', 'verified_rule', 'official', 'provider', 'provider_suggestion_approved'].includes(normalizeBroadcastTrustText(row.source)) ||
      normalizeBroadcastTrustText(row.confidence) === 'high'
    )
  )
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
  return formatMatchEventSemanticKey(toAuditEventLike(event))
}

function mergeAuditEvents(primary: unknown[], fallback: unknown[]) {
  const merged = new Map<string, unknown>()
  const addUnique = (event: unknown) => {
    merged.set(getAuditEventMergeKey(event), event)
  }

  if (!primary.length || fallback.length >= primary.length) {
    for (const event of fallback) addUnique(event)

    return [...merged.values()]
  }

  for (const event of fallback) {
    addUnique(event)
  }

  for (const event of primary) {
    addUnique(event)
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

async function fetchStoredMatchInfoRow(
  supabase: SupabaseClient,
  matchId: DbId | null | undefined
) {
  if (matchId === null || matchId === undefined) return null

  const selectBase =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, status, elapsed, home_score, away_score'
  const selectOptional =
    `${selectBase}, final_elapsed, venue_name, venue_id, venue_city, venue_country, timezone, broadcast_channel, broadcast_logo_url, highlights_url, highlights_title, referee`

  let response = await supabase
    .from('matches')
    .select(selectOptional)
    .eq('id', String(matchId))
    .maybeSingle()

  if (
    response.error &&
    (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('schema cache')
    )
  ) {
    response = await supabase
      .from('matches')
      .select(selectBase)
      .eq('id', String(matchId))
      .maybeSingle()
  }

  if (response.error) throw response.error

  return (response.data as StoredMatchAuditRow | null) ?? null
}

async function fetchAuditBroadcasters(
  supabase: SupabaseClient,
  matchId: DbId | null | undefined
) {
  if (matchId === null || matchId === undefined) return []

  const response = await supabase
    .from('match_broadcasts')
    .select('broadcaster_name, broadcaster_logo_url, country, source, confidence, verified')
    .eq('match_id', String(matchId))
    .order('broadcaster_name', { ascending: true })

  if (response.error) {
    const message = response.error.message?.toLowerCase() ?? ''
    const isMissingTrustColumns =
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      message.includes('source') ||
      message.includes('confidence') ||
      message.includes('verified') ||
      message.includes('schema cache')

    if (isMissingTrustColumns) {
      const fallback = await supabase
        .from('match_broadcasts')
        .select('broadcaster_name, broadcaster_logo_url, country')
        .eq('match_id', String(matchId))
        .order('broadcaster_name', { ascending: true })

      if (fallback.error) {
        if (isMissingOptionalTable(fallback.error, 'match_broadcasts')) return []
        throw fallback.error
      }

      return ((fallback.data ?? []) as StoredMatchBroadcasterRow[]).filter(isTrustedStoredBroadcaster)
    }

    if (isMissingOptionalTable(response.error, 'match_broadcasts')) return []
    throw response.error
  }

  return ((response.data ?? []) as StoredMatchBroadcasterRow[]).filter(isTrustedStoredBroadcaster)
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

function buildEventsByRawType(events: unknown[]) {
  return events.reduce<Record<string, number>>((accumulator, event) => {
    const eventLike = toAuditEventLike(event)
    const key = [
      eventLike.type || 'Event',
      eventLike.detail || null,
    ].filter(Boolean).join(' / ')

    accumulator[key] = (accumulator[key] ?? 0) + 1
    return accumulator
  }, {})
}

function countEventsByKind(events: unknown[]) {
  const summary = {
    total: events.length,
    byType: buildEventsByRawType(events),
    goals: 0,
    cards: 0,
    penalties: 0,
    missedPenalties: 0,
    ownGoals: 0,
    yellowCards: 0,
    redCards: 0,
    secondYellowCards: 0,
    substitutions: 0,
    varEvents: 0,
    cancelledGoals: 0,
    cancelledCards: 0,
    injuries: 0,
    yellowCardsHome: 0,
    yellowCardsAway: 0,
    redCardsHome: 0,
    redCardsAway: 0,
    rawSamples: events.slice(0, 8).map(toAuditEvent),
  }

  return summary
}

function isCancelledGoalAuditKind(event: unknown) {
  const eventLike = toAuditEventLike(event)
  const text = normalizeFootballEventText([
    eventLike.type,
    eventLike.detail,
    eventLike.comments,
  ].join(' '))

  return (
    text.includes('goal cancelled') ||
    text.includes('goal canceled') ||
    text.includes('goal disallowed') ||
    text.includes('disallowed goal')
  )
}

function isCancelledCardAuditKind(event: unknown) {
  const eventLike = toAuditEventLike(event)
  const text = normalizeFootballEventText([
    eventLike.type,
    eventLike.detail,
    eventLike.comments,
  ].join(' '))

  return (
    text.includes('card cancelled') ||
    text.includes('card canceled') ||
    text.includes('red card cancelled') ||
    text.includes('yellow card cancelled')
  )
}

function buildMergedStatisticsAudit(input: {
  statistics: unknown[]
  events: unknown[]
  match: StoredMatchRow | null
  teamsById: Map<string, StoredTeamRow>
}) {
  const homeTeam = input.match?.home_team_id !== null && input.match?.home_team_id !== undefined
    ? input.teamsById.get(String(input.match.home_team_id))
    : null
  const awayTeam = input.match?.away_team_id !== null && input.match?.away_team_id !== undefined
    ? input.teamsById.get(String(input.match.away_team_id))
    : null

  if (!homeTeam || !awayTeam) return []

  return normalizeMatchStatistics(
    input.statistics as Array<{
      team?: { id?: number | string | null; name?: string | null } | null
      statistics?: Array<{ type?: string | null; value?: string | number | null }> | null
    }>,
    {
      id: homeTeam.external_id ?? homeTeam.id,
      name: homeTeam.name,
    },
    {
      id: awayTeam.external_id ?? awayTeam.id,
      name: awayTeam.name,
    },
    input.events as Array<{
      team?: { id?: number | string | null; name?: string | null } | null
      type?: string | null
      detail?: string | null
      comments?: string | null
    }>
  )
}

function buildMissingExpectedStats(statisticsNames: string[]) {
  const normalizedNames = new Set(statisticsNames.map(normalizeFootballEventText))
  const expected = [
    'Ball Possession',
    'Total Shots',
    'Shots on Goal',
    'Shots off Goal',
    'Corner Kicks',
    'Fouls',
    'Offsides',
    'Yellow Cards',
    'Red Cards',
  ]

  return expected.filter((name) => !normalizedNames.has(normalizeFootballEventText(name)))
}

function readCachedFixturePayload(cache: DetailCacheRow | null) {
  return asRecord(cache?.fixture_payload) as ApiFixtureDetail | null
}

function buildMatchAuditInfo(input: {
  match: StoredMatchRow | null
  matchInfo: StoredMatchAuditRow | null
  league: StoredLeagueRow | null
  teamsById: Map<string, StoredTeamRow>
  fixturePayload: ApiFixtureDetail | null
}) {
  const homeTeam = input.match?.home_team_id !== null && input.match?.home_team_id !== undefined
    ? input.teamsById.get(String(input.match.home_team_id))
    : null
  const awayTeam = input.match?.away_team_id !== null && input.match?.away_team_id !== undefined
    ? input.teamsById.get(String(input.match.away_team_id))
    : null
  const fixture = input.fixturePayload?.fixture
  const status = fixture?.status ?? null
  const storedStatus = input.matchInfo?.status ?? null

  return {
    id: input.match?.id ?? null,
    external_id:
      input.match?.external_id ??
      input.fixturePayload?.fixture?.id ??
      null,
    league: {
      id: input.league?.id ?? input.match?.league_id ?? null,
      external_id: input.league?.external_id ?? input.fixturePayload?.league?.id ?? null,
      name: input.league?.name ?? input.fixturePayload?.league?.name ?? null,
      country: input.fixturePayload?.league?.country ?? null,
      season: input.league?.season ?? input.fixturePayload?.league?.season ?? null,
    },
    home: {
      id: input.match?.home_team_id ?? null,
      external_id: homeTeam?.external_id ?? null,
      name: homeTeam?.name ?? null,
    },
    away: {
      id: input.match?.away_team_id ?? null,
      external_id: awayTeam?.external_id ?? null,
      name: awayTeam?.name ?? null,
    },
    status: storedStatus ?? status?.short ?? null,
    statusLong:
      (storedStatus ? getStoredStatusLong(storedStatus) : null) ??
      status?.long ??
      null,
    elapsed:
      input.matchInfo?.final_elapsed ??
      input.matchInfo?.elapsed ??
      getFixtureStatusElapsedMinute(status) ??
      null,
    final_elapsed: input.matchInfo?.final_elapsed ?? null,
    match_date: fixture?.date ?? input.matchInfo?.match_date ?? null,
    stadium:
      cleanPatchText(fixture?.venue?.name) ??
      cleanPatchText(input.matchInfo?.venue_name),
    venueId:
      fixture?.venue?.id !== null && fixture?.venue?.id !== undefined && String(fixture.venue.id).trim()
        ? String(fixture.venue.id)
        : cleanPatchText(input.matchInfo?.venue_id),
    venueCity:
      cleanPatchText(fixture?.venue?.city) ??
      cleanPatchText(input.matchInfo?.venue_city),
    venueCountry:
      cleanPatchText(fixture?.venue?.country) ??
      cleanPatchText(input.matchInfo?.venue_country),
    timezone:
      cleanPatchText(fixture?.timezone) ??
      cleanPatchText(input.matchInfo?.timezone),
    referee:
      cleanPatchText(fixture?.referee) ??
      cleanPatchText(input.matchInfo?.referee),
  }
}

function buildRenderReadiness(input: {
  snapshot: MatchDetailAuditSnapshot
  matchInfo: ReturnType<typeof buildMatchAuditInfo>
  broadcasters: StoredMatchBroadcasterRow[]
  cache: DetailCacheRow | null
}) {
  const statistics = asArray(input.cache?.statistics)
  const lineups = asArray(input.cache?.lineups)

  return {
    canRenderTimeline: input.snapshot.hasEvents,
    canRenderStats: input.snapshot.hasStatistics,
    canRenderPitch: lineups.some((lineup) => countLineupPlayers(lineup, 'startXI') > 0),
    canRenderLineupLists: lineups.some((lineup) => (
      countLineupPlayers(lineup, 'startXI') > 0 ||
      countLineupPlayers(lineup, 'substitutes') > 0
    )),
    canRenderMatchInfo: Boolean(
      input.matchInfo.match_date ||
      input.matchInfo.status ||
      input.matchInfo.stadium ||
      input.matchInfo.referee ||
      input.broadcasters.length
    ),
    canRenderPartialStats: statistics.length > 0,
  }
}

function buildDetailedAuditSections(input: {
  cache: DetailCacheRow | null
  events: unknown[]
  match: StoredMatchRow | null
  teamsById: Map<string, StoredTeamRow>
}) {
  const statistics = asArray(input.cache?.statistics)
  const lineups = asArray(input.cache?.lineups)
  const eventSummary = countEventsByKind(input.events)

  for (const event of input.events) {
    const kind = getAuditEventKind(event)
    const side = getAuditTeamSide(event, input.match, input.teamsById)

    if (kind === 'goal' || kind === 'penalty-goal' || kind === 'own-goal') {
      eventSummary.goals += 1
    }
    if (kind === 'penalty' || kind === 'penalty-goal') eventSummary.penalties += 1
    if (kind === 'own-goal') eventSummary.ownGoals += 1
    if (kind === 'yellow-card') {
      eventSummary.cards += 1
      eventSummary.yellowCards += 1
      if (side === 'home') eventSummary.yellowCardsHome += 1
      if (side === 'away') eventSummary.yellowCardsAway += 1
    }
    if (kind === 'red-card' || kind === 'second-yellow') {
      eventSummary.cards += 1
      if (kind === 'second-yellow') eventSummary.secondYellowCards += 1
      else eventSummary.redCards += 1
      if (side === 'home') eventSummary.redCardsHome += 1
      if (side === 'away') eventSummary.redCardsAway += 1
    }
    if (kind === 'substitution') eventSummary.substitutions += 1
    if (kind === 'var') eventSummary.varEvents += 1
    if (kind === 'penalty-missed') eventSummary.missedPenalties += 1
    if (kind === 'injury') eventSummary.injuries += 1
    if (isCancelledGoalAuditKind(event)) eventSummary.cancelledGoals += 1
    if (isCancelledCardAuditKind(event)) eventSummary.cancelledCards += 1
  }

  const official = getOfficialDisciplineStats(statistics)
  const statisticsNames = buildStatisticsNames(statistics)
  const mergedStats = buildMergedStatisticsAudit({
    statistics,
    events: input.events,
    match: input.match,
    teamsById: input.teamsById,
  })
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
        names: statisticsNames,
        discipline: official,
      },
      hasOfficialStats: statistics.length > 0,
      officialStatsCount: statistics.reduce((sum, entry) => {
        const values = asArray(asRecord(entry)?.statistics)
        return sum + values.length
      }, 0),
      officialStatsNames: statisticsNames,
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
      mergedStats,
      mismatches,
      missingExpectedStats: buildMissingExpectedStats(statisticsNames),
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

  const [cache, storedEventRows, teamsById, matchInfo, league, broadcasters] = await Promise.all([
    readDetailCacheByFixture(supabase, fixtureExternalId),
    fetchStoredMatchEventRows(supabase, match?.id),
    match
      ? fetchStoredTeamsByIds(supabase, [match.home_team_id, match.away_team_id])
      : Promise.resolve(new Map<string, StoredTeamRow>()),
    fetchStoredMatchInfoRow(supabase, match?.id),
    fetchStoredLeagueById(supabase, match?.league_id),
    fetchAuditBroadcasters(supabase, match?.id),
  ])
  const storedEvents = storedEventRows.map((event) => mapStoredAuditEvent(event, teamsById))
  const mergedEvents = mergeAuditEvents(asArray(cache?.events), storedEvents)
  const dbCounts = getCacheDetailCounts(cache, mergedEvents)
  const renderCounts = buildRenderCounts({
    cache,
    events: mergedEvents,
    match,
    teamsById,
  })
  const renderStatus = getRenderStatus({
    matchStatus: matchInfo?.status ?? null,
    dbCounts,
    renderCounts,
  })
  const detailedSections = buildDetailedAuditSections({
    cache,
    events: mergedEvents,
    match,
    teamsById,
  })
  const snapshot = buildAuditSnapshot(cache, mergedEvents)
  const fixturePayload = readCachedFixturePayload(cache)
  const matchAuditInfo = buildMatchAuditInfo({
    match,
    matchInfo,
    league,
    teamsById,
    fixturePayload,
  })
  const highlightUrl =
    cleanPatchText(matchInfo?.highlights_url) ??
    cleanPatchText(asRecord(cache?.fixture_payload)?.highlights_url)
  const highlightTitle =
    cleanPatchText(matchInfo?.highlights_title) ??
    cleanPatchText(asRecord(cache?.fixture_payload)?.highlights_title)
  const missingSections = [...snapshot.missingSections]

  if (!matchAuditInfo.stadium) missingSections.push('stadium')
  if (!matchAuditInfo.referee) missingSections.push('referee')
  if (!broadcasters.length) missingSections.push('tv')

  return {
    fixtureExternalId,
    matchId: match?.id ?? null,
    match: matchAuditInfo,
    ...snapshot,
    ...detailedSections,
    broadcasts: {
      hasTv: broadcasters.length > 0,
      broadcasters: broadcasters.map((broadcaster) => ({
        name: broadcaster.broadcaster_name ?? null,
        logoUrl: broadcaster.broadcaster_logo_url ?? null,
        country: broadcaster.country ?? null,
        source: broadcaster.source ?? null,
        confidence: broadcaster.confidence ?? null,
        verified: broadcaster.verified ?? null,
      })),
    },
    highlights: {
      hasHighlights: Boolean(highlightUrl),
      url: highlightUrl,
      title: highlightTitle,
    },
    dbCounts,
    renderCounts,
    renderStatus,
    renderReadiness: buildRenderReadiness({
      snapshot,
      matchInfo: matchAuditInfo,
      broadcasters,
      cache,
    }),
    missingSections: [...new Set(missingSections)],
    warnings: [
      ...snapshot.warnings,
      ...(!matchAuditInfo.stadium ? ['No hay estadio disponible para renderizar.'] : []),
      ...(!matchAuditInfo.referee ? ['No hay arbitro disponible para renderizar.'] : []),
    ],
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
    includeProvider?: boolean
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
    let providerCounts: MatchDetailCounts | null = null
    if (input.includeProvider && isDetailRequiredForStatus(match.status)) {
      try {
        providerCounts = await fetchMatchDetailProviderCounts(fixtureExternalId)
      } catch (error) {
        const serialized = serializeError(error, 'api-football')
        warnings.push(
          `No se pudo consultar provider para fixture ${fixtureExternalId}: ${serialized.message}`
        )
      }
    }
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
    const detailAuditRecord = detailAudit as Record<string, unknown>
    const detailedEvents = asRecord(detailAuditRecord.events)
    const detailedStatistics = asRecord(detailAuditRecord.statistics)
    const substitutionsCount = toNumber(detailedEvents?.substitutions) ?? 0
    const statisticsMismatches = asArray(detailedStatistics?.mismatches)
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
      hasEvents: snapshot.hasEvents,
      eventsCount: snapshot.eventsCount,
      hasSubstitutions: snapshot.hasSubstitutions || substitutionsCount > 0,
      substitutionsCount,
      hasVarEvents: snapshot.hasVarEvents,
      hasMissedPenalty: snapshot.hasMissedPenalty,
      hasLineups: snapshot.hasLineups,
      homeStartersCount: snapshot.homeStartersCount,
      awayStartersCount: snapshot.awayStartersCount,
      homeSubstitutesCount: snapshot.homeSubstitutesCount,
      awaySubstitutesCount: snapshot.awaySubstitutesCount,
      hasCaptainData: snapshot.hasCaptainData,
      hasStatistics: snapshot.hasStatistics,
      statisticsCount: snapshot.statisticsCount,
      statisticsMismatches,
      providerCounts,
      dbCounts: (detailAudit as { dbCounts?: MatchDetailCounts }).dbCounts ?? getDetailCounts(snapshot),
      renderCounts:
        (detailAudit as { renderCounts?: MatchDetailRenderCounts }).renderCounts ??
        getEmptyRenderCounts(),
      renderStatus:
        (detailAudit as { renderStatus?: MatchDetailRenderStatus }).renderStatus ??
        'not-renderable',
      missingSections: snapshot.missingSections,
      warnings: snapshot.warnings,
      completenessScore: getCompletenessScore(snapshot, requiresDetail),
      missingRequiredSections,
      syncRecommended,
      syncUrl: syncRecommended
        ? `/api/admin/sync-match-detail?fixture=${fixtureExternalId}`
        : null,
    }

    if (
      !input.missingOnly ||
      item.missingRequiredSections.length > 0 ||
      item.statisticsMismatches.length > 0
    ) {
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
      includeProvider: Boolean(input.includeProvider),
    },
    summary,
    examplesMissing: items
      .filter((item) => item.missingRequiredSections.length > 0)
      .slice(0, 20),
    items,
    warnings,
  }
}

const BULK_SYNC_DEFAULT_LIMIT = 25
const BULK_SYNC_MAX_LIMIT = 100
const BULK_LIVE_STATUSES = ['LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'IN_PLAY']
const BULK_FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'Finished', 'Match Finished']
const MATCH_DETAIL_CONTROL_COLUMNS = [
  'last_events_synced_at',
  'last_statistics_synced_at',
  'last_lineups_synced_at',
  'detail_last_synced_at',
  'final_detail_synced_at',
] as const

type MatchDetailControlColumn = (typeof MATCH_DETAIL_CONTROL_COLUMNS)[number]
type MatchDetailControlColumnStatus = {
  available: Set<string>
  missing: MatchDetailControlColumn[]
}

function isMissingColumnSchemaError(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('column')
  )
}

async function detectMatchDetailControlColumns(
  supabase: SupabaseClient
): Promise<MatchDetailControlColumnStatus> {
  const available = new Set<string>(MATCH_DETAIL_CONTROL_COLUMNS)
  const response = await supabase
    .from('matches')
    .select(MATCH_DETAIL_CONTROL_COLUMNS.join(', '))
    .limit(1)

  if (!response.error) {
    return { available, missing: [] }
  }

  if (isMissingColumnSchemaError(response.error)) {
    // These columns are added by migrations and are only used as sync metadata.
    // When PostgREST has stale schema cache it can report them as unavailable even
    // though they already exist in Postgres. Keep the endpoint optimistic and let
    // the update path retry without optional columns if the REST API rejects them.
    return { available, missing: [] }
  }

  throw response.error
}

function clampBulkLimit(limit: number | null | undefined) {
  if (!Number.isFinite(limit ?? NaN) || !limit || limit <= 0) return BULK_SYNC_DEFAULT_LIMIT

  return Math.min(Math.floor(limit), BULK_SYNC_MAX_LIMIT)
}

function clampBulkLookbackDays(days: number | null | undefined) {
  if (!Number.isFinite(days ?? NaN) || days === null || days === undefined || days < 0) return null

  return Math.min(Math.floor(days), 365)
}

function normalizeBulkStatuses(input?: string[] | null) {
  return (input ?? [])
    .flatMap((status) => String(status).split(','))
    .map((status) => status.trim())
    .filter(Boolean)
}

function buildBulkDateRange(input: SyncMatchDetailsBulkOptions, now: Date) {
  if (input.date) {
    const range = getArgentinaDayUtcRange(input.date)
    return {
      dateFrom: range.startUtc,
      dateTo: range.endUtc,
    }
  }

  if (input.dateFrom || input.dateTo) {
    const fromRange = input.dateFrom ? getArgentinaDayUtcRange(input.dateFrom) : null
    const toRange = input.dateTo ? getArgentinaDayUtcRange(input.dateTo) : null

    return {
      dateFrom: fromRange?.startUtc ?? null,
      dateTo: toRange?.endUtc ?? null,
    }
  }

  if (input.recentFinishedOnly) {
    return {
      dateFrom: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      dateTo: now.toISOString(),
    }
  }

  if (input.futureDays !== null && input.futureDays !== undefined) {
    const days = Math.min(Math.max(Math.floor(input.futureDays), 0), 30)
    return {
      dateFrom: now.toISOString(),
      dateTo: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  const lookbackDays = clampBulkLookbackDays(input.lookbackDays)
  if (lookbackDays !== null) {
    const today = getArgentinaDateISO(now)
    const dateFrom = addDaysToISO(today, -lookbackDays)
    const tomorrow = addDaysToISO(today, 1)

    return {
      dateFrom: getArgentinaDayUtcRange(dateFrom).startUtc,
      dateTo: getArgentinaDayUtcRange(tomorrow).endUtc,
    }
  }

  if (input.liveOnly) {
    return {
      dateFrom: null,
      dateTo: null,
    }
  }

  const today = getArgentinaDateISO(now)
  const yesterday = addDaysToISO(today, -1)
  const tomorrow = addDaysToISO(today, 1)

  return {
    dateFrom: getArgentinaDayUtcRange(yesterday).startUtc,
    dateTo: getArgentinaDayUtcRange(tomorrow).endUtc,
  }
}

function getBulkStatuses(input: SyncMatchDetailsBulkOptions) {
  const explicit = normalizeBulkStatuses(input.statuses)
  if (explicit.length) return explicit
  if (input.liveOnly) return BULK_LIVE_STATUSES
  if (input.recentFinishedOnly) return BULK_FINISHED_STATUSES

  return []
}

async function fetchBulkMatchCandidates(
  supabase: SupabaseClient,
  input: SyncMatchDetailsBulkOptions,
  now: Date,
  limit: number,
  controlColumns?: MatchDetailControlColumnStatus
) {
  const range = buildBulkDateRange(input, now)
  const statuses = getBulkStatuses(input)
  const requestedLimit = input.missingDetailsOnly ? Math.min(Math.max(limit * 10, 500), 1_000) : limit
  const orderAscending = Boolean(input.futureDays !== null && input.futureDays !== undefined)
  const selectBase =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, status, elapsed, home_score, away_score'
  const optionalSelectColumns = ['detail_last_synced_at', 'final_detail_synced_at']
    .filter((column) => !controlColumns || controlColumns.available.has(column))
  const selectOptional = [selectBase, ...optionalSelectColumns].join(', ')

  let query = supabase
    .from('matches')
    .select(selectOptional)
    .not('external_id', 'is', null)
    .order('match_date', { ascending: orderAscending, nullsFirst: false })
    .limit(requestedLimit)

  if (range.dateFrom) query = query.gte('match_date', range.dateFrom)
  if (range.dateTo) query = query.lte('match_date', range.dateTo)
  if (statuses.length) query = query.in('status', statuses)

  if (input.leagueExternalId) {
    const leagueIds = await fetchAuditLeagueRowsByExternalId(supabase, input.leagueExternalId)
    if (!leagueIds.length) return { rows: [], range, statuses }
    query = query.in('league_id', leagueIds)
  }

  let response: {
    data: unknown
    error: { code?: string; message: string } | null
  } = await query

  if (
    response.error &&
    (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('schema cache')
    )
  ) {
    let fallbackQuery = supabase
      .from('matches')
      .select(selectBase)
      .not('external_id', 'is', null)
      .order('match_date', { ascending: orderAscending, nullsFirst: false })
      .limit(requestedLimit)

    if (range.dateFrom) fallbackQuery = fallbackQuery.gte('match_date', range.dateFrom)
    if (range.dateTo) fallbackQuery = fallbackQuery.lte('match_date', range.dateTo)
    if (statuses.length) fallbackQuery = fallbackQuery.in('status', statuses)

    if (input.leagueExternalId) {
      const leagueIds = await fetchAuditLeagueRowsByExternalId(supabase, input.leagueExternalId)
      if (!leagueIds.length) return { rows: [], range, statuses }
      fallbackQuery = fallbackQuery.in('league_id', leagueIds)
    }

    response = await fallbackQuery
  }

  if (response.error) throw response.error

  return {
    rows: (response.data ?? []) as StoredMatchBulkRow[],
    range,
    statuses,
  }
}

function minutesUntilBulk(matchDate: string | null | undefined, now: Date) {
  if (!matchDate) return null
  const timestamp = new Date(matchDate).getTime()
  if (!Number.isFinite(timestamp)) return null

  return Math.round((timestamp - now.getTime()) / 60_000)
}

function isRecentlyFinishedCandidate(match: StoredMatchBulkRow, now: Date) {
  if (!isFinishedStatus(match.status)) return false
  if (!match.match_date) return false

  const timestamp = new Date(match.match_date).getTime()
  if (!Number.isFinite(timestamp)) return false

  return now.getTime() - timestamp <= 3 * 60 * 60 * 1000
}

function getBulkSyncReasons(match: StoredMatchBulkRow, input: SyncMatchDetailsBulkOptions, now: Date) {
  const reasons = new Set<string>()
  if (input.force) reasons.add('force')
  if (input.missingDetailsOnly) reasons.add('missing-details')
  if (isLiveStatus(match.status)) reasons.add('live')
  if (isRecentlyFinishedCandidate(match, now)) reasons.add('recently-finished')
  if (isFinishedStatus(match.status)) reasons.add('finished')
  if (isUpcomingStatus(match.status)) reasons.add('future')
  if (input.date || input.dateFrom || input.dateTo) reasons.add('date-range')
  if (input.leagueExternalId) reasons.add('league')

  const kickoff = minutesUntilBulk(match.match_date, now)
  if (kickoff !== null && kickoff <= 90 && kickoff >= -10) reasons.add('lineup-window')

  return [...reasons]
}

function getBulkSyncPlan(match: StoredMatchBulkRow, input: SyncMatchDetailsBulkOptions, now: Date) {
  const force = Boolean(input.force)
  const status = match.status
  const kickoff = minutesUntilBulk(match.match_date, now)
  const started = isLiveStatus(status) || isFinishedStatus(status)
  const nearKickoff = kickoff !== null && kickoff <= 90 && kickoff >= -10
  const finalAlreadySynced = Boolean(match.final_detail_synced_at) && isFinishedStatus(status)

  if (!force && finalAlreadySynced && !input.missingDetailsOnly) {
    return {
      skipReason: 'final_detail_synced',
      plan: {
        fixture: false,
        events: false,
        lineups: false,
        statistics: false,
      },
    }
  }

  if (!force && !started && !nearKickoff) {
    return {
      skipReason: null,
      plan: {
        fixture: true,
        events: false,
        lineups: false,
        statistics: false,
      },
    }
  }

  return {
    skipReason: null,
    plan: {
      fixture: true,
      events: started || force,
      lineups: started || nearKickoff || force,
      statistics: started || force,
    },
  }
}

function countPlannedRequests(plan: SyncMatchDetailsBulkItem['plan']) {
  return Number(plan.fixture) + Number(plan.events) + Number(plan.lineups) + Number(plan.statistics)
}

function getLineupPlayersCount(snapshot: MatchDetailAuditSnapshot) {
  return (
    snapshot.lineupsHomeCount +
    snapshot.lineupsAwayCount +
    snapshot.substitutesHomeCount +
    snapshot.substitutesAwayCount
  )
}

function getDetailCounts(snapshot: MatchDetailAuditSnapshot): SyncMatchDetailsCounts {
  return {
    events: snapshot.eventsCount,
    lineups: getLineupPlayersCount(snapshot),
    statistics: snapshot.statisticsCount,
  }
}

function getCacheDetailCounts(cache: DetailCacheRow | null, events: unknown[] = asArray(cache?.events)): MatchDetailCounts {
  const lineups = asArray(cache?.lineups)

  return {
    events: events.length,
    lineups: countApiLineupPlayers(lineups),
    statistics: countApiStatisticsValues(asArray(cache?.statistics)),
  }
}

function getRenderTeamRef(
  teamsById: Map<string, StoredTeamRow>,
  teamId: DbId | null | undefined
) {
  const team = teamId !== null && teamId !== undefined ? teamsById.get(String(teamId)) : null

  return {
    id: team?.external_id ?? teamId ?? null,
    name: team?.name ?? null,
  }
}

function buildRenderCounts(input: {
  cache: DetailCacheRow | null
  events: unknown[]
  match: StoredMatchRow | null
  teamsById: Map<string, StoredTeamRow>
}): MatchDetailRenderCounts {
  const lineups = asArray(input.cache?.lineups)
  const startersCount = lineups.reduce(
    (sum, lineup) => sum + countLineupPlayers(lineup, 'startXI'),
    0
  )
  const substitutesCount = lineups.reduce(
    (sum, lineup) => sum + countLineupPlayers(lineup, 'substitutes'),
    0
  )
  const homeTeam = getRenderTeamRef(input.teamsById, input.match?.home_team_id)
  const awayTeam = getRenderTeamRef(input.teamsById, input.match?.away_team_id)
  const statisticsRows =
    input.match && homeTeam.name && awayTeam.name
      ? normalizeMatchStatistics(
          asArray(input.cache?.statistics) as Parameters<typeof normalizeMatchStatistics>[0],
          homeTeam,
          awayTeam,
          input.events as Parameters<typeof normalizeMatchStatistics>[3]
        ).length
      : countApiStatisticsValues(asArray(input.cache?.statistics))

  return {
    timelineEvents: getTimelineEvents(input.events as Parameters<typeof getTimelineEvents>[0]).length,
    formationPlayers: startersCount,
    statisticsRows,
    startersCount,
    substitutesCount,
  }
}

function getRenderStatus(input: {
  matchStatus?: string | null
  dbCounts: MatchDetailCounts
  renderCounts: MatchDetailRenderCounts
}): MatchDetailRenderStatus {
  const { matchStatus, dbCounts, renderCounts } = input
  const fixtureOnlyFuture =
    isUpcomingStatus(matchStatus) &&
    dbCounts.events === 0 &&
    dbCounts.lineups === 0 &&
    dbCounts.statistics === 0

  if (fixtureOnlyFuture) return 'future-no-details-yet'

  const hasRenderProblem =
    (dbCounts.events > 0 && renderCounts.timelineEvents === 0) ||
    (dbCounts.lineups > 0 && renderCounts.formationPlayers === 0) ||
    (dbCounts.statistics > 0 && renderCounts.statisticsRows === 0)

  if (hasRenderProblem) return 'render-problem'

  if (
    dbCounts.events > 0 &&
    dbCounts.lineups > 0 &&
    dbCounts.statistics > 0 &&
    renderCounts.timelineEvents > 0 &&
    renderCounts.formationPlayers > 0 &&
    renderCounts.statisticsRows > 0
  ) {
    return 'ready'
  }

  if (
    renderCounts.timelineEvents > 0 ||
    renderCounts.formationPlayers > 0 ||
    renderCounts.statisticsRows > 0
  ) {
    return 'partial'
  }

  return 'not-renderable'
}

function getRenderProblemWarnings(
  dbCounts: MatchDetailCounts,
  renderCounts: MatchDetailRenderCounts
) {
  return [
    dbCounts.events > 0 && renderCounts.timelineEvents === 0
      ? 'DB tiene eventos pero el mapper de cronologia devuelve 0.'
      : null,
    dbCounts.lineups > 0 && renderCounts.formationPlayers === 0
      ? 'DB tiene formaciones pero el mapper de cancha/listas devuelve 0 jugadores.'
      : null,
    dbCounts.statistics > 0 && renderCounts.statisticsRows === 0
      ? 'DB tiene estadisticas pero el normalizador devuelve 0 filas.'
      : null,
  ].filter((warning): warning is string => Boolean(warning))
}

function getEmptyDetailCounts(): SyncMatchDetailsCounts {
  return {
    events: 0,
    lineups: 0,
    statistics: 0,
  }
}

function getEmptyRenderCounts(): MatchDetailRenderCounts {
  return {
    timelineEvents: 0,
    formationPlayers: 0,
    statisticsRows: 0,
    startersCount: 0,
    substitutesCount: 0,
  }
}

function getProviderCounts(result: SyncMatchDetailResult): SyncMatchDetailsCounts {
  return {
    events: result.fetched.events,
    lineups: result.fetched.lineups,
    statistics: result.fetched.statistics,
  }
}

function hasUsableProviderLineups(count: number) {
  // API-Football can return two team-level lineup shells with no players.
  // Those are not renderable lineups and must not become persistence failures.
  return count > 2
}

function hasUsableProviderStatistics(count: number) {
  // Same idea as lineups: two team shells with empty statistics are not usable data.
  return count > 2
}

function getBulkDataStatus(input: {
  match: StoredMatchBulkRow
  plan: SyncMatchDetailsBulkItem['plan']
  after: SyncMatchDetailsCounts
}): SyncMatchDetailsDataStatus {
  const { match, plan, after } = input
  const started = isLiveStatus(match.status) || isFinishedStatus(match.status)
  const fixtureOnly = plan.fixture && !plan.events && !plan.lineups && !plan.statistics

  if (!started && fixtureOnly) return 'future-no-details-yet'
  if (after.events > 0 && after.lineups > 0 && after.statistics > 0) return 'complete'
  if (after.events > 0 || after.lineups > 0 || after.statistics > 0) return 'partial'

  return 'missing'
}

function getProviderStatus(input: {
  plan: SyncMatchDetailsBulkItem['plan']
  providerCounts: SyncMatchDetailsCounts
  dbCountsAfter: SyncMatchDetailsCounts
  hasErrors: boolean
}): SyncMatchDetailsProviderStatus {
  const { plan, providerCounts, dbCountsAfter, hasErrors } = input
  if (hasErrors) return 'error'

  const requestedDetails = plan.events || plan.lineups || plan.statistics
  if (!requestedDetails) return 'not-requested'

  const missing: Array<keyof SyncMatchDetailsCounts> = []
  if (plan.events && providerCounts.events === 0 && dbCountsAfter.events === 0) missing.push('events')
  if (plan.lineups && !hasUsableProviderLineups(providerCounts.lineups) && dbCountsAfter.lineups === 0) {
    missing.push('lineups')
  }
  if (plan.statistics && !hasUsableProviderStatistics(providerCounts.statistics) && dbCountsAfter.statistics === 0) {
    missing.push('statistics')
  }

  if (!missing.length) return 'complete'
  if (missing.length > 1) return 'provider-no-detail-data'
  if (missing[0] === 'events') return 'provider-no-events'
  if (missing[0] === 'lineups') return 'provider-no-lineups'
  if (missing[0] === 'statistics') return 'provider-no-statistics'

  return 'unknown'
}

function getPersistedProviderDataErrors(input: {
  plan: SyncMatchDetailsBulkItem['plan']
  providerCounts: SyncMatchDetailsCounts
  dbCountsAfter: SyncMatchDetailsCounts
}): SerializedSyncError[] {
  const { plan, providerCounts, dbCountsAfter } = input
  const errors: SerializedSyncError[] = []

  if (plan.events && providerCounts.events > 0 && dbCountsAfter.events === 0) {
    errors.push({
      message: 'API-Football devolvio eventos, pero no quedaron persistidos.',
      code: 'provider_events_not_persisted',
      detail: `provider=${providerCounts.events}; dbAfter=${dbCountsAfter.events}`,
      hint: 'Revisar upsert de football_match_detail_cache o fallback football_fixture_cache.',
      source: 'validation',
    })
  }

  if (plan.lineups && hasUsableProviderLineups(providerCounts.lineups) && dbCountsAfter.lineups === 0) {
    errors.push({
      message: 'API-Football devolvio alineaciones, pero no quedaron persistidas.',
      code: 'provider_lineups_not_persisted',
      detail: `provider=${providerCounts.lineups}; dbAfter=${dbCountsAfter.lineups}`,
      hint: 'Revisar upsert de lineups en el cache de detalle.',
      source: 'validation',
    })
  }

  if (plan.statistics && hasUsableProviderStatistics(providerCounts.statistics) && dbCountsAfter.statistics === 0) {
    errors.push({
      message: 'API-Football devolvio estadisticas, pero no quedaron persistidas.',
      code: 'provider_statistics_not_persisted',
      detail: `provider=${providerCounts.statistics}; dbAfter=${dbCountsAfter.statistics}`,
      hint: 'Revisar upsert de statistics en el cache de detalle.',
      source: 'validation',
    })
  }

  return errors
}

function isAuditProblem(
  audit: Awaited<ReturnType<typeof auditMatchDetailCache>>,
  match: StoredMatchBulkRow,
  input: SyncMatchDetailsBulkOptions,
  now: Date
) {
  const auditRecord = audit as Record<string, unknown>
  const auditMatch = asRecord(auditRecord.match)
  const status = eventField(auditMatch?.status) ?? match.status
  const upcoming = isUpcomingStatus(status)
  const started = isLiveStatus(status) || isFinishedStatus(status)
  const kickoff = minutesUntilBulk(match.match_date, now)
  const nearKickoff = kickoff !== null && kickoff <= 90 && kickoff >= -10

  if (upcoming && !input.force) {
    return nearKickoff && !audit.hasLineups
  }

  if (!started && !input.force) return false

  const scoreTotal = (match.home_score ?? 0) + (match.away_score ?? 0)
  const markerHasGoalsWithoutGoalEvents = scoreTotal > 0 && audit.hasEvents && !audit.hasGoals
  const lineupsIncomplete =
    audit.hasLineups && (!audit.homeStartersCount || !audit.awayStartersCount)
  return (
    !audit.hasEvents ||
    !audit.hasStatistics ||
    !audit.hasLineups ||
    lineupsIncomplete ||
    markerHasGoalsWithoutGoalEvents
  )
}

function classifyBulkSyncItem(input: {
  match: StoredMatchBulkRow
  plan: SyncMatchDetailsBulkItem['plan']
  result: SyncMatchDetailResult
  errors: SerializedSyncError[]
}): {
  status: SyncMatchDetailsBulkStatus
  dataStatus: SyncMatchDetailsDataStatus
  providerStatus: SyncMatchDetailsProviderStatus
} {
  const { match, plan, result, errors } = input
  const dbCountsBefore = getDetailCounts(result.before)
  const dbCountsAfter = getDetailCounts(result.after)
  const providerCounts = getProviderCounts(result)
  const hasErrors = errors.length > 0
  const dataStatus = getBulkDataStatus({ match, plan, after: dbCountsAfter })
  const providerStatus = getProviderStatus({
    plan,
    providerCounts,
    dbCountsAfter,
    hasErrors,
  })

  const started = isLiveStatus(match.status) || isFinishedStatus(match.status)
  const fixtureOnly = plan.fixture && !plan.events && !plan.lineups && !plan.statistics

  if (hasErrors) {
    return {
      status: 'failed',
      dataStatus,
      providerStatus,
    }
  }

  if (!started && fixtureOnly) {
    return {
      status: result.matchUpdated ? 'fixture-updated' : 'future-no-details-yet',
      dataStatus: 'future-no-details-yet',
      providerStatus: 'not-requested',
    }
  }

  if (result.renderStatus === 'render-problem') {
    return {
      status: 'render-problem',
      dataStatus,
      providerStatus,
    }
  }

  const countsChanged =
    dbCountsAfter.events > dbCountsBefore.events ||
    dbCountsAfter.lineups > dbCountsBefore.lineups ||
    dbCountsAfter.statistics > dbCountsBefore.statistics

  if (countsChanged) {
    return {
      status: 'updated',
      dataStatus,
      providerStatus,
    }
  }

  if (dataStatus === 'complete') {
    return {
      status: 'complete',
      dataStatus,
      providerStatus,
    }
  }

  if (providerStatus === 'provider-no-lineups') {
    return {
      status: 'provider-no-lineups',
      dataStatus,
      providerStatus,
    }
  }

  if (providerStatus === 'provider-no-statistics') {
    return {
      status: 'provider-no-statistics',
      dataStatus,
      providerStatus,
    }
  }

  if (providerStatus === 'provider-no-detail-data' && dataStatus === 'missing') {
    return {
      status: 'provider-no-detail-data',
      dataStatus,
      providerStatus,
    }
  }

  if (dataStatus === 'partial' || providerStatus === 'provider-no-detail-data') {
    return {
      status: 'partial',
      dataStatus,
      providerStatus,
    }
  }

  return {
    status: 'unchanged',
    dataStatus,
    providerStatus,
  }
}

export async function syncMatchDetailsBulk(
  supabase: SupabaseClient,
  input: SyncMatchDetailsBulkOptions = {}
): Promise<SyncMatchDetailsBulkResult> {
  const now = new Date()
  const limit = clampBulkLimit(input.limit)
  const warnings: string[] = []
  const controlColumns = await detectMatchDetailControlColumns(supabase)
  if (controlColumns.missing.length) {
    warnings.push(
      `Faltan columnas opcionales de control en matches: ${controlColumns.missing.join(', ')}. Se omiten sin marcar partidos como failed.`
    )
  }
  const { rows, range, statuses } = await fetchBulkMatchCandidates(
    supabase,
    input,
    now,
    limit,
    controlColumns
  )
  const filteredRows: StoredMatchBulkRow[] = []

  for (const row of rows) {
    if (!input.missingDetailsOnly) {
      filteredRows.push(row)
      continue
    }

    const fixtureExternalId = toNumber(row.external_id)
    if (!fixtureExternalId) continue

    const audit = await auditMatchDetailCache(supabase, {
      fixtureExternalId,
      matchId: String(row.id),
    })

    if (isAuditProblem(audit, row, input, now)) filteredRows.push(row)
    if (filteredRows.length >= limit) break
  }

  const selectedRows = filteredRows.slice(0, limit)
  const items: SyncMatchDetailsBulkItem[] = []
  let estimatedApiRequests = 0

  for (const match of selectedRows) {
    const fixtureExternalId = toNumber(match.external_id)
    const reasons = getBulkSyncReasons(match, input, now)

    if (!fixtureExternalId) {
      items.push({
        matchId: match.id,
        fixtureExternalId: 0,
        matchDate: match.match_date,
        status: 'failed',
        dataStatus: 'missing',
        providerStatus: 'unknown',
        matchStatus: match.status,
        reasons,
        plan: {
          fixture: false,
          events: false,
          lineups: false,
          statistics: false,
        },
        skipped: true,
        skipReason: 'missing_external_id',
        ok: false,
        providerCounts: getEmptyDetailCounts(),
        dbCountsBefore: getEmptyDetailCounts(),
        dbCountsAfter: getEmptyDetailCounts(),
        renderCounts: getEmptyRenderCounts(),
        renderStatus: 'not-renderable',
        persistence: null,
        warnings: [],
        errors: [
          {
            message: 'El match no tiene external_id numerico.',
            code: 'missing_external_id',
            detail: null,
            hint: null,
            source: 'validation',
          },
        ],
      })
      continue
    }

    const { plan, skipReason } = getBulkSyncPlan(match, input, now)
    estimatedApiRequests += countPlannedRequests(plan)

    if (skipReason) {
      items.push({
        matchId: match.id,
        fixtureExternalId,
        matchDate: match.match_date,
        status: 'skipped',
        dataStatus: 'missing',
        providerStatus: 'not-requested',
        matchStatus: match.status,
        reasons,
        plan,
        skipped: true,
        skipReason,
        ok: true,
        providerCounts: getEmptyDetailCounts(),
        dbCountsBefore: getEmptyDetailCounts(),
        dbCountsAfter: getEmptyDetailCounts(),
        renderCounts: getEmptyRenderCounts(),
        renderStatus: 'not-renderable',
        persistence: null,
        warnings: [],
        errors: [],
      })
      continue
    }

    try {
      const result = await syncMatchDetail(supabase, {
        fixtureExternalId,
        matchId: String(match.id),
        sections: plan,
        controlColumns,
      })
      const dbCountsBefore = getDetailCounts(result.before)
      const dbCountsAfter = getDetailCounts(result.after)
      const providerCounts = getProviderCounts(result)
      const errors = [
        ...result.errors,
        ...getPersistedProviderDataErrors({ plan, providerCounts, dbCountsAfter }),
      ]
      const classification = classifyBulkSyncItem({ match, plan, result, errors })

      items.push({
        matchId: match.id,
        fixtureExternalId,
        matchDate: match.match_date,
        status: classification.status,
        dataStatus: classification.dataStatus,
        providerStatus: classification.providerStatus,
        matchStatus: match.status,
        reasons,
        plan,
        skipped: false,
        skipReason: null,
        ok: classification.status !== 'failed',
        eventsBefore: dbCountsBefore.events,
        eventsAfter: dbCountsAfter.events,
        lineupsBefore: dbCountsBefore.lineups,
        lineupsAfter: dbCountsAfter.lineups,
        statisticsBefore: dbCountsBefore.statistics,
        statisticsAfter: dbCountsAfter.statistics,
        providerCounts,
        dbCountsBefore,
        dbCountsAfter,
        renderCounts: result.renderCounts,
        renderStatus: result.renderStatus,
        persistence: result.persistence,
        warnings: [
          ...result.warnings,
          ...getRenderProblemWarnings(dbCountsAfter, result.renderCounts),
        ],
        errors,
      })
    } catch (error) {
      items.push({
        matchId: match.id,
        fixtureExternalId,
        matchDate: match.match_date,
        status: 'failed',
        dataStatus: 'missing',
        providerStatus: 'error',
        matchStatus: match.status,
        reasons,
        plan,
        skipped: false,
        skipReason: null,
        ok: false,
        providerCounts: getEmptyDetailCounts(),
        dbCountsBefore: getEmptyDetailCounts(),
        dbCountsAfter: getEmptyDetailCounts(),
        renderCounts: getEmptyRenderCounts(),
        renderStatus: 'not-renderable',
        persistence: null,
        warnings: [],
        errors: [serializeError(error, 'unknown')],
      })
    }
  }

  const failed = items.filter((item) => item.status === 'failed').length
  const skipped = items.filter((item) => item.status === 'skipped').length
  const fixtureUpdated = items.filter((item) => item.status === 'fixture-updated').length
  const updated = items.filter((item) => item.status === 'updated' || item.status === 'fixture-updated').length
  const unchanged = items.filter((item) => item.status === 'unchanged').length
  const futureNoDetailsYet = items.filter((item) => item.status === 'future-no-details-yet').length
  const complete = items.filter((item) => item.status === 'complete' || item.dataStatus === 'complete').length
  const partial = items.filter((item) => item.status === 'partial' || item.dataStatus === 'partial').length
  const providerNoLineups = items.filter(
    (item) =>
      item.status === 'provider-no-lineups' ||
      item.providerStatus === 'provider-no-lineups' ||
      item.providerStatus === 'provider-no-detail-data'
  ).length
  const providerNoStatistics = items.filter(
    (item) =>
      item.status === 'provider-no-statistics' ||
      item.providerStatus === 'provider-no-statistics' ||
      item.providerStatus === 'provider-no-detail-data'
  ).length
  const renderProblems = items.filter((item) => item.renderStatus === 'render-problem').length

  if (input.missingDetailsOnly && rows.length > selectedRows.length) {
    warnings.push('Se revisaron mas partidos que los sincronizados para priorizar los que tenian detalle incompleto.')
  }

  return {
    ok: failed === 0,
    selected: selectedRows.length,
    processed: items.filter((item) => !item.skipped).length,
    updated,
    fixtureUpdated,
    unchanged,
    skipped,
    futureNoDetailsYet,
    complete,
    partial,
    providerNoLineups,
    providerNoStatistics,
    renderProblems,
    failed,
    limit,
    filters: {
      date: input.date ?? null,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      leagueExternalId: input.leagueExternalId ?? null,
      statuses,
      liveOnly: Boolean(input.liveOnly),
      recentFinishedOnly: Boolean(input.recentFinishedOnly),
      missingDetailsOnly: Boolean(input.missingDetailsOnly),
      futureDays: input.futureDays ?? null,
      lookbackDays: clampBulkLookbackDays(input.lookbackDays),
      force: Boolean(input.force),
    },
    estimatedApiRequests,
    requestPolicy: {
      defaultLimit: BULK_SYNC_DEFAULT_LIMIT,
      maxLimit: BULK_SYNC_MAX_LIMIT,
      fixture: '1 request por partido seleccionado para actualizar estado, minuto, marcador, penales, estadio y arbitro.',
      events: 'Solo partidos vivos/finalizados o force=true.',
      statistics: 'Solo partidos vivos/finalizados o force=true; futuros no iniciados no gastan statistics.',
      lineups: 'Partidos vivos/finalizados, force=true o ventana T-180 a post-inicio.',
      finalSkip: 'Si final_detail_synced_at existe y force=false, se salta salvo missingDetailsOnly=true.',
    },
    items,
    warnings,
  }
}

export async function syncMatchDetail(
  supabase: SupabaseClient,
  input: {
    fixtureExternalId?: number | null
    matchId?: string | null
    sections?: SyncMatchDetailSections
    controlColumns?: MatchDetailControlColumnStatus
  }
): Promise<SyncMatchDetailResult> {
  const warnings: string[] = []
  const errors: SerializedSyncError[] = []
  const sections = {
    fixture: input.sections?.fixture ?? true,
    events: input.sections?.events ?? true,
    lineups: input.sections?.lineups ?? true,
    statistics: input.sections?.statistics ?? true,
  }
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
    sections.fixture
      ? fetchFixtureDetail(fixtureExternalId)
      : Promise.resolve(null),
    sections.events
      ? fetchApiArray<ApiFixtureEvent>(
          '/fixtures/events',
          { fixture: fixtureExternalId },
          `sync-match-detail:${fixtureExternalId}:events`
        )
      : Promise.resolve([]),
    sections.lineups
      ? fetchApiArray<unknown>(
          '/fixtures/lineups',
          { fixture: fixtureExternalId },
          `sync-match-detail:${fixtureExternalId}:lineups`
        )
      : Promise.resolve([]),
    sections.statistics
      ? fetchApiArray<unknown>(
          '/fixtures/statistics',
          { fixture: fixtureExternalId },
          `sync-match-detail:${fixtureExternalId}:statistics`
        )
      : Promise.resolve([]),
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

  const fetchedLineupPlayers = countApiLineupPlayers(lineups)
  const fetchedStatisticsValues = countApiStatisticsValues(statistics)
  const usableLineups = fetchedLineupPlayers > 0 ? lineups : []
  const usableStatistics = fetchedStatisticsValues > 0 ? statistics : []
  const fetchedEventsForCache = events.length
    ? getTimelineEvents(events, {
        descending: false,
        excludePenaltyShootout: false,
        semanticDedupe: true,
      })
    : []
  const cachedEventsForCache = getTimelineEvents(
    asArray(beforeCache?.events) as Parameters<typeof getTimelineEvents>[0],
    {
      descending: false,
      excludePenaltyShootout: false,
      semanticDedupe: true,
    }
  )
  const eventsForCache = fetchedEventsForCache.length
    ? fetchedEventsForCache
    : cachedEventsForCache
  const lineupsForCache = usableLineups.length ? usableLineups : asArray(beforeCache?.lineups)
  const statisticsForCache = usableStatistics.length
    ? usableStatistics
    : asArray(beforeCache?.statistics)
  const fixturePayloadForCache =
    fixturePayload ??
    (asRecord(beforeCache?.fixture_payload) as ApiFixtureDetail | null) ??
    null
  const shouldMarkFinalDetailSynced =
    Boolean(fixturePayload?.fixture?.status) &&
    isFinishedStatus(getCanonicalMatchStatusFromApi(fixturePayload?.fixture?.status)) &&
    eventsForCache.length > 0 &&
    countApiLineupPlayers(lineupsForCache) > 0 &&
    countApiStatisticsValues(statisticsForCache) > 0
  const missingFromApi = [
    sections.fixture && !fixturePayload ? 'fixture' : null,
    sections.events && !events.length ? 'events' : null,
    sections.lineups && !fetchedLineupPlayers ? 'lineups' : null,
    sections.statistics && !fetchedStatisticsValues ? 'statistics' : null,
  ].filter((section): section is string => Boolean(section))

  if (sections.events && !events.length && before.hasEvents) {
    warnings.push('API-Football no devolvio eventos; se conservaron los eventos cacheados.')
  }
  if (sections.lineups && !fetchedLineupPlayers && before.hasLineups) {
    warnings.push('API-Football no devolvio alineaciones; se conservaron las alineaciones cacheadas.')
  }
  if (sections.statistics && !fetchedStatisticsValues && before.hasStatistics) {
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
        fixture_payload: fixturePayloadForCache,
        events: eventsForCache,
        lineups: lineupsForCache,
        statistics: statisticsForCache,
      },
      { onConflict: 'fixture_external_id' }
    )
    .select('fixture_payload, events, lineups, statistics')
    .maybeSingle()
  let cacheUpserted = !cacheResponse.error
  let detailTable: SyncMatchDetailPersistenceInfo['detailTable'] = cacheUpserted
    ? 'football_match_detail_cache'
    : null

  if (cacheResponse.error) {
    if (isMissingOptionalTable(cacheResponse.error, 'football_match_detail_cache')) {
      const fallbackCached = await upsertFixtureCacheDetailFallback(supabase, {
        fixtureExternalId,
        fixturePayload: fixturePayloadForCache,
        events: eventsForCache,
        lineups: lineupsForCache,
        statistics: statisticsForCache,
      })

      if (fallbackCached) {
        cacheUpserted = true
        detailTable = 'football_fixture_cache'
        warnings.push('football_match_detail_cache no existe; se uso football_fixture_cache como fallback.')
      } else {
        detailTable = null
        warnings.push('football_match_detail_cache no existe y no se pudo usar football_fixture_cache como fallback.')
      }
    } else {
      throw cacheResponse.error
    }
  }

  let matchEventsUpserted = 0
  let matchUpdated = false
  let teamsById = new Map<string, StoredTeamRow>()

  if (match) {
    try {
      matchUpdated = await updateStoredMatchFromFixtureDetail(
        supabase,
        match,
        fixturePayload,
        sections,
        input.controlColumns,
        {
          markFinalDetailSynced: shouldMarkFinalDetailSynced,
          markLineupsSynced: countApiLineupPlayers(lineupsForCache) > 0,
        }
      )
    } catch (error) {
      errors.push(serializeError(error, 'supabase'))
    }

    teamsById = await fetchStoredTeamsByIds(supabase, [
      match.home_team_id,
      match.away_team_id,
    ])

    try {
      if (sections.events) {
        matchEventsUpserted = await upsertStoredMatchEvents(supabase, {
          fixtureExternalId,
          match,
          events,
          teamsById,
        })
      }
    } catch (error) {
      errors.push(serializeError(error, 'supabase'))
    }
  } else {
    warnings.push('El fixture existe en API-Football pero no esta sincronizado en matches.')
  }

  const selectedCache = (cacheResponse.data as DetailCacheRow | null) ?? null
  const afterCache = mergeDetailCacheRows(
    await readDetailCacheByFixture(supabase, fixtureExternalId),
    selectedCache
  )
  const storedCounts = getCacheDetailCounts(afterCache)
  if (sections.lineups && fetchedLineupPlayers > 0 && storedCounts.lineups === 0) {
    errors.push({
      message: 'API-Football devolvio alineaciones, pero el cache de detalle quedo sin jugadores.',
      code: 'detail_cache_lineups_write_verification_failed',
      detail: `provider=${fetchedLineupPlayers}; stored=${storedCounts.lineups}; table=${detailTable ?? 'none'}`,
      hint: 'Verificar football_match_detail_cache.lineups, unique fixture_external_id y permisos de service_role.',
      source: 'validation',
    })
  }
  if (sections.statistics && fetchedStatisticsValues > 0 && storedCounts.statistics === 0) {
    errors.push({
      message: 'API-Football devolvio estadisticas, pero el cache de detalle quedo sin statistics.',
      code: 'detail_cache_statistics_write_verification_failed',
      detail: `provider=${fetchedStatisticsValues}; stored=${storedCounts.statistics}; table=${detailTable ?? 'none'}`,
      hint: 'Verificar football_match_detail_cache.statistics, unique fixture_external_id y permisos de service_role.',
      source: 'validation',
    })
  }
  const after = buildAuditSnapshot(afterCache)
  const renderCounts = buildRenderCounts({
    cache: afterCache,
    events: asArray(afterCache?.events),
    match,
    teamsById,
  })
  const renderStatus = getRenderStatus({
    matchStatus: fixturePayload?.fixture?.status?.short ?? fixturePayload?.fixture?.status?.long ?? null,
    dbCounts: getCacheDetailCounts(afterCache),
    renderCounts,
  })
  const updatedSections = [
    matchUpdated ? 'match' : null,
    cacheUpserted ? 'detail_cache' : null,
    events.length ? 'events' : null,
    fetchedLineupPlayers ? 'lineups' : null,
    fetchedStatisticsValues ? 'statistics' : null,
    matchEventsUpserted ? 'match_events' : null,
  ].filter((section): section is string => Boolean(section))

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
      lineups: fetchedLineupPlayers,
      statistics: fetchedStatisticsValues,
    },
    cacheUpserted,
    matchUpdated,
    matchEventsUpserted,
    persistence: {
      detailTable,
      matchEventsTable: match ? 'match_events' : null,
      cacheUpserted,
      usedFixtureCacheFallback: detailTable === 'football_fixture_cache',
      matchEventsUpserted,
      received: {
        events: events.length,
        lineupTeams: lineups.length,
        lineupPlayers: fetchedLineupPlayers,
        statisticsTeams: statistics.length,
        statisticsValues: fetchedStatisticsValues,
      },
      stored: storedCounts,
    },
    updatedSections,
    missingFromApi,
    renderCounts,
    renderStatus,
    warnings,
    errors,
  }
}
