import type { SupabaseClient } from '@supabase/supabase-js'

import { requestFootballApi } from '@/server/integrations/football-api-client'
import {
  getCanonicalMatchStatusFromApi,
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'
import { getFixtureStatusElapsedMinute } from '@/shared/utils/match-minute'
import { formatMatchEventStableKey } from '@/shared/utils/football-events'

type DbId = string | number

type QueryError = {
  code?: string
  message?: string
} | null

type ApiFixture = {
  fixture?: {
    id?: number | null
    date?: string | null
    timezone?: string | null
    referee?: string | null
    status?: {
      long?: string | null
      short?: string | null
      elapsed?: number | null
      extra?: number | null
    } | null
    venue?: {
      id?: number | string | null
      name?: string | null
      city?: string | null
      country?: string | null
    } | null
  } | null
  league?: {
    id?: number | null
    season?: number | null
  } | null
  teams?: {
    home?: {
      id?: number | null
      name?: string | null
    } | null
    away?: {
      id?: number | null
      name?: string | null
    } | null
  } | null
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
    extratime?: {
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

type StoredLiveMatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  match_date: string | null
  status: string | null
  elapsed?: number | null
  final_elapsed?: number | null
  home_score?: number | null
  away_score?: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  last_events_synced_at?: string | null
  last_statistics_synced_at?: string | null
  last_lineups_synced_at?: string | null
  final_detail_synced_at?: string | null
  final_followup_synced_at?: string | null
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
  assist_name?: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
  comments?: string | null
}

type DetailCacheRow = {
  fixture_payload?: unknown
  league_external_id?: string | null
  season?: number | null
  events?: unknown
  lineups?: unknown
  statistics?: unknown
}

type DetailCacheUpsertResult = {
  ok: boolean
  eventsCount: number
  lineupsCount: number
  statisticsCount: number
}

type MatchCandidate = {
  match: StoredLiveMatchRow
  reasons: Set<string>
}

type ApiRequestCounter = {
  count: number
}

type SyncLiveMatchItem = {
  matchId: DbId
  fixtureExternalId: number
  reasons: string[]
  statusBefore: string | null
  statusAfter: string | null
  scoreBefore: {
    home: number | null
    away: number | null
  }
  scoreAfter: {
    home: number | null
    away: number | null
  }
  fixtureRefreshed: boolean
  eventsFetched: number
  eventsUpserted: number
  duplicateEventsRemoved: number
  statisticsFetched: number
  lineupsFetched: number
  controlUpdated: {
    events: boolean
    statistics: boolean
    lineups: boolean
    finalDetail: boolean
    finalFollowup: boolean
  }
  warnings: string[]
}

type SyncLiveMatchesOptions = {
  now?: Date
  limit?: number | null
}

type LiveSyncAuditOptions = {
  now?: Date
  limit?: number | null
}

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'
const MATCH_BASE_SELECT = [
  'id',
  'external_id',
  'league_id',
  'match_date',
  'status',
  'elapsed',
  'home_score',
  'away_score',
  'home_team_id',
  'away_team_id',
].join(', ')
const MATCH_CONTROL_SELECT = [
  MATCH_BASE_SELECT,
  'final_elapsed',
  'home_penalty_score',
  'away_penalty_score',
  'last_events_synced_at',
  'last_statistics_synced_at',
  'last_lineups_synced_at',
  'final_detail_synced_at',
  'final_followup_synced_at',
].join(', ')

const LIVE_SYNC_STATUSES = ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT']
const FINISHED_SYNC_STATUSES = ['FT', 'AET', 'PEN']
const STALE_UNRESOLVED_LOOKBACK_MINUTES = 72 * 60
const HARD_FINAL_STATUSES = new Set(FINISHED_SYNC_STATUSES)
const DETAILS_RELEVANT_STATUSES = new Set([
  ...LIVE_SYNC_STATUSES,
  ...FINISHED_SYNC_STATUSES,
])

function isMissingOptionalColumn(error: QueryError) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('column')
  )
}

function isMissingOptionalTable(error: QueryError, table: string) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes(table) ||
    message.includes('schema cache')
  )
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function cleanPatchText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toIsoAtOffset(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}

function minutesUntil(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return null

  const parsed = Date.parse(dateValue)
  if (Number.isNaN(parsed)) return null

  return Math.round((parsed - now.getTime()) / 60_000)
}

function minutesSince(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return null

  const parsed = Date.parse(dateValue)
  if (Number.isNaN(parsed)) return null

  return Math.round((now.getTime() - parsed) / 60_000)
}

function olderThan(dateValue: string | null | undefined, now: Date, minutes: number) {
  const age = minutesSince(dateValue, now)

  return age === null || age >= minutes
}

function isDetailsRelevantStatus(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toUpperCase()

  return DETAILS_RELEVANT_STATUSES.has(normalized) || isLiveStatus(normalized) || isFinishedStatus(normalized)
}

function isFinalSyncStatus(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toUpperCase()

  return HARD_FINAL_STATUSES.has(normalized) || isFinishedStatus(normalized)
}

function shouldFetchEvents(match: StoredLiveMatchRow, status: string | null | undefined, now: Date) {
  if (!isDetailsRelevantStatus(status)) return false
  if (isPostponedStatus(status)) return olderThan(match.last_events_synced_at, now, 15)

  return olderThan(match.last_events_synced_at, now, 1)
}

function shouldFetchStatistics(match: StoredLiveMatchRow, status: string | null | undefined, now: Date) {
  if (isLiveStatus(status)) return olderThan(match.last_statistics_synced_at, now, 5)

  if (isFinalSyncStatus(status)) {
    return !match.final_detail_synced_at || shouldFetchFinalFollowup(match, now)
  }

  return false
}

function shouldFetchFinalFollowup(match: StoredLiveMatchRow, now: Date) {
  if (!match.final_detail_synced_at || match.final_followup_synced_at) return false

  return olderThan(match.final_detail_synced_at, now, 10)
}

function shouldFetchLineups(match: StoredLiveMatchRow, status: string | null | undefined, now: Date) {
  if (isFinalSyncStatus(status)) {
    return !match.final_detail_synced_at || shouldFetchFinalFollowup(match, now)
  }

  if (isLiveStatus(status)) {
    return olderThan(match.last_lineups_synced_at, now, 30)
  }

  const toKickoff = minutesUntil(match.match_date, now)
  if (toKickoff === null) return false

  if (toKickoff <= 90 && toKickoff > 60) {
    return !match.last_lineups_synced_at
  }

  if (toKickoff <= 60 && toKickoff > 30) {
    return olderThan(match.last_lineups_synced_at, now, 20)
  }

  if (toKickoff <= 30 && toKickoff > 5) {
    return olderThan(match.last_lineups_synced_at, now, 20)
  }

  if (toKickoff <= 5 && toKickoff >= -10) {
    return olderThan(match.last_lineups_synced_at, now, 10)
  }

  return false
}

function shouldRefreshFixture(match: StoredLiveMatchRow, reasons: Set<string>, now: Date) {
  const status = match.status

  if (reasons.has('api-live')) return false
  if (LIVE_SYNC_STATUSES.includes((status ?? '').toUpperCase())) return true
  if (reasons.has('starting-window')) return true
  if (reasons.has('stale-unresolved')) return true
  if (reasons.has('recently-finished') && (!match.final_detail_synced_at || shouldFetchFinalFollowup(match, now))) {
    return true
  }

  return false
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getEventSemanticKey(input: {
  matchId: DbId
  type: string | null | undefined
  detail: string | null | undefined
  minute: number | null | undefined
  extraMinute: number | null | undefined
  teamId: DbId | null | undefined
  playerName: string | null | undefined
  assistName?: string | null | undefined
  comments?: string | null | undefined
}) {
  return formatMatchEventStableKey(
    {
      type: input.type,
      detail: input.detail,
      time: {
        elapsed: input.minute,
        extra: input.extraMinute,
      },
      team: {
        id: input.teamId,
      },
      player: {
        name: input.playerName,
      },
      assist: {
        name: input.assistName,
      },
      comments: input.comments,
    },
    input.matchId
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

function countLineupPlayers(lineups: unknown[]) {
  return lineups.reduce<number>((total, lineup) => {
    const record = asRecord(lineup)
    const startXI = asArray(record?.startXI).length
    const substitutes = asArray(record?.substitutes).length

    return total + startXI + substitutes
  }, 0)
}

function countStatisticsValues(statistics: unknown[]) {
  return statistics.reduce<number>((total, entry) => {
    const record = asRecord(entry)

    return total + asArray(record?.statistics).length
  }, 0)
}

function getFixtureExternalId(fixture: ApiFixture) {
  return toNumber(fixture.fixture?.id)
}

function getFixtureStatus(fixture: ApiFixture) {
  return getCanonicalMatchStatusFromApi(fixture.fixture?.status ?? null)
}

function getFixtureScore(fixture: ApiFixture) {
  return {
    home:
      toNumber(fixture.goals?.home) ??
      toNumber(fixture.score?.fulltime?.home) ??
      toNumber(fixture.score?.extratime?.home),
    away:
      toNumber(fixture.goals?.away) ??
      toNumber(fixture.score?.fulltime?.away) ??
      toNumber(fixture.score?.extratime?.away),
    homePenalty: toNumber(fixture.score?.penalty?.home),
    awayPenalty: toNumber(fixture.score?.penalty?.away),
  }
}

function mapFixturePatch(fixture: ApiFixture) {
  const status = getFixtureStatus(fixture)
  const score = getFixtureScore(fixture)
  const elapsed = getFixtureStatusElapsedMinute(fixture.fixture?.status ?? null)
  const patch: Record<string, unknown> = {
    status,
    elapsed: isFinalSyncStatus(status) ? null : elapsed,
    match_date: fixture.fixture?.date ?? null,
    home_score: score.home,
    away_score: score.away,
    updated_at: new Date().toISOString(),
  }

  if (isFinalSyncStatus(status)) {
    patch.final_elapsed = elapsed
  }

  if (score.homePenalty !== null || score.awayPenalty !== null) {
    patch.home_penalty_score = score.homePenalty
    patch.away_penalty_score = score.awayPenalty
  }

  const venue = fixture.fixture?.venue ?? null
  const venueId = venue?.id
  const venueName = cleanPatchText(venue?.name)
  const venueCity = cleanPatchText(venue?.city)
  const venueCountry = cleanPatchText(venue?.country)
  const referee = cleanPatchText(fixture.fixture?.referee)
  const timezone = cleanPatchText(fixture.fixture?.timezone)

  if (venueId !== null && venueId !== undefined && String(venueId).trim()) {
    patch.venue_id = String(venueId)
  }
  if (venueName) patch.venue_name = venueName
  if (venueCity) patch.venue_city = venueCity
  if (venueCountry) patch.venue_country = venueCountry
  if (referee) patch.referee = referee
  if (timezone) patch.timezone = timezone

  return patch
}

async function fetchApiArray<T>(
  path: string,
  params: Record<string, string | number>,
  logContext: string,
  counter: ApiRequestCounter
) {
  counter.count += 1

  const { payload } = await requestFootballApi<T[]>(path, params, { logContext })
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) throw new Error(apiErrors.join(' | '))

  return payload.response ?? []
}

async function runMatchQuery(
  buildQuery: (
    select: string
  ) => PromiseLike<{ data: unknown; error: QueryError }>,
  warnings: string[]
) {
  let response = await buildQuery(MATCH_CONTROL_SELECT)

  if (response.error && isMissingOptionalColumn(response.error)) {
    warnings.push(
      'Las columnas de control de sync live no estan aplicadas en Supabase; se uso lectura base.'
    )
    response = await buildQuery(MATCH_BASE_SELECT)
  }

  if (response.error) throw response.error

  return ((response.data ?? []) as StoredLiveMatchRow[])
}

async function fetchMatchesByStatuses(
  supabase: SupabaseClient,
  statuses: string[],
  limit: number,
  warnings: string[]
) {
  return runMatchQuery(
    (select) =>
      supabase
        .from('matches')
        .select(select)
        .not('external_id', 'is', null)
        .in('status', statuses)
        .order('match_date', { ascending: true, nullsFirst: false })
        .limit(limit),
    warnings
  )
}

async function fetchMatchesByDateWindow(
  supabase: SupabaseClient,
  input: {
    fromIso: string
    toIso: string
    limit: number
  },
  warnings: string[]
) {
  return runMatchQuery(
    (select) =>
      supabase
        .from('matches')
        .select(select)
        .not('external_id', 'is', null)
        .gte('match_date', input.fromIso)
        .lte('match_date', input.toIso)
        .order('match_date', { ascending: true, nullsFirst: false })
        .limit(input.limit),
    warnings
  )
}

async function fetchMatchesByExternalIds(
  supabase: SupabaseClient,
  externalIds: number[],
  limit: number,
  warnings: string[]
) {
  if (!externalIds.length) return []

  return runMatchQuery(
    (select) =>
      supabase
        .from('matches')
        .select(select)
        .in('external_id', externalIds.slice(0, limit))
        .limit(limit),
    warnings
  )
}

function addCandidate(
  candidates: Map<string, MatchCandidate>,
  match: StoredLiveMatchRow,
  reason: string
) {
  const key = String(match.id)
  const current = candidates.get(key)

  if (current) {
    current.reasons.add(reason)
    return
  }

  candidates.set(key, {
    match,
    reasons: new Set([reason]),
  })
}

async function fetchLiveMatchCandidates(
  supabase: SupabaseClient,
  input: {
    now: Date
    limit: number
    liveFixtureIds: number[]
  },
  warnings: string[]
) {
  const candidates = new Map<string, MatchCandidate>()
  const [
    storedLive,
    startingWindow,
    lineupWindow,
    recentlyFinished,
    staleUnresolved,
    liveFromApi,
  ] = await Promise.all([
    fetchMatchesByStatuses(supabase, LIVE_SYNC_STATUSES, input.limit, warnings),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: toIsoAtOffset(input.now, -10),
        toIso: toIsoAtOffset(input.now, 15),
        limit: input.limit,
      },
      warnings
    ),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: input.now.toISOString(),
        toIso: toIsoAtOffset(input.now, 90),
        limit: input.limit,
      },
      warnings
    ),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: toIsoAtOffset(input.now, -120),
        toIso: input.now.toISOString(),
        limit: input.limit,
      },
      warnings
    ).then((rows) => rows.filter((row) => isFinalSyncStatus(row.status))),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: toIsoAtOffset(input.now, -STALE_UNRESOLVED_LOOKBACK_MINUTES),
        toIso: toIsoAtOffset(input.now, -45),
        limit: input.limit,
      },
      warnings
    ).then((rows) =>
      rows.filter((row) =>
        !isFinalSyncStatus(row.status) &&
        !isLiveStatus(row.status) &&
        !isPostponedStatus(row.status) &&
        isUpcomingStatus(row.status)
      )
    ),
    fetchMatchesByExternalIds(supabase, input.liveFixtureIds, input.limit, warnings),
  ])

  for (const match of storedLive) addCandidate(candidates, match, 'stored-live')
  for (const match of startingWindow) addCandidate(candidates, match, 'starting-window')
  for (const match of lineupWindow) addCandidate(candidates, match, 'lineup-window')
  for (const match of recentlyFinished) addCandidate(candidates, match, 'recently-finished')
  for (const match of staleUnresolved) addCandidate(candidates, match, 'stale-unresolved')
  for (const match of liveFromApi) addCandidate(candidates, match, 'api-live')

  return [...candidates.values()]
}

async function fetchStoredTeamsByIds(
  supabase: SupabaseClient,
  teamIds: Array<DbId | null | undefined>
) {
  const ids = [...new Set(teamIds.filter((id): id is DbId => id !== null && id !== undefined).map(String))]

  if (!ids.length) return new Map<string, StoredTeamRow>()

  const response = await supabase
    .from('teams')
    .select('id, external_id, name')
    .in('id', ids)

  if (response.error) throw response.error

  return new Map(
    ((response.data ?? []) as StoredTeamRow[]).map((team) => [String(team.id), team])
  )
}

function resolveEventTeamId(input: {
  apiTeamId: number | null
  match: StoredLiveMatchRow
  teamsById: Map<string, StoredTeamRow>
}) {
  const homeTeam =
    input.match.home_team_id !== null && input.match.home_team_id !== undefined
      ? input.teamsById.get(String(input.match.home_team_id))
      : null
  const awayTeam =
    input.match.away_team_id !== null && input.match.away_team_id !== undefined
      ? input.teamsById.get(String(input.match.away_team_id))
      : null
  const homeExternalId = toNumber(homeTeam?.external_id)
  const awayExternalId = toNumber(awayTeam?.external_id)

  if (input.apiTeamId !== null && homeExternalId !== null && input.apiTeamId === homeExternalId) {
    return input.match.home_team_id
  }

  if (input.apiTeamId !== null && awayExternalId !== null && input.apiTeamId === awayExternalId) {
    return input.match.away_team_id
  }

  return null
}

async function fetchStoredEventRows(supabase: SupabaseClient, matchId: DbId) {
  const response = await supabase
    .from('match_events')
    .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
    .eq('match_id', String(matchId))

  if (response.error) {
    if (
      response.error.code === '42703' ||
      response.error.code === 'PGRST204' ||
      response.error.message.toLowerCase().includes('comments') ||
      response.error.message.toLowerCase().includes('assist_name') ||
      response.error.message.toLowerCase().includes('schema cache')
    ) {
      const fallbackResponse = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, minute, extra_minute, type, detail')
        .eq('match_id', String(matchId))

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

async function removeDuplicateStoredEvents(
  supabase: SupabaseClient,
  existingRows: StoredMatchEventRow[]
) {
  const rowsByKey = new Map<string, StoredMatchEventRow[]>()

  for (const row of existingRows) {
    const key = getEventSemanticKey({
      matchId: row.match_id,
      type: row.type,
      detail: row.detail,
      minute: row.minute,
      extraMinute: row.extra_minute,
      teamId: row.team_id,
      playerName: row.player_name,
      assistName: row.assist_name,
      comments: row.comments,
    })
    const rows = rowsByKey.get(key) ?? []
    rows.push(row)
    rowsByKey.set(key, rows)
  }

  const duplicateIds = [...rowsByKey.values()]
    .filter((rows) => rows.length > 1)
    .flatMap((rows) => rows.slice(1).map((row) => row.id).filter((id): id is DbId => id !== null && id !== undefined))

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

async function upsertMatchEvents(
  supabase: SupabaseClient,
  input: {
    fixtureExternalId: number
    match: StoredLiveMatchRow
    events: ApiFixtureEvent[]
    teamsById: Map<string, StoredTeamRow>
  }
) {
  if (!input.events.length) {
    return {
      upserted: 0,
      duplicatesRemoved: 0,
    }
  }

  const existingRows = await fetchStoredEventRows(supabase, input.match.id)
  const duplicatesRemoved = await removeDuplicateStoredEvents(supabase, existingRows)
  const existingExternalIdByKey = new Map<string, string>()

  for (const row of existingRows) {
    const key = getEventSemanticKey({
      matchId: row.match_id,
      type: row.type,
      detail: row.detail,
      minute: row.minute,
      extraMinute: row.extra_minute,
      teamId: row.team_id,
      playerName: row.player_name,
      assistName: row.assist_name,
      comments: row.comments,
    })

    if (row.external_event_id && !existingExternalIdByKey.has(key)) {
      existingExternalIdByKey.set(key, row.external_event_id)
    }
  }

  const rowsByKey = new Map<string, Record<string, unknown>>()

  for (const event of input.events) {
    const apiTeamId = toNumber(event.team?.id)
    const teamId = resolveEventTeamId({
      apiTeamId,
      match: input.match,
      teamsById: input.teamsById,
    })
    const minute = toNumber(event.time?.elapsed)
    const extraMinute = toNumber(event.time?.extra)
    const playerName =
      cleanString(event.player?.name) ||
      cleanString(event.team?.name) ||
      cleanString(event.detail) ||
      cleanString(event.type) ||
      'Evento'
    const eventType = cleanString(event.type) || 'Event'
    const eventDetail = cleanString(event.detail) || null
    const assistName = cleanString(event.assist?.name) || null
    const comments = cleanString(event.comments) || null
    const semanticKey = getEventSemanticKey({
      matchId: input.match.id,
      type: eventType,
      detail: eventDetail,
      minute,
      extraMinute,
      teamId,
      playerName,
      assistName,
      comments,
    })
    const externalEventId =
      existingExternalIdByKey.get(semanticKey) ??
      (event.id !== null && event.id !== undefined
        ? String(event.id)
        : semanticKey)

    rowsByKey.set(semanticKey, {
      match_id: input.match.id,
      external_event_id: externalEventId,
      team_id: teamId,
      player_name: playerName,
      assist_name: assistName,
      minute,
      extra_minute: extraMinute,
      type: eventType,
      detail: eventDetail,
      comments,
    })
  }

  const rows = [...rowsByKey.values()]
  const existingNullExternalIdRows = existingRows.filter((row) => {
    if (row.external_event_id) return false

    const key = getEventSemanticKey({
      matchId: row.match_id,
      type: row.type,
      detail: row.detail,
      minute: row.minute,
      extraMinute: row.extra_minute,
      teamId: row.team_id,
      playerName: row.player_name,
      assistName: row.assist_name,
      comments: row.comments,
    })

    return rowsByKey.has(key)
  })

  if (existingNullExternalIdRows.length) {
    const idsToDelete = existingNullExternalIdRows
      .map((row) => row.id)
      .filter((id): id is DbId => id !== null && id !== undefined)
      .map(String)

    if (idsToDelete.length) {
      const deleteResponse = await supabase
        .from('match_events')
        .delete()
        .in('id', idsToDelete)

      if (deleteResponse.error && !isMissingOptionalTable(deleteResponse.error, 'match_events')) {
        throw deleteResponse.error
      }
    }
  }

  if (!rows.length) {
    return {
      upserted: 0,
      duplicatesRemoved: duplicatesRemoved + existingNullExternalIdRows.length,
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
        if (isMissingOptionalTable(fallbackResponse.error, 'match_events')) {
          return {
            upserted: 0,
            duplicatesRemoved,
          }
        }

        throw fallbackResponse.error
      }

      return {
        upserted: rows.length,
        duplicatesRemoved: duplicatesRemoved + existingNullExternalIdRows.length,
      }
    }

    if (isMissingOptionalTable(response.error, 'match_events')) {
      return {
        upserted: 0,
        duplicatesRemoved,
      }
    }

    throw response.error
  }

  return {
    upserted: rows.length,
    duplicatesRemoved: duplicatesRemoved + existingNullExternalIdRows.length,
  }
}

async function readDetailCache(supabase: SupabaseClient, fixtureExternalId: number) {
  const response = await supabase
    .from('football_match_detail_cache')
    .select('fixture_payload, league_external_id, season, events, lineups, statistics')
    .eq('fixture_external_id', String(fixtureExternalId))
    .maybeSingle()

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'football_match_detail_cache')) return null
    throw response.error
  }

  return (response.data as DetailCacheRow | null) ?? null
}

async function upsertDetailCache(
  supabase: SupabaseClient,
  input: {
    fixtureExternalId: number
    match: StoredLiveMatchRow
    fixturePayload: ApiFixture | null
    events?: unknown[] | null
    lineups?: unknown[] | null
    statistics?: unknown[] | null
  }
) {
  const existing = await readDetailCache(supabase, input.fixtureExternalId)
  const fixturePayload = input.fixturePayload ?? (existing?.fixture_payload as ApiFixture | undefined) ?? null
  const events = input.events && input.events.length
    ? input.events
    : asArray(existing?.events)
  const lineups = input.lineups && input.lineups.length
    ? input.lineups
    : asArray(existing?.lineups)
  const statistics = input.statistics && input.statistics.length
    ? input.statistics
    : asArray(existing?.statistics)

  const response = await supabase
    .from('football_match_detail_cache')
    .upsert(
      {
        fixture_external_id: String(input.fixtureExternalId),
        match_id: String(input.match.id),
        league_external_id:
          fixturePayload?.league?.id !== null && fixturePayload?.league?.id !== undefined
            ? String(fixturePayload.league.id)
            : existing?.league_external_id ?? null,
        season: toNumber(fixturePayload?.league?.season) ?? existing?.season ?? null,
        fixture_payload: fixturePayload,
        events,
        lineups,
        statistics,
      },
      { onConflict: 'fixture_external_id' }
    )

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'football_match_detail_cache')) {
      return {
        ok: false,
        eventsCount: events.length,
        lineupsCount: countLineupPlayers(lineups),
        statisticsCount: countStatisticsValues(statistics),
      }
    }
    throw response.error
  }

  return {
    ok: true,
    eventsCount: events.length,
    lineupsCount: countLineupPlayers(lineups),
    statisticsCount: countStatisticsValues(statistics),
  }
}

async function updateMatchPatch(
  supabase: SupabaseClient,
  matchId: DbId,
  patch: Record<string, unknown>,
  warnings: string[]
) {
  const response = await supabase
    .from('matches')
    .update(patch)
    .eq('id', String(matchId))

  if (!response.error) return true

  if (!isMissingOptionalColumn(response.error)) throw response.error

  const fallbackPatch = { ...patch }

  delete fallbackPatch.final_elapsed
  delete fallbackPatch.home_penalty_score
  delete fallbackPatch.away_penalty_score
  delete fallbackPatch.venue_id
  delete fallbackPatch.venue_name
  delete fallbackPatch.venue_city
  delete fallbackPatch.venue_country
  delete fallbackPatch.referee
  delete fallbackPatch.timezone
  delete fallbackPatch.last_events_synced_at
  delete fallbackPatch.last_statistics_synced_at
  delete fallbackPatch.last_lineups_synced_at
  delete fallbackPatch.final_detail_synced_at
  delete fallbackPatch.final_followup_synced_at

  warnings.push(
    'Supabase no tiene todas las columnas de sync live aplicadas; se actualizo el match sin controles finos.'
  )

  const fallbackResponse = await supabase
    .from('matches')
    .update(fallbackPatch)
    .eq('id', String(matchId))

  if (fallbackResponse.error) throw fallbackResponse.error

  return false
}

function getStatusAfterRefresh(match: StoredLiveMatchRow, fixturePayload: ApiFixture | null) {
  return fixturePayload ? getFixtureStatus(fixturePayload) : match.status
}

function getScoreAfterRefresh(match: StoredLiveMatchRow, fixturePayload: ApiFixture | null) {
  if (!fixturePayload) {
    return {
      home: match.home_score ?? null,
      away: match.away_score ?? null,
    }
  }

  const score = getFixtureScore(fixturePayload)

  return {
    home: score.home,
    away: score.away,
  }
}

function shouldMarkFinalDetailSynced(input: {
  status: string | null | undefined
  persistedEventsCount: number
  persistedStatisticsCount: number
  persistedLineupsCount: number
}) {
  return (
    isFinalSyncStatus(input.status) &&
    input.persistedEventsCount > 0 &&
    input.persistedStatisticsCount > 0 &&
    input.persistedLineupsCount > 0
  )
}

async function syncSingleLiveMatch(
  supabase: SupabaseClient,
  input: {
    candidate: MatchCandidate
    liveFixtureMap: Map<number, ApiFixture>
    now: Date
    requestCounter: ApiRequestCounter
  }
): Promise<SyncLiveMatchItem> {
  const warnings: string[] = []
  const { match, reasons } = input.candidate
  const fixtureExternalId = toNumber(match.external_id)

  if (!fixtureExternalId) {
    return {
      matchId: match.id,
      fixtureExternalId: 0,
      reasons: [...reasons],
      statusBefore: match.status,
      statusAfter: match.status,
      scoreBefore: {
        home: match.home_score ?? null,
        away: match.away_score ?? null,
      },
      scoreAfter: {
        home: match.home_score ?? null,
        away: match.away_score ?? null,
      },
      fixtureRefreshed: false,
      eventsFetched: 0,
      eventsUpserted: 0,
      duplicateEventsRemoved: 0,
      statisticsFetched: 0,
      lineupsFetched: 0,
      controlUpdated: {
        events: false,
        statistics: false,
        lineups: false,
        finalDetail: false,
        finalFollowup: false,
      },
      warnings: ['El match no tiene external_id numerico.'],
    }
  }

  let fixturePayload = input.liveFixtureMap.get(fixtureExternalId) ?? null
  let fixtureRefreshed = Boolean(fixturePayload)

  if (!fixturePayload && shouldRefreshFixture(match, reasons, input.now)) {
    const fixtures = await fetchApiArray<ApiFixture>(
      '/fixtures',
      {
        id: fixtureExternalId,
        timezone: ARGENTINA_TIME_ZONE,
      },
      `sync-live-matches:${fixtureExternalId}:fixture`,
      input.requestCounter
    )

    fixturePayload = fixtures[0] ?? null
    fixtureRefreshed = true
  }

  const statusAfter = getStatusAfterRefresh(match, fixturePayload)
  const scoreAfter = getScoreAfterRefresh(match, fixturePayload)
  const eventDue = shouldFetchEvents(match, statusAfter, input.now)
  const statisticsDue = shouldFetchStatistics(match, statusAfter, input.now)
  const lineupsDue = shouldFetchLineups(match, statusAfter, input.now)
  const [events, statistics, lineups] = await Promise.all([
    eventDue
      ? fetchApiArray<ApiFixtureEvent>(
          '/fixtures/events',
          { fixture: fixtureExternalId },
          `sync-live-matches:${fixtureExternalId}:events`,
          input.requestCounter
        )
      : Promise.resolve([]),
    statisticsDue
      ? fetchApiArray<unknown>(
          '/fixtures/statistics',
          { fixture: fixtureExternalId },
          `sync-live-matches:${fixtureExternalId}:statistics`,
          input.requestCounter
        )
      : Promise.resolve([]),
    lineupsDue
      ? fetchApiArray<unknown>(
          '/fixtures/lineups',
          { fixture: fixtureExternalId },
          `sync-live-matches:${fixtureExternalId}:lineups`,
          input.requestCounter
        )
      : Promise.resolve([]),
  ])
  const teamsById = eventDue
    ? await fetchStoredTeamsByIds(supabase, [match.home_team_id, match.away_team_id])
    : new Map<string, StoredTeamRow>()
  const eventResult = eventDue
    ? await upsertMatchEvents(supabase, {
        fixtureExternalId,
        match,
        events,
        teamsById,
      })
    : {
        upserted: 0,
        duplicatesRemoved: 0,
      }

  let detailCacheResult: DetailCacheUpsertResult = {
    ok: false,
    eventsCount: 0,
    lineupsCount: 0,
    statisticsCount: 0,
  }

  if (fixturePayload || eventDue || statisticsDue || lineupsDue) {
    detailCacheResult = await upsertDetailCache(supabase, {
      fixtureExternalId,
      match,
      fixturePayload,
      events: eventDue ? events : null,
      statistics: statisticsDue ? statistics : null,
      lineups: lineupsDue ? lineups : null,
    })

    if (!detailCacheResult.ok) {
      warnings.push(
        'No se pudo persistir football_match_detail_cache; el sync continuo sin marcar el detalle final como completo.'
      )
    }
  }

  const nowIso = input.now.toISOString()
  const controlPatch: Record<string, unknown> = {}

  if (fixturePayload) {
    Object.assign(controlPatch, mapFixturePatch(fixturePayload))
  }

  if (eventDue) controlPatch.last_events_synced_at = nowIso
  if (statisticsDue) controlPatch.last_statistics_synced_at = nowIso
  if (lineupsDue) controlPatch.last_lineups_synced_at = nowIso

  const finalDetailSynced = shouldMarkFinalDetailSynced({
    status: statusAfter,
    persistedEventsCount: detailCacheResult.eventsCount,
    persistedStatisticsCount: detailCacheResult.statisticsCount,
    persistedLineupsCount: detailCacheResult.lineupsCount,
  })
  const finalFollowupSynced = shouldFetchFinalFollowup(match, input.now)

  if (finalDetailSynced && !match.final_detail_synced_at) {
    controlPatch.final_detail_synced_at = nowIso
  }

  if (finalFollowupSynced) {
    controlPatch.final_followup_synced_at = nowIso
  }

  if (Object.keys(controlPatch).length) {
    await updateMatchPatch(supabase, match.id, controlPatch, warnings)
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('[sync-live-matches:item]', {
      fixtureExternalId,
      reasons: [...reasons],
      statusBefore: match.status,
      statusAfter,
      events: events.length,
      statistics: statistics.length,
      lineups: lineups.length,
    })
  }

  return {
    matchId: match.id,
    fixtureExternalId,
    reasons: [...reasons],
    statusBefore: match.status,
    statusAfter,
    scoreBefore: {
      home: match.home_score ?? null,
      away: match.away_score ?? null,
    },
    scoreAfter,
    fixtureRefreshed,
    eventsFetched: events.length,
    eventsUpserted: eventResult.upserted,
    duplicateEventsRemoved: eventResult.duplicatesRemoved,
    statisticsFetched: statistics.length,
    lineupsFetched: lineups.length,
    controlUpdated: {
      events: eventDue,
      statistics: statisticsDue,
      lineups: lineupsDue,
      finalDetail: Boolean(controlPatch.final_detail_synced_at),
      finalFollowup: Boolean(controlPatch.final_followup_synced_at),
    },
    warnings,
  }
}

function summarizeItems(items: SyncLiveMatchItem[], apiRequests: number) {
  return {
    candidates: items.length,
    fixturesRefreshed: items.filter((item) => item.fixtureRefreshed).length,
    eventsFetched: items.reduce((sum, item) => sum + item.eventsFetched, 0),
    eventsUpserted: items.reduce((sum, item) => sum + item.eventsUpserted, 0),
    duplicateEventsRemoved: items.reduce((sum, item) => sum + item.duplicateEventsRemoved, 0),
    statisticsFetched: items.reduce((sum, item) => sum + item.statisticsFetched, 0),
    lineupsFetched: items.reduce((sum, item) => sum + item.lineupsFetched, 0),
    finalDetailsSynced: items.filter((item) => item.controlUpdated.finalDetail).length,
    finalFollowupsSynced: items.filter((item) => item.controlUpdated.finalFollowup).length,
    apiRequests,
  }
}

export async function syncLiveMatches(
  supabase: SupabaseClient,
  options: SyncLiveMatchesOptions = {}
) {
  const now = options.now ?? new Date()
  const limit = Math.min(Math.max(options.limit ?? 120, 1), 300)
  const warnings: string[] = []
  const requestCounter: ApiRequestCounter = { count: 0 }
  const liveFixtures = await fetchApiArray<ApiFixture>(
    '/fixtures',
    {
      live: 'all',
      timezone: ARGENTINA_TIME_ZONE,
    },
    'sync-live-matches:global-live',
    requestCounter
  )
  const liveFixtureMap = new Map<number, ApiFixture>()

  for (const fixture of liveFixtures) {
    const fixtureExternalId = getFixtureExternalId(fixture)
    if (fixtureExternalId !== null) liveFixtureMap.set(fixtureExternalId, fixture)
  }

  const candidates = await fetchLiveMatchCandidates(
    supabase,
    {
      now,
      limit,
      liveFixtureIds: [...liveFixtureMap.keys()],
    },
    warnings
  )
  const items: SyncLiveMatchItem[] = []

  for (const candidate of candidates) {
    try {
      items.push(
        await syncSingleLiveMatch(supabase, {
          candidate,
          liveFixtureMap,
          now,
          requestCounter,
        })
      )
    } catch (error) {
      warnings.push(
        `No se pudo sincronizar match ${candidate.match.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  return {
    ok: warnings.length === 0,
    mode: 'sync-live-matches',
    now: now.toISOString(),
    policy: {
      globalLiveFixtures: 'cada ejecucion',
      events: 'cada 1 minuto para partidos live/relevantes',
      statistics: 'cada 5 minutos para live; final y follow-up al terminar',
      lineups: 'T-90, T-60, T-30, inicio, live espaciado y final',
      finalFollowup: '10 minutos despues de detectar FT/AET/PEN',
    },
    liveFixturesFromApi: liveFixtures.length,
    checked: candidates.length,
    summary: summarizeItems(items, requestCounter.count),
    items,
    warnings,
  }
}

function maxIso(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
}

function serializeAuditMatch(match: StoredLiveMatchRow) {
  return {
    id: match.id,
    externalId: match.external_id,
    matchDate: match.match_date,
    status: match.status,
    score: {
      home: match.home_score ?? null,
      away: match.away_score ?? null,
    },
    lastEventsSync: match.last_events_synced_at ?? null,
    lastStatisticsSync: match.last_statistics_synced_at ?? null,
    lastLineupsSync: match.last_lineups_synced_at ?? null,
    finalDetailSyncedAt: match.final_detail_synced_at ?? null,
    finalFollowupSyncedAt: match.final_followup_synced_at ?? null,
  }
}

async function fetchEventCountsByMatchIds(supabase: SupabaseClient, matchIds: DbId[]) {
  if (!matchIds.length) return new Map<string, number>()

  const response = await supabase
    .from('match_events')
    .select('match_id')
    .in('match_id', matchIds.map(String))

  if (response.error) {
    if (isMissingOptionalTable(response.error, 'match_events')) return new Map<string, number>()
    throw response.error
  }

  return ((response.data ?? []) as Array<{ match_id: DbId }>).reduce((accumulator, row) => {
    const key = String(row.match_id)
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1)
    return accumulator
  }, new Map<string, number>())
}

function estimateRequestBudget(input: {
  liveMatchesCount: number
  startingSoonCount: number
  recentlyFinishedCount: number
  lineupsWindowCount: number
  staleUnresolvedCount?: number
}) {
  const staleUnresolvedCount = input.staleUnresolvedCount ?? 0
  const dailyBudget = 75_000
  const perRunNow = {
    globalLiveFixture: 1,
    fixtureRefreshes:
      input.startingSoonCount +
      input.recentlyFinishedCount +
      staleUnresolvedCount +
      Math.max(input.liveMatchesCount - 1, 0),
    events: input.liveMatchesCount,
    statistics: Math.ceil(input.liveMatchesCount / 5),
    lineupsDueEstimate: Math.min(input.lineupsWindowCount, input.liveMatchesCount + input.startingSoonCount),
  }
  const estimatedDailyAtCurrentLoad =
    1 * 1440 +
    input.liveMatchesCount * 1440 +
    input.liveMatchesCount * 288 +
    input.lineupsWindowCount * 4 +
    input.recentlyFinishedCount * 2 +
    staleUnresolvedCount * 2

  return {
    dailyBudget,
    perRunNow,
    estimatedDailyAtCurrentLoad,
    estimatedDailyBudgetUsagePercent: Math.round((estimatedDailyAtCurrentLoad / dailyBudget) * 1000) / 10,
    assumptions: [
      '1 request global /fixtures?live=all por minuto.',
      'Eventos solo para partidos live/relevantes.',
      'Estadisticas live cada 5 minutos.',
      'Alineaciones en ventanas T-90/T-60/T-30/inicio/final.',
    ],
  }
}

export async function auditLiveSync(
  supabase: SupabaseClient,
  options: LiveSyncAuditOptions = {}
) {
  const now = options.now ?? new Date()
  const limit = Math.min(Math.max(options.limit ?? 120, 1), 300)
  const warnings: string[] = []
  const [
    liveMatches,
    startingSoonMatches,
    lineupWindowMatches,
    recentlyFinishedMatches,
    staleUnresolvedMatches,
  ] = await Promise.all([
    fetchMatchesByStatuses(supabase, LIVE_SYNC_STATUSES, limit, warnings),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: toIsoAtOffset(now, -10),
        toIso: toIsoAtOffset(now, 15),
        limit,
      },
      warnings
    ),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: now.toISOString(),
        toIso: toIsoAtOffset(now, 90),
        limit,
      },
      warnings
    ),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: toIsoAtOffset(now, -120),
        toIso: now.toISOString(),
        limit,
      },
      warnings
    ).then((rows) => rows.filter((row) => isFinalSyncStatus(row.status))),
    fetchMatchesByDateWindow(
      supabase,
      {
        fromIso: toIsoAtOffset(now, -STALE_UNRESOLVED_LOOKBACK_MINUTES),
        toIso: toIsoAtOffset(now, -45),
        limit,
      },
      warnings
    ).then((rows) =>
      rows.filter((row) =>
        !isFinalSyncStatus(row.status) &&
        !isLiveStatus(row.status) &&
        !isPostponedStatus(row.status) &&
        isUpcomingStatus(row.status)
      )
    ),
  ])
  const candidateMap = new Map<string, StoredLiveMatchRow>()

  for (const match of [...liveMatches, ...startingSoonMatches, ...recentlyFinishedMatches, ...staleUnresolvedMatches]) {
    candidateMap.set(String(match.id), match)
  }

  const eventCounts = await fetchEventCountsByMatchIds(supabase, [...candidateMap.values()].map((match) => match.id))
  const eventsSyncedRecently = liveMatches.filter((match) =>
    !olderThan(match.last_events_synced_at, now, 2)
  )
  const matchesMissingEvents = [...candidateMap.values()].filter(
    (match) => isDetailsRelevantStatus(match.status) && (eventCounts.get(String(match.id)) ?? 0) === 0
  )
  const staleLiveMatches = liveMatches.filter((match) =>
    olderThan(match.last_events_synced_at, now, 2)
  )
  const lineupsDue = lineupWindowMatches.filter((match) =>
    shouldFetchLineups(match, match.status, now)
  )

  if (warnings.some((warning) => warning.includes('columnas de control'))) {
    warnings.push('Aplicar la migracion live_match_sync_control para tener auditoria y throttling persistentes.')
  }

  return {
    ok: warnings.length === 0,
    endpoint: 'live-sync-audit',
    now: now.toISOString(),
    liveMatches: liveMatches.map(serializeAuditMatch),
    recentlyFinishedMatches: recentlyFinishedMatches.map(serializeAuditMatch),
    staleUnresolvedMatches: staleUnresolvedMatches.map(serializeAuditMatch),
    eventsSyncedRecently: eventsSyncedRecently.map(serializeAuditMatch),
    matchesMissingEvents: matchesMissingEvents.map((match) => ({
      ...serializeAuditMatch(match),
      eventsCount: eventCounts.get(String(match.id)) ?? 0,
    })),
    staleLiveMatches: staleLiveMatches.map(serializeAuditMatch),
    requestBudgetEstimate: estimateRequestBudget({
      liveMatchesCount: liveMatches.length,
      startingSoonCount: startingSoonMatches.length,
      recentlyFinishedCount: recentlyFinishedMatches.length,
      lineupsWindowCount: lineupsDue.length,
      staleUnresolvedCount: staleUnresolvedMatches.length,
    }),
    lastEventsSync: maxIso(liveMatches.map((match) => match.last_events_synced_at)),
    lastStatisticsSync: maxIso(liveMatches.map((match) => match.last_statistics_synced_at)),
    lastLineupsSync: maxIso(lineupWindowMatches.map((match) => match.last_lineups_synced_at)),
    warnings,
  }
}
