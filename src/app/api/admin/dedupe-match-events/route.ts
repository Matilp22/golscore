import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { serializeError } from '@/server/match-detail-cache'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'
import {
  formatMatchEventSemanticKey,
  formatMatchEventStableKey,
  getMatchEventExternalIdPriority,
} from '@/shared/utils/football-events'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type DbId = string | number

type MatchRow = {
  id: DbId
  external_id: DbId | null
  league_id: DbId | null
  home_team_id: DbId | null
  away_team_id: DbId | null
  home_score: number | null
  away_score: number | null
  status: string | null
  match_date: string | null
}

type MatchEventRow = {
  id: DbId
  external_event_id: string | null
  match_id: DbId
  team_id: DbId | null
  player_name: string | null
  assist_name: string | null
  minute: number | null
  extra_minute: number | null
  type: string | null
  detail: string | null
  comments: string | null
  created_at?: string | null
}

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

function readBoolean(value: string | null, fallback: boolean) {
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getEventDedupeKey(event: MatchEventRow) {
  return formatMatchEventStableKey(
    {
      id: event.id,
      external_event_id: event.external_event_id,
      match_id: event.match_id,
      team_id: event.team_id,
      player_name: event.player_name,
      assist_name: event.assist_name,
      time: {
        elapsed: event.minute,
        extra: event.extra_minute,
      },
      team: event.team_id !== null && event.team_id !== undefined
        ? { id: event.team_id }
        : null,
      player: event.player_name ? { name: event.player_name } : null,
      assist: event.assist_name ? { name: event.assist_name } : null,
      type: event.type,
      detail: event.detail,
      comments: event.comments,
    },
    event.match_id
  )
}

function getEventSemanticDedupeKey(event: MatchEventRow) {
  return formatMatchEventSemanticKey(
    {
      id: event.id,
      external_event_id: event.external_event_id,
      match_id: event.match_id,
      team_id: event.team_id,
      player_name: event.player_name,
      assist_name: event.assist_name,
      time: {
        elapsed: event.minute,
        extra: event.extra_minute,
      },
      team: event.team_id !== null && event.team_id !== undefined
        ? { id: event.team_id }
        : null,
      player: event.player_name ? { name: event.player_name } : null,
      assist: event.assist_name ? { name: event.assist_name } : null,
      type: event.type,
      detail: event.detail,
      comments: event.comments,
    },
    event.match_id
  )
}

function completenessScore(event: MatchEventRow) {
  return [
    event.external_event_id,
    event.team_id,
    event.player_name,
    event.assist_name,
    event.minute,
    event.extra_minute,
    event.type,
    event.detail,
    event.comments,
  ].reduce<number>((score, value) => {
    if (value === null || value === undefined) return score
    const text = String(value).trim()
    if (!text) return score

    return score + 1 + Math.min(text.length, 40) / 40
  }, getMatchEventExternalIdPriority(event.external_event_id) * 100)
}

function chooseKeeper(events: MatchEventRow[]) {
  return [...events].sort((a, b) => {
    const scoreDiff = completenessScore(b) - completenessScore(a)
    if (scoreDiff !== 0) return scoreDiff

    const aCreated = a.created_at ? Date.parse(a.created_at) : Number.POSITIVE_INFINITY
    const bCreated = b.created_at ? Date.parse(b.created_at) : Number.POSITIVE_INFINITY
    if (aCreated !== bCreated) return aCreated - bCreated

    return String(a.id).localeCompare(String(b.id))
  })[0]
}

async function resolveLeagueIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  leagueExternalId: number | null
) {
  if (!leagueExternalId) return null

  const response = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', leagueExternalId)

  if (response.error) throw response.error

  return (response.data ?? []).map((league) => String(league.id))
}

async function fetchMatches(request: Request) {
  const { searchParams } = new URL(request.url)
  const supabase = getSupabaseAdminClient()
  const fixture = readNumber(searchParams.get('fixture'))
  const matchId = searchParams.get('matchId') ?? searchParams.get('match_id')
  const leagueExternalId = readNumber(searchParams.get('leagueExternalId'))
  const limit = Math.min(Math.max(readNumber(searchParams.get('limit')) ?? 100, 1), 500)
  const range = readDateRange(searchParams)
  const leagueIds = await resolveLeagueIds(supabase, leagueExternalId)

  let query = supabase
    .from('matches')
    .select('id, external_id, league_id, home_team_id, away_team_id, home_score, away_score, status, match_date')
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (matchId) query = query.eq('id', matchId)
  if (fixture) query = query.eq('external_id', fixture)
  if (!matchId && !fixture) {
    if (range.dateFrom) query = query.gte('match_date', range.dateFrom)
    if (range.dateTo) query = query.lte('match_date', range.dateTo)
    if (leagueIds) {
      if (!leagueIds.length) return { supabase, matches: [] as MatchRow[], filters: { leagueExternalId, ...range } }
      query = query.in('league_id', leagueIds)
    }
  }

  const response = await query

  if (response.error) throw response.error

  return {
    supabase,
    matches: (response.data ?? []) as MatchRow[],
    filters: {
      matchId: matchId ?? null,
      fixture,
      leagueExternalId,
      ...range,
      limit,
    },
  }
}

async function fetchEvents(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  matchIds: string[]
) {
  const events: MatchEventRow[] = []

  for (const chunk of chunkArray(matchIds, 100)) {
    const response = await supabase
      .from('match_events')
      .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments, created_at')
      .in('match_id', chunk)

    if (response.error) {
      const fallback = await supabase
        .from('match_events')
        .select('id, external_event_id, match_id, team_id, player_name, assist_name, minute, extra_minute, type, detail, comments')
        .in('match_id', chunk)

      if (fallback.error) throw fallback.error
      events.push(...((fallback.data ?? []) as MatchEventRow[]))
      continue
    }

    events.push(...((response.data ?? []) as MatchEventRow[]))
  }

  return events
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const dryRun = readBoolean(searchParams.get('dryRun'), true)
    const { supabase, matches, filters } = await fetchMatches(request)
    const matchIds = matches.map((match) => String(match.id))
    const events = await fetchEvents(supabase, matchIds)
    const eventsByMatch = events.reduce<Map<string, MatchEventRow[]>>((accumulator, event) => {
      const key = String(event.match_id)
      const current = accumulator.get(key) ?? []
      current.push(event)
      accumulator.set(key, current)

      return accumulator
    }, new Map())
    const duplicateGroups = []
    const idsToDelete: string[] = []

    for (const match of matches) {
      const grouped = new Map<string, { stableKeys: Set<string>; events: MatchEventRow[] }>()

      for (const event of eventsByMatch.get(String(match.id)) ?? []) {
        const key = getEventSemanticDedupeKey(event)
        const group = grouped.get(key) ?? { stableKeys: new Set<string>(), events: [] }
        group.stableKeys.add(getEventDedupeKey(event))
        group.events.push(event)
        grouped.set(key, group)
      }

      for (const [key, groupInfo] of grouped.entries()) {
        const group = groupInfo.events
        if (group.length <= 1) continue

        const keeper = chooseKeeper(group)
        const toDelete = group.filter((event) => String(event.id) !== String(keeper.id))
        idsToDelete.push(...toDelete.map((event) => String(event.id)))
        duplicateGroups.push({
          matchId: match.id,
          fixtureExternalId: match.external_id,
          key,
          keyType: groupInfo.stableKeys.size === 1 ? 'stable' : 'semantic',
          keepId: keeper.id,
          deleteIds: toDelete.map((event) => event.id),
          events: group.map((event) => ({
            id: event.id,
            external_event_id: event.external_event_id,
            minute: event.minute,
            extra_minute: event.extra_minute,
            team_id: event.team_id,
            player_name: event.player_name,
            assist_name: event.assist_name,
            type: event.type,
            detail: event.detail,
          })),
        })
      }
    }

    if (!dryRun && idsToDelete.length) {
      for (const chunk of chunkArray(idsToDelete, 100)) {
        const response = await supabase
          .from('match_events')
          .delete()
          .in('id', chunk)

        if (response.error) throw response.error
      }
    }

    return jsonNoStore({
      ok: true,
      dryRun,
      filters,
      matchesChecked: matches.length,
      duplicateGroups: duplicateGroups.length,
      eventsToDelete: idsToDelete.length,
      deleted: dryRun ? 0 : idsToDelete.length,
      sample: duplicateGroups.slice(0, 20),
    })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[dedupe-match-events] Error completo', serialized)

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
