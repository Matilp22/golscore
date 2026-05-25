import { NextResponse } from 'next/server'
import { getMatchesByDate } from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { serializeError } from '@/server/match-detail-cache'
import { syncFixtureById, syncHomeScoreboardMatches } from '@/server/prode/sync-matches'
import { formatEventMinute } from '@/shared/utils/event-minute'
import { formatMatchEventStableKey, isScoreboardGoalEvent } from '@/shared/utils/football-events'
import { isFinishedStatus } from '@/shared/utils/match-status'

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

type MatchEventRow = {
  id: string
  match_id: DbId
  team_id: DbId | null
  player_name: string | null
  assist_name?: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
  comments?: string | null
  external_event_id?: string | null
}

type TeamRow = {
  id: DbId
  name: string | null
}

type LeagueRow = {
  id: DbId
  name: string | null
  external_id: DbId | null
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function getEventDedupeKey(event: MatchEventRow) {
  return formatMatchEventStableKey(
    {
      time: {
        elapsed: event.minute,
        extra: event.extra_minute,
      },
      team: event.team_id !== null && event.team_id !== undefined
        ? { id: event.team_id }
        : null,
      player: event.player_name ? { name: event.player_name } : null,
      assist: event.assist_name ? { name: event.assist_name } : null,
      type: event.type,
      detail: event.detail,
      comments: event.comments ?? null,
    },
    event.match_id
  )
}

function getDuplicateEventGroups(events: MatchEventRow[]) {
  const grouped = new Map<string, MatchEventRow[]>()

  for (const event of events) {
    const key = getEventDedupeKey(event)
    const group = grouped.get(key) ?? []
    group.push(event)
    grouped.set(key, group)
  }

  return [...grouped.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, events: group }))
}

async function fetchRowsByIds<T>(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  table: string,
  select: string,
  ids: string[]
) {
  const rows: T[] = []

  for (const chunk of chunkArray([...new Set(ids)], 100)) {
    const response = await supabase.from(table).select(select).in('id', chunk)

    if (response.error) throw response.error

    rows.push(...((response.data ?? []) as T[]))
  }

  return rows
}

async function resolveLeagueIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueExternalId: string | null
) {
  if (!leagueExternalId) return null

  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', leagueExternalId)

  if (response.error) throw response.error

  return (response.data ?? []).map((league) => String(league.id))
}

async function fetchApiScoresByExternalId(date: string | null) {
  if (!date) return new Map<string, { home: number | null; away: number | null }>()

  const apiMatches = await getMatchesByDate(date)

  return new Map(
    apiMatches.map((match) => [
      String(match.externalId ?? match.id),
      { home: match.goalsHome, away: match.goalsAway },
    ])
  )
}

async function fetchDuplicateExternalIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  const response = await supabase
    .from('matches')
    .select('external_id')
    .not('external_id', 'is', null)
    .limit(5000)

  if (response.error) throw response.error

  const grouped = new Map<string, number>()

  for (const row of response.data ?? []) {
    const externalId = String(row.external_id)
    grouped.set(externalId, (grouped.get(externalId) ?? 0) + 1)
  }

  return [...grouped.entries()]
    .filter(([, count]) => count > 1)
    .map(([external_id, count]) => ({ external_id, count }))
}

async function auditMatchEvents(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom') ?? date
  const dateTo = searchParams.get('dateTo') ?? date
  const leagueExternalId = searchParams.get('leagueExternalId')
  const limit = parsePositiveInteger(searchParams.get('limit'), 500)
  const fixture = searchParams.get('fixture')
  const shouldRepair =
    searchParams.get('fix') === 'true' ||
    searchParams.get('repair') === 'true'
  const supabase = getSupabaseAdminClient()
  const repairResults = []
  const totalMatchEventsResponse = await supabase
    .from('match_events')
    .select('id', { count: 'exact', head: true })

  if (totalMatchEventsResponse.error) throw totalMatchEventsResponse.error

  if (shouldRepair) {
    if (fixture) {
      repairResults.push(await syncFixtureById(supabase, Number(fixture), { debug: true }))
    } else if (date) {
      repairResults.push(await syncHomeScoreboardMatches(supabase, { date, limit, debug: true }))
    }
  }

  const leagueIds = await resolveLeagueIds(supabase, leagueExternalId)
  let matchQuery = supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, home_score, away_score, status, match_date')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('match_date', { ascending: false })
    .limit(limit)

  if (dateFrom) matchQuery = matchQuery.gte('match_date', `${dateFrom}T00:00:00.000Z`)
  if (dateTo) matchQuery = matchQuery.lte('match_date', `${dateTo}T23:59:59.999Z`)
  if (leagueIds) {
    if (!leagueIds.length) {
      return {
        ok: true,
        date,
        dateFrom,
        dateTo,
        leagueExternalId,
        totalAudited: 0,
        message: 'No se encontro liga para leagueExternalId.',
        matches: [],
      }
    }

    matchQuery = matchQuery.in('league_id', leagueIds)
  }

  const matchesResponse = await matchQuery

  if (matchesResponse.error) throw matchesResponse.error

  const matches = (matchesResponse.data ?? []) as MatchRow[]
  const matchIds = matches.map((match) => String(match.id))
  const events: MatchEventRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_events')
      .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
      .in('match_id', chunk)

    if (response.error) {
      const fallbackResponse = await supabase
        .from('match_events')
        .select('id, match_id, team_id, player_name, minute, extra_minute, type, detail')
        .in('match_id', chunk)

      if (fallbackResponse.error) throw fallbackResponse.error
      events.push(...((fallbackResponse.data ?? []) as MatchEventRow[]))
      continue
    }

    events.push(...((response.data ?? []) as MatchEventRow[]))
  }

  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is DbId => id !== null)
        .map(String)
    ),
  ]
  const leagueIdsInMatches = [
    ...new Set(
      matches
        .map((match) => match.league_id)
        .filter((id): id is DbId => id !== null)
        .map(String)
    ),
  ]
  const [teams, leagues, apiScoresByExternalId, duplicateExternalIds] = await Promise.all([
    fetchRowsByIds<TeamRow>(supabase, 'teams', 'id, name', teamIds),
    fetchRowsByIds<LeagueRow>(supabase, 'leagues', 'id, name, external_id', leagueIdsInMatches),
    fetchApiScoresByExternalId(date),
    fetchDuplicateExternalIds(supabase),
  ])
  const teamsById = new Map(teams.map((team) => [String(team.id), team]))
  const leaguesById = new Map(leagues.map((league) => [String(league.id), league]))
  const goalEventsByMatchId = events
    .filter((event) => isScoreboardGoalEvent(event.type, event.detail))
    .reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const matchId = String(event.match_id)
      const current = accumulator.get(matchId) ?? []
      current.push(event)
      accumulator.set(matchId, current)

      return accumulator
    }, new Map())
  const auditedMatches = matches.map((match) => {
    const matchEvents = events.filter((event) => String(event.match_id) === String(match.id))
    const duplicateGroups = getDuplicateEventGroups(matchEvents)
    const duplicateEvents = duplicateGroups.reduce((sum, group) => sum + group.events.length - 1, 0)
    const externalKey = match.external_id === null ? null : String(match.external_id)
    const apiScore = externalKey ? apiScoresByExternalId.get(externalKey) ?? null : null
    const expectedHomeScore = apiScore?.home ?? match.home_score
    const expectedAwayScore = apiScore?.away ?? match.away_score
    const expectedGoals =
      expectedHomeScore !== null && expectedAwayScore !== null
        ? expectedHomeScore + expectedAwayScore
        : null
    const goalEvents = goalEventsByMatchId.get(String(match.id)) ?? []
    const missingGoalEvents =
      expectedGoals === null ? null : expectedGoals - goalEvents.length
    const league = match.league_id === null ? null : leaguesById.get(String(match.league_id))
    const home = match.home_team_id === null ? null : teamsById.get(String(match.home_team_id))
    const away = match.away_team_id === null ? null : teamsById.get(String(match.away_team_id))
    const invalidTeamEvents = goalEvents.filter((event) =>
      event.team_id !== null &&
      String(event.team_id) !== String(match.home_team_id) &&
      String(event.team_id) !== String(match.away_team_id)
    )

    return {
      match_id: match.id,
      external_id: match.external_id,
      league: league?.name ?? null,
      league_external_id: league?.external_id ?? null,
      home: home?.name ?? null,
      away: away?.name ?? null,
      match_date: match.match_date,
      status: match.status,
      stored_score: {
        home: match.home_score,
        away: match.away_score,
      },
      api_score: apiScore,
      expected_goals: expectedGoals,
      goal_events: goalEvents.length,
      missing_events: missingGoalEvents,
      invalid_team_events: invalidTeamEvents.length,
      events_count: matchEvents.length,
      unique_events_count: matchEvents.length - duplicateEvents,
      duplicate_events: duplicateEvents,
      duplicate_groups: duplicateGroups.length,
      duplicates_by_type: duplicateGroups.reduce<Record<string, number>>((accumulator, group) => {
        const type = group.events[0]?.type ?? 'Event'
        accumulator[type] = (accumulator[type] ?? 0) + group.events.length - 1
        return accumulator
      }, {}),
      duplicates_by_player: duplicateGroups.reduce<Record<string, number>>((accumulator, group) => {
        const player = group.events[0]?.player_name ?? 'Sin jugador'
        accumulator[player] = (accumulator[player] ?? 0) + group.events.length - 1
        return accumulator
      }, {}),
      duplicate_samples: duplicateGroups.slice(0, 5).map((group) => ({
        key: group.key,
        events: group.events.map((event) => ({
          id: event.id,
          external_event_id: event.external_event_id ?? null,
          minute: formatEventMinute(event.minute, event.extra_minute),
          player: event.player_name,
          assist: event.assist_name ?? null,
          type: event.type,
          detail: event.detail,
        })),
      })),
      events: goalEvents
        .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.extra_minute ?? 0) - (b.extra_minute ?? 0))
        .map((event) => ({
          id: event.id,
          team_id: event.team_id,
          minute: formatEventMinute(event.minute, event.extra_minute),
          player: event.player_name,
          type: event.type,
          detail: event.detail,
        })),
    }
  })
  const missing = auditedMatches.filter((match) =>
    match.missing_events !== null && match.missing_events > 0
  )
  const surplus = auditedMatches.filter((match) =>
    match.missing_events !== null && match.missing_events < 0
  )
  const finalAuditedMatches = auditedMatches.filter((match) =>
    isFinishedStatus(match.status)
  )
  const finalMissing = finalAuditedMatches.filter((match) =>
    match.missing_events !== null && match.missing_events > 0
  )
  const finalSurplus = finalAuditedMatches.filter((match) =>
    match.missing_events !== null && match.missing_events < 0
  )
  const invalidTeam = auditedMatches.filter((match) => match.invalid_team_events > 0)
  const duplicateMatches = auditedMatches.filter((match) => match.duplicate_events > 0)
  const totalEvents = auditedMatches.reduce((sum, match) => sum + match.events_count, 0)
  const duplicateEvents = auditedMatches.reduce((sum, match) => sum + match.duplicate_events, 0)
  const eventsByLeague = [
    ...auditedMatches
      .reduce<Map<string, {
        league: string | null
        league_external_id: DbId | null
        matches: number
        events: number
      }>>((accumulator, match) => {
        const key = String(match.league_external_id ?? match.league ?? 'sin-liga')
        const current = accumulator.get(key) ?? {
          league: match.league,
          league_external_id: match.league_external_id,
          matches: 0,
          events: 0,
        }

        current.matches += 1
        current.events += match.goal_events
        accumulator.set(key, current)

        return accumulator
      }, new Map())
      .values(),
  ].sort((a, b) => {
    if (b.events !== a.events) return b.events - a.events
    return (a.league ?? '').localeCompare(b.league ?? '')
  })
  const belgranoSarmiento = auditedMatches.filter((match) => {
    const text = normalizeText(`${match.home ?? ''} ${match.away ?? ''}`)

    return text.includes('belgrano') && text.includes('sarmiento')
  })

  return {
    ok: true,
    date,
    dateFrom,
    dateTo,
    leagueExternalId,
    repaired: shouldRepair,
    repairResults,
    totalMatchEvents: totalMatchEventsResponse.count ?? 0,
    matchesChecked: auditedMatches.length,
    totalEvents,
    uniqueEvents: totalEvents - duplicateEvents,
    duplicateEvents,
    duplicateGroups: duplicateMatches.reduce((sum, match) => sum + match.duplicate_groups, 0),
    duplicateMatches: duplicateMatches.length,
    duplicates: duplicateMatches.slice(0, 30),
    examples: duplicateMatches.slice(0, 10),
    totalGoalEventsInAudit: auditedMatches.reduce((sum, match) => sum + match.goal_events, 0),
    eventsByLeague,
    totalAudited: auditedMatches.length,
    finalMatchesAudited: finalAuditedMatches.length,
    completeMatches: auditedMatches.length - missing.length - surplus.length,
    completeFinalMatches:
      finalAuditedMatches.length - finalMissing.length - finalSurplus.length,
    missingGoalMatches: missing.length,
    surplusGoalMatches: surplus.length,
    missingFinalGoalMatches: finalMissing.length,
    surplusFinalGoalMatches: finalSurplus.length,
    eventsWithInvalidTeam: invalidTeam.length,
    duplicateExternalIds: duplicateExternalIds.length,
    duplicateExternalIdsSample: duplicateExternalIds.slice(0, 30),
    missingGoalsTotal: missing.reduce((sum, match) => sum + Math.max(match.missing_events ?? 0, 0), 0),
    matchesWithFinalScoreAndMissingGoals: finalMissing,
    matchesWithFinalScoreAndSurplusGoals: finalSurplus,
    matchesWithScoreAndMissingGoals: missing,
    matchesWithSurplusGoalEvents: surplus,
    matchesWithInvalidEventTeam: invalidTeam,
    concreteCases: {
      belgranoSarmiento,
    },
    sample: auditedMatches.slice(0, 30),
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    return NextResponse.json(await auditMatchEvents(request))
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-events-audit] Error completo', serialized)

    return NextResponse.json(
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
