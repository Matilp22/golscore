import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { auditMatchDetailCache, serializeError } from '@/server/match-detail-cache'

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

function readCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readBoolean(value: unknown) {
  return Boolean(value)
}

function isFinalStatus(value: unknown) {
  const status = String(value ?? '').trim().toUpperCase()

  return ['FT', 'AET', 'PEN', 'FINISHED', 'MATCH FINISHED', 'FINAL'].includes(status)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fixture = readNumber(searchParams.get('fixture'))
    const matchId = searchParams.get('matchId') ?? searchParams.get('match_id')
    const supabase = getSupabaseAdminClient()

    if (!fixture && !matchId) {
      return jsonNoStore(
        {
          ok: false,
          error: 'missing_match_identifier',
          message: 'Informar matchId o fixture para auditar el estado del detalle.',
        },
        { status: 400 }
      )
    }

    const audit = await auditMatchDetailCache(supabase, {
      fixtureExternalId: fixture,
      matchId,
    })
    const auditRecord = audit as Record<string, unknown>
    const events = asRecord(auditRecord.events)
    const renderReadiness = asRecord(auditRecord.renderReadiness)
    const status = asRecord(auditRecord.match)?.status ?? null
    const substitutionsCount = readCount(events?.substitutions)
    const persistedData = {
      eventsCount: audit.eventsCount,
      substitutionsCount,
      varCount: readCount(events?.varEvents),
      missedPenaltyCount: readCount(events?.missedPenalties),
      lineupsCount:
        audit.lineupsHomeCount +
        audit.lineupsAwayCount +
        audit.substitutesHomeCount +
        audit.substitutesAwayCount,
      statisticsCount: audit.statisticsCount,
    }
    const finalRenderReadiness = {
      canRenderTimeline: readBoolean(renderReadiness?.canRenderTimeline ?? audit.hasEvents),
      canRenderLineups: readBoolean(
        renderReadiness?.canRenderPitch ??
        renderReadiness?.canRenderLineupLists ??
        audit.hasLineups
      ),
      canRenderStats: readBoolean(
        renderReadiness?.canRenderStats ??
        renderReadiness?.canRenderPartialStats ??
        audit.hasStatistics
      ),
      canRenderSubstitutions: substitutionsCount > 0,
    }
    const missingForFinal = isFinalStatus(status)
      ? [
          !finalRenderReadiness.canRenderTimeline ? 'timeline' : null,
          !finalRenderReadiness.canRenderLineups ? 'lineups' : null,
          !finalRenderReadiness.canRenderStats ? 'statistics' : null,
        ].filter((item): item is string => Boolean(item))
      : []

    return jsonNoStore({
      ok: true,
      match: audit.match,
      status,
      renderSource: 'supabase:matches+match_events+football_match_detail_cache',
      persistedData,
      liveLikeDataIfAny: {
        source: 'football_match_detail_cache+match_events',
        ...persistedData,
      },
      finalRenderReadiness,
      missingForFinal,
      warnings: audit.warnings,
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[match-detail-state-audit] Error completo', serialized)

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
