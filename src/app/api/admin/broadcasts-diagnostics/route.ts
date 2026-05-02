import { NextResponse } from 'next/server'
import { getMatchesByDate } from '@/lib/api-football'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getUpcomingMatchesWithoutBroadcasts } from '@/server/broadcasts/admin'

type MatchRow = {
  id: string | number
  external_id: string | number | null
  broadcast_channel?: string | null
  broadcast_logo_url?: string | null
}

type BroadcastRow = {
  id?: string
  match_id: string | number
  broadcaster_name: string
  broadcaster_logo_url: string | null
  country: string | null
  created_at?: string
}

type BroadcastRuleRow = {
  id: string
  league_external_id: string | null
  league_name: string | null
  country: string | null
  home_team_name: string | null
  away_team_name: string | null
  broadcaster_name: string
  broadcaster_logo_url: string | null
  priority: number | null
  active: boolean | null
  created_at?: string
}

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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function isMissingOptionalBroadcastsTable(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('match_broadcasts') ||
    message.includes('schema cache')
  )
}

function isMissingOptionalBroadcastColumns(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase()

  return (
    error.code === '42703' ||
    message.includes('broadcast_channel') ||
    message.includes('broadcast_logo_url') ||
    message.includes('schema cache')
  )
}

function isMissingOptionalRulesTable(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase()

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('broadcast_rules') ||
    message.includes('schema cache')
  )
}

async function fetchVisibleMatchRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  externalIdsForQuery: Array<string | number>
) {
  const rows: MatchRow[] = []
  let missingBroadcastColumns = false

  for (const chunk of chunkArray(externalIdsForQuery, 100)) {
    const response = await supabase
      .from('matches')
      .select('id, external_id, broadcast_channel, broadcast_logo_url')
      .in('external_id', chunk)

    if (!response.error) {
      rows.push(...((response.data ?? []) as MatchRow[]))
      continue
    }

    if (!isMissingOptionalBroadcastColumns(response.error)) throw response.error

    missingBroadcastColumns = true
    break
  }

  if (!missingBroadcastColumns) return rows

  for (const chunk of chunkArray(externalIdsForQuery, 100)) {
    const response = await supabase
      .from('matches')
      .select('id, external_id')
      .in('external_id', chunk)

    if (response.error) throw response.error

    rows.push(
      ...((response.data ?? []) as MatchRow[]).map((row) => ({
        ...row,
        broadcast_channel: null,
        broadcast_logo_url: null,
      }))
    )
  }

  return rows
}

async function fetchBroadcastRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const rows: BroadcastRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_broadcasts')
      .select('match_id, broadcaster_name, broadcaster_logo_url, country, created_at')
      .in('match_id', chunk)
      .order('broadcaster_name', { ascending: true })

    if (response.error) {
      if (isMissingOptionalBroadcastsTable(response.error)) return { rows: [], tableExists: false }
      throw response.error
    }

    rows.push(...((response.data ?? []) as BroadcastRow[]))
  }

  return { rows, tableExists: true }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || getBuenosAiresTodayISO()
    const dateTo = searchParams.get('dateTo') || searchParams.get('to') || addDaysToISO(date, 14)
    const supabase = getSupabaseAdminClient()
    const visibleMatches = await getMatchesByDate(date)
    const externalIds = [
      ...new Set(
        visibleMatches
          .map((match) => match.externalId ?? match.id)
          .filter((id) => Number.isFinite(id))
      ),
    ]
    const externalIdsForQuery = [
      ...new Set(externalIds.flatMap((id) => [id, String(id)])),
    ]
    const matchRows = await fetchVisibleMatchRows(supabase, externalIdsForQuery)
    const matchRowsByExternalId = new Map(
      matchRows
        .filter((row) => row.external_id !== null)
        .map((row) => [String(row.external_id), row])
    )
    const matchIds = [...new Set(matchRows.map((row) => String(row.id)))]
    const [
      countResult,
      latestResult,
      visibleBroadcastsResult,
      rulesCountResult,
      activeRulesResult,
      upcomingWithoutTvResult,
      upcomingWithTvResult,
    ] = await Promise.all([
      supabase
        .from('match_broadcasts')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('match_broadcasts')
        .select('id, match_id, broadcaster_name, broadcaster_logo_url, country, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      matchIds.length
        ? fetchBroadcastRows(supabase, matchIds)
        : Promise.resolve({ rows: [], tableExists: true }),
      supabase
        .from('broadcast_rules')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('broadcast_rules')
        .select('id, league_external_id, league_name, country, home_team_name, away_team_name, broadcaster_name, broadcaster_logo_url, priority, active, created_at')
        .eq('active', true)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(20),
      getUpcomingMatchesWithoutBroadcasts(supabase, {
        dateFrom: date,
        dateTo,
        includeWithBroadcasts: false,
        limit: 50,
      }),
      getUpcomingMatchesWithoutBroadcasts(supabase, {
        dateFrom: date,
        dateTo,
        includeWithBroadcasts: true,
        limit: 100,
      }),
    ])
    let tableExists = visibleBroadcastsResult.tableExists
    let totalMatchBroadcasts = countResult.count ?? 0
    let latestBroadcasts = (latestResult.data ?? []) as BroadcastRow[]
    let totalBroadcastRules = rulesCountResult.count ?? 0
    let activeRulesSample = (activeRulesResult.data ?? []) as BroadcastRuleRow[]

    if (countResult.error) {
      if (!isMissingOptionalBroadcastsTable(countResult.error)) throw countResult.error
      tableExists = false
      totalMatchBroadcasts = 0
    }

    if (latestResult.error) {
      if (!isMissingOptionalBroadcastsTable(latestResult.error)) throw latestResult.error
      tableExists = false
      latestBroadcasts = []
    }

    if (rulesCountResult.error) {
      if (!isMissingOptionalRulesTable(rulesCountResult.error)) throw rulesCountResult.error
      totalBroadcastRules = 0
    }

    if (activeRulesResult.error) {
      if (!isMissingOptionalRulesTable(activeRulesResult.error)) throw activeRulesResult.error
      activeRulesSample = []
    }

    const broadcastsByMatchId = visibleBroadcastsResult.rows.reduce<Map<string, BroadcastRow[]>>(
      (accumulator, row) => {
        const matchId = String(row.match_id)
        const current = accumulator.get(matchId) ?? []

        current.push(row)
        accumulator.set(matchId, current)

        return accumulator
      },
      new Map()
    )
    const visibleDiagnostics = visibleMatches.map((match) => {
      const externalId = match.externalId ?? match.id
      const matchRow = matchRowsByExternalId.get(String(externalId)) ?? null
      const tableBroadcasters = matchRow
        ? broadcastsByMatchId.get(String(matchRow.id)) ?? []
        : []
      const legacyBroadcaster =
        matchRow?.broadcast_channel
          ? [{
              match_id: matchRow.id,
              broadcaster_name: matchRow.broadcast_channel,
              broadcaster_logo_url: matchRow.broadcast_logo_url ?? null,
              country: null,
            }]
          : []
      const broadcasters = tableBroadcasters.length ? tableBroadcasters : legacyBroadcaster

      return {
        match_id: matchRow?.id ?? null,
        external_id: externalId,
        home: match.home,
        away: match.away,
        league: match.league,
        exists_in_supabase: Boolean(matchRow),
        broadcasters_found: broadcasters.length,
        broadcasters: broadcasters.map((broadcaster) => ({
          name: broadcaster.broadcaster_name,
          logo_url: broadcaster.broadcaster_logo_url,
          country: broadcaster.country,
        })),
      }
    })

    return NextResponse.json({
      ok: true,
      date,
      date_to: dateTo,
      total_match_broadcasts: totalMatchBroadcasts,
      total_broadcast_rules: totalBroadcastRules,
      message:
        !tableExists || totalMatchBroadcasts === 0
          ? 'No hay broadcasters cargados en Supabase'
          : null,
      latest_broadcasts: latestBroadcasts,
      active_rules_sample: activeRulesSample,
      visible_matches: visibleDiagnostics,
      upcoming_without_tv: upcomingWithoutTvResult.matches.slice(0, 30),
      upcoming_with_tv: upcomingWithTvResult.matches
        .filter((match) => match.broadcasters.length > 0)
        .slice(0, 30),
      sample_by_league: upcomingWithTvResult.matches.reduce<Record<string, {
        league: string
        with_tv: number
        without_tv: number
      }>>((accumulator, match) => {
        const key = match.league || 'Sin liga'
        const current = accumulator[key] ?? {
          league: key,
          with_tv: 0,
          without_tv: 0,
        }

        if (match.broadcasters.length > 0) {
          current.with_tv += 1
        } else {
          current.without_tv += 1
        }

        accumulator[key] = current
        return accumulator
      }, {}),
    })
  } catch (error) {
    console.error('[broadcasts-diagnostics] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo diagnosticar broadcasters.',
      },
      { status: 500 }
    )
  }
}
