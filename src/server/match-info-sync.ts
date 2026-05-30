import type { SupabaseClient } from '@supabase/supabase-js'

import { syncBroadcastsFromRules } from '@/server/broadcasts/admin'
import {
  auditMatchDetailCache,
  fetchMatchInfoProviderSnapshot,
  serializeError,
  syncMatchDetail,
} from '@/server/match-detail-cache'
import {
  addDaysToISO,
  getArgentinaDateISO,
  getArgentinaDayUtcRange,
} from '@/shared/utils/argentina-time'
import { isFinishedStatus, isUpcomingStatus } from '@/shared/utils/match-status'

type DbId = string | number

type MatchInfoRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  match_date: string | null
  status: string | null
  home_score?: number | null
  away_score?: number | null
  venue_id?: DbId | null
  venue_name?: string | null
  venue_city?: string | null
  venue_country?: string | null
  referee?: string | null
  timezone?: string | null
  broadcast_channel?: string | null
  broadcast_logo_url?: string | null
}

type LeagueRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
  country?: string | null
  season?: number | null
}

type TeamRow = {
  id: DbId
  name: string | null
}

type BroadcastRow = {
  match_id: DbId
  broadcaster_name: string | null
  broadcaster_logo_url: string | null
  country: string | null
  source?: string | null
  confidence?: string | null
  verified?: boolean | null
}

export type MatchInfoAuditOptions = {
  matchId?: string | null
  fixture?: number | null
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  futureDays?: number | null
  leagueExternalId?: number | null
  includeProvider?: boolean
  onlyProblems?: boolean
  limit?: number | null
}

export type UpcomingMatchInfoSyncOptions = {
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  leagueExternalId?: number | null
  futureDays?: number | null
  limit?: number | null
  force?: boolean
}

const MATCH_BASE_SELECT =
  'id, external_id, league_id, home_team_id, away_team_id, match_date, status, home_score, away_score'
const MATCH_INFO_SELECT =
  `${MATCH_BASE_SELECT}, venue_id, venue_name, venue_city, venue_country, referee, timezone, broadcast_channel, broadcast_logo_url`

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function cleanText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeTrustText(value?: string | number | null) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function isTrustedBroadcast(row: BroadcastRow) {
  return (
    row.verified === true &&
    (
      ['manual', 'verified_rule', 'official', 'provider', 'provider_suggestion_approved'].includes(normalizeTrustText(row.source)) ||
      normalizeTrustText(row.confidence) === 'high'
    )
  )
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readAuditMatch(audit: unknown) {
  return asRecord(asRecord(audit)?.match) ?? {}
}

function readAuditRenderReadiness(audit: unknown) {
  return asRecord(asRecord(audit)?.renderReadiness) ?? {}
}

function readAuditBroadcasters(audit: unknown) {
  const broadcasts = asRecord(asRecord(audit)?.broadcasts)
  const rows = broadcasts?.broadcasters

  return Array.isArray(rows) ? rows : []
}

function readAuditHasTv(audit: unknown) {
  return Boolean(asRecord(asRecord(audit)?.broadcasts)?.hasTv)
}

function readAuditCount(audit: unknown, field: string) {
  return toNumber(asRecord(audit)?.[field]) ?? 0
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const normalized = String(value ?? '').trim().toLowerCase()

  if (['1', 'true', 'yes', 'si'].includes(normalized)) return true
  if (['0', 'false', 'no'].includes(normalized)) return false

  return fallback
}

function clampLimit(value: number | null | undefined, fallback: number, max: number) {
  return Math.min(Math.max(value ?? fallback, 1), max)
}

function isMissingOptionalColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('schema cache')
  )
}

function getLocalDateRange(input: {
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  futureDays?: number | null
}) {
  const today = getArgentinaDateISO()
  const from = input.date ?? input.dateFrom ?? today
  const to =
    input.date ??
    input.dateTo ??
    addDaysToISO(from, Math.max(input.futureDays ?? 0, 0))
  const fromRange = getArgentinaDayUtcRange(from)
  const toRange = getArgentinaDayUtcRange(to)

  return {
    dateFrom: from,
    dateTo: to,
    startUtc: fromRange.startUtc,
    endUtc: toRange.endUtc,
  }
}

function getHoursUntilKickoff(matchDate: string | null | undefined, now = new Date()) {
  if (!matchDate) return null
  const parsed = Date.parse(matchDate)

  if (Number.isNaN(parsed)) return null

  return (parsed - now.getTime()) / 3_600_000
}

async function fetchLeagueIdsByExternalId(
  supabase: SupabaseClient,
  leagueExternalId: number
) {
  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', String(leagueExternalId))

  if (response.error) throw response.error

  return ((response.data ?? []) as Array<{ id: DbId }>).map((row) => String(row.id))
}

async function fetchRowsByIds<T extends { id: DbId }>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  ids: Array<DbId | null | undefined>
) {
  const uniqueIds = [...new Set(ids.filter((id): id is DbId => id !== null && id !== undefined).map(String))]

  if (!uniqueIds.length) return []

  const response = await supabase
    .from(table)
    .select(select)
    .in('id', uniqueIds)

  if (response.error) throw response.error

  return (response.data ?? []) as unknown as T[]
}

async function fetchBroadcastsByMatchIds(supabase: SupabaseClient, matchIds: DbId[]) {
  const uniqueIds = [...new Set(matchIds.map(String))]

  if (!uniqueIds.length) return []

  const response = await supabase
    .from('match_broadcasts')
    .select('match_id, broadcaster_name, broadcaster_logo_url, country, source, confidence, verified')
    .in('match_id', uniqueIds)
    .order('broadcaster_name', { ascending: true })

  if (response.error) {
    const message = response.error.message.toLowerCase()
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
        .select('match_id, broadcaster_name, broadcaster_logo_url, country')
        .in('match_id', uniqueIds)
        .order('broadcaster_name', { ascending: true })

      if (fallback.error) return []

      return ((fallback.data ?? []) as BroadcastRow[]).filter(isTrustedBroadcast)
    }

    if (
      response.error.code === '42P01' ||
      response.error.code === 'PGRST205' ||
      message.includes('match_broadcasts') ||
      message.includes('schema cache')
    ) {
      return []
    }

    throw response.error
  }

  return ((response.data ?? []) as BroadcastRow[]).filter(isTrustedBroadcast)
}

async function fetchMatchInfoRows(
  supabase: SupabaseClient,
  input: MatchInfoAuditOptions & { startUtc?: string; endUtc?: string },
  warnings: string[]
) {
  const limit = clampLimit(input.limit, 50, 200)
  let select = MATCH_INFO_SELECT
  let query = supabase
    .from('matches')
    .select(select)
    .not('external_id', 'is', null)
    .order('match_date', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (input.matchId) query = query.eq('id', input.matchId)
  if (input.fixture) query = query.eq('external_id', String(input.fixture))
  if (input.startUtc) query = query.gte('match_date', input.startUtc)
  if (input.endUtc) query = query.lt('match_date', input.endUtc)

  if (input.leagueExternalId) {
    const leagueIds = await fetchLeagueIdsByExternalId(supabase, input.leagueExternalId)
    if (!leagueIds.length) return []
    query = query.in('league_id', leagueIds)
  }

  let response = await query

  if (response.error && isMissingOptionalColumn(response.error)) {
    warnings.push(
      'Algunas columnas opcionales de informacion de partido no estan en el cache de schema; se uso lectura base sin marcar error.'
    )
    select = MATCH_BASE_SELECT
    query = supabase
      .from('matches')
      .select(select)
      .not('external_id', 'is', null)
      .order('match_date', { ascending: true, nullsFirst: false })
      .limit(limit)

    if (input.matchId) query = query.eq('id', input.matchId)
    if (input.fixture) query = query.eq('external_id', String(input.fixture))
    if (input.startUtc) query = query.gte('match_date', input.startUtc)
    if (input.endUtc) query = query.lt('match_date', input.endUtc)

    if (input.leagueExternalId) {
      const leagueIds = await fetchLeagueIdsByExternalId(supabase, input.leagueExternalId)
      if (!leagueIds.length) return []
      query = query.in('league_id', leagueIds)
    }

    response = await query
  }

  if (response.error) throw response.error

  return (response.data ?? []) as unknown as MatchInfoRow[]
}

function getBroadcastersForMatch(
  match: MatchInfoRow,
  broadcastsByMatchId: Map<string, BroadcastRow[]>
) {
  const directRows = broadcastsByMatchId.get(String(match.id)) ?? []

  if (directRows.length) {
    return directRows.map((broadcast) => ({
      name: broadcast.broadcaster_name,
      logoUrl: broadcast.broadcaster_logo_url,
      country: broadcast.country,
      source: broadcast.source,
      confidence: broadcast.confidence,
      verified: broadcast.verified,
    }))
  }

  return []
}

export async function auditMatchInfo(
  supabase: SupabaseClient,
  options: MatchInfoAuditOptions = {}
) {
  const range = getLocalDateRange(options)
  const warnings: string[] = []
  const includeProvider = readBoolean(options.includeProvider, false)
  const matches = await fetchMatchInfoRows(
    supabase,
    {
      ...options,
      startUtc: options.matchId || options.fixture ? undefined : range.startUtc,
      endUtc: options.matchId || options.fixture ? undefined : range.endUtc,
    },
    warnings
  )
  const [leagues, teams, broadcasts] = await Promise.all([
    fetchRowsByIds<LeagueRow>(
      supabase,
      'leagues',
      'id, external_id, name, country, season',
      matches.map((match) => match.league_id)
    ),
    fetchRowsByIds<TeamRow>(
      supabase,
      'teams',
      'id, name',
      matches.flatMap((match) => [match.home_team_id, match.away_team_id])
    ),
    fetchBroadcastsByMatchIds(supabase, matches.map((match) => match.id)),
  ])
  const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
  const teamsById = new Map(teams.map((team) => [String(team.id), team]))
  const broadcastsByMatchId = broadcasts.reduce<Map<string, BroadcastRow[]>>((map, broadcast) => {
    const matchId = String(broadcast.match_id)
    const current = map.get(matchId) ?? []

    current.push(broadcast)
    map.set(matchId, current)

    return map
  }, new Map())
  const items = []

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
    const audit = fixtureExternalId
      ? await auditMatchDetailCache(supabase, {
          fixtureExternalId,
          matchId: String(match.id),
        })
      : null
    const auditMatch = readAuditMatch(audit)
    const renderReadiness = readAuditRenderReadiness(audit)
    const broadcasters = getBroadcastersForMatch(match, broadcastsByMatchId)
    const auditHasTv = readAuditHasTv(audit)
    const auditStatisticsCount = readAuditCount(audit, 'statisticsCount')
    const lineupsCount =
      readAuditCount(audit, 'lineupsHomeCount') +
      readAuditCount(audit, 'lineupsAwayCount') +
      readAuditCount(audit, 'substitutesHomeCount') +
      readAuditCount(audit, 'substitutesAwayCount')
    const dbStadium =
      cleanText(auditMatch.stadium) ??
      cleanText(match.venue_name)
    const dbCity =
      cleanText(auditMatch.venueCity) ??
      cleanText(match.venue_city)
    const dbReferee =
      cleanText(auditMatch.referee) ??
      cleanText(match.referee)
    const provider = includeProvider && fixtureExternalId
      ? await fetchMatchInfoProviderSnapshot(fixtureExternalId).catch((error) => {
          warnings.push(
            `No se pudo consultar provider para fixture ${fixtureExternalId}: ${serializeError(error, 'api-football').message}`
          )

          return null
        })
      : null
    const render = {
      canRenderStadium: Boolean(dbStadium),
      canRenderReferee: Boolean(dbReferee),
      canRenderTv: broadcasters.length > 0 || auditHasTv,
      canRenderLineups: Boolean(
        renderReadiness?.canRenderPitch ||
        renderReadiness?.canRenderLineupLists ||
        lineupsCount > 0
      ),
      canRenderProbableLineup: false,
      canRenderStatistics: Boolean(renderReadiness?.canRenderStats || auditStatisticsCount),
    }
    const problems = [
      provider?.stadium && !dbStadium ? 'provider_has_stadium_but_db_missing' : null,
      provider?.referee && !dbReferee ? 'provider_has_referee_but_db_missing' : null,
      provider?.lineupsCount && provider.lineupsCount > 0 && lineupsCount === 0
        ? 'provider_has_lineups_but_db_missing'
        : null,
      provider?.statisticsCount && provider.statisticsCount > 0 && !auditStatisticsCount
        ? 'provider_has_statistics_but_db_missing'
        : null,
      broadcasters.length > 0 && !render.canRenderTv ? 'db_has_broadcasts_but_render_not_ready' : null,
      lineupsCount > 0 && !render.canRenderLineups ? 'db_has_lineups_but_render_not_ready' : null,
      !dbStadium ? 'missing_stadium' : null,
      !dbReferee ? 'missing_referee' : null,
      !render.canRenderTv ? 'missing_tv' : null,
      isUpcomingStatus(match.status) && lineupsCount === 0 ? 'lineup_not_confirmed_yet' : null,
    ].filter((problem): problem is string => Boolean(problem))
    const item = {
      matchId: match.id,
      fixtureExternalId,
      league: {
        id: match.league_id,
        externalId: toNumber(league?.external_id),
        name: league?.name ?? null,
        country: league?.country ?? null,
        season: league?.season ?? null,
      },
      home: home?.name ?? null,
      away: away?.name ?? null,
      status: match.status,
      matchDate: match.match_date,
      db: {
        stadium: dbStadium,
        venue: dbStadium,
        venueId: cleanText(auditMatch.venueId) ?? cleanText(match.venue_id),
        city: dbCity,
        referee: dbReferee,
        timezone: cleanText(auditMatch.timezone) ?? cleanText(match.timezone),
        broadcasters,
        lineupsCount,
        statisticsCount: auditStatisticsCount,
      },
      provider: provider ?? {
        stadium: null,
        venue: null,
        city: null,
        referee: null,
        hasLineups: false,
        lineupsCount: 0,
        hasStatistics: false,
        statisticsCount: 0,
      },
      render,
      problems,
    }

    if (!options.onlyProblems || problems.length) {
      items.push(item)
    }
  }
  const checkedByDay = matches.reduce<Record<string, number>>((accumulator, match) => {
    const day = match.match_date ? getArgentinaDateISO(match.match_date) : 'sin-fecha'

    accumulator[day] = (accumulator[day] ?? 0) + 1

    return accumulator
  }, {})
  const returnedByDay = items.reduce<Record<string, number>>((accumulator, item) => {
    const day = item.matchDate ? getArgentinaDateISO(item.matchDate) : 'sin-fecha'

    accumulator[day] = (accumulator[day] ?? 0) + 1

    return accumulator
  }, {})

  return {
    ok: true,
    dateRange: {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      startUtc: range.startUtc,
      endUtc: range.endUtc,
    },
    checked: matches.length,
    returned: items.length,
    byDay: {
      checked: checkedByDay,
      returned: returnedByDay,
    },
    includeProvider,
    warnings: [...new Set(warnings)],
    items,
  }
}

export async function auditMissingMatchInfo(
  supabase: SupabaseClient,
  options: MatchInfoAuditOptions = {}
) {
  const audit = await auditMatchInfo(supabase, {
    ...options,
    includeProvider: options.includeProvider ?? true,
    onlyProblems: true,
  })
  const byLeague = new Map<string, {
    leagueExternalId: number | null
    leagueName: string | null
    matches: number
    futureWithoutStadium: number
    futureWithoutReferee: number
    futureWithoutTv: number
    upcomingWithoutLineups: number
    providerVenueNotPersisted: number
    providerRefereeNotPersisted: number
    providerLineupsNotPersisted: number
    providerStatisticsNotPersisted: number
    dbTvRenderProblems: number
    examples: unknown[]
  }>()

  for (const item of audit.items) {
    const leagueKey = String(item.league.externalId ?? item.league.name ?? item.league.id ?? 'sin-liga')
    const current = byLeague.get(leagueKey) ?? {
      leagueExternalId: item.league.externalId,
      leagueName: item.league.name,
      matches: 0,
      futureWithoutStadium: 0,
      futureWithoutReferee: 0,
      futureWithoutTv: 0,
      upcomingWithoutLineups: 0,
      providerVenueNotPersisted: 0,
      providerRefereeNotPersisted: 0,
      providerLineupsNotPersisted: 0,
      providerStatisticsNotPersisted: 0,
      dbTvRenderProblems: 0,
      examples: [],
    }

    current.matches += 1
    if (item.problems.includes('missing_stadium')) current.futureWithoutStadium += 1
    if (item.problems.includes('missing_referee')) current.futureWithoutReferee += 1
    if (item.problems.includes('missing_tv')) current.futureWithoutTv += 1
    if (item.problems.includes('lineup_not_confirmed_yet')) current.upcomingWithoutLineups += 1
    if (item.problems.includes('provider_has_stadium_but_db_missing')) current.providerVenueNotPersisted += 1
    if (item.problems.includes('provider_has_referee_but_db_missing')) current.providerRefereeNotPersisted += 1
    if (item.problems.includes('provider_has_lineups_but_db_missing')) current.providerLineupsNotPersisted += 1
    if (item.problems.includes('provider_has_statistics_but_db_missing')) current.providerStatisticsNotPersisted += 1
    if (item.problems.includes('db_has_broadcasts_but_render_not_ready')) current.dbTvRenderProblems += 1
    if (current.examples.length < 5) current.examples.push(item)

    byLeague.set(leagueKey, current)
  }

  return {
    ok: true,
    dateRange: audit.dateRange,
    byDay: audit.byDay,
    warnings: audit.warnings,
    totals: {
      problems: audit.returned,
      futureWithoutStadium: [...byLeague.values()].reduce((sum, league) => sum + league.futureWithoutStadium, 0),
      futureWithoutReferee: [...byLeague.values()].reduce((sum, league) => sum + league.futureWithoutReferee, 0),
      futureWithoutTv: [...byLeague.values()].reduce((sum, league) => sum + league.futureWithoutTv, 0),
      upcomingWithoutLineups: [...byLeague.values()].reduce((sum, league) => sum + league.upcomingWithoutLineups, 0),
      providerLineupsNotPersisted: [...byLeague.values()].reduce((sum, league) => sum + league.providerLineupsNotPersisted, 0),
      providerStatisticsNotPersisted: [...byLeague.values()].reduce((sum, league) => sum + league.providerStatisticsNotPersisted, 0),
    },
    leagues: [...byLeague.values()],
    items: audit.items,
  }
}

export async function syncUpcomingMatchInfo(
  supabase: SupabaseClient,
  options: UpcomingMatchInfoSyncOptions = {}
) {
  const futureDays = Math.min(Math.max(options.futureDays ?? 7, 0), 30)
  const limit = clampLimit(options.limit, 50, 100)
  const range = getLocalDateRange({ ...options, futureDays })
  const warnings: string[] = []
  const errors: unknown[] = []
  const broadcastResult = await syncBroadcastsFromRules(supabase, {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    leagueExternalId: options.leagueExternalId ?? null,
    limit,
  }).catch((error) => {
    errors.push(serializeError(error, 'supabase'))

    return null
  })
  const rows = await fetchMatchInfoRows(
    supabase,
    {
      ...options,
      limit,
      startUtc: new Date().toISOString(),
      endUtc: range.endUtc,
    },
    warnings
  )
  const items = []
  let updated = 0
  let unchanged = 0
  let withVenue = 0
  let withReferee = 0
  let withTv = 0
  let withLineups = 0
  let noLineupsYet = 0

  for (const match of rows) {
    const fixtureExternalId = toNumber(match.external_id)
    const startsInHours = getHoursUntilKickoff(match.match_date)
    const shouldAskLineups =
      Boolean(options.force) ||
      (startsInHours !== null && startsInHours <= 24 && startsInHours >= -2)

    if (!fixtureExternalId) {
      items.push({
        matchId: match.id,
        fixtureExternalId: null,
        status: 'skipped',
        skipReason: 'missing_fixture_external_id',
      })
      continue
    }

    if (!options.force && isFinishedStatus(match.status)) {
      items.push({
        matchId: match.id,
        fixtureExternalId,
        status: 'skipped',
        skipReason: 'finished_match_not_upcoming',
      })
      continue
    }

    const before = await auditMatchDetailCache(supabase, {
      fixtureExternalId,
      matchId: String(match.id),
    })
    const result = await syncMatchDetail(supabase, {
      fixtureExternalId,
      matchId: String(match.id),
      sections: {
        fixture: true,
        events: false,
        lineups: shouldAskLineups,
        statistics: false,
      },
    }).catch((error) => {
      const serialized = serializeError(error, 'unknown')
      errors.push(serialized)

      return null
    })
    const after = await auditMatchDetailCache(supabase, {
      fixtureExternalId,
      matchId: String(match.id),
    })
    const beforeMatchInfo = readAuditMatch(before)
    const afterMatchInfo = readAuditMatch(after)
    const afterBroadcasters = readAuditBroadcasters(after)
    const afterHasTv = readAuditHasTv(after)
    const beforeLineups =
      readAuditCount(before, 'lineupsHomeCount') +
      readAuditCount(before, 'lineupsAwayCount') +
      readAuditCount(before, 'substitutesHomeCount') +
      readAuditCount(before, 'substitutesAwayCount')
    const afterLineups =
      readAuditCount(after, 'lineupsHomeCount') +
      readAuditCount(after, 'lineupsAwayCount') +
      readAuditCount(after, 'substitutesHomeCount') +
      readAuditCount(after, 'substitutesAwayCount')
    const changed =
      result?.matchUpdated ||
      result?.cacheUpserted ||
      beforeMatchInfo.stadium !== afterMatchInfo.stadium ||
      beforeMatchInfo.referee !== afterMatchInfo.referee ||
      beforeLineups !== afterLineups
    const broadcasters = afterBroadcasters

    if (changed) updated += 1
    else unchanged += 1
    if (afterMatchInfo.stadium) withVenue += 1
    if (afterMatchInfo.referee) withReferee += 1
    if (afterHasTv) withTv += 1
    if (afterLineups > 0) withLineups += 1
    if (shouldAskLineups && afterLineups === 0) noLineupsYet += 1

    items.push({
      matchId: match.id,
      fixtureExternalId,
      status: changed ? 'updated' : 'unchanged',
      startsInHours,
      requestedLineups: shouldAskLineups,
      withVenue: Boolean(afterMatchInfo.stadium),
      withReferee: Boolean(afterMatchInfo.referee),
      withTv: afterHasTv,
      lineupsCount: afterLineups,
      noLineupsYet: shouldAskLineups && afterLineups === 0,
      broadcasters,
      warnings: result?.warnings ?? [],
      errors: result?.errors ?? [],
    })
  }

  return {
    ok: errors.length === 0,
    selected: rows.length,
    updated,
    unchanged,
    withVenue,
    withReferee,
    withTv,
    withLineups,
    noLineupsYet,
    broadcastRules: broadcastResult,
    warnings: [...new Set(warnings)],
    errors,
    items,
  }
}
