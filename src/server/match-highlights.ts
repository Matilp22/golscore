import type { SupabaseClient } from '@supabase/supabase-js'

import { isFinishedStatus } from '@/shared/utils/match-status'
import { getYouTubeVideoId, getYouTubeWatchUrl } from '@/shared/utils/youtube'

type DbClient = SupabaseClient

type MatchRow = {
  id: string
  external_id: string | number | null
  league_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  match_date: string | null
  status: string | null
  highlights_url: string | null
  highlights_title: string | null
}

type TeamRow = {
  id: string
  name: string | null
}

type LeagueRow = {
  id: string
  external_id: string | number | null
  name: string | null
}

export type HighlightMatch = MatchRow & {
  homeName: string | null
  awayName: string | null
  leagueName: string | null
  leagueExternalId: string | null
}

type YouTubeSearchItem = {
  id?: {
    videoId?: string
  }
  snippet?: {
    title?: string
    description?: string
    channelTitle?: string
    publishedAt?: string
  }
}

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[]
  error?: {
    code?: number
    message?: string
    errors?: Array<{
      message?: string
      reason?: string
      domain?: string
    }>
  }
}

export type HighlightSyncOptions = {
  matchId?: string | null
  leagueExternalId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  limit?: number | null
  force?: boolean
}

export type HighlightAuditOptions = {
  leagueExternalId?: string | null
  limit?: number | null
}

type HighlightResult = {
  matchId: string
  externalId: string | number | null
  home: string | null
  away: string | null
  league: string | null
  matchDate: string | null
  query?: string
  status: 'updated' | 'skipped' | 'error'
  reason?: string
  selected?: {
    title: string
    url: string
    channelTitle: string | null
    publishedAt: string | null
    score: number
  }
  candidates?: Array<{
    title: string
    channelTitle: string | null
    publishedAt: string | null
    score: number
    reasons: string[]
  }>
  error?: ErrorPayload
}

type ErrorPayload = {
  message: string
  code: string
  detail: string | null
  source: 'youtube' | 'supabase' | 'config' | 'unknown'
}

class SerializableError extends Error {
  code: string
  detail: string | null
  source: ErrorPayload['source']

  constructor(
    message: string,
    code: string,
    detail: string | null,
    source: ErrorPayload['source']
  ) {
    super(message)
    this.name = 'SerializableError'
    this.code = code
    this.detail = detail
    this.source = source
  }
}

const DEFAULT_SYNC_LIMIT = 1
const MAX_SYNC_LIMIT = 10
const DEFAULT_AUDIT_LIMIT = 30
const MAX_AUDIT_LIMIT = 100
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_FETCH_TIMEOUT_MS = 8000

const SUMMARY_KEYWORDS = ['resumen', 'highlights', 'goles', 'goals', 'full highlights']
const NEGATIVE_PATTERNS = [
  'prediccion',
  'pronostico',
  'previa',
  'simulacion',
  'efootball',
  'pes',
  'live stream',
  'radio',
  'reaccion',
  'watchalong',
  'watch along',
  'resumen falso',
]
const KNOWN_CHANNELS = [
  'liga profesional',
  'afa',
  'conmebol',
  'espn',
  'tyc sports',
  'dsports',
  'tnt sports',
  'fox sports',
  'fifa',
  'uefa',
]
const STOPWORDS = new Set([
  'club',
  'atletico',
  'atlético',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'fc',
  'ca',
  'cd',
  'cf',
  'sc',
])

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function clampLimit(value: number | null | undefined, defaultValue: number, maxValue: number) {
  if (!value || !Number.isFinite(value)) return defaultValue

  return Math.max(1, Math.min(maxValue, Math.floor(value)))
}

function isSupabaseErrorLike(error: unknown) {
  if (typeof error !== 'object' || error === null) return false

  const record = error as Record<string, unknown>
  const code = typeof record.code === 'string' ? record.code : ''

  return (
    code.startsWith('PGRST') ||
    /^[0-9A-Z]{5}$/.test(code) ||
    typeof record.details === 'string' ||
    typeof record.hint === 'string'
  )
}

export function serializeHighlightError(
  error: unknown,
  fallbackSource: ErrorPayload['source'] = 'unknown'
): ErrorPayload {
  if (error instanceof SerializableError) {
    return {
      message: error.message,
      code: error.code,
      detail: error.detail,
      source: error.source,
    }
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const message =
      typeof record.message === 'string' && record.message.trim()
        ? record.message
        : 'Error desconocido'
    const code =
      typeof record.code === 'string' && record.code.trim()
        ? record.code
        : fallbackSource === 'supabase'
          ? 'SUPABASE_ERROR'
          : 'UNKNOWN_ERROR'
    const detail =
      typeof record.details === 'string'
        ? record.details
        : typeof record.detail === 'string'
          ? record.detail
          : typeof record.hint === 'string'
            ? record.hint
            : null

    return {
      message,
      code,
      detail,
      source: fallbackSource,
    }
  }

  return {
    message: error instanceof Error ? error.message : String(error || 'Error desconocido'),
    code: 'UNKNOWN_ERROR',
    detail: null,
    source: fallbackSource,
  }
}

function normalizeDateBoundary(value: string | null | undefined, endOfDay = false) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
  }

  return trimmed
}

function getSignificantTokens(value: string | null | undefined) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function getTeamTitleScore(title: string, teamName: string | null) {
  const normalizedTeam = normalizeText(teamName)
  const normalizedTitle = normalizeText(title)
  if (!normalizedTeam || !normalizedTitle) return 0
  if (normalizedTitle.includes(normalizedTeam)) return 3

  const tokens = getSignificantTokens(teamName)
  if (!tokens.length) return 0

  const matchedTokens = tokens.filter((token) => normalizedTitle.includes(token))
  if (!matchedTokens.length) return 0
  if (tokens.length === 1) return 2
  if (matchedTokens.length >= Math.min(2, tokens.length)) return 2

  return 1
}

function containsAny(normalizedTextValue: string, tokens: string[]) {
  return tokens.some((token) => normalizedTextValue.includes(token))
}

function isFifaGameText(normalizedTextValue: string) {
  return /\bfifa\s?\d{2}\b/.test(normalizedTextValue) || normalizedTextValue.includes('fifa gameplay')
}

function isPublishedBeforeMatch(matchDate: string | null, publishedAt: string | null) {
  if (!matchDate || !publishedAt) return false

  const matchTimestamp = new Date(matchDate).getTime()
  const publishedTimestamp = new Date(publishedAt).getTime()
  if (!Number.isFinite(matchTimestamp) || !Number.isFinite(publishedTimestamp)) return false

  return publishedTimestamp < matchTimestamp - 60 * 60 * 1000
}

function getPublishedDistanceDays(matchDate: string | null, publishedAt: string | null) {
  if (!matchDate || !publishedAt) return null

  const matchTimestamp = new Date(matchDate).getTime()
  const publishedTimestamp = new Date(publishedAt).getTime()
  if (!Number.isFinite(matchTimestamp) || !Number.isFinite(publishedTimestamp)) return null

  return Math.abs(publishedTimestamp - matchTimestamp) / (24 * 60 * 60 * 1000)
}

export function buildYouTubeHighlightQuery(match: HighlightMatch) {
  const year = match.match_date ? new Date(match.match_date).getFullYear() : null
  return compactSpaces(
    [
      match.homeName,
      match.awayName,
      'resumen goles highlights',
      year && Number.isFinite(year) ? String(year) : null,
      match.leagueName,
    ]
      .filter(Boolean)
      .join(' ')
  )
}

export function scoreYouTubeHighlightResult(match: HighlightMatch, result: YouTubeSearchItem) {
  const title = result.snippet?.title ?? ''
  const description = result.snippet?.description ?? ''
  const channelTitle = result.snippet?.channelTitle ?? ''
  const publishedAt = result.snippet?.publishedAt ?? null
  const text = normalizeText(`${title} ${description}`)
  const normalizedTitle = normalizeText(title)
  const normalizedChannel = normalizeText(channelTitle)
  const reasons: string[] = []
  let score = 0

  const homeScore = getTeamTitleScore(title, match.homeName)
  const awayScore = getTeamTitleScore(title, match.awayName)
  if (homeScore >= 2) {
    score += 4
    reasons.push('home-team')
  } else if (homeScore > 0) {
    score += 1
  }
  if (awayScore >= 2) {
    score += 4
    reasons.push('away-team')
  } else if (awayScore > 0) {
    score += 1
  }
  if (homeScore >= 2 && awayScore >= 2) {
    score += 3
    reasons.push('both-teams')
  }

  if (normalizedTitle.includes('resumen')) {
    score += 4
    reasons.push('resumen')
  }
  if (normalizedTitle.includes('highlights')) {
    score += 3
    reasons.push('highlights')
  }
  if (normalizedTitle.includes('goles') || normalizedTitle.includes('goals')) {
    score += 2
    reasons.push('goles')
  }

  const normalizedLeague = normalizeText(match.leagueName)
  if (normalizedLeague && text.includes(normalizedLeague)) {
    score += 2
    reasons.push('league')
  }

  if (KNOWN_CHANNELS.some((channel) => normalizedChannel.includes(channel))) {
    score += 3
    reasons.push('known-channel')
  }

  const distanceDays = getPublishedDistanceDays(match.match_date, publishedAt)
  if (distanceDays !== null) {
    if (isPublishedBeforeMatch(match.match_date, publishedAt)) {
      score -= 8
      reasons.push('published-before-match')
    } else if (distanceDays <= 3) {
      score += 3
      reasons.push('published-close')
    } else if (distanceDays <= 14) {
      score += 1
      reasons.push('published-near')
    }
  }

  if (containsAny(text, NEGATIVE_PATTERNS) || isFifaGameText(text)) {
    score -= 8
    reasons.push('negative-keyword')
  }
  if ((text.includes('en vivo') || text.includes('live')) && !containsAny(text, SUMMARY_KEYWORDS)) {
    score -= 5
    reasons.push('live-not-summary')
  }

  const hasSummaryIntent = containsAny(normalizedTitle, SUMMARY_KEYWORDS)
  const hasBothTeams = homeScore >= 2 && awayScore >= 2

  return {
    score,
    reasons,
    accepted: score >= 10 && hasBothTeams && hasSummaryIntent,
  }
}

async function fetchRowsById<T extends { id: string }>(
  supabase: DbClient,
  table: string,
  ids: string[],
  columns: string
) {
  const map = new Map<string, T>()
  if (!ids.length) return map

  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in('id', [...new Set(ids)])

  if (error) throw error

  for (const row of (data ?? []) as unknown as T[]) {
    map.set(String(row.id), row)
  }

  return map
}

async function getLeagueIdByExternalId(supabase: DbClient, leagueExternalId?: string | null) {
  if (!leagueExternalId) return null

  const { data, error } = await supabase
    .from('leagues')
    .select('id')
    .eq('external_id', leagueExternalId)
    .maybeSingle()

  if (error) throw error

  return data?.id ? String(data.id) : null
}

async function fetchMatches(supabase: DbClient, options: HighlightSyncOptions) {
  const limit = clampLimit(options.limit, DEFAULT_SYNC_LIMIT, MAX_SYNC_LIMIT)
  const rowsLimit = options.matchId ? 1 : limit * 5
  let query = supabase
    .from('matches')
    .select(
      'id, external_id, league_id, home_team_id, away_team_id, match_date, status, highlights_url, highlights_title'
    )
    .order('match_date', { ascending: false, nullsFirst: false })
    .limit(rowsLimit)

  if (options.matchId) {
    const matchId = options.matchId.trim()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
      query = query.eq('id', matchId)
    } else {
      query = query.eq('external_id', matchId)
    }
  }

  const leagueId = await getLeagueIdByExternalId(supabase, options.leagueExternalId)
  if (options.leagueExternalId && !leagueId) return []
  if (leagueId) query = query.eq('league_id', leagueId)

  const dateFrom = normalizeDateBoundary(options.dateFrom)
  const dateTo = normalizeDateBoundary(options.dateTo, true)
  if (dateFrom) query = query.gte('match_date', dateFrom)
  if (dateTo) query = query.lte('match_date', dateTo)
  if (!options.force) query = query.is('highlights_url', null)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []) as MatchRow[]
}

async function enrichMatches(supabase: DbClient, rows: MatchRow[]) {
  const teamIds = rows
    .flatMap((row) => [row.home_team_id, row.away_team_id])
    .filter((id): id is string => Boolean(id))
  const leagueIds = rows
    .map((row) => row.league_id)
    .filter((id): id is string => Boolean(id))
  const [teamsById, leaguesById] = await Promise.all([
    fetchRowsById<TeamRow>(supabase, 'teams', teamIds, 'id, name'),
    fetchRowsById<LeagueRow>(supabase, 'leagues', leagueIds, 'id, external_id, name'),
  ])

  return rows.map((row): HighlightMatch => {
    const league = row.league_id ? leaguesById.get(String(row.league_id)) : null
    const home = row.home_team_id ? teamsById.get(String(row.home_team_id)) : null
    const away = row.away_team_id ? teamsById.get(String(row.away_team_id)) : null

    return {
      ...row,
      homeName: home?.name ?? null,
      awayName: away?.name ?? null,
      leagueName: league?.name ?? null,
      leagueExternalId: league?.external_id ? String(league.external_id) : null,
    }
  })
}

function getPreSearchSkipReason(match: HighlightMatch, force: boolean | undefined) {
  if (!isFinishedStatus(match.status)) return 'not_finished'
  if (!match.match_date) return 'missing_match_date'
  if (new Date(match.match_date).getTime() > Date.now()) return 'future_match'
  if (!force && match.highlights_url) return 'already_has_highlights'
  if (!match.homeName || !match.awayName) return 'missing_teams'

  return null
}

async function searchYouTubeHighlights(query: string, apiKey: string) {
  const url = new URL(YOUTUBE_SEARCH_URL)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '5')
  url.searchParams.set('q', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('order', 'relevance')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('safeSearch', 'moderate')
  url.searchParams.set(
    'fields',
    'items(id/videoId,snippet/title,snippet/description,snippet/channelTitle,snippet/publishedAt),error(code,message,errors(message,reason,domain))'
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    throw new SerializableError(
      aborted
        ? `YouTube no respondio en ${YOUTUBE_FETCH_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : 'Fallo el fetch a YouTube',
      aborted ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_FETCH_FAILED',
      aborted ? `Timeout ${YOUTUBE_FETCH_TIMEOUT_MS}ms` : null,
      'youtube'
    )
  } finally {
    clearTimeout(timeout)
  }

  const payload = (await response.json().catch(() => ({}))) as YouTubeSearchResponse

  console.info('[sync-match-highlights] youtube-response', {
    query,
    status: response.status,
    ok: response.ok,
    results: payload.items?.length ?? 0,
  })

  if (!response.ok) {
    const firstError = payload.error?.errors?.[0]
    throw new SerializableError(
      payload.error?.message || `YouTube devolvio ${response.status}`,
      firstError?.reason || `YOUTUBE_${response.status}`,
      firstError?.message || payload.error?.message || null,
      'youtube'
    )
  }

  return payload.items ?? []
}

function toResultBase(match: HighlightMatch) {
  return {
    matchId: match.id,
    externalId: match.external_id,
    home: match.homeName,
    away: match.awayName,
    league: match.leagueName,
    matchDate: match.match_date,
  }
}

export async function syncMatchHighlights(supabase: DbClient, options: HighlightSyncOptions) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    throw new SerializableError(
      'Falta YOUTUBE_API_KEY',
      'MISSING_YOUTUBE_API_KEY',
      'Configura YOUTUBE_API_KEY en variables de entorno server-side.',
      'config'
    )
  }

  const limit = clampLimit(options.limit, DEFAULT_SYNC_LIMIT, MAX_SYNC_LIMIT)
  const rows = await fetchMatches(supabase, { ...options, limit })
  const matches = await enrichMatches(supabase, rows)
  const results: HighlightResult[] = []
  let searched = 0
  let updated = 0

  console.info('[sync-match-highlights] start', {
    matchesChecked: matches.length,
    limit,
    force: Boolean(options.force),
    matchId: options.matchId ?? null,
    leagueExternalId: options.leagueExternalId ?? null,
  })

  for (const match of matches) {
    const skipReason = getPreSearchSkipReason(match, options.force)
    if (skipReason) {
      console.info('[sync-match-highlights] skipped', {
        matchId: match.id,
        externalId: match.external_id,
        reason: skipReason,
      })

      results.push({
        ...toResultBase(match),
        status: 'skipped',
        reason: skipReason,
      })
      continue
    }

    if (searched >= limit) break

    const query = buildYouTubeHighlightQuery(match)
    searched += 1

    console.info('[sync-match-highlights] search', {
      matchId: match.id,
      externalId: match.external_id,
      query,
    })

    try {
      const items = await searchYouTubeHighlights(query, apiKey)
      const scored = items
        .map((item) => ({
          item,
          videoId: item.id?.videoId ? getYouTubeVideoId(getYouTubeWatchUrl(item.id.videoId)) : null,
          title: item.snippet?.title ?? '',
          channelTitle: item.snippet?.channelTitle ?? null,
          publishedAt: item.snippet?.publishedAt ?? null,
          ...scoreYouTubeHighlightResult(match, item),
        }))
        .filter((item) => item.videoId)
        .sort((a, b) => b.score - a.score)

      const selected = scored.find((item) => item.accepted)
      if (!selected?.videoId) {
        console.info('[sync-match-highlights] skipped', {
          matchId: match.id,
          externalId: match.external_id,
          reason: 'no_reliable_video',
          query,
          topScore: scored[0]?.score ?? null,
        })

        results.push({
          ...toResultBase(match),
          query,
          status: 'skipped',
          reason: 'no_reliable_video',
          candidates: scored.map((item) => ({
            title: item.title,
            channelTitle: item.channelTitle,
            publishedAt: item.publishedAt,
            score: item.score,
            reasons: item.reasons,
          })),
        })
        continue
      }

      const highlightsUrl = getYouTubeWatchUrl(selected.videoId)
      const { error } = await supabase
        .from('matches')
        .update({
          highlights_url: highlightsUrl,
          highlights_title: selected.title,
        })
        .eq('id', match.id)

      if (error) throw error

      updated += 1
      console.info('[sync-match-highlights] updated', {
        matchId: match.id,
        externalId: match.external_id,
        query,
        video: highlightsUrl,
        title: selected.title,
        score: selected.score,
      })

      results.push({
        ...toResultBase(match),
        query,
        status: 'updated',
        selected: {
          title: selected.title,
          url: highlightsUrl,
          channelTitle: selected.channelTitle,
          publishedAt: selected.publishedAt,
          score: selected.score,
        },
      })
    } catch (error) {
      const serialized = serializeHighlightError(
        error,
        isSupabaseErrorLike(error) ? 'supabase' : 'youtube'
      )
      console.warn('[sync-match-highlights] error', {
        matchId: match.id,
        externalId: match.external_id,
        query,
        ...serialized,
      })

      results.push({
        ...toResultBase(match),
        query,
        status: 'error',
        reason: serialized.message,
        error: serialized,
      })
    }
  }

  const skipped = results.filter((result) => result.status === 'skipped').length
  const errors = results.filter((result) => result.status === 'error').length

  console.info('[sync-match-highlights] done', {
    matchesChecked: matches.length,
    searched,
    updated,
    skipped,
    errors,
  })

  return {
    ok: true,
    checked: matches.length,
    matchesChecked: matches.length,
    searched,
    updated,
    skipped,
    errors,
    results,
  }
}

export async function getHighlightsAudit(supabase: DbClient, options: HighlightAuditOptions) {
  const limit = clampLimit(options.limit, DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT)
  const rows = await fetchMatches(supabase, {
    leagueExternalId: options.leagueExternalId,
    limit,
    force: true,
  })
  const matches = await enrichMatches(supabase, rows)
  const finished = matches.filter((match) => isFinishedStatus(match.status))
  const withHighlights = finished.filter((match) => Boolean(match.highlights_url))
  const withoutHighlights = finished.filter((match) => !match.highlights_url)
  const byLeague = finished.reduce<Map<string, { league: string; withHighlights: number; withoutHighlights: number }>>(
    (map, match) => {
      const key = match.leagueExternalId ?? match.leagueName ?? 'unknown'
      const current = map.get(key) ?? {
        league: match.leagueName ?? 'Sin liga',
        withHighlights: 0,
        withoutHighlights: 0,
      }

      if (match.highlights_url) current.withHighlights += 1
      else current.withoutHighlights += 1
      map.set(key, current)

      return map
    },
    new Map()
  )

  return {
    ok: true,
    checked: matches.length,
    finishedMatches: finished.length,
    withHighlights: withHighlights.length,
    withoutHighlights: withoutHighlights.length,
    byLeague: [...byLeague.values()],
    finishedWithoutHighlights: withoutHighlights.slice(0, limit).map((match) => ({
      id: match.id,
      externalId: match.external_id,
      league: match.leagueName,
      home: match.homeName,
      away: match.awayName,
      matchDate: match.match_date,
      status: match.status,
    })),
    latestHighlights: withHighlights.slice(0, limit).map((match) => ({
      id: match.id,
      externalId: match.external_id,
      league: match.leagueName,
      home: match.homeName,
      away: match.awayName,
      matchDate: match.match_date,
      title: match.highlights_title,
      url: match.highlights_url,
    })),
    recentErrors: [],
  }
}
