import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncBroadcastsFromRules, syncProviderBroadcasts } from '@/server/broadcasts/admin'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) return true
  if (!cronSecret) return false

  return request.headers.get('x-cron-secret') === cronSecret
}

function getBuenosAiresTodayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDaysToISO(isoDate: string, amount: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + amount)

  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

async function getSyncOptions(request: Request) {
  const { searchParams } = new URL(request.url)
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {}
  const today = getBuenosAiresTodayISO()
  const date =
    searchParams.get('date') ??
    readString((body as Record<string, unknown>).date)
  const dateFrom =
    searchParams.get('dateFrom') ??
    searchParams.get('from') ??
    readString((body as Record<string, unknown>).dateFrom) ??
    readString((body as Record<string, unknown>).date_from) ??
    date ??
    today
  const dateTo =
    searchParams.get('dateTo') ??
    searchParams.get('to') ??
    readString((body as Record<string, unknown>).dateTo) ??
    readString((body as Record<string, unknown>).date_to) ??
    date ??
    addDaysToISO(today, 14)
  const leagueExternalId =
    searchParams.get('leagueExternalId') ??
    searchParams.get('league_external_id') ??
    readString((body as Record<string, unknown>).leagueExternalId) ??
    readString((body as Record<string, unknown>).league_external_id)
  const leagueName =
    searchParams.get('leagueName') ??
    searchParams.get('league_name') ??
    readString((body as Record<string, unknown>).leagueName) ??
    readString((body as Record<string, unknown>).league_name)
  const limit =
    readNumber(searchParams.get('limit')) ??
    readNumber((body as Record<string, unknown>).limit)
  const offset =
    readNumber(searchParams.get('offset')) ??
    readNumber(searchParams.get('cursor')) ??
    readNumber((body as Record<string, unknown>).offset) ??
    readNumber((body as Record<string, unknown>).cursor)
  const source =
    searchParams.get('source') ??
    searchParams.get('mode') ??
    readString((body as Record<string, unknown>).source) ??
    readString((body as Record<string, unknown>).mode) ??
    'auto'

  return {
    dateFrom,
    dateTo,
    leagueExternalId,
    leagueName,
    limit,
    offset,
    source,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const options = await getSyncOptions(request)
    const normalizedSource = options.source.toLowerCase()
    const shouldSyncApi = normalizedSource === 'auto' || normalizedSource === 'api'
    const shouldSyncRules = normalizedSource === 'auto' || normalizedSource === 'rules'
    const apiResult = shouldSyncApi
      ? await syncProviderBroadcasts(supabase, {
          ...options,
          includeApi: true,
          dryRun: false,
        }).catch((error) => ({
          ok: false,
          error: error instanceof Error ? error.message : 'No se pudo sincronizar TV desde API.',
        }))
      : null
    const rulesResult = shouldSyncRules
      ? await syncBroadcastsFromRules(supabase, options)
      : {
          matchesChecked: 0,
          rulesLoaded: 0,
          broadcastsCreated: 0,
          broadcastsUpdated: 0,
          skipped: 0,
          sample: [],
        }

    return NextResponse.json({
      ok: true,
      source: normalizedSource,
      api: apiResult,
      rules: rulesResult,
      ...rulesResult,
    })
  } catch (error) {
    console.error('[sync-broadcasts] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo sincronizar televisacion.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
