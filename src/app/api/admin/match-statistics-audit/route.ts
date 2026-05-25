import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  auditMatchDetailsGeneral,
  serializeError,
  type MatchDetailGeneralAuditItem,
} from '@/server/match-detail-cache'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'

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

function readBoolean(value: string | null, fallback = false) {
  if (value === null) return fallback

  return ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase())
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

function simplifyItem(item: MatchDetailGeneralAuditItem) {
  return {
    matchId: item.matchId,
    fixtureExternalId: item.fixtureExternalId,
    league: item.league,
    teams: item.teams,
    status: item.status,
    matchDate: item.matchDate,
    providerCounts: item.providerCounts,
    dbCounts: item.dbCounts,
    renderCounts: item.renderCounts,
    statisticsMismatches: item.statisticsMismatches,
    warnings: item.warnings,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const range = readDateRange(searchParams)
    const onlyProblems = readBoolean(searchParams.get('onlyProblems'))
    const includeProvider = readBoolean(searchParams.get('includeProvider'), true)
    const audit = await auditMatchDetailsGeneral(getSupabaseAdminClient(), {
      limit: readNumber(searchParams.get('limit')) ?? 50,
      leagueExternalId: readNumber(searchParams.get('leagueExternalId')),
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      includeProvider,
      missingOnly: false,
    })
    const items = audit.items
    const completeStats = items.filter((item) =>
      item.dbCounts.statistics > 0 &&
      item.renderCounts.statisticsRows > 2
    )
    const providerNoStatistics = items.filter((item) =>
      item.providerCounts !== null &&
      item.providerCounts.statistics === 0 &&
      item.dbCounts.statistics === 0
    )
    const syncStatisticsNotPersisted = items.filter((item) =>
      item.providerCounts !== null &&
      item.providerCounts.statistics > 0 &&
      item.dbCounts.statistics === 0
    )
    const onlyDerivedDisciplineStats = items.filter((item) =>
      item.dbCounts.statistics === 0 &&
      item.dbCounts.events > 0 &&
      item.audit.hasCards
    )
    const statisticsRenderProblems = items.filter((item) =>
      item.dbCounts.statistics > 0 &&
      item.renderCounts.statisticsRows === 0
    )
    const problemItems = [
      ...syncStatisticsNotPersisted,
      ...statisticsRenderProblems,
      ...onlyDerivedDisciplineStats,
    ]
    const uniqueProblemItems = [...new Map(problemItems.map((item) => [item.fixtureExternalId, item])).values()]
    const selectedItems = onlyProblems ? uniqueProblemItems : items

    return jsonNoStore({
      ok: true,
      matchesChecked: items.length,
      filters: {
        ...audit.filters,
        onlyProblems,
        includeProvider,
      },
      completeStats: completeStats.length,
      providerNoStatistics: providerNoStatistics.length,
      syncStatisticsNotPersisted: syncStatisticsNotPersisted.length,
      onlyDerivedDisciplineStats: onlyDerivedDisciplineStats.length,
      statisticsRenderProblems: statisticsRenderProblems.length,
      examples: {
        completeStats: completeStats.slice(0, 10).map(simplifyItem),
        providerNoStatistics: providerNoStatistics.slice(0, 10).map(simplifyItem),
        syncStatisticsNotPersisted: syncStatisticsNotPersisted.slice(0, 10).map(simplifyItem),
        onlyDerivedDisciplineStats: onlyDerivedDisciplineStats.slice(0, 10).map(simplifyItem),
        statisticsRenderProblems: statisticsRenderProblems.slice(0, 10).map(simplifyItem),
      },
      items: selectedItems.map(simplifyItem),
      warnings: audit.warnings,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-statistics-audit] Error completo', serialized)

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
