import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { auditMatchDetailCache, serializeError } from '@/server/match-detail-cache'
import { buildMatchDetailViewModel } from '@/server/match-detail-view-model'

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
      const frontBlockers = {
        hiddenByStatus: false,
        hiddenByEmptyFormationString: false,
        hiddenByMissingOfficialStats: false,
        hiddenByCssClass: false,
        hiddenByTabState: false,
        hiddenByWrongDataSource: true,
        hiddenByMobileBreakpoint: false,
      }
      const componentReadiness = {
        timelineShouldRender: false,
        formationShouldRender: false,
        statisticsShouldRender: false,
        lineupTabsShouldRender: false,
      }

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
        componentReadiness,
        frontBlockers,
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

    const viewModel = await buildMatchDetailViewModel({
      fixtureExternalId,
      matchId,
    })
    const events = viewModel.sourceEvents
    const lineups = viewModel.lineups
    const statistics = Array.isArray(viewModel.statistics) ? viewModel.statistics : []
    const timelineEvents = viewModel.timelineEvents
    const statPairs = viewModel.statisticsRows
    const disciplinePairs = viewModel.disciplineRows
    const formationPlayersCount = viewModel.renderCounts.formationPlayers
    const startersTabCount = viewModel.renderCounts.startersCount
    const substitutesTabCount = viewModel.renderCounts.substitutesCount
    const dbLineupsCount =
      audit.lineupsHomeCount +
      audit.lineupsAwayCount +
      audit.substitutesHomeCount +
      audit.substitutesAwayCount
    const componentReadiness = {
      timelineShouldRender: viewModel.renderReadiness.canRenderTimeline,
      formationShouldRender: viewModel.renderReadiness.canRenderFormation,
      statisticsShouldRender: viewModel.renderReadiness.canRenderStatistics,
      lineupTabsShouldRender: viewModel.renderReadiness.canRenderLineupTabs,
    }
    const hiddenByWrongDataSource =
      (audit.eventsCount > 0 && events.length === 0) ||
      (dbLineupsCount > 0 && lineups.length === 0) ||
      (audit.statisticsCount > 0 && statistics.length === 0)
    const frontBlockers = {
      hiddenByStatus: false,
      hiddenByEmptyFormationString: false,
      hiddenByMissingOfficialStats: audit.statisticsCount > 0 && statPairs.length === 0,
      hiddenByCssClass: false,
      hiddenByTabState: false,
      hiddenByWrongDataSource,
      hiddenByMobileBreakpoint: false,
    }
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
      !viewModel.fixture ? 'fixture_not_resolved_for_render' : null,
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
      renderStatus: audit.renderStatus,
      db: {
        eventsCount: audit.eventsCount,
        renderSourceEventsCount: events.length,
        lineupsCount: dbLineupsCount,
        statisticsCount: audit.statisticsCount,
        homeStartersCount: audit.homeStartersCount,
        awayStartersCount: audit.awayStartersCount,
        homeSubsCount: audit.homeSubstitutesCount,
        awaySubsCount: audit.awaySubstitutesCount,
      },
      dbCounts: {
        events: audit.eventsCount,
        lineups: dbLineupsCount,
        statistics: audit.statisticsCount,
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
      renderCounts: {
        timelineEvents: timelineEvents.length,
        formationPlayers: formationPlayersCount,
        statisticsRows: statPairs.length,
        startersCount: startersTabCount,
        substitutesCount: substitutesTabCount,
      },
      componentReadiness,
      frontBlockers,
      renderReadiness: viewModel.renderReadiness,
      missingBecause,
      warnings: [
        ...audit.warnings,
        audit.eventsCount > events.length
          ? `match_events contiene ${audit.eventsCount} filas crudas y el render recibe ${events.length} eventos unicos tras desduplicar cache/stored events.`
          : null,
        viewModel.formationStringsMissing
          ? 'Falta formation string en al menos un equipo, pero el front actual no bloquea la cancha por eso y usa posiciones por grid, posicion o fallback.'
          : null,
        hiddenByWrongDataSource
          ? 'Hay datos en audit/DB que no llegaron al objeto de render; revisar fuente getMatchDetail/cache.'
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
