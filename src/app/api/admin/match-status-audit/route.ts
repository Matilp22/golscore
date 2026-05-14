import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  isFinishedStatus,
  isLiveStatus,
  isPostponedStatus,
  isUpcomingStatus,
} from '@/shared/utils/match-status'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type MatchRow = {
  id: string | number
  external_id: string | number | null
  league_id: string | number | null
  home_team_id: string | number | null
  away_team_id: string | number | null
  match_date: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  elapsed?: number | null
  final_elapsed?: number | null
}

type LeagueRow = {
  id: string | number
  external_id: string | number | null
  name: string | null
}

type TeamRow = {
  id: string | number
  name: string | null
}

type StatusIssue = {
  id: string
  external_id: string | number | null
  league: string | null
  league_external_id: string | number | null
  local: string | null
  visitante: string | null
  match_date: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  elapsed: number | null
  final_elapsed: number | null
  hours_since_start: number | null
  reason: string
  suggested_fix: string | null
}

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }
const DEFAULT_LOOKBACK_DAYS = 7
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const DEFAULT_STALE_LIVE_HOURS = 4
const DEFAULT_PAST_NOT_FINISHED_HOURS = 8

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function readBoolean(value: string | null) {
  return value ? ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase()) : false
}

function readNumber(value: string | null, fallback: number, maxValue = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) return fallback

  return Math.min(maxValue, Math.floor(parsed))
}

function toIsoDateOffset(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString()
}

function getHoursSinceStart(matchDate: string | null) {
  if (!matchDate) return null

  const timestamp = new Date(matchDate).getTime()
  if (!Number.isFinite(timestamp)) return null

  return (Date.now() - timestamp) / 3_600_000
}

function getIssueReason(
  match: MatchRow,
  hoursSinceStart: number | null,
  staleLiveHours: number,
  pastNotFinishedHours: number
) {
  if (hoursSinceStart === null) return null
  if (hoursSinceStart < 0) return null
  if (isPostponedStatus(match.status)) return null

  if (isLiveStatus(match.status) && hoursSinceStart >= staleLiveHours) {
    return {
      reason: 'live_too_long',
      suggestedFix:
        match.home_score !== null && match.away_score !== null
          ? 'status=FT, final_elapsed=elapsed'
          : null,
    }
  }

  if (
    !isFinishedStatus(match.status) &&
    !isUpcomingStatus(match.status) &&
    hoursSinceStart >= pastNotFinishedHours &&
    match.home_score !== null &&
    match.away_score !== null
  ) {
    return {
      reason: 'past_scored_not_finished',
      suggestedFix: 'status=FT, final_elapsed=elapsed',
    }
  }

  if (isFinishedStatus(match.status) && match.elapsed !== null && match.final_elapsed === null) {
    return {
      reason: 'finished_missing_final_elapsed',
      suggestedFix: 'final_elapsed=elapsed',
    }
  }

  return null
}

async function fetchMatches(options: {
  leagueExternalId: string | null
  dateFrom: string
  dateTo: string
  limit: number
}) {
  const supabase = getSupabaseAdminClient()
  let leagueIds: Array<string | number> | null = null

  if (options.leagueExternalId) {
    const leaguesResponse = await supabase
      .from('leagues')
      .select('id')
      .eq('external_id', options.leagueExternalId)

    if (leaguesResponse.error) throw leaguesResponse.error
    leagueIds = (leaguesResponse.data ?? []).map((league) => league.id)
  }

  let query = supabase
    .from('matches')
    .select(
      'id, external_id, league_id, home_team_id, away_team_id, match_date, status, home_score, away_score, elapsed, final_elapsed'
    )
    .gte('match_date', options.dateFrom)
    .lte('match_date', options.dateTo)
    .order('match_date', { ascending: false })
    .limit(options.limit)

  if (leagueIds) query = query.in('league_id', leagueIds)

  const primary = await query

  if (!primary.error) {
    return {
      supabase,
      matches: (primary.data ?? []) as MatchRow[],
      finalElapsedSupported: true,
    }
  }

  const message = primary.error.message.toLowerCase()
  const missingOptionalColumns =
    primary.error.code === '42703' ||
    primary.error.code === 'PGRST204' ||
    message.includes('elapsed') ||
    message.includes('final_elapsed') ||
    message.includes('schema cache')

  if (!missingOptionalColumns) throw primary.error

  let elapsedOnlyQuery = supabase
    .from('matches')
    .select(
      'id, external_id, league_id, home_team_id, away_team_id, match_date, status, home_score, away_score, elapsed'
    )
    .gte('match_date', options.dateFrom)
    .lte('match_date', options.dateTo)
    .order('match_date', { ascending: false })
    .limit(options.limit)

  if (leagueIds) elapsedOnlyQuery = elapsedOnlyQuery.in('league_id', leagueIds)

  const elapsedOnly = await elapsedOnlyQuery

  if (!elapsedOnly.error) {
    return {
      supabase,
      matches: (elapsedOnly.data ?? []) as MatchRow[],
      finalElapsedSupported: false,
    }
  }

  let fallbackQuery = supabase
    .from('matches')
    .select(
      'id, external_id, league_id, home_team_id, away_team_id, match_date, status, home_score, away_score'
    )
    .gte('match_date', options.dateFrom)
    .lte('match_date', options.dateTo)
    .order('match_date', { ascending: false })
    .limit(options.limit)

  if (leagueIds) fallbackQuery = fallbackQuery.in('league_id', leagueIds)

  const fallback = await fallbackQuery
  if (fallback.error) throw fallback.error

  return {
    supabase,
    matches: (fallback.data ?? []) as MatchRow[],
    finalElapsedSupported: false,
  }
}

async function fetchLookupMaps(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matches: MatchRow[]
) {
  const leagueIds = [...new Set(matches.map((match) => match.league_id).filter(Boolean).map(String))]
  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter(Boolean)
        .map(String)
    ),
  ]
  const leagues = new Map<string, LeagueRow>()
  const teams = new Map<string, TeamRow>()

  if (leagueIds.length) {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, external_id, name')
      .in('id', leagueIds)

    if (error) throw error

    for (const league of (data ?? []) as LeagueRow[]) {
      leagues.set(String(league.id), league)
    }
  }

  if (teamIds.length) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds)

    if (error) throw error

    for (const team of (data ?? []) as TeamRow[]) {
      teams.set(String(team.id), team)
    }
  }

  return { leagues, teams }
}

function serializeIssue(
  match: MatchRow,
  issue: { reason: string; suggestedFix: string | null },
  lookups: Awaited<ReturnType<typeof fetchLookupMaps>>,
  hoursSinceStart: number | null
): StatusIssue {
  const league = match.league_id ? lookups.leagues.get(String(match.league_id)) : null
  const home = match.home_team_id ? lookups.teams.get(String(match.home_team_id)) : null
  const away = match.away_team_id ? lookups.teams.get(String(match.away_team_id)) : null

  return {
    id: String(match.id),
    external_id: match.external_id,
    league: league?.name ?? null,
    league_external_id: league?.external_id ?? null,
    local: home?.name ?? null,
    visitante: away?.name ?? null,
    match_date: match.match_date,
    status: match.status,
    home_score: match.home_score,
    away_score: match.away_score,
    elapsed: match.elapsed ?? null,
    final_elapsed: match.final_elapsed ?? null,
    hours_since_start:
      hoursSinceStart === null ? null : Math.round(hoursSinceStart * 10) / 10,
    reason: issue.reason,
    suggested_fix: issue.suggestedFix,
  }
}

async function applyFix(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  issue: StatusIssue,
  finalElapsedSupported: boolean
) {
  const finalElapsed = issue.final_elapsed ?? issue.elapsed ?? null
  const payload =
    issue.reason === 'finished_missing_final_elapsed'
      ? { final_elapsed: finalElapsed }
      : finalElapsedSupported
        ? { status: 'FT', final_elapsed: finalElapsed }
        : { status: 'FT' }

  const { error } = await supabase
    .from('matches')
    .update(payload)
    .eq('id', issue.id)

  if (error) throw error

  return {
    id: issue.id,
    external_id: issue.external_id,
    reason: issue.reason,
    applied: payload,
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'No autorizado' },
      { status: 401, headers: NO_STORE_HEADERS }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const fix = readBoolean(searchParams.get('fix'))
    const leagueExternalId = searchParams.get('leagueExternalId')
    const limit = readNumber(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT)
    const staleLiveHours = readNumber(
      searchParams.get('staleLiveHours'),
      DEFAULT_STALE_LIVE_HOURS
    )
    const pastNotFinishedHours = readNumber(
      searchParams.get('pastNotFinishedHours'),
      DEFAULT_PAST_NOT_FINISHED_HOURS
    )
    const dateFrom = searchParams.get('dateFrom') || toIsoDateOffset(-DEFAULT_LOOKBACK_DAYS)
    const dateTo = searchParams.get('dateTo') || toIsoDateOffset(1)
    const { supabase, matches, finalElapsedSupported } = await fetchMatches({
      leagueExternalId,
      dateFrom,
      dateTo,
      limit,
    })
    const lookups = await fetchLookupMaps(supabase, matches)
    const issues = matches
      .map((match) => {
        const hoursSinceStart = getHoursSinceStart(match.match_date)
        const issue = getIssueReason(match, hoursSinceStart, staleLiveHours, pastNotFinishedHours)

        return issue ? serializeIssue(match, issue, lookups, hoursSinceStart) : null
      })
      .filter((issue): issue is StatusIssue => Boolean(issue))

    const corrections = fix
      ? await Promise.all(
          issues
            .filter((issue) => issue.suggested_fix)
            .map((issue) => applyFix(supabase, issue, finalElapsedSupported))
        )
      : []

    return NextResponse.json(
      {
        ok: true,
        fix,
        filters: {
          leagueExternalId,
          dateFrom,
          dateTo,
          limit,
          staleLiveHours,
          pastNotFinishedHours,
        },
        totals: {
          checked: matches.length,
          issues: issues.length,
          live_too_long: issues.filter((issue) => issue.reason === 'live_too_long').length,
          past_scored_not_finished: issues.filter(
            (issue) => issue.reason === 'past_scored_not_finished'
          ).length,
          finished_missing_final_elapsed: issues.filter(
            (issue) => issue.reason === 'finished_missing_final_elapsed'
          ).length,
          corrections: corrections.length,
        },
        finalElapsedSupported,
        issues,
        corrections,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    console.error('[match-status-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar estados de partidos.',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
