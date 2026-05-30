import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  auditMatchDetailCache,
  fetchMatchDetailProviderCounts,
  serializeError,
  type MatchDetailCounts,
} from '@/server/match-detail-cache'
import { buildMatchDetailViewModel } from '@/server/match-detail-view-model'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'
import {
  getEventPlayerId,
  getEventPlayerName,
  getEventTeamId,
  getPlayerIncidentsForLineup,
  normalizeFootballEventText,
  normalizeMatchEvent,
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
  match_date: string | null
  status: string | null
  elapsed?: number | null
  final_elapsed?: number | null
  home_score?: number | null
  away_score?: number | null
  venue_name?: string | null
  referee?: string | null
}

type Diagnosis =
  | 'ok'
  | 'provider-empty'
  | 'db-missing'
  | 'mapper-missing'
  | 'render-blocked'
  | 'provider-no-lineups'
  | 'provider-no-statistics'
  | 'sync-lineups-not-persisted'
  | 'sync-statistics-not-persisted'
  | 'duplicated-events'
  | 'duplicated-player-incidents'
  | 'wrong-player-incident-assignment'

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

function readBoolean(value: string | null) {
  return ['1', 'true', 'yes', 'si'].includes((value ?? '').trim().toLowerCase())
}

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
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

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function emptyCounts(): MatchDetailCounts {
  return {
    events: 0,
    lineups: 0,
    statistics: 0,
  }
}

function diagnoseSection(input: {
  section: 'events' | 'lineups' | 'statistics'
  providerChecked: boolean
  providerCount: number | null
  dbCount: number
  mappedCount: number
  shouldRender: boolean
}): Diagnosis {
  if (input.dbCount > 0 && input.mappedCount === 0) return 'mapper-missing'
  if (input.mappedCount > 0 && !input.shouldRender) return 'render-blocked'
  if (input.dbCount > 0) return 'ok'
  if (input.providerChecked && (input.providerCount ?? 0) > 0) {
    if (input.section === 'lineups') return 'sync-lineups-not-persisted'
    if (input.section === 'statistics') return 'sync-statistics-not-persisted'
    return 'db-missing'
  }
  if (input.providerChecked && (input.providerCount ?? 0) === 0) {
    if (input.section === 'lineups') return 'provider-no-lineups'
    if (input.section === 'statistics') return 'provider-no-statistics'
    return 'provider-empty'
  }

  return 'db-missing'
}

type MatchDetailSystemViewModel = Awaited<ReturnType<typeof buildMatchDetailViewModel>>

function normalizeId(value?: string | number | null) {
  if (value === null || value === undefined) return ''

  return String(value).trim()
}

function sameTeamId(a?: string | number | null, b?: string | number | null) {
  const left = normalizeId(a)
  const right = normalizeId(b)

  return Boolean(left && right && left === right)
}

function normalizePersonDisplayRef(value?: string | null) {
  const normalized = normalizeFootballEventText(value)
  if (!normalized) return ''

  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length < 2) return normalized

  const firstInitial = parts[0]?.[0] ?? ''
  const lastName = parts[parts.length - 1]

  return firstInitial && lastName ? `${firstInitial}-${lastName}` : normalized
}

function playerMatchesEvent(
  player: { player?: { id?: number | null; name?: string | null } },
  teamId: string | number | null | undefined,
  event: MatchDetailSystemViewModel['lineupEvents'][number],
  options: {
    requireTeam?: boolean
  } = {}
) {
  const requireTeam = options.requireTeam ?? true
  if (requireTeam && !sameTeamId(teamId, getEventTeamId(event))) return false

  const playerId = normalizeId(player.player?.id ?? null)
  const eventPlayerId = normalizeId(getEventPlayerId(event))

  if (playerId && eventPlayerId) return playerId === eventPlayerId

  const playerName = normalizeFootballEventText(player.player?.name)
  const eventPlayerName = normalizeFootballEventText(getEventPlayerName(event))

  if (playerName && eventPlayerName && playerName === eventPlayerName) return true

  const playerRef = normalizePersonDisplayRef(player.player?.name)
  const eventRef = normalizePersonDisplayRef(getEventPlayerName(event))

  return Boolean(playerRef && eventRef && playerRef === eventRef)
}

function buildPlayerIncidentAudit(viewModel: MatchDetailSystemViewModel) {
  const renderedEventCount =
    viewModel.timelineEvents.length +
    viewModel.penaltyShootoutEvents.length
  const duplicatedEvents = Math.max(viewModel.sourceEvents.length - renderedEventCount, 0)
  const teams = [
    {
      side: 'home' as const,
      teamId: viewModel.teams?.home.id ?? viewModel.homeLineup?.team?.id ?? null,
      players: [
        ...viewModel.homeStarters,
        ...viewModel.homeSubstitutes,
      ],
    },
    {
      side: 'away' as const,
      teamId: viewModel.teams?.away.id ?? viewModel.awayLineup?.team?.id ?? null,
      players: [
        ...viewModel.awayStarters,
        ...viewModel.awaySubstitutes,
      ],
    },
  ]
  const incidentGroups = new Map<string, Array<Record<string, unknown>>>()
  const wrongGoalExamples: Array<Record<string, unknown>> = []

  for (const team of teams) {
    for (const playerWrap of team.players) {
      const player = playerWrap.player
      if (!player?.name) continue

      const incidents = getPlayerIncidentsForLineup(
        {
          id: player.id ?? null,
          name: player.name,
        },
        team.teamId,
        viewModel.lineupEvents
      )

      for (const incident of incidents) {
        const key = [
          team.side,
          normalizeId(team.teamId),
          normalizeId(player.id ?? null) || normalizeFootballEventText(player.name),
          incident.kind,
          incident.playerRole,
          incident.minute ?? 'minute',
          incident.extraMinute ?? 'no-extra',
        ].join(':')

        const incidentGroup = incidentGroups.get(key) ?? []
        incidentGroup.push({
          team: team.side,
          playerId: player.id ?? null,
          playerName: player.name,
          incidentPlayerId: incident.playerId,
          incidentPlayerName: incident.playerName,
          kind: incident.kind,
          role: incident.playerRole,
          minute: incident.minute,
          extraMinute: incident.extraMinute,
          label: incident.label,
        })
        incidentGroups.set(key, incidentGroup)

        if (
          (incident.kind === 'goal' || incident.kind === 'penalty-goal' || incident.kind === 'own-goal') &&
          normalizeFootballEventText(incident.playerName) &&
          normalizeFootballEventText(incident.playerName) !== normalizeFootballEventText(player.name) &&
          normalizePersonDisplayRef(incident.playerName) !== normalizePersonDisplayRef(player.name) &&
          normalizeId(incident.playerId) !== normalizeId(player.id ?? null)
        ) {
          wrongGoalExamples.push({
            team: team.side,
            playerName: player.name,
            incidentPlayerName: incident.playerName,
            kind: incident.kind,
            minute: incident.minute,
            extraMinute: incident.extraMinute,
          })
        }
      }
    }
  }

  const suspiciousExamples = viewModel.lineupEvents.flatMap((event) => {
    const normalized = normalizeMatchEvent(event)
    const shouldMatchPlayer =
      normalized.kind === 'goal' ||
      normalized.kind === 'penalty-goal' ||
      normalized.kind === 'own-goal' ||
      normalized.kind === 'penalty-missed' ||
      normalized.kind === 'yellow-card' ||
      normalized.kind === 'red-card' ||
      normalized.kind === 'second-yellow'

    if (!shouldMatchPlayer) return []

    const team = normalized.kind === 'own-goal'
      ? teams.find((candidate) =>
          candidate.players.some((player) =>
            playerMatchesEvent(player, candidate.teamId, event, { requireTeam: false })
          )
        ) ?? null
      : teams.find((candidate) => sameTeamId(candidate.teamId, getEventTeamId(event))) ?? null
    if (!team) {
      return [{
        reason: 'event_team_not_in_match_lineups',
        teamId: getEventTeamId(event),
        playerName: getEventPlayerName(event),
        kind: normalized.kind,
        minute: normalized.minute,
      }]
    }

    const matched = team.players.some((player) =>
      playerMatchesEvent(player, team.teamId, event, {
        requireTeam: normalized.kind !== 'own-goal',
      })
    )
    if (matched) return []

    return [{
      reason: 'event_player_not_found_in_lineup_team',
      team: team.side,
      teamId: team.teamId,
      playerName: getEventPlayerName(event),
      kind: normalized.kind,
      minute: normalized.minute,
      extraMinute: normalized.extraMinute,
    }]
  })
  const duplicatedIncidentGroups = [...incidentGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, incidents: group }))
  const duplicatedIncidents = duplicatedIncidentGroups.reduce(
    (sum, group) => sum + Math.max(group.incidents.length - 1, 0),
    0
  )

  return {
    duplicatedEvents,
    duplicatedIncidents,
    wrongGoalAssignments: wrongGoalExamples.length,
    suspiciousAssignments: suspiciousExamples.length,
    examples: {
      wrongGoalAssignments: wrongGoalExamples.slice(0, 5),
      suspiciousAssignments: suspiciousExamples.slice(0, 5),
      duplicatedIncidents: duplicatedIncidentGroups.slice(0, 5),
    },
  }
}

function applyIncidentDiagnosis(
  current: Diagnosis,
  playerIncidentAudit: ReturnType<typeof buildPlayerIncidentAudit>
): Diagnosis {
  if (current !== 'ok') return current
  if (playerIncidentAudit.wrongGoalAssignments > 0) return 'wrong-player-incident-assignment'
  if (playerIncidentAudit.duplicatedIncidents > 0) return 'duplicated-player-incidents'

  return current
}

async function fetchMatches(input: {
  fixture: number | null
  matchId: string | null
  dateFrom: string | null
  dateTo: string | null
  leagueExternalId: number | null
  limit: number
}) {
  const supabase = getSupabaseAdminClient()
  const select =
    'id, external_id, league_id, home_team_id, away_team_id, match_date, status, elapsed, final_elapsed, home_score, away_score, venue_name, referee'

  if (input.fixture) {
    const response = await supabase
      .from('matches')
      .select(select)
      .eq('external_id', String(input.fixture))
      .limit(1)

    if (response.error) throw response.error
    return (response.data ?? []) as MatchRow[]
  }

  if (input.matchId) {
    const numericMatchId = toNumber(input.matchId)
    const byExternalId = numericMatchId
      ? await supabase
          .from('matches')
          .select(select)
          .eq('external_id', String(numericMatchId))
          .limit(1)
      : null

    if (byExternalId?.error) throw byExternalId.error
    if (byExternalId?.data?.length) return byExternalId.data as MatchRow[]

    const response = await supabase
      .from('matches')
      .select(select)
      .eq('id', input.matchId)
      .limit(1)

    if (response.error) throw response.error
    return (response.data ?? []) as MatchRow[]
  }

  let query = supabase
    .from('matches')
    .select(select)
    .not('external_id', 'is', null)
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(input.limit)

  if (input.dateFrom) query = query.gte('match_date', input.dateFrom)
  if (input.dateTo) query = query.lte('match_date', input.dateTo)

  if (input.leagueExternalId) {
    const leagueResponse = await supabase
      .from('leagues')
      .select('id')
      .eq('external_id', String(input.leagueExternalId))

    if (leagueResponse.error) throw leagueResponse.error

    const leagueIds = ((leagueResponse.data ?? []) as Array<{ id: DbId }>).map((league) =>
      String(league.id)
    )
    if (!leagueIds.length) return []
    query = query.in('league_id', leagueIds)
  }

  const response = await query
  if (response.error) throw response.error

  return (response.data ?? []) as MatchRow[]
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fixture = readNumber(searchParams.get('fixture'))
    const matchId = searchParams.get('matchId') ?? searchParams.get('match_id')
    const includeProvider = readBoolean(searchParams.get('includeProvider'))
    const onlyProblems = readBoolean(searchParams.get('onlyProblems'))
    const limit = Math.min(Math.max(readNumber(searchParams.get('limit')) ?? 50, 1), 200)
    const leagueExternalId = readNumber(searchParams.get('leagueExternalId'))
    const range = readDateRange(searchParams)
    const supabase = getSupabaseAdminClient()
    const matches = await fetchMatches({
      fixture,
      matchId,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      leagueExternalId,
      limit,
    })
    const items: unknown[] = []
    const warnings: string[] = []

    for (const match of matches) {
      const fixtureExternalId = toNumber(match.external_id)
      if (!fixtureExternalId) continue

      const [audit, viewModel] = await Promise.all([
        auditMatchDetailCache(supabase, {
          fixtureExternalId,
          matchId: String(match.id),
        }),
        buildMatchDetailViewModel({
          fixtureExternalId,
          matchId: String(match.id),
        }),
      ])
      const providerErrors = []
      let providerCounts: MatchDetailCounts | null = null

      if (includeProvider) {
        try {
          providerCounts = await fetchMatchDetailProviderCounts(fixtureExternalId)
        } catch (error) {
          const serialized = serializeError(error, 'api-football')
          providerErrors.push(serialized)
          warnings.push(`No se pudo consultar provider para fixture ${fixtureExternalId}: ${serialized.message}`)
        }
      }

      const dbCounts = (audit as { dbCounts?: MatchDetailCounts }).dbCounts ?? emptyCounts()
      const mappedCounts = {
        timelineEvents: viewModel.renderCounts.timelineEvents,
        formationPlayers: viewModel.renderCounts.formationPlayers,
        statisticsRows: viewModel.renderCounts.statisticsRows,
        starters: viewModel.renderCounts.startersCount,
        substitutes: viewModel.renderCounts.substitutesCount,
      }
      const renderReadiness = {
        timeline: viewModel.renderReadiness.canRenderTimeline,
        formation: viewModel.renderReadiness.canRenderFormation,
        statistics: viewModel.renderReadiness.canRenderStatistics,
        lineups: viewModel.renderReadiness.canRenderLineupTabs,
      }
      const playerIncidentAudit = buildPlayerIncidentAudit(viewModel)
      const baseDiagnosis = {
        events: diagnoseSection({
          section: 'events',
          providerChecked: includeProvider && !providerErrors.length,
          providerCount: providerCounts?.events ?? null,
          dbCount: dbCounts.events,
          mappedCount: mappedCounts.timelineEvents,
          shouldRender: renderReadiness.timeline,
        }),
        lineups: diagnoseSection({
          section: 'lineups',
          providerChecked: includeProvider && !providerErrors.length,
          providerCount: providerCounts?.lineups ?? null,
          dbCount: dbCounts.lineups,
          mappedCount: mappedCounts.formationPlayers,
          shouldRender: renderReadiness.lineups,
        }),
        statistics: diagnoseSection({
          section: 'statistics',
          providerChecked: includeProvider && !providerErrors.length,
          providerCount: providerCounts?.statistics ?? null,
          dbCount: dbCounts.statistics,
          mappedCount: mappedCounts.statisticsRows,
          shouldRender: renderReadiness.statistics,
        }),
      }
      const diagnosis = {
        ...baseDiagnosis,
        events: applyIncidentDiagnosis(baseDiagnosis.events, playerIncidentAudit),
      }
      const itemWarnings = [
        ...(audit.warnings ?? []),
        playerIncidentAudit.duplicatedEvents > 0
          ? `match_events/cache tiene ${playerIncidentAudit.duplicatedEvents} eventos crudos duplicados antes del render.`
          : null,
        playerIncidentAudit.duplicatedIncidents > 0
          ? 'El render detecto incidencias duplicadas por jugador.'
          : null,
        playerIncidentAudit.wrongGoalAssignments > 0
          ? 'Hay goles asignados a jugadores que no coinciden con el evento principal.'
          : null,
        playerIncidentAudit.suspiciousAssignments > 0
          ? 'Hay eventos cuyo jugador no aparece en la alineacion del mismo equipo.'
          : null,
        providerCounts && providerCounts.lineups > 0 && dbCounts.lineups === 0
          ? 'Provider trae alineaciones pero la DB/cache no las tiene.'
          : null,
        providerCounts && providerCounts.statistics > 0 && dbCounts.statistics === 0
          ? 'Provider trae estadisticas pero la DB/cache no las tiene.'
          : null,
        dbCounts.lineups > 0 && mappedCounts.formationPlayers === 0
          ? 'DB tiene alineaciones pero el view model no preparo jugadores.'
          : null,
        dbCounts.statistics > 0 && mappedCounts.statisticsRows === 0
          ? 'DB tiene estadisticas pero el normalizador no preparo filas.'
          : null,
      ].filter((warning): warning is string => Boolean(warning))
      const hasProblem =
        Object.values(diagnosis).some((value) => value !== 'ok') ||
        providerErrors.length > 0 ||
        playerIncidentAudit.suspiciousAssignments > 0

      const item = {
        match: audit.match ?? {
          id: match.id,
          external_id: fixtureExternalId,
        },
        status: viewModel.match.status ?? match.status,
        providerCounts: providerCounts ?? {
          events: 0,
          lineups: 0,
          statistics: 0,
        },
        providerChecked: includeProvider,
        dbCounts,
        mappedCounts,
        renderReadiness,
        diagnosis,
        playerIncidentAudit,
        warnings: itemWarnings,
        errors: providerErrors,
      }

      if (!onlyProblems || hasProblem) items.push(item)
    }

    return jsonNoStore({
      ok: true,
      endpoint: 'match-detail-system-audit',
      filters: {
        fixture,
        matchId,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        leagueExternalId,
        includeProvider,
        onlyProblems,
        limit,
      },
      checked: matches.length,
      returned: items.length,
      items,
      warnings,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-detail-system-audit] Error completo', serialized)

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
