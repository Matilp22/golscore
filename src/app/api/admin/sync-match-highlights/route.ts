import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  serializeHighlightError,
  syncMatchHighlights,
  type HighlightSyncOptions,
} from '@/server/match-highlights'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false

  return ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase())
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function readOptions(request: Request): Promise<HighlightSyncOptions> {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
  const bodyRecord = body as Record<string, unknown>

  return {
    matchId:
      searchParams.get('matchId') ??
      searchParams.get('match_id') ??
      readString(bodyRecord.matchId) ??
      readString(bodyRecord.match_id),
    fixture:
      searchParams.get('fixture') ??
      searchParams.get('fixtureExternalId') ??
      searchParams.get('fixture_external_id') ??
      readString(bodyRecord.fixture) ??
      readString(bodyRecord.fixtureExternalId) ??
      readString(bodyRecord.fixture_external_id),
    leagueExternalId:
      searchParams.get('leagueExternalId') ??
      searchParams.get('league_external_id') ??
      readString(bodyRecord.leagueExternalId) ??
      readString(bodyRecord.league_external_id),
    date:
      searchParams.get('date') ??
      readString(bodyRecord.date),
    dateFrom:
      searchParams.get('dateFrom') ??
      searchParams.get('date_from') ??
      readString(bodyRecord.dateFrom) ??
      readString(bodyRecord.date_from),
    dateTo:
      searchParams.get('dateTo') ??
      searchParams.get('date_to') ??
      readString(bodyRecord.dateTo) ??
      readString(bodyRecord.date_to),
    limit: readNumber(searchParams.get('limit')) ?? readNumber(bodyRecord.limit),
    recentFinishedOnly: readBoolean(
      searchParams.get('recentFinishedOnly') ??
        searchParams.get('recent_finished_only') ??
        bodyRecord.recentFinishedOnly ??
        bodyRecord.recent_finished_only
    ),
    force: readBoolean(searchParams.get('force') ?? bodyRecord.force),
  }
}

function inferErrorSource(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const code = typeof record.code === 'string' ? record.code : ''

    if (code === 'MISSING_YOUTUBE_API_KEY') return 'config'
    if (
      code.startsWith('YOUTUBE') ||
      code === 'keyInvalid' ||
      code === 'quotaExceeded' ||
      code === 'dailyLimitExceeded'
    ) {
      return 'youtube'
    }
    if (
      code.startsWith('PGRST') ||
      /^[0-9A-Z]{5}$/.test(code) ||
      typeof record.details === 'string' ||
      typeof record.hint === 'string'
    ) {
      return 'supabase'
    }
  }

  if (/youtube/i.test(message)) return 'youtube'
  if (/supabase|postgrest|schema cache/i.test(message)) return 'supabase'
  if (/YOUTUBE_API_KEY/i.test(message)) return 'config'

  return 'unknown'
}

function errorJson(error: unknown) {
  const serialized = serializeHighlightError(error, inferErrorSource(error))
  const status =
    serialized.status ??
    (serialized.code === 'missing_youtube_api_key' || serialized.code === 'MISSING_YOUTUBE_API_KEY'
      ? 503
      : serialized.source === 'youtube'
        ? 502
        : 500)

  console.error('[sync-match-highlights] endpoint-error', serialized)

  return NextResponse.json(
    {
      ok: false,
      error: serialized.code,
      message: serialized.message,
      code: serialized.code,
      detail: serialized.detail,
      source: serialized.source,
      status: serialized.status,
      missingColumns: serialized.missingColumns,
    },
    {
      status,
      headers: JSON_HEADERS,
    }
  )
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado' },
        { status: 401, headers: JSON_HEADERS }
      )
    }
    if (!process.env.YOUTUBE_API_KEY) {
      return errorJson({
        message: 'Falta YOUTUBE_API_KEY',
        code: 'missing_youtube_api_key',
        detail: 'Configura YOUTUBE_API_KEY en variables de entorno server-side.',
      })
    }

    const supabase = getSupabaseAdminClient()
    const options = await readOptions(request)
    const result = await syncMatchHighlights(supabase, options)

    return NextResponse.json(result, {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    return errorJson(error)
  }
}

export async function POST(request: Request) {
  return GET(request)
}
