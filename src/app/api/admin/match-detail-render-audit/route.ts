import { NextResponse } from 'next/server'

import {
  getMatchDetail,
  type MatchEvent,
  type MatchFixture,
  type MatchLineup,
  type MatchStatisticsTeam,
} from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { auditMatchDetailCache, serializeError } from '@/server/match-detail-cache'
import { getTimelineEvents } from '@/shared/utils/football-events'
import {
  buildDisciplineStatisticsFromEvents,
  normalizeMatchStatistics,
} from '@/shared/utils/match-statistics'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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

function readNumber(value: string | null) {
  if (!value?.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeTeamName(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\b(ca|club|de|del|la|el|fc|ac)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isSameTeamRef(
  candidate: { id?: number; name?: string } | undefined,
  target: { id?: number; name?: string }
) {
  if (!candidate || !target) return false
  if (candidate.id && target.id && Number(candidate.id) === Number(target.id)) return true

  const candidateName = normalizeTeamName(candidate.name)
  const targetName = normalizeTeamName(target.name)

  return Boolean(
    candidateName &&
    targetName &&
    (
      candidateName === targetName ||
      candidateName.includes(targetName) ||
      targetName.includes(candidateName)
    )
  )
}

function countPlayers(lineup: MatchLineup | null | undefined, key: 'startXI' | 'substitutes') {
  const players = lineup?.[key]

  return Array.isArray(players) ? players.length : 0
}

function getLineupsForFixture(lineups: MatchLineup[], fixture: MatchFixture | null) {
  if (!fixture) {
    return {
      homeLineup: lineups[0] ?? null,
      awayLineup: lineups[1] ?? null,
    }
  }

  return {
    homeLineup:
      lineups.find((lineup) => isSameTeamRef(lineup.team, fixture.teams.home)) ??
      lineups[0] ??
      null,
    awayLineup:
      lineups.find((lineup) => isSameTeamRef(lineup.team, fixture.teams.away)) ??
      lineups[1] ??
      null,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fixture = readNumber(searchParams.get('fixture'))
    const matchId = searchParams.get('matchId') ?? searchParams.get('match_id')

    if (!fixture && !matchId) {
      return jsonNoStore(
        {
          ok: false,
          error: 'missing_match_identifier',
          message: 'Informar matchId o fixture para auditar render de detalle.',
        },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    const audit = await auditMatchDetailCache(supabase, {
      fixtureExternalId: fixture,
      matchId,
    })
    const fixtureExternalId = audit.fixtureExternalId

    if (!fixtureExternalId) {
      return jsonNoStore({
        ok: false,
        error: 'missing_fixture_external_id',
        match: audit.match,
        db: {
          eventsCount: 0,
          rawAuditEventsCount: audit.eventsCount,
          lineupsCount:
            audit.lineupsHomeCount +
            audit.lineupsAwayCount +
            audit.substitutesHomeCount +
            audit.substitutesAwayCount,
          statisticsCount: audit.statisticsCount,
          homeStartersCount: audit.homeStartersCount,
          awayStartersCount: audit.awayStartersCount,
          homeSubsCount: audit.homeSubstitutesCount,
          awaySubsCount: audit.awaySubstitutesCount,
        },
        mapped: {
          timelineEventsCount: 0,
          formationPlayersCount: 0,
          statisticsRowsCount: 0,
          disciplineRowsCount: 0,
          startersCount: 0,
          substitutesCount: 0,
          startersTabCount: 0,
          substitutesTabCount: 0,
        },
        renderReadiness: {
          canRenderTimeline: false,
          canRenderFormation: false,
          canRenderStatistics: false,
          canRenderLineupTabs: false,
        },
        missingBecause: ['fixture_external_id_not_resolved'],
        warnings: audit.warnings,
      })
    }

    const detail = await getMatchDetail(fixtureExternalId)
    const fixtureData = detail.fixture as MatchFixture | null
    const events: MatchEvent[] = Array.isArray(detail.events) ? detail.events : []
    const lineups: MatchLineup[] = Array.isArray(detail.lineups) ? detail.lineups : []
    const statistics: MatchStatisticsTeam[] = Array.isArray(detail.statistics)
      ? detail.statistics
      : []
    const timelineEvents = getTimelineEvents(events)
    const statPairs = fixtureData
      ? normalizeMatchStatistics(
          statistics,
          fixtureData.teams.home,
          fixtureData.teams.away,
          events
        )
      : []
    const disciplinePairs = fixtureData && !statPairs.length
      ? buildDisciplineStatisticsFromEvents(events, fixtureData.teams.home, fixtureData.teams.away)
      : []
    const { homeLineup, awayLineup } = getLineupsForFixture(lineups, fixtureData)
    const homeStartersCount = countPlayers(homeLineup, 'startXI')
    const awayStartersCount = countPlayers(awayLineup, 'startXI')
    const homeSubsCount = countPlayers(homeLineup, 'substitutes')
    const awaySubsCount = countPlayers(awayLineup, 'substitutes')
    const formationPlayersCount = homeStartersCount + awayStartersCount
    const startersTabCount = formationPlayersCount
    const substitutesTabCount = homeSubsCount + awaySubsCount
    const dbLineupsCount =
      audit.lineupsHomeCount +
      audit.lineupsAwayCount +
      audit.substitutesHomeCount +
      audit.substitutesAwayCount
    const missingBecause = [
      events.length > 0 && timelineEvents.length === 0
        ? 'events_exist_but_timeline_mapper_returned_empty'
        : null,
      dbLineupsCount > 0 && formationPlayersCount === 0
        ? 'lineups_exist_but_mapper_lost_players_or_team_match_failed'
        : null,
      audit.statisticsCount > 0 && statPairs.length === 0
        ? 'statistics_exist_but_normalizer_returned_empty'
        : null,
      !fixtureData ? 'fixture_not_resolved_for_render' : null,
      lineups.length > 0 && formationPlayersCount === 0
        ? 'lineups_array_present_without_resolved_start_xi'
        : null,
      asRecord(audit.renderReadiness)?.canRenderPitch === false && formationPlayersCount > 0
        ? 'audit_readiness_false_but_mapped_players_available'
        : null,
    ].filter((item): item is string => Boolean(item))

    return jsonNoStore({
      ok: true,
      match: audit.match,
      db: {
        eventsCount: events.length,
        rawAuditEventsCount: audit.eventsCount,
        lineupsCount: dbLineupsCount,
        statisticsCount: audit.statisticsCount,
        homeStartersCount: audit.homeStartersCount,
        awayStartersCount: audit.awayStartersCount,
        homeSubsCount: audit.homeSubstitutesCount,
        awaySubsCount: audit.awaySubstitutesCount,
      },
      mapped: {
        timelineEventsCount: timelineEvents.length,
        formationPlayersCount,
        statisticsRowsCount: statPairs.length,
        disciplineRowsCount: disciplinePairs.length,
        startersCount: startersTabCount,
        substitutesCount: substitutesTabCount,
        startersTabCount,
        substitutesTabCount,
      },
      renderReadiness: {
        canRenderTimeline: timelineEvents.length > 0,
        canRenderFormation: formationPlayersCount > 0,
        canRenderStatistics: statPairs.length > 0,
        canRenderLineupTabs: startersTabCount > 0 || substitutesTabCount > 0,
      },
      missingBecause,
      warnings: [
        ...audit.warnings,
        audit.eventsCount > events.length
          ? `match_events contiene ${audit.eventsCount} filas crudas y el render recibe ${events.length} eventos unicos tras desduplicar cache/stored events.`
          : null,
      ].filter((warning): warning is string => Boolean(warning)),
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-detail-render-audit] Error completo', serialized)

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
