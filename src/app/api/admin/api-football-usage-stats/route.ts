import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type UsageRow = {
  day: string
  endpoint: string
  context: string
  request_count: number | string
  success_count: number | string
  error_count: number | string
  timeout_count: number | string
  rate_limit_count: number | string
  total_duration_ms: number | string
  last_status: number | null
  last_error_code: string | null
}

type UsageAggregate = {
  requests: number
  successful: number
  errors: number
  timeouts: number
  rateLimited: number
  totalDurationMs: number
}

const DEFAULT_DAYS = 7
const DEFAULT_DAILY_LIMIT = 75000

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
  const cronSecret = process.env.CRON_SECRET

  return Boolean(cronSecret && getAuthorizationToken(request) === cronSecret)
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)

  return next
}

function isValidDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function getRange(searchParams: URLSearchParams) {
  const explicitDate = searchParams.get('date')

  if (isValidDate(explicitDate)) {
    return {
      dateFrom: explicitDate as string,
      dateTo: explicitDate as string,
      days: 1,
    }
  }

  const days = parsePositiveInteger(searchParams.get('days'), DEFAULT_DAYS)
  const dateTo = isValidDate(searchParams.get('dateTo'))
    ? (searchParams.get('dateTo') as string)
    : formatDate(new Date())
  const dateFrom = isValidDate(searchParams.get('dateFrom'))
    ? (searchParams.get('dateFrom') as string)
    : formatDate(addDays(new Date(`${dateTo}T00:00:00.000Z`), -(days - 1)))

  return { dateFrom, dateTo, days }
}

function createAggregate(): UsageAggregate {
  return {
    requests: 0,
    successful: 0,
    errors: 0,
    timeouts: 0,
    rateLimited: 0,
    totalDurationMs: 0,
  }
}

function addRow(target: UsageAggregate, row: UsageRow) {
  target.requests += toNumber(row.request_count)
  target.successful += toNumber(row.success_count)
  target.errors += toNumber(row.error_count)
  target.timeouts += toNumber(row.timeout_count)
  target.rateLimited += toNumber(row.rate_limit_count)
  target.totalDurationMs += toNumber(row.total_duration_ms)
}

function aggregateBy(rows: UsageRow[], key: keyof Pick<UsageRow, 'day' | 'endpoint' | 'context'>) {
  const map = new Map<string, UsageAggregate>()

  for (const row of rows) {
    const groupKey = String(row[key] ?? 'unknown')
    const current = map.get(groupKey) ?? createAggregate()

    addRow(current, row)
    map.set(groupKey, current)
  }

  return [...map.entries()]
    .map(([name, aggregate]) => ({ name, ...aggregate }))
    .sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name))
}

function getUsageStatus(requests: number) {
  if (requests > 75000) return 'exceeded'
  if (requests >= 65000) return 'danger'
  if (requests >= 50000) return 'warning'

  return 'ok'
}

function isMissingUsageTable(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('football_api_usage_daily') ||
    message.includes('schema cache')
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const range = getRange(searchParams)
    const dailyLimit = parsePositiveInteger(
      process.env.FOOTBALL_API_DAILY_LIMIT ?? null,
      DEFAULT_DAILY_LIMIT
    )
    const supabase = getSupabaseAdminClient()
    const response = await supabase
      .from('football_api_usage_daily')
      .select(
        'day, endpoint, context, request_count, success_count, error_count, timeout_count, rate_limit_count, total_duration_ms, last_status, last_error_code'
      )
      .gte('day', range.dateFrom)
      .lte('day', range.dateTo)
      .order('day', { ascending: true })
      .order('endpoint', { ascending: true })
      .order('context', { ascending: true })

    if (response.error) {
      if (isMissingUsageTable(response.error)) {
        return jsonNoStore(
          {
            ok: false,
            error: 'football_api_usage_daily_missing',
            message:
              'La tabla public.football_api_usage_daily no existe todavia. Aplicar la migracion aditiva antes de consultar metricas.',
            range,
          },
          { status: 503 }
        )
      }

      throw response.error
    }

    const rows = (response.data ?? []) as UsageRow[]
    const total = createAggregate()

    rows.forEach((row) => addRow(total, row))

    const todayKey = formatDate(new Date())
    const today = createAggregate()

    rows
      .filter((row) => row.day === todayKey)
      .forEach((row) => addRow(today, row))

    const status = getUsageStatus(today.requests)
    const warnings = [
      status === 'warning'
        ? 'API-Football usage is above 50,000 requests today.'
        : null,
      status === 'danger'
        ? 'API-Football usage is above 65,000 requests today.'
        : null,
      status === 'exceeded'
        ? 'API-Football usage exceeded the configured daily limit.'
        : null,
    ].filter((warning): warning is string => Boolean(warning))

    return jsonNoStore({
      ok: true,
      range,
      dailyLimit,
      totalRequests: total.requests,
      averagePerDay: range.days > 0 ? total.requests / range.days : 0,
      today: {
        requests: today.requests,
        successful: today.successful,
        errors: today.errors,
        timeouts: today.timeouts,
        rateLimited: today.rateLimited,
        remaining: Math.max(0, dailyLimit - today.requests),
        usagePercentage: dailyLimit > 0 ? (today.requests / dailyLimit) * 100 : null,
        status,
      },
      byDay: aggregateBy(rows, 'day'),
      byEndpoint: aggregateBy(rows, 'endpoint'),
      byContext: aggregateBy(rows, 'context'),
      warnings,
      groupBy: searchParams.get('groupBy') ?? null,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: 'api_football_usage_stats_failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
