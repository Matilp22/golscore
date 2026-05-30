import type { SupabaseClient } from '@supabase/supabase-js'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { syncLeagueStandingsCache } from '@/server/football-standings-cache'
import {
  findDerivedLigaProfesionalMatchForOfficialFixture,
  generateLigaProfesionalPlayoffs,
  markLigaProfesionalDerivedMatchAsOfficial,
} from '@/server/liga-profesional/playoffs'
import { recalculateProdePoints } from '@/server/prode/points'
import {
  ALLOWED_TOURNAMENTS,
  getAllowedTournamentBySlug,
  getAllowedTournamentByExternalId,
  normalizeLeagueName,
} from '@/shared/config/prode-leagues'
import {
  TOURNAMENT_PAGE_CONFIGS,
  VISIBLE_TOURNAMENT_PAGE_CONFIGS,
  getTournamentConfig,
  type TournamentPageConfig,
} from '@/shared/config/tournament-pages'
import {
  getCompetitionRule,
  getCompetitionVisibleNameEs,
} from '@/shared/config/competition-rules'
import { getHomeMatchVisibility } from '@/shared/utils/home-match-visibility'
import {
  isCancelledEvent,
  formatMatchEventStableKey,
  isImportantLiveEvent,
  isScoreboardGoalEvent,
  isSubstitutionEvent,
  normalizeFootballEventText,
} from '@/shared/utils/football-events'
import { getCanonicalMatchStatusFromApi, isFinishedStatus } from '@/shared/utils/match-status'
import {
  ARGENTINA_TIME_ZONE,
  addDaysToISO,
  getArgentinaDateISO,
  getArgentinaTodayISO,
} from '@/shared/utils/argentina-time'
import {
  getLeagueLogoOverrideUrl,
  pickLeagueLogoUrl,
  pickTeamLogoUrl,
} from '@/shared/utils/asset-urls'
import { getFixtureStatusElapsedMinute } from '@/shared/utils/match-minute'
import {
  LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID,
  getLeagueFinalPhaseKey,
} from '@/shared/utils/league-rounds'

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: {
      elapsed?: number | null
      extra?: number | null
      long?: string
      short: string
    }
    venue?: {
      name?: string | null
      city?: string | null
    }
    [key: string]: unknown
  }
  league: {
    id: number
    name: string
    country?: string
    season?: number
    round?: string
    logo?: string | null
    [key: string]: unknown
  }
  teams: {
    home: {
      id: number
      name: string
      logo?: string
    }
    away: {
      id: number
      name: string
      logo?: string
    }
  }
  broadcasts?: unknown
  broadcasters?: unknown
  broadcast?: unknown
  tv?: unknown
  television?: unknown
  channels?: unknown
  channel?: unknown
  streaming?: unknown
  platforms?: unknown
  platform?: unknown
  coverage?: unknown
  [key: string]: unknown
  goals: {
    home: number | null
    away: number | null
  }
  score?: {
    fulltime?: {
      home: number | null
      away: number | null
    }
    penalty?: {
      home: number | null
      away: number | null
    }
  }
}

type ApiFixtureEvent = {
  id?: number | string
  team?: {
    id?: number
    name?: string
  }
  player?: {
    id?: number
    name?: string
  }
  assist?: {
    id?: number
    name?: string
  }
  time?: {
    elapsed?: number | null
    extra?: number | null
  }
  type?: string
  detail?: string | null
  comments?: string | null
}

type ApiLeague = {
  league?: {
    id?: number
    name?: string
    logo?: string | null
  }
  country?: {
    name?: string | null
  }
  seasons?: Array<{
    year?: number
    current?: boolean
  }>
}

export type SyncTournamentResult = {
  slug: string
  name: string
  externalLeagueId: number
  season: number
  fetched: number
  processed: number
  discarded: number
  leaguesCreated: number
  leaguesUpdated: number
  teamsCreated: number
  teamsUpdated: number
  matchesCreated: number
  matchesUpdated: number
  eventsFound: number
  goalsInserted: number
  created: number
  updated: number
  skipped: number
  roundSummary: Array<{
    round: string
    count: number
    firstFixtureId: number
    lastFixtureId: number
  }>
  errors: string[]
  sampleErrors: Array<{
    fixtureId: number | null
    stage: string
    message: string
  }>
}

export type SyncMatchesResult = {
  processedTournaments: number
  fetched: number
  processed: number
  discarded: number
  teamsCreated: number
  teamsUpdated: number
  matchesCreated: number
  matchesUpdated: number
  eventsFound: number
  goalsInserted: number
  created: number
  updated: number
  skipped: number
  homeScoreboard: HomeScoreboardSyncResult | null
  tournaments: SyncTournamentResult[]
}

type DbId = string | number

type DbIdRow = {
  id: DbId
}

type SyncOptions = {
  competition?: string | null
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  leagueExternalId?: string | number | null
  debug?: boolean
  limit?: number | null
  offset?: number | null
  onlyEvents?: boolean
}

type SyncableTournament = {
  slug: string
  name: string
  type: string
  country?: string | null
  externalLeagueId: number
  season: number
  aliases: readonly string[]
}

type UpsertAction = 'created' | 'updated'

type UpsertResult = {
  id: DbId
  action: UpsertAction
}

type StoredMatchLookupRow = DbIdRow & {
  external_id?: number | string | null
}

type SyncMatchEventsResult = {
  eventsFound: number
  goalsInserted: number
}

type FixtureBroadcast = {
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
}

type HomeScoreboardSyncResult = {
  dates: string[]
  fetched: number
  selected: number
  processed: number
  cached: number
  skipped: number
  eventsFound: number
  goalsInserted: number
  pointsRecalculated: number
  leagues: Array<{
    leagueId: number
    name: string
    country?: string
    fixtures: number
  }>
  sampleErrors: Array<{
    fixtureId: number | null
    stage: string
    message: string
  }>
}

export type SyncHomeMatchesOptions = {
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  leagueExternalId?: string | number | null
  debug?: boolean
  limit?: number | null
  offset?: number | null
  liveOnly?: boolean
  skipEvents?: boolean
  skipPoints?: boolean
}

export type AvailableLeagueRow = {
  id: DbId
  name: string | null
  external_id: number | string | null
  season: number | null
  country?: string | null
}

export type SyncLeaguesOptions = {
  debug?: boolean
  limit?: number | null
  offset?: number | null
}

export type SyncLeaguesResult = {
  fetched: number
  targeted: number
  processedTargets: number
  inserted: number
  updated: number
  skipped: number
  sampleErrors: Array<{
    competition: string
    message: string
  }>
  leagues: AvailableLeagueRow[]
}

export type SyncLeagueEventsOptions = {
  competition: string
  date?: string | null
  debug?: boolean
  limit?: number | null
  offset?: number | null
  onlyEvents?: boolean
}

export type SyncCompetitionFullOptions = {
  competition?: string | null
  leagueExternalId?: string | number | null
  season?: number | null
  debug?: boolean
  limit?: number | null
  offset?: number | null
  syncEvents?: boolean
}

export type SyncCompetitionFullResult = SyncTournamentResult & {
  selected: number
  cached: number
  syncEvents: boolean
  fixturesChecked: number
  fixturesSynced: number
  standingsChecked: number
  standingsSynced: number
  roundsDetected: string[]
  groupsDetected: string[]
  warnings: string[]
}

export type SyncHomeBroadcastsFromApiOptions = {
  dateFrom: string
  dateTo: string
  leagueExternalId?: string | number | null
  leagueName?: string | null
  debug?: boolean
  limit?: number | null
  offset?: number | null
}

export type SyncHomeBroadcastsFromApiResult = {
  dates: string[]
  fetched: number
  selected: number
  processed: number
  skipped: number
  broadcastersFound: number
  broadcastersStored: number
  sample: Array<{
    fixtureId: number
    league: string
    local: string
    visitante: string
    broadcasters: string[]
  }>
  sampleErrors: Array<{
    fixtureId: number | null
    stage: string
    message: string
  }>
}

const LIVE_EVENT_SYNC_STATUSES = new Set(['LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P'])
const DEFAULT_SYNC_LIMIT = 20
const MAX_SYNC_LIMIT = 50

type EventTournamentConfig = TournamentPageConfig & {
  externalLeagueId?: number | null
}

export type SyncSingleFixtureResult = {
  fixtureId: number
  tournament: {
    slug: string
    name: string
    externalLeagueId: number
    season: number
  }
  api: {
    status: string
    statusLong?: string | null
    elapsed?: number | null
    date?: string
    goalsHome: number | null
    goalsAway: number | null
    fulltimeHome: number | null
    fulltimeAway: number | null
    resolvedHomeScore: number | null
    resolvedAwayScore: number | null
  }
  warnings: string[]
  before: {
    id: DbId
    external_id: number | string | null
    home_score: number | null
    away_score: number | null
    status: string | null
  } | null
  after: {
    id: DbId
    external_id: number | string | null
    home_score: number | null
    away_score: number | null
    status: string | null
  } | null
  eventSync?: SyncMatchEventsResult
  action: UpsertAction
  matchBefore?: SyncSingleFixtureResult['before']
  matchAfter?: SyncSingleFixtureResult['after']
  apiFixture?: {
    fixture: {
      id: number
      date: string
      status: {
        short: string
        long: string | null
        elapsed: number | null
      }
    }
    goals: {
      home: number | null
      away: number | null
    }
    score: {
      fulltime: {
        home: number | null
        away: number | null
      }
    }
  }
  updatedFields?: Record<string, { before: unknown; after: unknown }>
}

function logDebug(enabled: boolean | undefined, message: string, meta?: Record<string, unknown>) {
  if (!enabled) return

  console.info(`[sync-matches:debug] ${message}`, meta ?? {})
}

async function withTimeout<T>(promise: PromiseLike<T>, stage: string, ms = 20000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${stage} supero ${ms}ms sin responder.`)),
          ms
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function addFixtureError(
  result: SyncTournamentResult,
  fixtureId: number | null,
  stage: string,
  error: unknown
) {
  const message = error instanceof Error ? error.message : 'Error desconocido'
  const detail = fixtureId ? `Fixture ${fixtureId} (${stage}): ${message}` : `${stage}: ${message}`

  result.errors.push(detail)

  if (result.sampleErrors.length < 10) {
    result.sampleErrors.push({ fixtureId, stage, message })
  }
}

function getFixtureRoundValue(round: string | null | undefined) {
  const normalizedRound = round?.trim()

  return normalizedRound ? normalizedRound : null
}

function getFixtureHomeScore(fixture: ApiFixture) {
  return fixture.goals.home ?? fixture.score?.fulltime?.home ?? null
}

function getFixtureAwayScore(fixture: ApiFixture) {
  return fixture.goals.away ?? fixture.score?.fulltime?.away ?? null
}

function normalizeNullableFixtureText(value: string | null | undefined) {
  const trimmed = value?.trim()

  return trimmed || null
}

function getFixtureVenuePayload(fixture: ApiFixture) {
  return {
    venue_name: normalizeNullableFixtureText(fixture.fixture.venue?.name),
    venue_city: normalizeNullableFixtureText(fixture.fixture.venue?.city),
    venue_country: normalizeNullableFixtureText(fixture.league.country),
  }
}

function getFixtureCachePayload(fixture: ApiFixture) {
  return {
    id: fixture.fixture.id,
    externalId: fixture.fixture.id,
    leagueId: fixture.league.id,
    league: fixture.league.name,
    season: fixture.league.season ?? null,
    leagueLogo: pickLeagueLogoUrl(null, fixture.league.id, fixture.league.logo) ?? null,
    country: fixture.league.country ?? null,
    date: fixture.fixture.date,
    round: fixture.league.round ?? null,
    homeId: fixture.teams.home.id,
    home: fixture.teams.home.name,
    awayId: fixture.teams.away.id,
    away: fixture.teams.away.name,
    homeLogo: pickTeamLogoUrl(null, fixture.teams.home.id, fixture.teams.home.logo) ?? null,
    awayLogo: pickTeamLogoUrl(null, fixture.teams.away.id, fixture.teams.away.logo) ?? null,
    goalsHome: getFixtureHomeScore(fixture),
    goalsAway: getFixtureAwayScore(fixture),
    homePenaltyScore: fixture.score?.penalty?.home ?? null,
    awayPenaltyScore: fixture.score?.penalty?.away ?? null,
    minute: getFixtureStatusElapsedMinute(fixture.fixture.status),
    statusShort: getCanonicalMatchStatusFromApi(fixture.fixture.status),
    statusLong: fixture.fixture.status.long ?? fixture.fixture.status.short,
  }
}

function readFixtureCacheRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function readExistingFixtureMatchDetail(
  supabase: SupabaseClient,
  fixtureExternalId: number
) {
  const response = await withTimeout(
    supabase
      .from('football_fixture_cache')
      .select('normalized_payload')
      .eq('fixture_external_id', String(fixtureExternalId))
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    `football fixture cache existing detail ${fixtureExternalId}`
  )

  if (response.error) {
    if (isMissingFixtureCacheTable(response.error)) return null
    throw new Error(
      `No se pudo leer cache existente del fixture ${fixtureExternalId}: ${response.error.message}`
    )
  }

  const normalizedPayload = readFixtureCacheRecord(
    (response.data as { normalized_payload?: unknown } | null)?.normalized_payload
  )
  return normalizedPayload?.matchDetail ?? null
}

function isMissingFixtureCacheTable(error: { code?: string; message?: string } | null) {
  if (!error) return false

  const message = (error.message ?? '').toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('football_fixture_cache') ||
    message.includes('schema cache')
  )
}

async function upsertFixtureCache(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  debug?: boolean
) {
  const existingMatchDetail = await readExistingFixtureMatchDetail(
    supabase,
    fixture.fixture.id
  )
  const normalizedPayload = {
    ...getFixtureCachePayload(fixture),
    ...(existingMatchDetail ? { matchDetail: existingMatchDetail } : {}),
  }
  const cacheDate = getArgentinaDateKey(fixture.fixture.date)
  const response = await withTimeout(
    supabase
      .from('football_fixture_cache')
      .upsert(
        {
          date: cacheDate,
          league_external_id: String(fixture.league.id),
          fixture_external_id: String(fixture.fixture.id),
          payload: fixture,
          normalized_payload: normalizedPayload,
        },
        { onConflict: 'date,fixture_external_id' }
      ),
    `football fixture cache upsert ${fixture.fixture.id}`
  )

  if (!response.error) {
    const cleanup = await withTimeout(
      supabase
        .from('football_fixture_cache')
        .delete()
        .eq('fixture_external_id', String(fixture.fixture.id))
        .neq('date', cacheDate),
      `football fixture cache cleanup ${fixture.fixture.id}`
    )

    if (cleanup.error && !isMissingFixtureCacheTable(cleanup.error)) {
      throw new Error(
        `No se pudo limpiar cache duplicado del fixture ${fixture.fixture.id}: ${cleanup.error.message}`
      )
    }

    logDebug(debug, 'fixture cached', {
      fixtureId: fixture.fixture.id,
      date: cacheDate,
      leagueExternalId: fixture.league.id,
    })

    return true
  }

  if (isMissingFixtureCacheTable(response.error)) {
    console.warn('[sync-fixtures] football_fixture_cache no disponible; se continua con matches.', {
      fixtureId: fixture.fixture.id,
      message: response.error.message,
    })

    return false
  }

  throw new Error(`No se pudo cachear fixture ${fixture.fixture.id}: ${response.error.message}`)
}

function hasResolvedScore(fixture: ApiFixture) {
  return getFixtureHomeScore(fixture) !== null && getFixtureAwayScore(fixture) !== null
}

function hasAnyFixtureGoals(fixture: ApiFixture) {
  return (getFixtureHomeScore(fixture) ?? 0) > 0 || (getFixtureAwayScore(fixture) ?? 0) > 0
}

function shouldRecalculateProdePoints(fixture: ApiFixture) {
  return isFinishedStatus(fixture.fixture.status.short) && hasResolvedScore(fixture)
}

function isLiveEventSyncStatus(statusShort: string) {
  return LIVE_EVENT_SYNC_STATUSES.has(statusShort)
}

function getUpdatedFields(
  before: SyncSingleFixtureResult['before'],
  after: SyncSingleFixtureResult['after']
) {
  const fields: Record<string, { before: unknown; after: unknown }> = {}

  if (!after) return fields

  for (const field of ['status', 'home_score', 'away_score', 'external_id'] as const) {
    const beforeValue = before?.[field] ?? null
    const afterValue = after[field] ?? null

    if (beforeValue !== afterValue) {
      fields[field] = {
        before: beforeValue,
        after: afterValue,
      }
    }
  }

  return fields
}

function getTeamLogoUrl(team: { id: number; logo?: string | null }) {
  return pickTeamLogoUrl(null, team.id, team.logo)
}

function getLeagueLogoUrl(league: { id?: number; logo?: string | null }) {
  return pickLeagueLogoUrl(null, league.id, league.logo)
}

const BROADCAST_SOURCE_KEYS = [
  'broadcast',
  'broadcasts',
  'broadcaster',
  'broadcasters',
  'tv',
  'television',
  'channel',
  'channels',
  'streaming',
  'platform',
  'platforms',
  'transmission',
  'transmissions',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBroadcastText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)

  return null
}

function readBroadcastTextFromKeys(
  source: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = readBroadcastText(source[key])

    if (value) return value
  }

  return null
}

function readBroadcastCountry(value: unknown): string | null {
  const text = readBroadcastText(value)

  if (text) return text
  if (!isRecord(value)) return null

  return readBroadcastTextFromKeys(value, ['name', 'country', 'code'])
}

function collectFixtureBroadcastsFromValue(
  value: unknown,
  sourceKey: string
): FixtureBroadcast[] {
  if (value === null || value === undefined || typeof value === 'boolean') return []

  const directText = readBroadcastText(value)
  if (directText) {
    return [{
      broadcaster_name: directText,
      broadcaster_logo_url: null,
      country: null,
    }]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectFixtureBroadcastsFromValue(item, sourceKey))
  }

  if (!isRecord(value)) return []

  const nestedNameSource =
    value.broadcaster ??
    value.broadcast ??
    value.channel ??
    value.network ??
    value.provider ??
    value.platform ??
    value.tv
  const nestedName =
    readBroadcastText(nestedNameSource) ||
    (isRecord(nestedNameSource)
      ? readBroadcastTextFromKeys(nestedNameSource, ['name', 'title', 'label'])
      : null)
  const directName =
    readBroadcastTextFromKeys(value, [
      'broadcaster_name',
      'broadcasterName',
      'name',
      'title',
      'label',
      'channel_name',
      'channelName',
      'network',
      'provider',
      'platform',
    ]) || nestedName
  const directLogo =
    readBroadcastTextFromKeys(value, [
      'broadcaster_logo_url',
      'broadcasterLogoUrl',
      'logo',
      'logo_url',
      'logoUrl',
      'image',
      'image_url',
      'imageUrl',
    ]) ||
    (isRecord(nestedNameSource)
      ? readBroadcastTextFromKeys(nestedNameSource, [
          'logo',
          'logo_url',
          'logoUrl',
          'image',
          'image_url',
          'imageUrl',
        ])
      : null)
  const directCountry = readBroadcastCountry(value.country)

  const matches: FixtureBroadcast[] = directName
    ? [{
        broadcaster_name: directName,
        broadcaster_logo_url: directLogo,
        country: directCountry,
      }]
    : []

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    const shouldInspectChild =
      BROADCAST_SOURCE_KEYS.some((candidate) => normalizedKey.includes(candidate)) ||
      sourceKey.toLowerCase().includes('coverage')

    if (shouldInspectChild) {
      matches.push(...collectFixtureBroadcastsFromValue(child, key))
    }
  }

  return matches
}

function normalizeBroadcastName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFixtureBroadcasts(fixture: ApiFixture): FixtureBroadcast[] {
  const sourceEntries: Array<[string, unknown]> = [
    ['broadcasts', fixture.broadcasts],
    ['broadcasters', fixture.broadcasters],
    ['broadcast', fixture.broadcast],
    ['tv', fixture.tv],
    ['television', fixture.television],
    ['channels', fixture.channels],
    ['channel', fixture.channel],
    ['streaming', fixture.streaming],
    ['platforms', fixture.platforms],
    ['platform', fixture.platform],
    ['coverage', fixture.coverage],
    ['fixture.broadcasts', fixture.fixture.broadcasts],
    ['fixture.broadcasters', fixture.fixture.broadcasters],
    ['fixture.broadcast', fixture.fixture.broadcast],
    ['fixture.tv', fixture.fixture.tv],
    ['fixture.television', fixture.fixture.television],
    ['fixture.channels', fixture.fixture.channels],
    ['fixture.channel', fixture.fixture.channel],
    ['league.broadcasts', fixture.league.broadcasts],
    ['league.broadcasters', fixture.league.broadcasters],
    ['league.tv', fixture.league.tv],
    ['league.coverage', fixture.league.coverage],
  ]
  const byName = new Map<string, FixtureBroadcast>()

  for (const [key, value] of sourceEntries) {
    for (const broadcast of collectFixtureBroadcastsFromValue(value, key)) {
      const name = broadcast.broadcaster_name.trim()
      const normalizedName = normalizeBroadcastName(name)

      if (!normalizedName) continue

      const existing = byName.get(normalizedName)
      byName.set(normalizedName, {
        broadcaster_name: existing?.broadcaster_name ?? name,
        broadcaster_logo_url:
          existing?.broadcaster_logo_url ?? broadcast.broadcaster_logo_url,
        country: existing?.country ?? broadcast.country ?? fixture.league.country ?? null,
      })
    }
  }

  return [...byName.values()]
}

function isMissingOptionalMatchBroadcasts(error: { code?: string; message?: string } | unknown) {
  const errorObject =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : {}
  const message = (errorObject.message ?? String(error)).toLowerCase()

  return (
    errorObject.code === '42P01' ||
    errorObject.code === '42703' ||
    errorObject.code === 'PGRST204' ||
    errorObject.code === 'PGRST205' ||
    message.includes('match_broadcasts') ||
    message.includes('schema cache')
  )
}

async function syncMatchBroadcastsFromFixtureIfSupported(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  matchId: DbId,
  debug?: boolean
) {
  const broadcasts = extractFixtureBroadcasts(fixture)

  if (!broadcasts.length) {
    logDebug(debug, 'fixture has no API broadcaster payload', {
      fixtureId: fixture.fixture.id,
      league: fixture.league.name,
    })

    return { broadcastsFound: 0, broadcastsStored: 0 }
  }

  const payload = broadcasts.map((broadcast) => ({
    match_id: matchId,
    broadcaster_name: broadcast.broadcaster_name,
    broadcaster_logo_url: broadcast.broadcaster_logo_url,
    country: broadcast.country,
    source: 'provider',
    confidence: 'high',
    verified: true,
    created_by_rule_id: null,
  }))

  const response = await withTimeout(
    supabase
      .from('match_broadcasts')
      .upsert(payload, { onConflict: 'match_id,broadcaster_name' }),
    `match_broadcasts upsert ${fixture.fixture.id}`
  )

  if (response.error) {
    if (isMissingOptionalMatchBroadcasts(response.error)) {
      console.warn('[sync-match-broadcasts] Tabla match_broadcasts no disponible.', {
        fixtureId: fixture.fixture.id,
        league: fixture.league.name,
      })

      return { broadcastsFound: broadcasts.length, broadcastsStored: 0 }
    }

    throw response.error
  }

  console.info('[sync-match-broadcasts] emisoras procesadas', {
    fixtureId: fixture.fixture.id,
    league: fixture.league.name,
    broadcastersFound: broadcasts.length,
    broadcastersStored: payload.length,
    broadcasters: broadcasts.map((broadcast) => broadcast.broadcaster_name),
  })

  return { broadcastsFound: broadcasts.length, broadcastsStored: payload.length }
}

async function safeSyncMatchBroadcastsFromFixture(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  matchId: DbId,
  debug?: boolean
) {
  try {
    return await syncMatchBroadcastsFromFixtureIfSupported(
      supabase,
      fixture,
      matchId,
      debug
    )
  } catch (error) {
    console.warn('[sync-match-broadcasts] No se pudo guardar televisacion API.', {
      fixtureId: fixture.fixture.id,
      league: fixture.league.name,
      matchId,
      message: error instanceof Error ? error.message : String(error),
    })

    return { broadcastsFound: 0, broadcastsStored: 0 }
  }
}

function getArgentinaDateKey(dateString: string) {
  return getArgentinaDateISO(dateString)
}

function getTournamentSelection(slug?: string | null) {
  if (!slug) return []

  const normalizedSlug = slugifyLeagueName(slug)
  const tournament = getAllowedTournamentBySlug(slug)

  if (tournament) return [tournament]

  const fallbackTournament = ALLOWED_TOURNAMENTS.find((candidate) => {
    if (String(candidate.externalLeagueId) === slug) return true
    if (slugifyLeagueName(candidate.slug) === normalizedSlug) return true
    if (slugifyLeagueName(candidate.name) === normalizedSlug) return true

    return candidate.aliases.some((alias) => slugifyLeagueName(alias) === normalizedSlug)
  })

  return fallbackTournament ? [fallbackTournament] : []
}

function slugifyLeagueName(value: string | null | undefined) {
  return normalizeLeagueName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getBatchLimit(value: number | null | undefined) {
  if (!value || value <= 0) return DEFAULT_SYNC_LIMIT

  return Math.min(Math.floor(value), MAX_SYNC_LIMIT)
}

function getBatchOffset(value: number | null | undefined) {
  if (!value || value <= 0) return 0

  return Math.floor(value)
}

const FULL_SYNC_PROTECTED_EXTERNAL_IDS: Record<string, number> = {
  'argentina-liga-profesional': 128,
  'argentina-copa-argentina': 130,
}

const EUROPEAN_SEASON_EXTERNAL_IDS = new Set([
  2,
  3,
  848,
  39,
  45,
  61,
  66,
  78,
  81,
  94,
  96,
  135,
  137,
  140,
  143,
])

function getDefaultSyncSeason(leagueExternalId: number) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  if (EUROPEAN_SEASON_EXTERNAL_IDS.has(leagueExternalId)) {
    return month >= 7 ? year : year - 1
  }

  if (leagueExternalId === 9 || leagueExternalId === 4 || leagueExternalId === 960) {
    return 2024
  }

  if (leagueExternalId === 5) return 2025

  return year
}

function getConfiguredExternalIdForTournament(tournament: TournamentPageConfig | null) {
  if (!tournament) return null

  return (
    getCompetitionRule(tournament.key)?.externalIds[0] ??
    FULL_SYNC_PROTECTED_EXTERNAL_IDS[tournament.key] ??
    null
  )
}

function getTournamentByExternalId(leagueExternalId: number) {
  return VISIBLE_TOURNAMENT_PAGE_CONFIGS.find((tournament) =>
    getCompetitionRule(tournament.key)?.externalIds.includes(leagueExternalId) ||
    FULL_SYNC_PROTECTED_EXTERNAL_IDS[tournament.key] === leagueExternalId
  ) ?? null
}

function getFullSyncTournament(options: SyncCompetitionFullOptions): SyncableTournament {
  const directAllowed =
    getAllowedTournamentBySlug(options.competition) ??
    getAllowedTournamentByExternalId(options.leagueExternalId ?? options.competition)
  const configuredTournament = options.competition
    ? getEventTournamentConfig(options.competition)
    : null
  const optionExternalId =
    options.leagueExternalId === null || options.leagueExternalId === undefined
      ? null
      : Number(options.leagueExternalId)
  const directExternalId =
    Number.isFinite(optionExternalId) && optionExternalId
      ? optionExternalId
      : null
  const configuredExternalId =
    directAllowed?.externalLeagueId ??
    directExternalId ??
    getConfiguredExternalIdForTournament(configuredTournament)

  if (!configuredExternalId) {
    throw new Error('Debe indicar competition o leagueExternalId valido para sync full.')
  }

  const tournament =
    configuredTournament ??
    getTournamentByExternalId(configuredExternalId) ??
    null
  const rule = tournament ? getCompetitionRule(tournament.key) : null
  const season =
    options.season ??
    directAllowed?.season ??
    getDefaultSyncSeason(configuredExternalId)
  const slug =
    directAllowed?.slug ??
    tournament?.key ??
    `league-${configuredExternalId}`
  const name =
    directAllowed?.name ??
    (tournament
      ? getCompetitionVisibleNameEs(tournament.key, tournament.title)
      : `Liga ${configuredExternalId}`)
  const aliases = [
    name,
    ...(directAllowed?.aliases ?? []),
    ...(tournament?.searchTerms ?? []),
    ...(rule?.aliases ?? []),
  ]

  return {
    slug,
    name,
    type: directAllowed?.type ?? rule?.type ?? 'cup',
    country: tournament?.country ?? null,
    externalLeagueId: configuredExternalId,
    season,
    aliases,
  }
}

function fixtureMatchesTournamentConfig(fixture: ApiFixture, tournament: EventTournamentConfig) {
  if (
    tournament.externalLeagueId !== undefined &&
    tournament.externalLeagueId !== null
  ) {
    return fixture.league.id === tournament.externalLeagueId
  }

  const fixtureLeague = normalizeLeagueName(fixture.league.name)
  const fixtureCountry = normalizeLeagueName(fixture.league.country)
  const tournamentCountry = normalizeLeagueName(tournament.country)
  const countryMatches =
    !tournamentCountry ||
    tournamentCountry === fixtureCountry ||
    tournamentCountry === 'world'

  if (!countryMatches) return false

  return tournament.searchTerms.some((term) => {
    const normalizedTerm = normalizeLeagueName(term)

    return (
      fixtureLeague === normalizedTerm ||
      containsNormalizedPhrase(fixtureLeague, normalizedTerm)
    )
  })
}

function leagueMatchesTournamentConfig(league: ApiLeague, tournament: TournamentPageConfig) {
  const leagueName = normalizeLeagueName(league.league?.name)
  const leagueCountry = normalizeLeagueName(league.country?.name)
  const tournamentCountry = normalizeLeagueName(tournament.country)
  const countryMatches =
    !tournamentCountry ||
    tournamentCountry === leagueCountry ||
    tournamentCountry === 'world'

  if (!countryMatches || !leagueName) return false

  return tournament.searchTerms.some((term) => {
    const normalizedTerm = normalizeLeagueName(term)

    return leagueName === normalizedTerm || containsNormalizedPhrase(leagueName, normalizedTerm)
  })
}

function getLeagueTournamentMatchScore(league: ApiLeague, tournament: TournamentPageConfig) {
  if (!leagueMatchesTournamentConfig(league, tournament)) return 0

  const leagueName = normalizeLeagueName(league.league?.name)
  const tournamentTitle = normalizeLeagueName(tournament.title)
  let score = leagueName === tournamentTitle ? 120 : 0

  for (const term of tournament.searchTerms) {
    const normalizedTerm = normalizeLeagueName(term)

    if (leagueName === normalizedTerm) {
      score = Math.max(score, 110)
    } else if (containsNormalizedPhrase(leagueName, normalizedTerm)) {
      score = Math.max(score, 80)
    }
  }

  return score
}

function containsNormalizedPhrase(value: string, phrase: string) {
  if (!value || !phrase) return false

  return ` ${value} `.includes(` ${phrase} `)
}

function fixtureMatchesHomeTournament(fixture: ApiFixture) {
  return getHomeMatchVisibility({
    leagueId: fixture.league.id ?? null,
    league: fixture.league.name,
    country: fixture.league.country,
    home: fixture.teams.home.name,
    away: fixture.teams.away.name,
    round: fixture.league.round,
  }).included
}

function getEventTournamentConfig(competition: string) {
  const directMatch = getTournamentConfig(competition)

  if (directMatch) return directMatch

  const normalizedCompetition = normalizeLeagueName(competition)
  const competitionSlug = slugifyLeagueName(competition)

  return (
    TOURNAMENT_PAGE_CONFIGS.find((tournament) => {
      if (normalizeLeagueName(tournament.title) === normalizedCompetition) return true
      if (normalizeLeagueName(tournament.key) === normalizedCompetition) return true
      if (slugifyLeagueName(tournament.title) === competitionSlug) return true
      if (slugifyLeagueName(tournament.key) === competitionSlug) return true

      return tournament.searchTerms.some(
        (term) =>
          normalizeLeagueName(term) === normalizedCompetition ||
          slugifyLeagueName(term) === competitionSlug
      )
    }) ?? null
  )
}

export async function getAvailableLeagues(supabase: SupabaseClient) {
  const { data, error } = await withTimeout(
    supabase
      .from('leagues')
      .select('id, name, external_id, season, country')
      .order('name', { ascending: true }),
    'available leagues lookup'
  )

  if (error) {
    throw new Error(`No se pudieron leer ligas disponibles: ${error.message}`)
  }

  return (data ?? []) as AvailableLeagueRow[]
}

async function getEventTournamentConfigFromDb(
  supabase: SupabaseClient,
  competition: string
): Promise<EventTournamentConfig | null> {
  const availableLeagues = await getAvailableLeagues(supabase)
  const configuredTournament = getEventTournamentConfig(competition)
  const normalizedCompetition = normalizeLeagueName(competition)
  const competitionSlug = slugifyLeagueName(competition)
  const externalId = Number(competition)
  const matchingLeague = availableLeagues
    .map((league) => {
      const apiLeague: ApiLeague = {
        league: {
          id: Number(league.external_id),
          name: league.name ?? undefined,
        },
        country: {
          name: league.country ?? undefined,
        },
      }
      let score = 0

      if (configuredTournament) {
        score = Math.max(score, getLeagueTournamentMatchScore(apiLeague, configuredTournament))
      }

      const name = league.name ?? ''

      if (Number.isFinite(externalId) && Number(league.external_id) === externalId) {
        score = Math.max(score, 130)
      }
      if (normalizeLeagueName(name) === normalizedCompetition) {
        score = Math.max(score, 120)
      }
      if (slugifyLeagueName(name) === competitionSlug) {
        score = Math.max(score, 120)
      }

      return { league, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.league ?? null

  if (!matchingLeague?.name) return null

  return {
    key: slugifyLeagueName(matchingLeague.name),
    title: matchingLeague.name,
    sectionKey: configuredTournament?.sectionKey ?? 'db',
    country: matchingLeague.country ?? configuredTournament?.country,
    searchTerms: [matchingLeague.name],
    externalLeagueId:
      matchingLeague.external_id === null || matchingLeague.external_id === undefined
        ? null
        : Number(matchingLeague.external_id),
  }
}

async function getEventTournamentConfigFromCompetition(
  supabase: SupabaseClient,
  competition: string
) {
  return (
    (await getEventTournamentConfigFromDb(supabase, competition)) ??
    getEventTournamentConfig(competition)
  )
}

function createEmptyHomeScoreboardResult(dates: string[]): HomeScoreboardSyncResult {
  return {
    dates,
    fetched: 0,
    selected: 0,
    processed: 0,
    cached: 0,
    skipped: 0,
    eventsFound: 0,
    goalsInserted: 0,
    pointsRecalculated: 0,
    leagues: [],
    sampleErrors: [],
  }
}

function getInclusiveDateRange(dateFrom: string, dateTo: string, maxDays = 14) {
  const dates: string[] = []
  let current = dateFrom

  while (current <= dateTo && dates.length < maxDays) {
    dates.push(current)
    current = addDaysToISO(current, 1)
  }

  return dates
}

function addHomeScoreboardError(
  result: HomeScoreboardSyncResult,
  fixtureId: number | null,
  stage: string,
  error: unknown
) {
  if (result.sampleErrors.length >= 10) return

  result.sampleErrors.push({
    fixtureId,
    stage,
    message: error instanceof Error ? error.message : 'Error desconocido',
  })
}

function summarizeFixtureRounds(fixtures: ApiFixture[]) {
  const grouped = new Map<string, ApiFixture[]>()

  for (const fixture of fixtures) {
    const round = fixture.league.round || 'Sin fase'
    const current = grouped.get(round) || []
    current.push(fixture)
    grouped.set(round, current)
  }

  return [...grouped.entries()].map(([round, roundFixtures]) => {
    const sorted = [...roundFixtures].sort(compareFixturesByApiOrder)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    return {
      round,
      count: sorted.length,
      firstFixtureId: first?.fixture.id ?? 0,
      lastFixtureId: last?.fixture.id ?? 0,
    }
  })
}

function compareFixturesByApiOrder(a: ApiFixture, b: ApiFixture) {
  const roundCompare = getApiRoundOrder(a.league.round) - getApiRoundOrder(b.league.round)
  if (roundCompare !== 0) return roundCompare

  const dateCompare = new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime()
  if (dateCompare !== 0) return dateCompare

  return a.fixture.id - b.fixture.id
}

function getApiRoundOrder(round: string | null | undefined) {
  const normalized = (round || '').toLowerCase()

  if (normalized.includes('round of 64') || normalized.includes('32nd finals')) return 10
  if (normalized.includes('round of 32') || normalized.includes('16th finals')) return 20
  if (normalized.includes('round of 16') || normalized.includes('8th finals') || normalized.includes('octavos')) return 30
  if (normalized.includes('quarter') || normalized.includes('cuartos')) return 40
  if (normalized.includes('semi') || normalized.includes('semifinal')) return 50
  if (normalized.includes('final') && !normalized.includes('semi')) return 60
  return 999
}

function buildLigaProfesionalOfficialBracketSlots(fixtures: ApiFixture[]) {
  const groupedByPhase = new Map<string, ApiFixture[]>()

  for (const fixture of fixtures) {
    if (fixture.league.id !== LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID) continue

    const phase = getLeagueFinalPhaseKey(fixture.league.round)
    if (!phase) continue

    const current = groupedByPhase.get(phase) ?? []
    current.push(fixture)
    groupedByPhase.set(phase, current)
  }

  const slotsByFixtureId = new Map<number, number>()

  for (const matches of groupedByPhase.values()) {
    [...matches].sort(compareFixturesByApiOrder).forEach((fixture, index) => {
      slotsByFixtureId.set(fixture.fixture.id, index + 1)
    })
  }

  return slotsByFixtureId
}

async function fetchTournamentFixtures(tournament: SyncableTournament) {
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      league: tournament.externalLeagueId,
      season: tournament.season,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    { logContext: `sync-matches:${tournament.slug}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return payload.response ?? []
}

async function fetchFixturesByApiDate(date: string, logContext: string) {
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      date,
      timezone: ARGENTINA_TIME_ZONE,
    },
    { logContext }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return payload.response ?? []
}

async function fetchFixturesByDate(date: string) {
  const apiDates = [addDaysToISO(date, -1), date, addDaysToISO(date, 1)]
  const fixturesById = new Map<number, ApiFixture>()

  for (const apiDate of apiDates) {
    const fixtures = await fetchFixturesByApiDate(
      apiDate,
      `sync-home-scoreboard:${date}:api-date:${apiDate}`
    )

    for (const fixture of fixtures) {
      if (getArgentinaDateKey(fixture.fixture.date) !== date) continue
      fixturesById.set(fixture.fixture.id, fixture)
    }
  }

  return [...fixturesById.values()].sort(compareFixturesByApiOrder)
}

async function fetchCurrentLeagues() {
  const { payload } = await requestFootballApi<ApiLeague[]>(
    '/leagues',
    {
      current: 'true',
    },
    { logContext: 'sync-leagues:current' }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return payload.response ?? []
}

async function fetchFixtureById(fixtureId: number) {
  const { payload } = await requestFootballApi<ApiFixture[]>(
    '/fixtures',
    {
      id: fixtureId,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    { logContext: `sync-match:${fixtureId}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  const fixture = payload.response?.[0] ?? null

  if (!fixture) {
    throw new Error(`API-Football no devolvio el fixture ${fixtureId}.`)
  }

  return fixture
}

async function fetchFixtureEvents(fixtureId: number) {
  const { payload } = await requestFootballApi<ApiFixtureEvent[]>(
    '/fixtures/events',
    { fixture: fixtureId },
    { logContext: `sync-match-events:${fixtureId}` }
  )
  const apiErrors = payload.errors ? Object.values(payload.errors).filter(Boolean) : []

  if (apiErrors.length) {
    throw new Error(apiErrors.join(' | '))
  }

  return payload.response ?? []
}

async function upsertLeague(
  supabase: SupabaseClient,
  tournament: SyncableTournament,
  fixture: ApiFixture | null,
  debug?: boolean
) {
  const payload = {
    external_id: tournament.externalLeagueId,
    name: tournament.name,
    country:
      fixture?.league.country ??
      tournament.country ??
      (tournament.type === 'cup' || tournament.type === 'group_cup' ? 'World' : 'Argentina'),
    season: tournament.season,
    logo_url: getLeagueLogoUrl({
      id: tournament.externalLeagueId,
      logo: fixture?.league.logo,
    }),
    logo_source: getLeagueLogoOverrideUrl(tournament.externalLeagueId)
      ? 'manual-override-2026'
      : 'api-football',
    logo_last_synced_at: new Date().toISOString(),
  }

  logDebug(debug, 'league lookup by external_id started', {
    external_id: tournament.externalLeagueId,
  })

  const { data: existingByExternalId, error: externalIdError } = await withTimeout(
    supabase
      .from('leagues')
      .select('id')
      .eq('external_id', tournament.externalLeagueId)
      .maybeSingle(),
    `leagues lookup ${tournament.externalLeagueId}`
  )

  logDebug(debug, 'league lookup by external_id finished', {
    external_id: tournament.externalLeagueId,
    found: Boolean(existingByExternalId),
    error: externalIdError?.message ?? null,
  })

  if (externalIdError) {
    throw new Error(`No se pudo buscar la liga ${tournament.name}: ${externalIdError.message}`)
  }

  if (existingByExternalId) {
    logDebug(debug, 'league update started', { id: (existingByExternalId as DbIdRow).id })

    const { data, error } = await withTimeout(
      supabase
        .from('leagues')
        .update(payload)
        .eq('id', (existingByExternalId as DbIdRow).id)
        .select('id')
        .single(),
      `leagues update ${tournament.externalLeagueId}`
    )

    logDebug(debug, 'league update finished', {
      id: (existingByExternalId as DbIdRow).id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo actualizar la liga ${tournament.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  const allowedNames = new Set(
    [tournament.name, ...tournament.aliases].map((name) => normalizeLeagueName(name))
  )
  logDebug(debug, 'legacy league lookup started', { tournament: tournament.slug })

  const { data: legacyLeagues, error: legacyError } = await withTimeout(
    supabase
      .from('leagues')
      .select('id, name, external_id')
      .is('external_id', null),
    `legacy leagues lookup ${tournament.slug}`
  )

  logDebug(debug, 'legacy league lookup finished', {
    tournament: tournament.slug,
    count: legacyLeagues?.length ?? 0,
    error: legacyError?.message ?? null,
  })

  if (legacyError) {
    throw new Error(`No se pudo buscar ligas legacy para ${tournament.name}: ${legacyError.message}`)
  }

  const reusableLegacyLeague = (legacyLeagues as Array<DbIdRow & {
    name: string | null
    external_id: number | null
  }> | null)?.find((league) => allowedNames.has(normalizeLeagueName(league.name)))

  if (reusableLegacyLeague) {
    logDebug(debug, 'legacy league normalize started', { id: reusableLegacyLeague.id })

    const { data, error } = await withTimeout(
      supabase
        .from('leagues')
        .update(payload)
        .eq('id', reusableLegacyLeague.id)
        .select('id')
        .single(),
      `legacy league normalize ${tournament.slug}`
    )

    logDebug(debug, 'legacy league normalize finished', {
      id: reusableLegacyLeague.id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo normalizar la liga ${tournament.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'league insert started', { external_id: tournament.externalLeagueId })

  const { data, error } = await withTimeout(
    supabase
      .from('leagues')
      .insert(payload)
      .select('id')
      .single(),
    `leagues insert ${tournament.externalLeagueId}`
  )

  logDebug(debug, 'league insert finished', {
    external_id: tournament.externalLeagueId,
    error: error?.message ?? null,
  })

  if (error) throw new Error(`No se pudo guardar la liga ${tournament.name}: ${error.message}`)

  return {
    id: (data as DbIdRow).id,
    action: 'created' as const,
  }
}

async function upsertLeagueFromFixture(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  debug?: boolean
) {
  const leagueExternalId = fixture.league.id
  const leagueName = fixture.league.name
  const payload = {
    external_id: leagueExternalId,
    name: leagueName,
    country: fixture.league.country ?? null,
    season: fixture.league.season ?? new Date(fixture.fixture.date).getUTCFullYear(),
    logo_url: getLeagueLogoUrl(fixture.league),
    logo_source: 'api-football',
    logo_last_synced_at: new Date().toISOString(),
  }

  const { data: existingByExternalId, error: externalIdError } = await withTimeout(
    supabase
      .from('leagues')
      .select('id')
      .eq('external_id', leagueExternalId)
      .maybeSingle(),
    `home leagues lookup ${leagueExternalId}`
  )

  if (externalIdError) {
    throw new Error(`No se pudo buscar la liga ${leagueName}: ${externalIdError.message}`)
  }

  if (existingByExternalId) {
    const { data, error } = await withTimeout(
      supabase
        .from('leagues')
        .update(payload)
        .eq('id', (existingByExternalId as DbIdRow).id)
        .select('id')
        .single(),
      `home leagues update ${leagueExternalId}`
    )

    if (error) throw new Error(`No se pudo actualizar la liga ${leagueName}: ${error.message}`)

    logDebug(debug, 'home league updated', { leagueExternalId, leagueName })

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  const { data, error } = await withTimeout(
    supabase
      .from('leagues')
      .insert(payload)
      .select('id')
      .single(),
    `home leagues insert ${leagueExternalId}`
  )

  if (error) throw new Error(`No se pudo guardar la liga ${leagueName}: ${error.message}`)

  logDebug(debug, 'home league inserted', { leagueExternalId, leagueName })

  return {
    id: (data as DbIdRow).id,
    action: 'created' as const,
  }
}

function getLeagueSeason(apiLeague: ApiLeague) {
  const currentSeason = apiLeague.seasons?.find((season) => season.current && season.year)
  const latestSeason = [...(apiLeague.seasons ?? [])]
    .filter((season) => typeof season.year === 'number')
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0]

  return currentSeason?.year ?? latestSeason?.year ?? new Date().getUTCFullYear()
}

async function upsertLeagueFromApi(
  supabase: SupabaseClient,
  apiLeague: ApiLeague,
  debug?: boolean
) {
  const externalId = apiLeague.league?.id
  const name = apiLeague.league?.name?.trim()

  if (!externalId || !name) {
    throw new Error('Liga de API-Football sin id o nombre.')
  }

  const payload = {
    external_id: externalId,
    name,
    country: apiLeague.country?.name ?? null,
    season: getLeagueSeason(apiLeague),
    logo_url: getLeagueLogoUrl({
      id: externalId,
      logo: apiLeague.league?.logo,
    }),
    logo_source: 'api-football',
    logo_last_synced_at: new Date().toISOString(),
  }

  const { data: existingByExternalId, error: externalIdError } = await withTimeout(
    supabase
      .from('leagues')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle(),
    `sync-leagues lookup ${externalId}`
  )

  if (externalIdError) {
    throw new Error(`No se pudo buscar la liga ${name}: ${externalIdError.message}`)
  }

  if (existingByExternalId) {
    const { data, error } = await withTimeout(
      supabase
        .from('leagues')
        .update(payload)
        .eq('id', (existingByExternalId as DbIdRow).id)
        .select('id, name, external_id, season')
        .single(),
      `sync-leagues update ${externalId}`
    )

    if (error) throw new Error(`No se pudo actualizar la liga ${name}: ${error.message}`)

    logDebug(debug, 'league updated from API', { externalId, name })

    return {
      action: 'updated' as const,
      league: data as AvailableLeagueRow,
    }
  }

  const { data, error } = await withTimeout(
    supabase
      .from('leagues')
      .insert(payload)
      .select('id, name, external_id, season')
      .single(),
    `sync-leagues insert ${externalId}`
  )

  if (error) throw new Error(`No se pudo guardar la liga ${name}: ${error.message}`)

  logDebug(debug, 'league inserted from API', { externalId, name })

  return {
    action: 'created' as const,
    league: data as AvailableLeagueRow,
  }
}

async function upsertTeam(
  supabase: SupabaseClient,
  team: { id: number; name: string; logo?: string },
  debug?: boolean
) {
  const payload = {
    external_id: team.id,
    name: team.name,
    logo_url: getTeamLogoUrl(team),
    logo_source: 'api-football',
    logo_last_synced_at: new Date().toISOString(),
  }

  logDebug(debug, 'team lookup by external_id started', {
    external_id: team.id,
    name: team.name,
  })

  const { data: existingByExternalId, error: externalIdError } = await withTimeout(
    supabase
      .from('teams')
      .select('id')
      .eq('external_id', team.id)
      .maybeSingle(),
    `teams lookup ${team.id}`
  )

  logDebug(debug, 'team lookup by external_id finished', {
    external_id: team.id,
    found: Boolean(existingByExternalId),
    error: externalIdError?.message ?? null,
  })

  if (externalIdError) {
    throw new Error(`No se pudo buscar el equipo ${team.name}: ${externalIdError.message}`)
  }

  if (existingByExternalId) {
    logDebug(debug, 'team update started', { id: (existingByExternalId as DbIdRow).id })

    const { data, error } = await withTimeout(
      supabase
        .from('teams')
        .update(payload)
        .eq('id', (existingByExternalId as DbIdRow).id)
        .select('id')
        .single(),
      `teams update ${team.id}`,
    )

    logDebug(debug, 'team update finished', {
      id: (existingByExternalId as DbIdRow).id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo actualizar el equipo ${team.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'legacy team lookup started', { external_id: team.id })

  const { data: legacyTeams, error: legacyError } = await withTimeout(
    supabase
      .from('teams')
      .select('id, name, external_id')
      .is('external_id', null),
    `legacy teams lookup ${team.id}`
  )

  logDebug(debug, 'legacy team lookup finished', {
    external_id: team.id,
    count: legacyTeams?.length ?? 0,
    error: legacyError?.message ?? null,
  })

  if (legacyError) {
    throw new Error(`No se pudo buscar equipos legacy para ${team.name}: ${legacyError.message}`)
  }

  const reusableLegacyTeam = (legacyTeams as Array<DbIdRow & {
    name: string | null
    external_id: number | null
  }> | null)?.find((candidate) => normalizeLeagueName(candidate.name) === normalizeLeagueName(team.name))

  if (reusableLegacyTeam) {
    logDebug(debug, 'legacy team normalize started', { id: reusableLegacyTeam.id })

    const { data, error } = await withTimeout(
      supabase
        .from('teams')
        .update(payload)
        .eq('id', reusableLegacyTeam.id)
        .select('id')
        .single(),
      `legacy team normalize ${team.id}`,
    )

    logDebug(debug, 'legacy team normalize finished', {
      id: reusableLegacyTeam.id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo normalizar el equipo ${team.name}: ${error.message}`)

    return {
      id: (data as DbIdRow).id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'team insert started', { external_id: team.id })

  const { data, error } = await withTimeout(
    supabase
      .from('teams')
      .insert(payload)
      .select('id')
      .single(),
    `teams insert ${team.id}`,
  )

  logDebug(debug, 'team insert finished', {
    external_id: team.id,
    error: error?.message ?? null,
  })

  if (error) throw new Error(`No se pudo guardar el equipo ${team.name}: ${error.message}`)

  return {
    id: (data as DbIdRow).id,
    action: 'created' as const,
  }
}

async function upsertMatch(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  leagueId: string | number,
  homeTeamId: string | number,
  awayTeamId: string | number,
  debug?: boolean,
  officialBracketSlot?: number | null
) {
  const homeScore = getFixtureHomeScore(fixture)
  const awayScore = getFixtureAwayScore(fixture)
  const status = getCanonicalMatchStatusFromApi(fixture.fixture.status)
  const payload = {
    external_id: fixture.fixture.id,
    league_id: leagueId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_date: fixture.fixture.date,
    round: getFixtureRoundValue(fixture.league.round),
    status,
    home_score: homeScore,
    away_score: awayScore,
  }

  logDebug(debug, 'match lookup by external_id started', {
    external_id: fixture.fixture.id,
  })

  const externalIdCandidates = [String(fixture.fixture.id), fixture.fixture.id]
  let existingByExternalId: StoredMatchLookupRow | null = null
  let existingExternalIdError: { message: string } | null = null
  let reconciledDerivedMatchId: DbId | null = null

  for (const externalId of externalIdCandidates) {
    const { data, error } = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id')
        .eq('external_id', externalId)
        .maybeSingle(),
      `matches lookup ${fixture.fixture.id}`
    )

    if (error) {
      existingExternalIdError = error
      break
    }

    if (data) {
      existingByExternalId = data as StoredMatchLookupRow
      break
    }
  }

  logDebug(debug, 'match lookup by external_id finished', {
    external_id: fixture.fixture.id,
    found: Boolean(existingByExternalId),
    error: existingExternalIdError?.message ?? null,
  })

  if (existingExternalIdError) {
    throw new Error(`No se pudo verificar el partido ${fixture.fixture.id}: ${existingExternalIdError.message}`)
  }

  if (!existingByExternalId) {
    const { data: existingById, error: existingByIdError } = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id')
        .eq('id', fixture.fixture.id)
        .maybeSingle(),
      `matches lookup by id ${fixture.fixture.id}`
    )

    if (existingByIdError) {
      logDebug(debug, 'match lookup by id fallback failed', {
        fixtureId: fixture.fixture.id,
        error: existingByIdError.message,
      })
    } else if (existingById) {
      existingByExternalId = existingById as StoredMatchLookupRow
      logDebug(debug, 'match lookup by id fallback found legacy row', {
        fixtureId: fixture.fixture.id,
        id: existingByExternalId.id,
        external_id: existingByExternalId.external_id ?? null,
      })
    }
  }

  if (
    !existingByExternalId &&
    fixture.league.id === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID &&
    getLeagueFinalPhaseKey(fixture.league.round)
  ) {
    const derivedMatch = await findDerivedLigaProfesionalMatchForOfficialFixture(supabase, {
      leagueId,
      round: fixture.league.round,
      homeTeamId,
      awayTeamId,
      bracketSlot: officialBracketSlot ?? null,
    })

    if (derivedMatch) {
      existingByExternalId = {
        id: derivedMatch.id,
        external_id: derivedMatch.external_id,
      }
      reconciledDerivedMatchId = derivedMatch.id
      logDebug(debug, 'derived Liga Profesional match matched official fixture', {
        fixtureId: fixture.fixture.id,
        matchId: derivedMatch.id,
        round: fixture.league.round,
      })
    }
  }

  const existing = existingByExternalId

  if (existing) {
    logDebug(debug, 'match update started', {
      fixtureId: fixture.fixture.id,
      id: existing.id,
      payload,
    })

    const { error } = await withTimeout(
      supabase
        .from('matches')
        .update(payload)
        .eq('id', existing.id),
      `matches update ${fixture.fixture.id}`
    )

    logDebug(debug, 'match update finished', {
      fixtureId: fixture.fixture.id,
      id: existing.id,
      error: error?.message ?? null,
    })

    if (error) throw new Error(`No se pudo actualizar el partido ${fixture.fixture.id}: ${error.message}`)

    if (reconciledDerivedMatchId) {
      await markLigaProfesionalDerivedMatchAsOfficial(supabase, reconciledDerivedMatchId)
    }
    await updateElapsedIfSupported(supabase, existing.id, fixture, debug)
    await updatePenaltyScoresIfSupported(supabase, existing.id, fixture, debug)
    await updateVenueFieldsIfSupported(supabase, existing.id, fixture, debug)
    await safeSyncMatchBroadcastsFromFixture(supabase, fixture, existing.id, debug)

    return {
      id: existing.id,
      action: 'updated' as const,
    }
  }

  logDebug(debug, 'match insert started', {
    fixtureId: fixture.fixture.id,
    payload,
  })

  const { data, error } = await withTimeout(
    supabase
      .from('matches')
      .insert(payload)
      .select('id')
      .single(),
    `matches insert ${fixture.fixture.id}`
  )

  logDebug(debug, 'match insert finished', {
    fixtureId: fixture.fixture.id,
    error: error?.message ?? null,
  })

  if (!error) {
    await updateElapsedIfSupported(supabase, (data as DbIdRow).id, fixture, debug)
    await updatePenaltyScoresIfSupported(supabase, (data as DbIdRow).id, fixture, debug)
    await updateVenueFieldsIfSupported(supabase, (data as DbIdRow).id, fixture, debug)
    await safeSyncMatchBroadcastsFromFixture(supabase, fixture, (data as DbIdRow).id, debug)

    return {
      id: (data as DbIdRow).id,
      action: 'created' as const,
    }
  }

  const shouldTryNumericIdFallback =
    error.message.toLowerCase().includes('null value') ||
    error.message.toLowerCase().includes('id') ||
    error.message.toLowerCase().includes('primary key')

  if (!shouldTryNumericIdFallback) {
    throw new Error(`No se pudo guardar el partido ${fixture.fixture.id}: ${error.message}`)
  }

  logDebug(debug, 'match insert fallback with id started', {
    fixtureId: fixture.fixture.id,
  })

  const { data: fallbackData, error: fallbackError } = await withTimeout(
    supabase
      .from('matches')
      .insert({
        id: fixture.fixture.id,
        ...payload,
      })
      .select('id')
      .single(),
    `matches insert fallback ${fixture.fixture.id}`
  )

  logDebug(debug, 'match insert fallback with id finished', {
    fixtureId: fixture.fixture.id,
    error: fallbackError?.message ?? null,
  })

  if (fallbackError) {
    if (fallbackError.message.toLowerCase().includes('duplicate')) {
      logDebug(debug, 'match update by id fallback started', {
        fixtureId: fixture.fixture.id,
      })

      const { error: updateByIdError } = await withTimeout(
        supabase
          .from('matches')
          .update(payload)
          .eq('id', fixture.fixture.id),
        `matches update by id fallback ${fixture.fixture.id}`
      )

      logDebug(debug, 'match update by id fallback finished', {
        fixtureId: fixture.fixture.id,
        error: updateByIdError?.message ?? null,
      })

      if (!updateByIdError) {
        await updateElapsedIfSupported(supabase, fixture.fixture.id, fixture, debug)
        await updatePenaltyScoresIfSupported(supabase, fixture.fixture.id, fixture, debug)
        await updateVenueFieldsIfSupported(supabase, fixture.fixture.id, fixture, debug)
        await safeSyncMatchBroadcastsFromFixture(supabase, fixture, fixture.fixture.id, debug)

        return {
          id: fixture.fixture.id,
          action: 'updated' as const,
        }
      }
    }

    throw new Error(
      `No se pudo guardar el partido ${fixture.fixture.id}: ${error.message}; fallback con id fallo: ${fallbackError.message}`
    )
  }

  const fallbackId = (fallbackData as DbIdRow | null)?.id ?? fixture.fixture.id
  await updateElapsedIfSupported(supabase, fallbackId, fixture, debug)
  await updatePenaltyScoresIfSupported(supabase, fallbackId, fixture, debug)
  await updateVenueFieldsIfSupported(supabase, fallbackId, fixture, debug)
  await safeSyncMatchBroadcastsFromFixture(supabase, fixture, fallbackId, debug)

  return {
    id: fallbackId,
    action: 'created' as const,
  }
}

function getEventExternalId(fixture: ApiFixture, event: ApiFixtureEvent) {
  if (event.id !== undefined && event.id !== null) return String(event.id)

  return formatMatchEventStableKey(event, fixture.fixture.id)
}

function isImportantMatchEventForHome(event: ApiFixtureEvent) {
  const normalizedType = normalizeFootballEventText(event.type)
  const normalizedDetail = normalizeFootballEventText(event.detail)
  const isCardEvent =
    normalizedType.includes('card') &&
    (
      normalizedDetail.includes('yellow') ||
      normalizedDetail.includes('red') ||
      normalizedDetail.includes('roja')
    )
  const isReviewEvent =
    normalizedType.includes('var') ||
    isCancelledEvent(event)

  return (
    (
      isScoreboardGoalEvent(event.type, event.detail) ||
      isCardEvent ||
      isSubstitutionEvent(event) ||
      isImportantLiveEvent(event.type, event.detail) ||
      isReviewEvent
    ) &&
    event.time?.elapsed !== null &&
    event.time?.elapsed !== undefined
  )
}

function isMissingOptionalMatchEvents(error: { code?: string; message?: string } | unknown) {
  const errorObject =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; message?: string })
      : {}
  const message = (errorObject.message ?? String(error)).toLowerCase()

  return (
    errorObject.code === '42P01' ||
    errorObject.code === '42703' ||
    errorObject.code === 'PGRST204' ||
    errorObject.code === 'PGRST205' ||
    message.includes('match_events') ||
    message.includes('schema cache')
  )
}

function shouldIgnoreEventSyncError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('limit of requests') ||
    message.includes('429')
  )
}

async function deleteStoredMatchEvents(
  supabase: SupabaseClient,
  matchId: DbId,
  fixtureId: number
) {
  const deleteResponse = await withTimeout(
    supabase.from('match_events').delete().eq('match_id', matchId),
    `match_events delete ${fixtureId}`
  )

  if (deleteResponse.error) {
    if (isMissingOptionalMatchEvents(deleteResponse.error)) return false
    throw deleteResponse.error
  }

  return true
}

async function syncMatchEventsIfSupported(
  supabase: SupabaseClient,
  fixture: ApiFixture,
  matchId: DbId,
  homeTeamId: DbId,
  awayTeamId: DbId,
  debug?: boolean
): Promise<SyncMatchEventsResult> {
  const emptyResult = { eventsFound: 0, goalsInserted: 0 }
  const statusShort = getCanonicalMatchStatusFromApi(fixture.fixture.status)
  const hasFixtureGoals = hasAnyFixtureGoals(fixture)
  const shouldFetchEvents =
    hasFixtureGoals ||
    isLiveEventSyncStatus(statusShort) ||
    isFinishedStatus(statusShort)

  if (!shouldFetchEvents) return emptyResult

  try {
    logDebug(debug, 'syncing match events from API-Football', {
      fixtureId: fixture.fixture.id,
      matchId,
      status: statusShort,
      hasFixtureGoals,
    })

    const events = await fetchFixtureEvents(fixture.fixture.id)
    const eventRows = events
      .filter(isImportantMatchEventForHome)
      .map((event) => {
        const storedMinute = event.time?.elapsed as number
        const storedExtraMinute = event.time?.extra ?? null
        const teamId =
          event.team?.id === fixture.teams.home.id
            ? homeTeamId
            : event.team?.id === fixture.teams.away.id
              ? awayTeamId
              : null
        const rawExternalEventId = getEventExternalId(fixture, event)
        const hasApiEventId = event.id !== undefined && event.id !== null
        const externalEventId = hasApiEventId
          ? rawExternalEventId
          : rawExternalEventId

        console.info('event time', {
          fixtureId: fixture.fixture.id,
          player: event.player?.name ?? null,
          elapsed: event.time?.elapsed ?? null,
          extra: event.time?.extra ?? null,
          storedMinute,
          storedExtraMinute,
        })

        return {
          match_id: matchId,
          external_event_id: externalEventId,
          team_id: teamId,
          player_name:
            event.player?.name?.trim() ||
            event.team?.name?.trim() ||
            event.detail ||
            event.type ||
            'Evento',
          assist_name: event.assist?.name ?? null,
          minute: storedMinute,
          extra_minute: storedExtraMinute,
          type: event.type as string,
          detail: event.detail ?? null,
          comments: event.comments ?? null,
        }
      })
    const dedupedEventRows = [
      ...eventRows
        .reduce<Map<string, (typeof eventRows)[number]>>((accumulator, row) => {
          accumulator.set(String(row.external_event_id), row)
          return accumulator
        }, new Map())
        .values(),
    ]

    console.info('[sync-match-events] eventos recibidos', {
      fixtureId: fixture.fixture.id,
      league: fixture.league.name,
      matchId,
      totalEvents: events.length,
      importantEvents: eventRows.length,
      dedupedImportantEvents: dedupedEventRows.length,
    })

    const deleted = await deleteStoredMatchEvents(supabase, matchId, fixture.fixture.id)
    if (!deleted) return emptyResult

    if (!dedupedEventRows.length) return { eventsFound: events.length, goalsInserted: 0 }

    const insertResponse = await withTimeout(
      supabase
        .from('match_events')
        .upsert(dedupedEventRows, { onConflict: 'match_id,external_event_id' }),
      `match_events upsert ${fixture.fixture.id}`
    )

    if (insertResponse.error) {
      if (
        insertResponse.error.code === '42703' ||
        insertResponse.error.code === 'PGRST204' ||
        insertResponse.error.message.toLowerCase().includes('comments') ||
        insertResponse.error.message.toLowerCase().includes('schema cache')
      ) {
        const fallbackRows = dedupedEventRows.map((row) => {
          const rowWithoutComments: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            if (key !== 'comments') rowWithoutComments[key] = value
          }
          return rowWithoutComments
        })
        const fallbackResponse = await withTimeout(
          supabase
            .from('match_events')
            .upsert(fallbackRows, { onConflict: 'match_id,external_event_id' }),
          `match_events upsert fallback ${fixture.fixture.id}`
        )

        if (fallbackResponse.error) {
          if (isMissingOptionalMatchEvents(fallbackResponse.error)) return emptyResult
          throw fallbackResponse.error
        }
      } else {
        if (isMissingOptionalMatchEvents(insertResponse.error)) return emptyResult
        throw insertResponse.error
      }
    }

    logDebug(debug, 'match events synced', {
      fixtureId: fixture.fixture.id,
      matchId,
      events: dedupedEventRows.length,
    })
    const insertedGoals = dedupedEventRows.filter((row) =>
      isScoreboardGoalEvent(row.type, row.detail)
    ).length

    console.info('[sync-match-events] eventos importantes insertados en match_events', {
      fixtureId: fixture.fixture.id,
      league: fixture.league.name,
      matchId,
      insertedEvents: dedupedEventRows.length,
      insertedGoals,
    })

    if (isFinishedStatus(statusShort) || isFinishedStatus(fixture.fixture.status.long)) {
      await updateFinalElapsedFromEventsIfSupported(supabase, matchId, fixture, events, debug)
    }

    return {
      eventsFound: events.length,
      goalsInserted: insertedGoals,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (shouldIgnoreEventSyncError(error)) {
      console.warn('[sync-match-events] API-Football limit; se omiten eventos del partido.', {
        fixtureId: fixture.fixture.id,
        message,
      })
      return emptyResult
    }

    console.warn('[sync-match-events] No se pudieron sincronizar eventos; se omiten.', {
      fixtureId: fixture.fixture.id,
      message,
    })

    return emptyResult
  }
}

async function updateElapsedIfSupported(
  supabase: SupabaseClient,
  matchId: DbId,
  fixture: ApiFixture,
  debug?: boolean
) {
  const elapsed = getFixtureStatusElapsedMinute(fixture.fixture.status)
  const isFinished =
    isFinishedStatus(fixture.fixture.status.short) || isFinishedStatus(fixture.fixture.status.long)
  const payload = isFinished ? { elapsed, final_elapsed: elapsed } : { elapsed }

  const response = await withTimeout(
    supabase
      .from('matches')
      .update(payload)
      .eq('id', matchId),
    `matches elapsed update ${fixture.fixture.id}`
  )
  let error = response.error

  if (!error) return

  if (
    isFinished &&
    (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.message.toLowerCase().includes('final_elapsed') ||
      error.message.toLowerCase().includes('schema cache')
    )
  ) {
    const fallbackResponse = await withTimeout(
      supabase
        .from('matches')
        .update({ elapsed })
        .eq('id', matchId),
      `matches elapsed fallback update ${fixture.fixture.id}`
    )

    error = fallbackResponse.error
    if (!error) return
  }

  const message = error.message.toLowerCase()
  const isMissingElapsedColumn =
    message.includes('elapsed') ||
    message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'

  if (isMissingElapsedColumn) {
    logDebug(debug, 'elapsed column missing; base match sync preserved', {
      fixtureId: fixture.fixture.id,
      matchId,
      elapsed,
      error: error.message,
    })
    return
  }

  throw new Error(`No se pudo guardar elapsed del partido ${fixture.fixture.id}: ${error.message}`)
}

function getApiEventElapsedMinute(event: ApiFixtureEvent) {
  const elapsed = event.time?.elapsed
  const extra = event.time?.extra

  if (elapsed === null || elapsed === undefined || !Number.isFinite(elapsed)) return null
  if (extra !== null && extra !== undefined && Number.isFinite(extra) && extra > 0) {
    return elapsed + extra
  }

  return elapsed
}

function getFinalElapsedFromFixtureEvents(fixture: ApiFixture, events: ApiFixtureEvent[]) {
  const statusElapsed = getFixtureStatusElapsedMinute(fixture.fixture.status)
  const maxEventElapsed = events.reduce<number | null>((max, event) => {
    const eventElapsed = getApiEventElapsedMinute(event)

    if (eventElapsed === null) return max
    if (max === null) return eventElapsed

    return Math.max(max, eventElapsed)
  }, null)

  if (statusElapsed === null) return maxEventElapsed
  if (maxEventElapsed === null) return statusElapsed

  return Math.max(statusElapsed, maxEventElapsed)
}

async function updateFinalElapsedFromEventsIfSupported(
  supabase: SupabaseClient,
  matchId: DbId,
  fixture: ApiFixture,
  events: ApiFixtureEvent[],
  debug?: boolean
) {
  const finalElapsed = getFinalElapsedFromFixtureEvents(fixture, events)

  if (finalElapsed === null) return

  const { error } = await withTimeout(
    supabase
      .from('matches')
      .update({
        elapsed: finalElapsed,
        final_elapsed: finalElapsed,
      })
      .eq('id', matchId),
    `matches final elapsed update ${fixture.fixture.id}`
  )

  if (!error) return

  const message = error.message.toLowerCase()
  const isMissingFinalElapsedColumn =
    message.includes('final_elapsed') ||
    message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'

  if (isMissingFinalElapsedColumn) {
    logDebug(debug, 'final_elapsed column missing; elapsed already preserved', {
      fixtureId: fixture.fixture.id,
      matchId,
      finalElapsed,
      error: error.message,
    })
    return
  }

  throw new Error(`No se pudo guardar final_elapsed del partido ${fixture.fixture.id}: ${error.message}`)
}

async function updatePenaltyScoresIfSupported(
  supabase: SupabaseClient,
  matchId: DbId,
  fixture: ApiFixture,
  debug?: boolean
) {
  const homePenaltyScore = fixture.score?.penalty?.home ?? null
  const awayPenaltyScore = fixture.score?.penalty?.away ?? null

  if (homePenaltyScore === null && awayPenaltyScore === null) return

  const { error } = await withTimeout(
    supabase
      .from('matches')
      .update({
        home_penalty_score: homePenaltyScore,
        away_penalty_score: awayPenaltyScore,
      })
      .eq('id', matchId),
    `matches penalty update ${fixture.fixture.id}`
  )

  if (!error) return

  const message = error.message.toLowerCase()
  const isMissingPenaltyColumn =
    message.includes('home_penalty_score') ||
    message.includes('away_penalty_score') ||
    message.includes('schema cache')

  if (isMissingPenaltyColumn) {
    logDebug(debug, 'penalty columns missing; base match sync preserved', {
      fixtureId: fixture.fixture.id,
      matchId,
      error: error.message,
    })
    return
  }

  throw new Error(`No se pudieron guardar penales del partido ${fixture.fixture.id}: ${error.message}`)
}

async function updateVenueFieldsIfSupported(
  supabase: SupabaseClient,
  matchId: DbId,
  fixture: ApiFixture,
  debug?: boolean
) {
  const payload = getFixtureVenuePayload(fixture)

  if (!payload.venue_name && !payload.venue_city && !payload.venue_country) return

  const { error } = await withTimeout(
    supabase
      .from('matches')
      .update(payload)
      .eq('id', matchId),
    `matches venue update ${fixture.fixture.id}`
  )

  if (!error) return

  const message = error.message.toLowerCase()
  const isMissingVenueColumn =
    message.includes('venue_name') ||
    message.includes('venue_city') ||
    message.includes('venue_country') ||
    message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'

  if (isMissingVenueColumn) {
    logDebug(debug, 'venue columns missing; base match sync preserved', {
      fixtureId: fixture.fixture.id,
      matchId,
      payload,
      error: error.message,
    })
    return
  }

  throw new Error(`No se pudo guardar sede del partido ${fixture.fixture.id}: ${error.message}`)
}

async function fetchStoredMatchByExternalId(supabase: SupabaseClient, fixtureId: number) {
  let data: unknown = null
  let error: { message: string } | null = null

  for (const externalId of [String(fixtureId), fixtureId]) {
    const result = await withTimeout(
      supabase
        .from('matches')
        .select('id, external_id, home_score, away_score, status')
        .eq('external_id', externalId)
        .maybeSingle(),
      `matches debug lookup ${fixtureId}`
    )

    if (result.error) {
      error = result.error
      break
    }

    if (result.data) {
      data = result.data
      break
    }
  }

  if (error) {
    throw new Error(`No se pudo leer el partido ${fixtureId} desde Supabase: ${error.message}`)
  }

  return data as SyncSingleFixtureResult['before']
}

export async function syncFixtureById(
  supabase: SupabaseClient,
  fixtureId: number,
  options: { debug?: boolean } = {}
): Promise<SyncSingleFixtureResult> {
  const fixture = await fetchFixtureById(fixtureId)
  const before = await fetchStoredMatchByExternalId(supabase, fixtureId)
  const league = await upsertLeagueFromFixture(supabase, fixture, options.debug)
  const [homeTeam, awayTeam] = await Promise.all([
    upsertTeam(supabase, fixture.teams.home, options.debug),
    upsertTeam(supabase, fixture.teams.away, options.debug),
  ])
  const matchUpsert = await upsertMatch(
    supabase,
    fixture,
    league.id,
    homeTeam.id,
    awayTeam.id,
    options.debug
  )
  const warnings: string[] = []

  const eventSync = await syncMatchEventsIfSupported(
    supabase,
    fixture,
    matchUpsert.id,
    homeTeam.id,
    awayTeam.id,
    options.debug
  )

  if (shouldRecalculateProdePoints(fixture)) {
    try {
      await recalculateProdePoints(supabase, matchUpsert.id)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudieron recalcular puntos.'
      warnings.push(message)
      logDebug(options.debug, 'points recalculation failed after fixture sync', {
        fixtureId,
        matchId: matchUpsert.id,
        error: message,
      })
    }
  }

  const after = await fetchStoredMatchByExternalId(supabase, fixtureId)
  const updatedFields = getUpdatedFields(before, after)

  return {
    fixtureId,
    tournament: {
      slug: slugifyLeagueName(fixture.league.name),
      name: fixture.league.name,
      externalLeagueId: fixture.league.id,
      season:
        fixture.league.season ??
        new Date(fixture.fixture.date).getFullYear(),
    },
    api: {
      status: getCanonicalMatchStatusFromApi(fixture.fixture.status),
      statusLong: fixture.fixture.status.long ?? null,
      elapsed: getFixtureStatusElapsedMinute(fixture.fixture.status),
      date: fixture.fixture.date,
      goalsHome: fixture.goals.home,
      goalsAway: fixture.goals.away,
      fulltimeHome: fixture.score?.fulltime?.home ?? null,
      fulltimeAway: fixture.score?.fulltime?.away ?? null,
      resolvedHomeScore: getFixtureHomeScore(fixture),
      resolvedAwayScore: getFixtureAwayScore(fixture),
    },
    warnings,
    before,
    after,
    eventSync,
    matchBefore: before,
    matchAfter: after,
    apiFixture: {
      fixture: {
        id: fixture.fixture.id,
        date: fixture.fixture.date,
        status: {
          short: getCanonicalMatchStatusFromApi(fixture.fixture.status),
          long: fixture.fixture.status.long ?? null,
          elapsed: getFixtureStatusElapsedMinute(fixture.fixture.status),
        },
      },
      goals: {
        home: fixture.goals.home,
        away: fixture.goals.away,
      },
      score: {
        fulltime: {
          home: fixture.score?.fulltime?.home ?? null,
          away: fixture.score?.fulltime?.away ?? null,
        },
      },
    },
    updatedFields,
    action: matchUpsert.action,
  }
}

export async function syncProdeFixtureById(
  supabase: SupabaseClient,
  fixtureId: number,
  options: { debug?: boolean } = {}
): Promise<SyncSingleFixtureResult> {
  const fixture = await fetchFixtureById(fixtureId)
  const tournament = getAllowedTournamentByExternalId(fixture.league.id)

  if (!tournament) {
    throw new Error(
      `Fixture ${fixtureId} pertenece a liga ${fixture.league.id}, que no esta permitida para Prode.`
    )
  }

  if (fixture.league.season && fixture.league.season !== tournament.season) {
    throw new Error(
      `Fixture ${fixtureId} pertenece a temporada ${fixture.league.season}, esperada ${tournament.season}.`
    )
  }

  const before = await fetchStoredMatchByExternalId(supabase, fixtureId)
  const league = await upsertLeague(supabase, tournament, fixture, options.debug)
  const [homeTeam, awayTeam] = await Promise.all([
    upsertTeam(supabase, fixture.teams.home, options.debug),
    upsertTeam(supabase, fixture.teams.away, options.debug),
  ])
  const matchUpsert = await upsertMatch(
    supabase,
    fixture,
    league.id,
    homeTeam.id,
    awayTeam.id,
    options.debug
  )
  const warnings: string[] = []

  await syncMatchEventsIfSupported(
    supabase,
    fixture,
    matchUpsert.id,
    homeTeam.id,
    awayTeam.id,
    options.debug
  )

  if (shouldRecalculateProdePoints(fixture)) {
    try {
      await recalculateProdePoints(supabase, matchUpsert.id)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudieron recalcular puntos.'
      warnings.push(message)
      logDebug(options.debug, 'prode points recalculation failed after single fixture sync', {
        fixtureId,
        matchId: matchUpsert.id,
        error: message,
      })
    }
  }

  const after = await fetchStoredMatchByExternalId(supabase, fixtureId)
  const updatedFields = getUpdatedFields(before, after)

  return {
    fixtureId,
    tournament: {
      slug: tournament.slug,
      name: tournament.name,
      externalLeagueId: tournament.externalLeagueId,
      season: tournament.season,
    },
    api: {
      status: getCanonicalMatchStatusFromApi(fixture.fixture.status),
      statusLong: fixture.fixture.status.long ?? null,
      elapsed: getFixtureStatusElapsedMinute(fixture.fixture.status),
      date: fixture.fixture.date,
      goalsHome: fixture.goals.home,
      goalsAway: fixture.goals.away,
      fulltimeHome: fixture.score?.fulltime?.home ?? null,
      fulltimeAway: fixture.score?.fulltime?.away ?? null,
      resolvedHomeScore: getFixtureHomeScore(fixture),
      resolvedAwayScore: getFixtureAwayScore(fixture),
    },
    warnings,
    before,
    after,
    matchBefore: before,
    matchAfter: after,
    apiFixture: {
      fixture: {
        id: fixture.fixture.id,
        date: fixture.fixture.date,
        status: {
          short: getCanonicalMatchStatusFromApi(fixture.fixture.status),
          long: fixture.fixture.status.long ?? null,
          elapsed: getFixtureStatusElapsedMinute(fixture.fixture.status),
        },
      },
      goals: {
        home: fixture.goals.home,
        away: fixture.goals.away,
      },
      score: {
        fulltime: {
          home: fixture.score?.fulltime?.home ?? null,
          away: fixture.score?.fulltime?.away ?? null,
        },
      },
    },
    updatedFields,
    action: matchUpsert.action,
  }
}

export async function syncHomeScoreboardMatches(
  supabase: SupabaseClient,
  options: SyncHomeMatchesOptions | boolean = {}
): Promise<HomeScoreboardSyncResult> {
  const normalizedOptions =
    typeof options === 'boolean'
      ? { debug: options }
      : options
  const debug = normalizedOptions.debug
  const today = getArgentinaTodayISO()
  const rangeStart = normalizedOptions.dateFrom ?? normalizedOptions.date ?? null
  const rangeEnd = normalizedOptions.dateTo ?? rangeStart
  const dates = rangeStart && rangeEnd
    ? getInclusiveDateRange(rangeStart, rangeEnd)
    : [addDaysToISO(today, -1), today, addDaysToISO(today, 1)]
  const limit = normalizedOptions.limit && normalizedOptions.limit > 0
    ? Math.min(Math.floor(normalizedOptions.limit), MAX_SYNC_LIMIT)
    : null
  const offset = getBatchOffset(normalizedOptions.offset)
  const liveOnly = Boolean(normalizedOptions.liveOnly)
  const skipEvents = Boolean(normalizedOptions.skipEvents)
  const skipPoints = Boolean(normalizedOptions.skipPoints)
  const leagueExternalId = normalizedOptions.leagueExternalId
  const result = createEmptyHomeScoreboardResult(dates)
  const fixturesById = new Map<number, ApiFixture>()

  for (const date of dates) {
    try {
      const fixtures = await fetchFixturesByDate(date)
      result.fetched += fixtures.length

      for (const fixture of fixtures) {
        if (!fixtureMatchesHomeTournament(fixture)) continue
        if (
          leagueExternalId !== null &&
          leagueExternalId !== undefined &&
          String(fixture.league.id) !== String(leagueExternalId)
        ) {
          continue
        }
        fixturesById.set(fixture.fixture.id, fixture)
      }
    } catch (error) {
      addHomeScoreboardError(result, null, `fetch-home-fixtures:${date}`, error)
      console.warn('[sync-home-scoreboard] No se pudieron leer fixtures del dia.', {
        date,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const selectedFixtures = [...fixturesById.values()]
    .filter((fixture) =>
      !liveOnly ||
      isLiveEventSyncStatus(getCanonicalMatchStatusFromApi(fixture.fixture.status)) ||
      isFinishedStatus(getCanonicalMatchStatusFromApi(fixture.fixture.status))
    )
    .sort(compareFixturesByApiOrder)
  const fixturesToProcess = limit
    ? selectedFixtures.slice(offset, offset + limit)
    : selectedFixtures.slice(offset)
  result.selected = selectedFixtures.length

  const leagueCounts = new Map<number, {
    leagueId: number
    name: string
    country?: string
    fixtures: number
  }>()

  for (const fixture of fixturesToProcess) {
    if (!fixture.league.id || !fixture.teams.home.id || !fixture.teams.away.id) {
      result.skipped += 1
      continue
    }

    const currentLeague = leagueCounts.get(fixture.league.id) ?? {
      leagueId: fixture.league.id,
      name: fixture.league.name,
      country: fixture.league.country,
      fixtures: 0,
    }
    currentLeague.fixtures += 1
    leagueCounts.set(fixture.league.id, currentLeague)

    try {
      try {
        if (await upsertFixtureCache(supabase, fixture, debug)) {
          result.cached += 1
        }
      } catch (error) {
        addHomeScoreboardError(result, fixture.fixture.id, 'fixture-cache-upsert', error)
        console.warn('[sync-fixtures] No se pudo guardar cache del fixture.', {
          fixtureId: fixture.fixture.id,
          league: fixture.league.name,
          message: error instanceof Error ? error.message : String(error),
        })
      }

      const league = await upsertLeagueFromFixture(supabase, fixture, debug)
      const [homeTeam, awayTeam] = await Promise.all([
        upsertTeam(supabase, fixture.teams.home, debug),
        upsertTeam(supabase, fixture.teams.away, debug),
      ])
      const matchUpsert = await upsertMatch(
        supabase,
        fixture,
        league.id,
        homeTeam.id,
        awayTeam.id,
        debug
      )
      const eventSync = skipEvents
        ? {
            eventsFound: 0,
            goalsInserted: 0,
          }
        : await syncMatchEventsIfSupported(
            supabase,
            fixture,
            matchUpsert.id,
            homeTeam.id,
            awayTeam.id,
            debug
          )

      result.processed += 1
      result.eventsFound += eventSync.eventsFound
      result.goalsInserted += eventSync.goalsInserted

      if (!skipEvents || debug) {
        console.info('events processed', {
          fixtureId: fixture.fixture.id,
          league: fixture.league.name,
          eventsFound: eventSync.eventsFound,
          goalsStored: eventSync.goalsInserted,
          skipped: skipEvents,
        })
      }

      if (!skipPoints && shouldRecalculateProdePoints(fixture)) {
        try {
          const pointsResult = await recalculateProdePoints(supabase, matchUpsert.id)
          result.pointsRecalculated += pointsResult.calculated
          logDebug(debug, 'prode points recalculated from home scoreboard sync', {
            fixtureId: fixture.fixture.id,
            matchId: matchUpsert.id,
            recalculated: pointsResult.calculated,
          })
        } catch (error) {
          addHomeScoreboardError(result, fixture.fixture.id, 'points-recalculation', error)
        }
      }
    } catch (error) {
      result.skipped += 1
      addHomeScoreboardError(result, fixture.fixture.id, 'home-fixture-processing', error)
      console.warn('[sync-home-scoreboard] Fixture omitido.', {
        fixtureId: fixture.fixture.id,
        league: fixture.league.name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  result.leagues = [...leagueCounts.values()].sort((a, b) => {
    if (b.fixtures !== a.fixtures) return b.fixtures - a.fixtures
    return a.name.localeCompare(b.name)
  })

  console.info('[sync-home-scoreboard] resumen', {
    dates: result.dates,
    liveOnly,
    skipEvents,
    skipPoints,
    leagueExternalId: leagueExternalId ?? null,
    fetched: result.fetched,
    selected: result.selected,
    processedBatch: fixturesToProcess.length,
    limit,
    offset,
    processed: result.processed,
    cached: result.cached,
    eventsFound: result.eventsFound,
    goalsInserted: result.goalsInserted,
    leagues: result.leagues.map((league) => league.name),
  })

  return result
}

export async function syncHomeFixtureCacheOnly(
  supabase: SupabaseClient,
  options: SyncHomeMatchesOptions = {}
): Promise<HomeScoreboardSyncResult> {
  const debug = options.debug
  const today = getArgentinaTodayISO()
  const rangeStart = options.dateFrom ?? options.date ?? null
  const rangeEnd = options.dateTo ?? rangeStart
  const dates = rangeStart && rangeEnd
    ? getInclusiveDateRange(rangeStart, rangeEnd)
    : [addDaysToISO(today, -1), today, addDaysToISO(today, 1)]
  const limit = options.limit && options.limit > 0
    ? Math.min(Math.floor(options.limit), MAX_SYNC_LIMIT)
    : null
  const offset = getBatchOffset(options.offset)
  const liveOnly = Boolean(options.liveOnly)
  const leagueExternalId = options.leagueExternalId
  const result = createEmptyHomeScoreboardResult(dates)
  const fixturesById = new Map<number, ApiFixture>()

  for (const date of dates) {
    try {
      const fixtures = await fetchFixturesByDate(date)
      result.fetched += fixtures.length

      for (const fixture of fixtures) {
        if (!fixtureMatchesHomeTournament(fixture)) continue
        if (
          leagueExternalId !== null &&
          leagueExternalId !== undefined &&
          String(fixture.league.id) !== String(leagueExternalId)
        ) {
          continue
        }
        fixturesById.set(fixture.fixture.id, fixture)
      }
    } catch (error) {
      addHomeScoreboardError(result, null, `fetch-home-fixtures-cache-only:${date}`, error)
      console.warn('[sync-home-cache-only] No se pudieron leer fixtures del dia.', {
        date,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const selectedFixtures = [...fixturesById.values()]
    .filter((fixture) =>
      !liveOnly ||
      isLiveEventSyncStatus(getCanonicalMatchStatusFromApi(fixture.fixture.status)) ||
      isFinishedStatus(getCanonicalMatchStatusFromApi(fixture.fixture.status))
    )
    .sort(compareFixturesByApiOrder)
  const fixturesToProcess = limit
    ? selectedFixtures.slice(offset, offset + limit)
    : selectedFixtures.slice(offset)
  result.selected = selectedFixtures.length

  const leagueCounts = new Map<number, {
    leagueId: number
    name: string
    country?: string
    fixtures: number
  }>()

  for (const fixture of fixturesToProcess) {
    try {
      if (await upsertFixtureCache(supabase, fixture, debug)) {
        result.cached += 1
      }
      result.processed += 1

      if (fixture.league.id) {
        const currentLeague = leagueCounts.get(fixture.league.id) ?? {
          leagueId: fixture.league.id,
          name: fixture.league.name,
          country: fixture.league.country,
          fixtures: 0,
        }
        currentLeague.fixtures += 1
        leagueCounts.set(fixture.league.id, currentLeague)
      }
    } catch (error) {
      result.skipped += 1
      addHomeScoreboardError(result, fixture.fixture.id, 'fixture-cache-only-upsert', error)
      console.warn('[sync-home-cache-only] Fixture omitido.', {
        fixtureId: fixture.fixture.id,
        league: fixture.league.name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  result.leagues = [...leagueCounts.values()].sort((a, b) => {
    if (b.fixtures !== a.fixtures) return b.fixtures - a.fixtures
    return a.name.localeCompare(b.name)
  })

  console.info('[sync-home-cache-only] resumen', {
    dates: result.dates,
    liveOnly,
    leagueExternalId: leagueExternalId ?? null,
    fetched: result.fetched,
    selected: result.selected,
    processedBatch: fixturesToProcess.length,
    limit,
    offset,
    processed: result.processed,
    cached: result.cached,
    leagues: result.leagues.map((league) => league.name),
  })

  return result
}

export async function syncHomeBroadcastsFromApiFixtures(
  supabase: SupabaseClient,
  options: SyncHomeBroadcastsFromApiOptions
): Promise<SyncHomeBroadcastsFromApiResult> {
  const dates = getInclusiveDateRange(options.dateFrom, options.dateTo)
  const limit = options.limit && options.limit > 0 ? Math.min(Math.floor(options.limit), 500) : null
  const offset = getBatchOffset(options.offset)
  const normalizedLeagueName = normalizeLeagueName(options.leagueName)
  const result: SyncHomeBroadcastsFromApiResult = {
    dates,
    fetched: 0,
    selected: 0,
    processed: 0,
    skipped: 0,
    broadcastersFound: 0,
    broadcastersStored: 0,
    sample: [],
    sampleErrors: [],
  }
  const fixturesById = new Map<number, ApiFixture>()

  for (const date of dates) {
    try {
      const fixtures = await fetchFixturesByDate(date)
      result.fetched += fixtures.length

      for (const fixture of fixtures) {
        if (!fixtureMatchesHomeTournament(fixture)) continue
        if (
          options.leagueExternalId &&
          String(fixture.league.id) !== String(options.leagueExternalId)
        ) {
          continue
        }
        if (
          normalizedLeagueName &&
          !normalizeLeagueName(fixture.league.name).includes(normalizedLeagueName)
        ) {
          continue
        }

        fixturesById.set(fixture.fixture.id, fixture)
      }
    } catch (error) {
      result.sampleErrors.push({
        fixtureId: null,
        stage: `fetch-api-broadcast-fixtures:${date}`,
        message: error instanceof Error ? error.message : 'Error desconocido',
      })
    }
  }

  const selectedFixtures = [...fixturesById.values()].sort(compareFixturesByApiOrder)
  const fixturesToProcess = limit
    ? selectedFixtures.slice(offset, offset + limit)
    : selectedFixtures.slice(offset)
  result.selected = selectedFixtures.length

  for (const fixture of fixturesToProcess) {
    if (!fixture.league.id || !fixture.teams.home.id || !fixture.teams.away.id) {
      result.skipped += 1
      continue
    }

    const apiBroadcasts = extractFixtureBroadcasts(fixture)
    result.broadcastersFound += apiBroadcasts.length

    if (!apiBroadcasts.length) {
      result.skipped += 1
      continue
    }

    try {
      const league = await upsertLeagueFromFixture(supabase, fixture, options.debug)
      const [homeTeam, awayTeam] = await Promise.all([
        upsertTeam(supabase, fixture.teams.home, options.debug),
        upsertTeam(supabase, fixture.teams.away, options.debug),
      ])
      await upsertMatch(
        supabase,
        fixture,
        league.id,
        homeTeam.id,
        awayTeam.id,
        options.debug
      )

      result.processed += 1
      result.broadcastersStored += apiBroadcasts.length

      if (result.sample.length < 20) {
        result.sample.push({
          fixtureId: fixture.fixture.id,
          league: fixture.league.name,
          local: fixture.teams.home.name,
          visitante: fixture.teams.away.name,
          broadcasters: apiBroadcasts.map((broadcast) => broadcast.broadcaster_name),
        })
      }
    } catch (error) {
      result.skipped += 1

      if (result.sampleErrors.length < 10) {
        result.sampleErrors.push({
          fixtureId: fixture.fixture.id,
          stage: 'api-broadcast-processing',
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }
  }

  console.info('[sync-api-broadcasts] resumen', {
    dates,
    leagueExternalId: options.leagueExternalId ?? null,
    leagueName: options.leagueName ?? null,
    fetched: result.fetched,
    selected: result.selected,
    processed: result.processed,
    skipped: result.skipped,
    broadcastersFound: result.broadcastersFound,
    broadcastersStored: result.broadcastersStored,
  })

  return result
}

export async function syncVisibleHomeLeagues(
  supabase: SupabaseClient,
  options: SyncLeaguesOptions = {}
): Promise<SyncLeaguesResult> {
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : null
  const offset = getBatchOffset(options.offset)
  const apiLeagues = await fetchCurrentLeagues()
  const targetConfigs = limit
    ? VISIBLE_TOURNAMENT_PAGE_CONFIGS.slice(offset, offset + Math.min(limit, MAX_SYNC_LIMIT))
    : VISIBLE_TOURNAMENT_PAGE_CONFIGS.slice(offset)
  const result: SyncLeaguesResult = {
    fetched: apiLeagues.length,
    targeted: VISIBLE_TOURNAMENT_PAGE_CONFIGS.length,
    processedTargets: targetConfigs.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    sampleErrors: [],
    leagues: [],
  }
  const usedExternalIds = new Set<number>()

  for (const tournament of targetConfigs) {
    const matchingLeague = apiLeagues
      .map((league) => ({
        league,
        score: usedExternalIds.has(league.league?.id ?? 0)
          ? 0
          : getLeagueTournamentMatchScore(league, tournament),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.league ?? null

    if (!matchingLeague?.league?.id) {
      result.skipped += 1

      if (result.sampleErrors.length < 10) {
        result.sampleErrors.push({
          competition: tournament.key,
          message: 'No se encontro liga actual en API-Football para esta competencia.',
        })
      }

      continue
    }

    try {
      const upsert = await upsertLeagueFromApi(supabase, matchingLeague, options.debug)

      usedExternalIds.add(matchingLeague.league.id)

      if (upsert.action === 'created') result.inserted += 1
      if (upsert.action === 'updated') result.updated += 1

      result.leagues.push(upsert.league)
    } catch (error) {
      result.skipped += 1

      if (result.sampleErrors.length < 10) {
        result.sampleErrors.push({
          competition: tournament.key,
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }
  }

  console.info('[sync-leagues] resumen', {
    fetched: result.fetched,
    targeted: result.targeted,
    processedTargets: result.processedTargets,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
  })

  return result
}

export async function syncLeagueEvents(
  supabase: SupabaseClient,
  options: SyncLeagueEventsOptions
): Promise<HomeScoreboardSyncResult> {
  const tournament = await getEventTournamentConfigFromCompetition(
    supabase,
    options.competition
  )

  if (!tournament) {
    throw new Error(`Competencia no encontrada para eventos: ${options.competition}`)
  }

  const date = options.date || getArgentinaTodayISO()
  const limit = getBatchLimit(options.limit)
  const offset = getBatchOffset(options.offset)
  const result = createEmptyHomeScoreboardResult([date])

  let fixtures: ApiFixture[] = []

  try {
    fixtures = await fetchFixturesByDate(date)
    result.fetched = fixtures.length
  } catch (error) {
    addHomeScoreboardError(result, null, `fetch-league-fixtures:${date}`, error)
    console.warn('[sync-league-events] No se pudieron leer fixtures del dia.', {
      competition: tournament.key,
      date,
      message: error instanceof Error ? error.message : String(error),
    })

    return result
  }

  const matchingFixtures = fixtures
    .filter((fixture) => fixtureMatchesTournamentConfig(fixture, tournament))
    .sort(compareFixturesByApiOrder)
  const selectedFixtures = matchingFixtures.slice(offset, offset + limit)
  result.selected = matchingFixtures.length

  const leagueCounts = new Map<number, {
    leagueId: number
    name: string
    country?: string
    fixtures: number
  }>()

  for (const fixture of selectedFixtures) {
    if (!fixture.league.id || !fixture.teams.home.id || !fixture.teams.away.id) {
      result.skipped += 1
      continue
    }

    const currentLeague = leagueCounts.get(fixture.league.id) ?? {
      leagueId: fixture.league.id,
      name: fixture.league.name,
      country: fixture.league.country,
      fixtures: 0,
    }
    currentLeague.fixtures += 1
    leagueCounts.set(fixture.league.id, currentLeague)

    try {
      const league = await upsertLeagueFromFixture(supabase, fixture, options.debug)
      const [homeTeam, awayTeam] = await Promise.all([
        upsertTeam(supabase, fixture.teams.home, options.debug),
        upsertTeam(supabase, fixture.teams.away, options.debug),
      ])
      const matchUpsert = await upsertMatch(
        supabase,
        fixture,
        league.id,
        homeTeam.id,
        awayTeam.id,
        options.debug
      )
      const eventSync = await syncMatchEventsIfSupported(
        supabase,
        fixture,
        matchUpsert.id,
        homeTeam.id,
        awayTeam.id,
        options.debug
      )

      result.processed += 1
      result.eventsFound += eventSync.eventsFound
      result.goalsInserted += eventSync.goalsInserted

      console.info('events processed', {
        fixtureId: fixture.fixture.id,
        league: fixture.league.name,
        eventsFound: eventSync.eventsFound,
        goalsStored: eventSync.goalsInserted,
      })
    } catch (error) {
      result.skipped += 1
      addHomeScoreboardError(result, fixture.fixture.id, 'league-event-processing', error)
      console.warn('[sync-league-events] Fixture omitido.', {
        fixtureId: fixture.fixture.id,
        league: fixture.league.name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  result.leagues = [...leagueCounts.values()].sort((a, b) => {
    if (b.fixtures !== a.fixtures) return b.fixtures - a.fixtures
    return a.name.localeCompare(b.name)
  })

  console.info('[sync-league-events] resumen', {
    competition: tournament.key,
    date,
    limit,
    offset,
    fetched: result.fetched,
    selected: result.selected,
    processed: result.processed,
    eventsFound: result.eventsFound,
    goalsInserted: result.goalsInserted,
    leagues: result.leagues.map((league) => league.name),
  })

  return result
}

export async function syncCompetitionFull(
  supabase: SupabaseClient,
  options: SyncCompetitionFullOptions = {}
): Promise<SyncCompetitionFullResult> {
  const tournament = getFullSyncTournament(options)
  const offset = getBatchOffset(options.offset)
  const syncEvents = options.syncEvents ?? true
  const warnings: string[] = []
  const result: SyncCompetitionFullResult = {
    slug: tournament.slug,
    name: tournament.name,
    externalLeagueId: tournament.externalLeagueId,
    season: tournament.season,
    fetched: 0,
    selected: 0,
    processed: 0,
    discarded: 0,
    leaguesCreated: 0,
    leaguesUpdated: 0,
    teamsCreated: 0,
    teamsUpdated: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    eventsFound: 0,
    goalsInserted: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    cached: 0,
    syncEvents,
    fixturesChecked: 0,
    fixturesSynced: 0,
    standingsChecked: 0,
    standingsSynced: 0,
    roundsDetected: [],
    groupsDetected: [],
    roundSummary: [],
    warnings,
    errors: [],
    sampleErrors: [],
  }

  let fixtures: ApiFixture[] = []

  try {
    fixtures = await fetchTournamentFixtures(tournament)
  } catch (error) {
    addFixtureError(result, null, 'fetch-fixtures', error)
    return result
  }

  result.fetched = fixtures.length
  result.fixturesChecked = fixtures.length
  result.roundSummary = summarizeFixtureRounds(fixtures)
  result.roundsDetected = result.roundSummary.map((round) => round.round)

  const standingsSync = await syncLeagueStandingsCache(supabase, {
    leagueExternalId: tournament.externalLeagueId,
    season: tournament.season,
    logContext: `sync-competition-full:${tournament.slug}:standings`,
  })
  result.standingsChecked = standingsSync.standingsChecked
  result.standingsSynced = standingsSync.standingsSynced
  result.groupsDetected = standingsSync.groupsDetected

  for (const warning of standingsSync.warnings) {
    warnings.push(warning)
  }

  for (const error of standingsSync.errors) {
    result.errors.push(`standings-cache: ${error}`)
  }

  const orderedFixtures = [...fixtures].sort(compareFixturesByApiOrder)
  const limit =
    options.limit && options.limit > 0
      ? Math.floor(options.limit)
      : null
  const fixturesToProcess = limit
    ? orderedFixtures.slice(offset, offset + limit)
    : orderedFixtures.slice(offset)
  result.selected = fixturesToProcess.length

  if (!fixtures.length) {
    warnings.push('API-Football no devolvio fixtures para esta competencia/temporada.')
  }

  let league: UpsertResult | null = null

  try {
    league = await upsertLeague(supabase, tournament, fixtures[0] ?? null, options.debug)

    if (league.action === 'created') result.leaguesCreated += 1
    if (league.action === 'updated') result.leaguesUpdated += 1
  } catch (error) {
    addFixtureError(result, null, 'league-upsert', error)
    return result
  }

  const ligaProfesionalOfficialBracketSlots =
    tournament.externalLeagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
      ? buildLigaProfesionalOfficialBracketSlots(orderedFixtures)
      : new Map<number, number>()

  for (const fixture of fixturesToProcess) {
    try {
      if (fixture.league.id !== tournament.externalLeagueId) {
        result.skipped += 1
        result.discarded += 1
        result.errors.push(
          `Fixture ${fixture.fixture.id} ignorado: pertenece a liga ${fixture.league.id}, no a ${tournament.externalLeagueId}.`
        )
        continue
      }

      if (!fixture.teams.home.id || !fixture.teams.away.id) {
        result.skipped += 1
        result.discarded += 1
        continue
      }

      try {
        if (await upsertFixtureCache(supabase, fixture, options.debug)) {
          result.cached += 1
        }
      } catch (error) {
        addFixtureError(result, fixture.fixture.id, 'fixture-cache-upsert', error)
      }

      const [homeTeam, awayTeam] = await Promise.all([
        upsertTeam(supabase, fixture.teams.home, options.debug),
        upsertTeam(supabase, fixture.teams.away, options.debug),
      ])

      if (homeTeam.action === 'created') result.teamsCreated += 1
      if (homeTeam.action === 'updated') result.teamsUpdated += 1
      if (awayTeam.action === 'created') result.teamsCreated += 1
      if (awayTeam.action === 'updated') result.teamsUpdated += 1

      const matchUpsert = await upsertMatch(
        supabase,
        fixture,
        league.id,
        homeTeam.id,
        awayTeam.id,
        options.debug,
        ligaProfesionalOfficialBracketSlots.get(fixture.fixture.id) ?? null
      )

      if (matchUpsert.action === 'created') {
        result.created += 1
        result.matchesCreated += 1
      }

      if (matchUpsert.action === 'updated') {
        result.updated += 1
        result.matchesUpdated += 1
      }

      if (syncEvents) {
        const eventSync = await syncMatchEventsIfSupported(
          supabase,
          fixture,
          matchUpsert.id,
          homeTeam.id,
          awayTeam.id,
          options.debug
        )
        result.eventsFound += eventSync.eventsFound
        result.goalsInserted += eventSync.goalsInserted
      }

      result.processed += 1
      result.fixturesSynced = result.processed
    } catch (error) {
      addFixtureError(result, fixture.fixture.id, 'fixture-processing', error)
    }
  }

  if (
    tournament.externalLeagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID &&
    !limit
  ) {
    try {
      await generateLigaProfesionalPlayoffs(supabase, {
        leagueExternalId: tournament.externalLeagueId,
        season: tournament.season,
        dryRun: false,
      })
    } catch (error) {
      addFixtureError(result, null, 'liga-profesional-playoff-generation', error)
    }
  }

  return result
}

export async function syncProdeMatches(
  supabase: SupabaseClient,
  options: SyncOptions = {}
): Promise<SyncMatchesResult> {
  if (!options.competition) {
    throw new Error('Debe indicar competition para evitar timeout')
  }

  const tournaments = getTournamentSelection(options.competition)
  const limit = getBatchLimit(options.limit)
  const offset = getBatchOffset(options.offset)

  if (!tournaments.length) {
    const homeScoreboard = await syncLeagueEvents(supabase, {
      competition: options.competition,
      date: options.date,
      debug: options.debug,
      limit,
      offset,
      onlyEvents: options.onlyEvents,
    })

    return {
      processedTournaments: 0,
      fetched: homeScoreboard.fetched,
      processed: homeScoreboard.processed,
      discarded: 0,
      teamsCreated: 0,
      teamsUpdated: 0,
      matchesCreated: 0,
      matchesUpdated: 0,
      eventsFound: homeScoreboard.eventsFound,
      goalsInserted: homeScoreboard.goalsInserted,
      created: 0,
      updated: 0,
      skipped: homeScoreboard.skipped,
      homeScoreboard,
      tournaments: [],
    }
  }

  const results: SyncTournamentResult[] = []

  for (const tournament of tournaments) {
    const result: SyncTournamentResult = {
      slug: tournament.slug,
      name: tournament.name,
      externalLeagueId: tournament.externalLeagueId,
      season: tournament.season,
      fetched: 0,
      processed: 0,
      discarded: 0,
      leaguesCreated: 0,
      leaguesUpdated: 0,
      teamsCreated: 0,
      teamsUpdated: 0,
      matchesCreated: 0,
      matchesUpdated: 0,
      eventsFound: 0,
      goalsInserted: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      roundSummary: [],
      errors: [],
      sampleErrors: [],
    }

    try {
      const fixtures = await fetchTournamentFixtures(tournament)
      result.fetched = fixtures.length
      result.roundSummary = summarizeFixtureRounds(fixtures)
      const orderedFixtures = [...fixtures].sort(compareFixturesByApiOrder)
      const ligaProfesionalOfficialBracketSlots =
        tournament.externalLeagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID
          ? buildLigaProfesionalOfficialBracketSlots(orderedFixtures)
          : new Map<number, number>()
      const dateFilteredFixtures = options.date
        ? orderedFixtures.filter((fixture) => getArgentinaDateKey(fixture.fixture.date) === options.date)
        : orderedFixtures
      const fixturesToProcess = dateFilteredFixtures.slice(offset, offset + limit)

      logDebug(options.debug, 'fixtures fetched', {
        tournament: tournament.slug,
        fetched: fixtures.length,
        date: options.date ?? null,
        availableAfterDateFilter: dateFilteredFixtures.length,
        processing: fixturesToProcess.length,
        limit,
        offset,
        onlyEvents: Boolean(options.onlyEvents),
        roundSummary: result.roundSummary,
        order: fixturesToProcess.map((fixture) => ({
          round: fixture.league.round ?? null,
          date: fixture.fixture.date,
          fixtureId: fixture.fixture.id,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
        })),
      })

      let league: UpsertResult

      try {
        league = await upsertLeague(supabase, tournament, fixtures[0] ?? null, options.debug)

        if (league.action === 'created') result.leaguesCreated += 1
        if (league.action === 'updated') result.leaguesUpdated += 1

        logDebug(options.debug, 'league upserted', {
          tournament: tournament.slug,
          leagueId: league.id,
          action: league.action,
          externalLeagueId: tournament.externalLeagueId,
        })
      } catch (error) {
        addFixtureError(result, null, 'league-upsert', error)
        results.push(result)
        continue
      }

      for (const fixture of fixturesToProcess) {
        try {
          if (fixture.league.id !== tournament.externalLeagueId) {
            result.skipped += 1
            result.discarded += 1
            result.errors.push(
              `Fixture ${fixture.fixture.id} ignorado: pertenece a liga ${fixture.league.id}, no a ${tournament.externalLeagueId}.`
            )
            logDebug(options.debug, 'fixture discarded by league mismatch', {
              fixtureId: fixture.fixture.id,
              fixtureLeagueId: fixture.league.id,
              expectedLeagueId: tournament.externalLeagueId,
            })
            continue
          }

          if (!fixture.teams.home.id || !fixture.teams.away.id) {
            result.skipped += 1
            result.discarded += 1
            logDebug(options.debug, 'fixture discarded by missing team id', {
              fixtureId: fixture.fixture.id,
              homeTeamId: fixture.teams.home.id,
              awayTeamId: fixture.teams.away.id,
            })
            continue
          }

          result.processed += 1

          logDebug(options.debug, 'processing fixture', {
            fixtureId: fixture.fixture.id,
            external_id: fixture.fixture.id,
            league_id: league.id,
            homeExternalId: fixture.teams.home.id,
            awayExternalId: fixture.teams.away.id,
            match_date: fixture.fixture.date,
            api_round: fixture.league.round ?? null,
            stored_round: getFixtureRoundValue(fixture.league.round),
            status: getCanonicalMatchStatusFromApi(fixture.fixture.status),
            goals_home: fixture.goals.home,
            goals_away: fixture.goals.away,
            fulltime_home: fixture.score?.fulltime?.home ?? null,
            fulltime_away: fixture.score?.fulltime?.away ?? null,
            resolved_home_score: getFixtureHomeScore(fixture),
            resolved_away_score: getFixtureAwayScore(fixture),
          })

          const [homeTeam, awayTeam] = await Promise.all([
            upsertTeam(supabase, fixture.teams.home, options.debug),
            upsertTeam(supabase, fixture.teams.away, options.debug),
          ])

          if (homeTeam.action === 'created') result.teamsCreated += 1
          if (homeTeam.action === 'updated') result.teamsUpdated += 1
          if (awayTeam.action === 'created') result.teamsCreated += 1
          if (awayTeam.action === 'updated') result.teamsUpdated += 1

          const matchUpsert = await upsertMatch(
            supabase,
            fixture,
            league.id,
            homeTeam.id,
            awayTeam.id,
            options.debug,
            ligaProfesionalOfficialBracketSlots.get(fixture.fixture.id) ?? null
          )

          const eventSync = await syncMatchEventsIfSupported(
            supabase,
            fixture,
            matchUpsert.id,
            homeTeam.id,
            awayTeam.id,
            options.debug
          )
          result.eventsFound += eventSync.eventsFound
          result.goalsInserted += eventSync.goalsInserted

          console.info('events processed', {
            fixtureId: fixture.fixture.id,
            league: fixture.league.name,
            eventsFound: eventSync.eventsFound,
            goalsStored: eventSync.goalsInserted,
          })

          if (matchUpsert.action === 'created') {
            result.created += 1
            result.matchesCreated += 1
          }

          if (matchUpsert.action === 'updated') {
            result.updated += 1
            result.matchesUpdated += 1
          }

          if (!options.onlyEvents && shouldRecalculateProdePoints(fixture)) {
            try {
              await recalculateProdePoints(supabase, matchUpsert.id)
              logDebug(options.debug, 'prode points recalculated', {
                fixtureId: fixture.fixture.id,
                matchId: matchUpsert.id,
              })
            } catch (error) {
              addFixtureError(result, fixture.fixture.id, 'points-recalculation', error)
            }
          }

          logDebug(options.debug, 'match upserted', {
            fixtureId: fixture.fixture.id,
            matchId: matchUpsert.id,
            action: matchUpsert.action,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            leagueId: league.id,
          })
        } catch (error) {
          addFixtureError(result, fixture.fixture.id, 'fixture-processing', error)
          logDebug(options.debug, 'fixture failed', {
            fixtureId: fixture.fixture.id,
            error: error instanceof Error ? error.message : 'Error desconocido',
          })
        }
      }

      if (
        tournament.externalLeagueId === LIGA_PROFESIONAL_ARGENTINA_EXTERNAL_ID &&
        !options.onlyEvents
      ) {
        try {
          const playoffGeneration = await generateLigaProfesionalPlayoffs(supabase, {
            leagueExternalId: tournament.externalLeagueId,
            season: tournament.season,
            dryRun: false,
          })

          logDebug(options.debug, 'liga profesional playoff generation finished', {
            generatedQuarterFinals: playoffGeneration.generatedQuarterFinals.length,
            generatedSemiFinals: playoffGeneration.generatedSemiFinals.length,
            generatedFinal: playoffGeneration.generatedFinal.length,
            missingWinners: playoffGeneration.missingWinners.length,
            skippedBecauseAlreadyExists: playoffGeneration.skippedBecauseAlreadyExists.length,
          })
        } catch (error) {
          addFixtureError(result, null, 'liga-profesional-playoff-generation', error)
        }
      }

      logDebug(options.debug, 'tournament summary', {
        tournament: tournament.slug,
        fetched: result.fetched,
        processed: result.processed,
        discarded: result.discarded,
        teamsCreated: result.teamsCreated,
        teamsUpdated: result.teamsUpdated,
        matchesCreated: result.matchesCreated,
        matchesUpdated: result.matchesUpdated,
        eventsFound: result.eventsFound,
        goalsInserted: result.goalsInserted,
        errors: result.errors.length,
      })
      console.info('[sync-matches] resumen torneo', {
        tournament: tournament.slug,
        fixturesProcessed: result.processed,
        eventsFound: result.eventsFound,
        goalsInserted: result.goalsInserted,
      })
    } catch (error) {
      addFixtureError(result, null, 'fetch-fixtures', error)
    }

    results.push(result)
  }

  return {
    processedTournaments: results.length,
    fetched: results.reduce((sum, item) => sum + item.fetched, 0),
    processed: results.reduce((sum, item) => sum + item.processed, 0),
    discarded: results.reduce((sum, item) => sum + item.discarded, 0),
    teamsCreated: results.reduce((sum, item) => sum + item.teamsCreated, 0),
    teamsUpdated: results.reduce((sum, item) => sum + item.teamsUpdated, 0),
    matchesCreated: results.reduce((sum, item) => sum + item.matchesCreated, 0),
    matchesUpdated: results.reduce((sum, item) => sum + item.matchesUpdated, 0),
    eventsFound: results.reduce((sum, item) => sum + item.eventsFound, 0),
    goalsInserted: results.reduce((sum, item) => sum + item.goalsInserted, 0),
    created: results.reduce((sum, item) => sum + item.created, 0),
    updated: results.reduce((sum, item) => sum + item.updated, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
    homeScoreboard: null,
    tournaments: results,
  }
}
