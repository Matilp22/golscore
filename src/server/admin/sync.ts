import 'server-only'

import { getAdminClient, toAdminDataError, type AdminDataResult } from '@/server/admin/shared'
import { syncHomeScoreboardMatches } from '@/server/prode/sync-matches'
import { addDaysToISO, getArgentinaTodayISO } from '@/shared/utils/argentina-time'

export type FixtureDateSummary = {
  date: string
  fixtures: number
  lastUpdatedAt: string | null
}

export type DashboardStats = {
  status: 'ok' | 'setup_required' | 'error'
  lastSyncAt: string | null
  today: {
    date: string
    fixtures: number
  }
  tomorrow: {
    date: string
    fixtures: number
  }
  recentErrors: string[]
}

export type SyncPanelData = {
  lastSyncAt: string | null
  dateSummaries: FixtureDateSummary[]
  recentErrors: string[]
  logsAvailable: boolean
}

export type ManualSyncResult = {
  ok: boolean
  checked: number
  synced: number
  cached: number
  errors: Array<{
    fixtureId: number | null
    stage: string
    message: string
  }>
  durationMs: number
  date: string | null
}

type FixtureCacheSummaryRow = {
  date: string
  updated_at: string | null
}

function emptyDashboardStats(status: DashboardStats['status']): DashboardStats {
  const today = getArgentinaTodayISO()
  const tomorrow = addDaysToISO(today, 1)

  return {
    status,
    lastSyncAt: null,
    today: {
      date: today,
      fixtures: 0,
    },
    tomorrow: {
      date: tomorrow,
      fixtures: 0,
    },
    recentErrors: [],
  }
}

function summarizeRows(rows: FixtureCacheSummaryRow[]) {
  const summaries = new Map<string, FixtureDateSummary>()

  for (const row of rows) {
    const current = summaries.get(row.date) ?? {
      date: row.date,
      fixtures: 0,
      lastUpdatedAt: null,
    }

    current.fixtures += 1

    if (
      row.updated_at &&
      (!current.lastUpdatedAt || new Date(row.updated_at) > new Date(current.lastUpdatedAt))
    ) {
      current.lastUpdatedAt = row.updated_at
    }

    summaries.set(row.date, current)
  }

  return [...summaries.values()].sort((left, right) => right.date.localeCompare(left.date))
}

export async function getAdminDashboardStats(): Promise<AdminDataResult<DashboardStats>> {
  const fallback = emptyDashboardStats('error')

  try {
    const supabase = getAdminClient()
    const today = getArgentinaTodayISO()
    const tomorrow = addDaysToISO(today, 1)
    const { data, error } = await supabase
      .from('football_fixture_cache')
      .select('date, updated_at')
      .in('date', [today, tomorrow])
      .limit(5000)

    if (error) {
      const adminError = toAdminDataError(error, 'No se pudo leer el cache de fixtures.')

      return {
        data: emptyDashboardStats(adminError.setupRequired ? 'setup_required' : 'error'),
        error: adminError,
      }
    }

    const summaries = summarizeRows((data ?? []) as FixtureCacheSummaryRow[])
    const byDate = new Map(summaries.map((summary) => [summary.date, summary]))
    const lastSyncAt =
      summaries
        .map((summary) => summary.lastUpdatedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null

    return {
      data: {
        status: 'ok',
        lastSyncAt,
        today: {
          date: today,
          fixtures: byDate.get(today)?.fixtures ?? 0,
        },
        tomorrow: {
          date: tomorrow,
          fixtures: byDate.get(tomorrow)?.fixtures ?? 0,
        },
        recentErrors: [],
      },
      error: null,
    }
  } catch (error) {
    return {
      data: fallback,
      error: toAdminDataError(error, 'No se pudo cargar el dashboard admin.'),
    }
  }
}

export async function getSyncPanelData(): Promise<AdminDataResult<SyncPanelData>> {
  const fallback: SyncPanelData = {
    lastSyncAt: null,
    dateSummaries: [],
    recentErrors: [],
    logsAvailable: false,
  }

  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('football_fixture_cache')
      .select('date, updated_at')
      .order('date', { ascending: false })
      .limit(5000)

    if (error) {
      return {
        data: fallback,
        error: toAdminDataError(error, 'No se pudo leer el cache de fixtures.'),
      }
    }

    const dateSummaries = summarizeRows((data ?? []) as FixtureCacheSummaryRow[])
    const lastSyncAt =
      dateSummaries
        .map((summary) => summary.lastUpdatedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null

    return {
      data: {
        lastSyncAt,
        dateSummaries: dateSummaries.slice(0, 14),
        recentErrors: [],
        logsAvailable: false,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: fallback,
      error: toAdminDataError(error, 'No se pudo cargar el panel de sync.'),
    }
  }
}

export async function runManualFixtureSync(input: {
  date?: string | null
  limit?: number | null
}): Promise<ManualSyncResult> {
  const startedAt = Date.now()
  const supabase = getAdminClient()
  const result = await syncHomeScoreboardMatches(supabase, {
    date: input.date || null,
    limit: input.limit ?? null,
    debug: false,
  })

  return {
    ok: result.sampleErrors.length === 0,
    checked: result.selected,
    synced: result.processed,
    cached: result.cached,
    errors: result.sampleErrors,
    durationMs: Date.now() - startedAt,
    date: input.date || null,
  }
}
