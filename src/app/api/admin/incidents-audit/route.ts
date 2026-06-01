import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { requestFootballApi } from '@/server/integrations/football-api-client'
import { serializeError } from '@/server/match-detail-cache'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'
import {
  dedupeTimelineEvents,
  getEventMinute,
  getEventPlayerName,
  getMatchEventDedupeKey,
  isCancelledCardEvent,
  isCancelledGoalEvent,
  isMissedPenaltyEvent,
  isSecondYellowCardEvent,
  isSubstitutionEvent,
  isValidAssistEvent,
  isValidGoalForScore,
  isValidGoalForScorerTable,
  isVarEvent,
  isYellowCardEvent,
  normalizeMatchEvent,
  type FootballEventLike,
} from '@/shared/utils/football-events'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
  status: string | null
  match_date: string | null
}

type MatchEventRow = FootballEventLike & {
  id: DbId
  external_event_id?: DbId | null
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

type TeamRow = {
  id: DbId
  name: string | null
}

type LeagueRow = {
  id: DbId
  external_id: DbId | null
  name: string | null
}

type ProviderEvent = FootballEventLike & {
  id?: DbId | null
  time?: {
    elapsed?: number | null
    extra?: number | null
  } | null
  team?: {
    id?: DbId | null
    name?: string | null
  } | null
  player?: {
    id?: DbId | null
    name?: string | null
  } | null
  assist?: {
    id?: DbId | null
    name?: string | null
  } | null
  type?: string | null
  detail?: string | null
  comments?: string | null
}

type IncidentCounts = ReturnType<typeof countIncidents>

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

function readBoolean(value: string | null, fallback = false) {
  if (value === null) return fallback

  return ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase())
}

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function readStatuses(value: string | null) {
  return (value ?? '')
    .split(',')
    .map((status) => status.trim())
    .filter(Boolean)
}

function readDateRange(searchParams: URLSearchParams) {
  const date = searchParams.get('date')
  if (date) {
    const range = getArgentinaDayUtcRange(date)
    return {
      dateFrom: range.startUtc,
      dateTo: range.endUtc,
    }
  }

  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  return {
    dateFrom: dateFrom ? getArgentinaDayUtcRange(dateFrom).startUtc : null,
    dateTo: dateTo ? getArgentinaDayUtcRange(dateTo).endUtc : null,
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function toProviderEventLike(event: ProviderEvent, matchId: DbId): FootballEventLike {
  return {
    ...event,
    external_event_id: event.id ?? null,
    match_id: matchId,
  }
}

function countIncidents(events: FootballEventLike[]) {
  const deduped = dedupeTimelineEvents(events, {
    descending: false,
    excludePenaltyShootout: true,
    semanticDedupe: true,
  })
  const counts = {
    totalEvents: deduped.length,
    goals: 0,
    penalties: 0,
    missedPenalties: 0,
    ownGoals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    secondYellowCards: 0,
    substitutions: 0,
    varEvents: 0,
    cancelledGoals: 0,
    cancelledCards: 0,
    injuries: 0,
  }

  for (const event of deduped) {
    const normalized = normalizeMatchEvent(event)

    if (normalized.kind === 'goal') counts.goals += 1
    if (normalized.kind === 'penalty-goal') counts.penalties += 1
    if (normalized.kind === 'own-goal') counts.ownGoals += 1
    if (isMissedPenaltyEvent(event)) counts.missedPenalties += 1
    if (isValidAssistEvent(event)) counts.assists += 1
    if (isYellowCardEvent(event)) counts.yellowCards += 1
    if (normalized.kind === 'red-card') counts.redCards += 1
    if (isSecondYellowCardEvent(event)) counts.secondYellowCards += 1
    if (isSubstitutionEvent(event)) counts.substitutions += 1
    if (isVarEvent(event)) counts.varEvents += 1
    if (isCancelledGoalEvent(event)) counts.cancelledGoals += 1
    if (isCancelledCardEvent(event)) counts.cancelledCards += 1
    if (normalized.kind === 'injury') counts.injuries += 1
  }

  return counts
}

function countMapped(events: FootballEventLike[]) {
  const timelineEvents = dedupeTimelineEvents(events, {
    descending: false,
    excludePenaltyShootout: true,
    semanticDedupe: true,
  })
  const incidentEvents = timelineEvents.filter((event) => {
    const normalized = normalizeMatchEvent(event)

    return (
      normalized.kind === 'goal' ||
      normalized.kind === 'penalty-goal' ||
      normalized.kind === 'own-goal' ||
      normalized.kind === 'penalty-missed' ||
      normalized.kind === 'yellow-card' ||
      normalized.kind === 'red-card' ||
      normalized.kind === 'second-yellow' ||
      normalized.kind === 'substitution' ||
      normalized.kind === 'var' ||
      normalized.kind === 'injury'
    )
  })

  return {
    timelineEvents: timelineEvents.length,
    homeScorers: timelineEvents.filter((event) =>
      isValidGoalForScore(event) &&
      Boolean(getEventPlayerName(event)?.trim()) &&
      getEventMinute(event) !== null
    ).length,
    formationIncidents: incidentEvents.length,
    lineupIncidents: incidentEvents.length,
    scorerTableEvents: timelineEvents.filter(isValidGoalForScorerTable).length,
    assistTableEvents: timelineEvents.filter(isValidAssistEvent).length,
    cardsTableEvents: timelineEvents.filter((event) =>
      isYellowCardEvent(event) ||
      normalizeMatchEvent(event).kind === 'red-card' ||
      isSecondYellowCardEvent(event)
    ).length,
  }
}

function getDuplicateEvents(events: FootballEventLike[], matchId: DbId) {
  const groups = new Map<string, FootballEventLike[]>()

  for (const event of events) {
    const key = getMatchEventDedupeKey(event, matchId)
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      count: group.length,
      events: group.slice(0, 5).map((event) => ({
        id: event.id ?? null,
        externalEventId: event.external_event_id ?? null,
        minute: getEventMinute(event),
        playerName: getEventPlayerName(event),
        type: event.type ?? null,
        detail: event.detail ?? null,
      })),
    }))
}

function compareCounts(providerCounts: IncidentCounts | null, dbCounts: IncidentCounts) {
  if (!providerCounts) return []

  const keys: Array<keyof IncidentCounts> = [
    'goals',
    'penalties',
    'missedPenalties',
    'ownGoals',
    'assists',
    'yellowCards',
    'redCards',
    'secondYellowCards',
    'substitutions',
    'varEvents',
    'cancelledGoals',
    'cancelledCards',
  ]

  return keys.filter((key) => providerCounts[key] > dbCounts[key])
}

function buildDiagnosis(input: {
  includeProvider: boolean
  providerCounts: IncidentCounts | null
  dbCounts: IncidentCounts
  mappedCounts: ReturnType<typeof countMapped>
  expectedGoals: number | null
}) {
  const providerMissing =
    input.includeProvider &&
    input.providerCounts !== null &&
    input.providerCounts.totalEvents === 0
  const partialProviderCoverage =
    input.includeProvider &&
    input.providerCounts !== null &&
    input.expectedGoals !== null &&
    input.expectedGoals > 0 &&
    (
      input.providerCounts.goals +
      input.providerCounts.penalties +
      input.providerCounts.ownGoals
    ) < input.expectedGoals
  const syncMissing =
    input.providerCounts !== null &&
    input.providerCounts.totalEvents > input.dbCounts.totalEvents
  const mapperMissing =
    input.dbCounts.totalEvents > 0 &&
    input.mappedCounts.timelineEvents === 0
  const renderMissing =
    input.expectedGoals !== null &&
    input.expectedGoals > 0 &&
    input.mappedCounts.homeScorers < input.expectedGoals

  return {
    provider: input.includeProvider
      ? providerMissing
        ? 'provider-no-events'
        : partialProviderCoverage
          ? 'partial-provider-coverage'
        : 'ok'
      : 'not_checked',
    persistence: syncMissing ? 'sync-events-not-persisted' : 'ok',
    mapper: mapperMissing ? 'mapper-missing' : 'ok',
    render: renderMissing ? 'render-missing' : 'ok',
  }
}

async function resolveLeagueIds(input: {
  leagueExternalId: number | null
  competition: string | null
}) {
  const supabase = getSupabaseAdminClient()

  if (input.leagueExternalId !== null) {
    const response = await supabase
      .from('leagues')
      .select('id')
      .eq('external_id', String(input.leagueExternalId))

    if (response.error) throw response.error

    return (response.data ?? []).map((league) => String(league.id))
  }

  if (input.competition?.trim()) {
    const response = await supabase
      .from('leagues')
      .select('id')
      .ilike('name', `%${input.competition.trim()}%`)

    if (response.error) throw response.error

    return (response.data ?? []).map((league) => String(league.id))
  }

  return null
}

async function fetchMatches(input: {
  dateFrom: string | null
  dateTo: string | null
  leagueExternalId: number | null
  competition: string | null
  statuses: string[]
  limit: number
}) {
  const supabase = getSupabaseAdminClient()
  const leagueIds = await resolveLeagueIds({
    leagueExternalId: input.leagueExternalId,
    competition: input.competition,
  })

  let query = supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, home_score, away_score, status, match_date')
    .not('external_id', 'is', null)
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(input.limit)

  if (input.dateFrom) query = query.gte('match_date', input.dateFrom)
  if (input.dateTo) query = query.lte('match_date', input.dateTo)
  if (input.statuses.length) query = query.in('status', input.statuses)
  if (leagueIds) {
    if (!leagueIds.length) return { supabase, matches: [] as MatchRow[] }
    query = query.in('league_id', leagueIds)
  }

  const response = await query
  if (response.error) throw response.error

  return {
    supabase,
    matches: (response.data ?? []) as MatchRow[],
  }
}

async function fetchEvents(matchIds: string[]) {
  const supabase = getSupabaseAdminClient()
  const events: MatchEventRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_events')
      .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
      .in('match_id', chunk)

    if (response.error) {
      const fallback = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)

      if (fallback.error) throw fallback.error
      events.push(...((fallback.data ?? []) as MatchEventRow[]))
      continue
    }

    events.push(...((response.data ?? []) as MatchEventRow[]))
  }

  return events
}

async function fetchRowsByIds<T>(table: string, select: string, ids: string[]) {
  const supabase = getSupabaseAdminClient()
  const rows: T[] = []

  for (const chunk of chunkArray([...new Set(ids)], 100)) {
    const response = await supabase
      .from(table)
      .select(select)
      .in('id', chunk)

    if (response.error) throw response.error
    rows.push(...((response.data ?? []) as T[]))
  }

  return rows
}

async function fetchProviderEvents(match: MatchRow) {
  const fixture = Number(match.external_id)

  if (!Number.isFinite(fixture)) {
    return {
      events: [] as FootballEventLike[],
      warning: 'fixture_external_id_not_numeric',
    }
  }

  const response = await requestFootballApi<ProviderEvent[]>(
    '/fixtures/events',
    { fixture },
    { logContext: `incidents-audit:${fixture}:events` }
  )

  return {
    events: (response.payload.response ?? []).map((event) =>
      toProviderEventLike(event, match.id)
    ),
    warning: null,
  }
}

function buildLeagueSummary(matchesAudit: Array<{
  league: { externalId: DbId | null; name: string | null } | null
  dbCounts: IncidentCounts
  providerCounts: IncidentCounts | null
  diagnosis: ReturnType<typeof buildDiagnosis>
}>) {
  const summaries = new Map<string, {
    leagueExternalId: DbId | null
    leagueName: string | null
    matchesChecked: number
    completeIncidents: number
    partialIncidents: number
    providerNoEvents: number
    partialProviderCoverage: number
    syncEventsNotPersisted: number
    mapperMissing: number
    renderMissing: number
  }>()

  for (const match of matchesAudit) {
    const key = String(match.league?.externalId ?? match.league?.name ?? 'sin-liga')
    const summary = summaries.get(key) ?? {
      leagueExternalId: match.league?.externalId ?? null,
      leagueName: match.league?.name ?? null,
      matchesChecked: 0,
      completeIncidents: 0,
      partialIncidents: 0,
      providerNoEvents: 0,
      partialProviderCoverage: 0,
      syncEventsNotPersisted: 0,
      mapperMissing: 0,
      renderMissing: 0,
    }
    const hasProblem =
      (
        match.diagnosis.provider !== 'ok' &&
        match.diagnosis.provider !== 'not_checked'
      ) ||
      match.diagnosis.persistence !== 'ok' ||
      match.diagnosis.mapper !== 'ok' ||
      match.diagnosis.render !== 'ok'

    summary.matchesChecked += 1
    if (hasProblem) summary.partialIncidents += 1
    else summary.completeIncidents += 1
    if (match.diagnosis.provider === 'provider-no-events') summary.providerNoEvents += 1
    if (match.diagnosis.provider === 'partial-provider-coverage') {
      summary.partialProviderCoverage += 1
    }
    if (match.diagnosis.persistence !== 'ok') summary.syncEventsNotPersisted += 1
    if (match.diagnosis.mapper !== 'ok') summary.mapperMissing += 1
    if (match.diagnosis.render !== 'ok') summary.renderMissing += 1

    summaries.set(key, summary)
  }

  return [...summaries.values()]
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const range = readDateRange(searchParams)
    const leagueExternalId = readNumber(searchParams.get('leagueExternalId'))
    const competition = searchParams.get('competition')
    const statuses = readStatuses(searchParams.get('status'))
    const includeProvider = readBoolean(searchParams.get('includeProvider'), false)
    const onlyProblems = readBoolean(searchParams.get('onlyProblems'), false)
    const limit = Math.min(Math.max(readNumber(searchParams.get('limit')) ?? 100, 1), 500)
    const { matches } = await fetchMatches({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      leagueExternalId,
      competition,
      statuses,
      limit,
    })
    const matchIds = matches.map((match) => String(match.id))
    const events = matchIds.length ? await fetchEvents(matchIds) : []
    const teamIds = matches
      .flatMap((match) => [match.home_team_id, match.away_team_id])
      .filter((id): id is DbId => id !== null && id !== undefined)
      .map(String)
    const leagueIds = matches
      .map((match) => match.league_id)
      .filter((id): id is DbId => id !== null && id !== undefined)
      .map(String)
    const [teams, leagues] = await Promise.all([
      fetchRowsByIds<TeamRow>('teams', 'id, name', teamIds),
      fetchRowsByIds<LeagueRow>('leagues', 'id, external_id, name', leagueIds),
    ])
    const teamsById = new Map(teams.map((team) => [String(team.id), team]))
    const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
    const eventsByMatchId = events.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const key = String(event.match_id)
      const current = accumulator.get(key) ?? []

      current.push(event)
      accumulator.set(key, current)

      return accumulator
    }, new Map())
    const matchesAudit = []

    for (const match of matches) {
      const dbEvents = eventsByMatchId.get(String(match.id)) ?? []
      const dbCounts = countIncidents(dbEvents)
      const mappedCounts = countMapped(dbEvents)
      const providerWarnings: string[] = []
      let providerCounts: IncidentCounts | null = null

      if (includeProvider) {
        try {
          const provider = await fetchProviderEvents(match)
          if (provider.warning) providerWarnings.push(provider.warning)
          providerCounts = countIncidents(provider.events)
        } catch (error) {
          providerWarnings.push(error instanceof Error ? error.message : String(error))
          providerCounts = null
        }
      }

      const expectedGoals =
        match.home_score !== null && match.away_score !== null
          ? match.home_score + match.away_score
          : null
      const diagnosis = buildDiagnosis({
        includeProvider,
        providerCounts,
        dbCounts,
        mappedCounts,
        expectedGoals,
      })
      const duplicateEvents = getDuplicateEvents(dbEvents, match.id)
      const missingIncidentTypes = compareCounts(providerCounts, dbCounts)
      const warnings = [
        ...providerWarnings.map((warning) => `provider: ${warning}`),
        ...missingIncidentTypes.map((type) => `db_missing_${String(type)}`),
      ]

      if (duplicateEvents.length) warnings.push('duplicated_events')

      const home = match.home_team_id ? teamsById.get(String(match.home_team_id)) : null
      const away = match.away_team_id ? teamsById.get(String(match.away_team_id)) : null
      const league = match.league_id ? leaguesById.get(String(match.league_id)) : null

      matchesAudit.push({
        match: {
          id: match.id,
          fixtureExternalId: match.external_id,
          date: match.match_date,
          status: match.status,
          home: home?.name ?? null,
          away: away?.name ?? null,
          score: {
            home: match.home_score,
            away: match.away_score,
          },
          league: league
            ? {
                id: league.id,
                externalId: league.external_id,
                name: league.name,
              }
            : null,
        },
        providerCounts,
        dbCounts,
        mappedCounts,
        diagnosis,
        missingIncidentTypes,
        duplicateEvents: {
          totalGroups: duplicateEvents.length,
          totalDuplicates: duplicateEvents.reduce((sum, group) => sum + group.count - 1, 0),
          sample: duplicateEvents.slice(0, 5),
        },
        warnings,
        errors: [],
        league: league
          ? {
              externalId: league.external_id,
              name: league.name,
            }
          : null,
      })
    }

    const problemMatches = matchesAudit.filter((match) =>
      match.warnings.length > 0 ||
      (
        match.diagnosis.provider !== 'ok' &&
        match.diagnosis.provider !== 'not_checked'
      ) ||
      match.diagnosis.persistence !== 'ok' ||
      match.diagnosis.mapper !== 'ok' ||
      match.diagnosis.render !== 'ok'
    )
    const returnedMatches = onlyProblems ? problemMatches : matchesAudit

    return jsonNoStore({
      ok: true,
      filters: {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        leagueExternalId,
        competition,
        status: statuses,
        includeProvider,
        onlyProblems,
        limit,
      },
      summary: {
        matchesChecked: matchesAudit.length,
        problemMatches: problemMatches.length,
        totalDbEvents: matchesAudit.reduce((sum, match) => sum + match.dbCounts.totalEvents, 0),
        totalProviderEvents: matchesAudit.reduce(
          (sum, match) => sum + (match.providerCounts?.totalEvents ?? 0),
          0
        ),
      },
      leagues: buildLeagueSummary(matchesAudit),
      matches: returnedMatches,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[incidents-audit] Error completo', serialized)

    return jsonNoStore(
      {
        ok: false,
        error: serialized.message,
        code: serialized.code,
        detail: serialized.detail,
        hint: serialized.hint,
        source: serialized.source,
      },
      { status: 500 }
    )
  }
}
