import type { SupabaseClient } from '@supabase/supabase-js'

import {
  ALLOWED_REMOTE_ASSET_HOSTS,
  YOUTUBE_IMAGE_ALT_HOST,
  YOUTUBE_IMAGE_HOST,
} from '@/shared/utils/asset-urls'
import { getArgentinaDayUtcRange } from '@/shared/utils/argentina-time'
import { translateCountryNameToSpanish } from '@/shared/utils/country-names'
import { isFinishedStatus } from '@/shared/utils/match-status'
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
  getYouTubeWatchUrl,
  isValidYouTubeUrl,
} from '@/shared/utils/youtube'

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

type YouTubeVideoDetailsItem = {
  id?: string
  snippet?: {
    title?: string
    description?: string
    channelTitle?: string
    publishedAt?: string
  }
  status?: {
    uploadStatus?: string
    privacyStatus?: string
    embeddable?: boolean
  }
  contentDetails?: {
    regionRestriction?: {
      allowed?: string[]
      blocked?: string[]
    }
  }
}

type YouTubeVideoDetailsResponse = {
  items?: YouTubeVideoDetailsItem[]
  error?: YouTubeSearchResponse['error']
}

export type HighlightSyncOptions = {
  matchId?: string | null
  fixture?: string | null
  leagueExternalId?: string | null
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  recentFinishedOnly?: boolean
  limit?: number | null
  force?: boolean
}

export type HighlightAuditOptions = {
  matchId?: string | null
  fixture?: string | null
  leagueExternalId?: string | null
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  limit?: number | null
  onlyProblems?: boolean
}

type HighlightResult = {
  matchId: string
  fixtureExternalId: string | number | null
  externalId: string | number | null
  home: string | null
  away: string | null
  league: string | null
  matchDate: string | null
  query?: string
  queries?: string[]
  status: 'updated' | 'already_exists' | 'no_reliable_video' | 'skipped_not_finished' | 'failed'
  skipReason?: string
  reason?: string
  selectedVideo?: {
    title: string
    url: string
    channelTitle: string | null
    publishedAt: string | null
    score: number
  }
  selectedScore?: number
  selected?: {
    title: string
    url: string
    channelTitle: string | null
    publishedAt: string | null
    score: number
  }
  highlightsUrl?: string
  highlightsTitle?: string
  candidatesFound?: number
  clearedExisting?: boolean
  clearedExistingReason?: string | null
  candidates?: Array<{
    title: string
    channelTitle: string | null
    publishedAt: string | null
    score: number
    reasons: string[]
    query?: string
  }>
  errors?: ErrorPayload[]
  error?: ErrorPayload
}

type ErrorPayload = {
  message: string
  code: string
  detail: string | null
  source: 'youtube' | 'supabase' | 'config' | 'unknown'
  status?: number | null
  missingColumns?: string[]
}

class SerializableError extends Error {
  code: string
  detail: string | null
  source: ErrorPayload['source']
  status: number | null
  missingColumns?: string[]

  constructor(
    message: string,
    code: string,
    detail: string | null,
    source: ErrorPayload['source'],
    options: { status?: number | null; missingColumns?: string[] } = {}
  ) {
    super(message)
    this.name = 'SerializableError'
    this.code = code
    this.detail = detail
    this.source = source
    this.status = options.status ?? null
    this.missingColumns = options.missingColumns
  }
}

const DEFAULT_SYNC_LIMIT = 8
const MAX_SYNC_LIMIT = 30
const DEFAULT_AUDIT_LIMIT = 50
const MAX_AUDIT_LIMIT = 100
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'
const YOUTUBE_FETCH_TIMEOUT_MS = 8000
const YOUTUBE_RESULTS_PER_QUERY = 8
const YOUTUBE_VIDEO_DETAILS_BATCH_SIZE = 50
const MAX_PRIMARY_HIGHLIGHT_QUERIES = 3
const MAX_TRUSTED_SOURCE_FALLBACK_QUERIES = 5
const MAX_TEAM_SEARCH_NAMES = 4
const FINISHED_QUERY_STATUSES = ['FT', 'AET', 'PEN', 'Final', 'Finalizado', 'Finished', 'Match Finished']
const PRIORITY_HIGHLIGHT_LEAGUES = [
  {
    externalId: '1',
    name: 'Copa del Mundo 2026',
    aliases: ['world cup', 'copa del mundo'],
  },
  {
    externalId: '10',
    name: 'Amistosos internacionales',
    aliases: ['friendlies', 'amistosos'],
  },
] as const

const SUMMARY_KEYWORDS = ['resumen', 'highlights', 'goles', 'goals', 'full highlights']
const NEGATIVE_PATTERNS = [
  'prediccion',
  'pronostico',
  'previa',
  'simulacion',
  'simulation',
  'simulator',
  'efootball',
  'pes',
  'gameplay',
  'gameplays',
  'virtual football',
  'ea sports fc',
  'ea fc',
  'fifa mobile',
  'fc mobile',
  'dream league soccer',
  'pro evolution soccer',
  'cpu vs cpu',
  'ai vs ai',
  'ps5',
  'xbox',
  'nintendo',
  'predict',
  'prediction',
  'betting',
  'odds',
  'live stream',
  'streaming',
  'en directo',
  'radio',
  'reaccion',
  'reaction',
  'shorts',
  '#shorts',
  'watchalong',
  'watch along',
  'resumen falso',
  'nursery rhymes',
  'cocomelon',
  'cocolemon',
  'premier ligue tv',
  'alaa elsafy',
  'mahmoud shaker',
]
const KNOWN_CHANNELS = [
  'liga profesional',
  'afa',
  'afa play',
  'afa estudio',
  'conmebol',
  'espn',
  'espn fc',
  'espn fans',
  'espn premium',
  'espn deportes',
  'tyc sports',
  'tyc sports play',
  'tyc sports argentina',
  'telefe',
  'telefe deportes',
  'telefe noticias',
  'afaplay',
  'dsports',
  'd sports',
  'directv',
  'directv sports',
  'tnt sports',
  'tnt premium',
  'tnt sports premium',
  'fox sports',
  'fox soccer',
  'fox deportes',
  'dazn',
  'dazn tv',
  'fifa',
  'fifa play',
  'fifa plus',
  'fifa+',
  'uefa',
  'copa argentina',
  'win sports',
]
const OFFICIAL_CHANNEL_HINTS = [
  'football association',
  'football federation',
  'soccer association',
  'soccer federation',
  'federacion',
  'federacao',
  'federation',
  'asociacion de futbol',
  'national team',
  'seleccion nacional',
  'seleccion',
  'official',
  'oficial',
  'tv oficial',
  'canal oficial',
  'play oficial',
  'new zealand football',
  'us soccer',
  'ussoccer',
  'figc',
  'vivo azzurro',
]
const TRUSTED_SOURCE_SEARCH_TERMS = [
  'TyC Sports',
  'TyC Sports Play',
  'Telefe',
  'Telefe Deportes',
  'ESPN Fans',
  'ESPN FC',
  'ESPN',
  'TNT Sports',
  'DSports',
  'DirecTV Sports',
  'DAZN',
  'DAZN TV',
  'AFA Play',
  'AFA Estudio',
  'FIFA Play',
  'FIFA+',
  'FIFA',
  'CONMEBOL',
  'Liga Profesional',
  'canal oficial',
  'canal oficial resumen',
  'official highlights',
  'Fox Sports',
  'FOX Soccer',
]
const COUNTRY_TEAM_SEARCH_ALIASES: Record<string, string[]> = {
  algeria: ['Argelia'],
  argentina: ['Argentina', 'Seleccion Argentina', 'Selección Argentina'],
  austria: ['Austria'],
  belgium: ['Belgica'],
  brazil: ['Brasil'],
  cameroon: ['Camerun'],
  canada: ['Canada'],
  china: ['China'],
  colombia: ['Colombia'],
  croatia: ['Croacia'],
  'czech republic': ['Republica Checa'],
  czechia: ['Chequia'],
  denmark: ['Dinamarca'],
  'dominican republic': ['Republica Dominicana'],
  ecuador: ['Ecuador'],
  egypt: ['Egipto'],
  england: ['Inglaterra'],
  france: ['Francia'],
  germany: ['Alemania'],
  ghana: ['Ghana'],
  greece: ['Grecia'],
  honduras: ['Honduras'],
  iran: ['Iran'],
  ireland: ['Irlanda'],
  italy: ['Italia'],
  'ivory coast': ['Costa de Marfil'],
  japan: ['Japon'],
  luxembourg: ['Luxemburgo'],
  mexico: ['Mexico'],
  morocco: ['Marruecos'],
  netherlands: ['Paises Bajos', 'Holanda'],
  'new zealand': ['Nueva Zelanda', 'N Zelanda'],
  nigeria: ['Nigeria'],
  'north korea': ['Corea del Norte'],
  norway: ['Noruega'],
  panama: ['Panama'],
  paraguay: ['Paraguay'],
  peru: ['Peru'],
  poland: ['Polonia'],
  portugal: ['Portugal'],
  qatar: ['Qatar'],
  scotland: ['Escocia'],
  senegal: ['Senegal'],
  serbia: ['Serbia'],
  'south africa': ['Sudafrica'],
  'south korea': ['Corea del Sur'],
  spain: ['Espana'],
  sweden: ['Suecia'],
  switzerland: ['Suiza'],
  tunisia: ['Tunez'],
  turkey: ['Turquia'],
  'united states': ['Estados Unidos', 'USA'],
  usa: ['Estados Unidos', 'USMNT'],
  uruguay: ['Uruguay'],
  venezuela: ['Venezuela'],
  wales: ['Gales'],
}
const STOPWORDS = new Set([
  'club',
  'atletico',
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
const TEAM_NAME_ALIASES: Record<string, string[]> = {
  argentina: ['seleccion argentina', 'argentina seleccion', 'albiceleste'],
  belgium: ['belgica'],
  'bosnia & herzegovina': ['bosnia y herzegovina', 'bosnia herzegovina', 'bosnia'],
  'bosnia and herzegovina': ['bosnia y herzegovina', 'bosnia herzegovina', 'bosnia'],
  canada: ['canada'],
  curacao: ['curazao'],
  egypt: ['egipto'],
  'new zealand': ['nueva zelanda', 'n zelanda'],
  usa: ['estados unidos', 'united states', 'usmnt'],
  'united states': ['estados unidos', 'usa', 'usmnt'],
  mexico: ['mexico', 'méxico'],
  'ivory coast': ['costa de marfil', 'cote d ivoire', "cote d'ivoire"],
  'south korea': ['corea del sur'],
  'north korea': ['corea del norte'],
  sweden: ['suecia'],
  tunisia: ['tunez', 'túnez'],
}
const EXTRA_TEAM_NAME_ALIASES: Record<string, string[]> = {
  algeria: ['argelia'],
  denmark: ['dinamarca'],
  'dominican republic': ['republica dominicana'],
  italy: ['italia'],
  luxembourg: ['luxemburgo'],
  netherlands: ['paises bajos', 'holanda'],
  nigeria: ['nigeria'],
  panama: ['panamá'],
  poland: ['polonia'],
}
const TEAM_SEARCH_ALIASES: Record<string, string[]> = {
  algeria: ['Argelia'],
  argentina: ['Seleccion Argentina', 'Selección Argentina', 'Argentina'],
  denmark: ['Dinamarca'],
  'dominican republic': ['Republica Dominicana'],
  italy: ['Italia'],
  luxembourg: ['Luxemburgo'],
  netherlands: ['Paises Bajos', 'Holanda'],
  'new zealand': ['Nueva Zelanda', 'N Zelanda'],
  poland: ['Polonia'],
  'south korea': ['Corea del Sur'],
  'north korea': ['Corea del Norte'],
  usa: ['Estados Unidos'],
  'united states': ['Estados Unidos', 'USA'],
}

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

function readErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null) return ''

  const record = error as Record<string, unknown>
  return [
    typeof record.message === 'string' ? record.message : '',
    typeof record.details === 'string' ? record.details : '',
    typeof record.hint === 'string' ? record.hint : '',
  ].join(' ').toLowerCase()
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

function isYouTubeQuotaError(error: ErrorPayload) {
  if (error.source !== 'youtube') return false

  const text = `${error.code} ${error.message} ${error.detail ?? ''}`.toLowerCase()

  return (
    text.includes('quota') ||
    text.includes('ratelimitexceeded') ||
    text.includes('rate limit exceeded') ||
    text.includes('too many requests') ||
    error.status === 429 ||
    text.includes('dailylimitexceeded') ||
    text.includes('daily limit exceeded')
  )
}

function getMissingHighlightColumnsFromError(error: unknown) {
  const message = readErrorMessage(error)
  const missing = new Set<string>()

  if (message.includes('highlights_url')) missing.add('highlights_url')
  if (message.includes('highlights_title')) missing.add('highlights_title')
  if (message.includes('schema cache') && !missing.size) {
    missing.add('highlights_url')
    missing.add('highlights_title')
  }

  return [...missing]
}

function isMissingColumnError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  const record = error as Record<string, unknown>
  const code = typeof record.code === 'string' ? record.code : ''
  const message = readErrorMessage(error)

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('column')
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
      status: error.status,
      missingColumns: error.missingColumns,
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
    const status = typeof record.status === 'number' ? record.status : null

    return {
      message,
      code,
      detail,
      source: fallbackSource,
      status,
      missingColumns: getMissingHighlightColumnsFromError(error),
    }
  }

  return {
    message: error instanceof Error ? error.message : String(error || 'Error desconocido'),
    code: 'UNKNOWN_ERROR',
    detail: null,
    source: fallbackSource,
    status: null,
  }
}

function resolveDateRange(options: {
  date?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  recentFinishedOnly?: boolean
}) {
  if (options.date) {
    const range = getArgentinaDayUtcRange(options.date)
    return { dateFrom: range.startUtc, dateTo: range.endUtc }
  }

  if (options.dateFrom || options.dateTo) {
    const fromRange = options.dateFrom ? getArgentinaDayUtcRange(options.dateFrom) : null
    const toRange = options.dateTo ? getArgentinaDayUtcRange(options.dateTo) : null

    return {
      dateFrom: fromRange?.startUtc ?? null,
      dateTo: toRange?.endUtc ?? null,
    }
  }

  if (options.recentFinishedOnly) {
    return {
      dateFrom: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      dateTo: new Date().toISOString(),
    }
  }

  return { dateFrom: null, dateTo: null }
}

function getSignificantTokens(value: string | null | undefined) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function hasSuspiciousEncoding(value: string) {
  return /Ã|Â|�/.test(value)
}

function uniqueTextValues(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const compacted = compactSpaces(value ?? '')
    if (!compacted || hasSuspiciousEncoding(compacted)) continue

    const normalized = normalizeText(compacted)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    result.push(compacted)
  }

  return result
}

function getTranslatedCountryAliases(teamName: string | null, normalizedTeam: string) {
  const translated = translateCountryNameToSpanish(teamName)

  if (!translated || hasSuspiciousEncoding(translated)) return []
  if (normalizeText(translated) === normalizedTeam) return []

  return [translated]
}

function getTeamAliasNames(teamName: string | null) {
  const normalizedTeam = normalizeText(teamName)
  if (!normalizedTeam) return []

  return uniqueTextValues([
    ...(TEAM_NAME_ALIASES[normalizedTeam] ?? []),
    ...(EXTRA_TEAM_NAME_ALIASES[normalizedTeam] ?? []),
    ...(TEAM_SEARCH_ALIASES[normalizedTeam] ?? []),
    ...(COUNTRY_TEAM_SEARCH_ALIASES[normalizedTeam] ?? []),
    ...getTranslatedCountryAliases(teamName, normalizedTeam),
  ])
}

function getTeamTitleCandidates(teamName: string | null) {
  const normalizedTeam = normalizeText(teamName)
  if (!normalizedTeam) return []

  return uniqueTextValues([normalizedTeam, ...getTeamAliasNames(teamName)])
    .map((alias) => normalizeText(alias))
    .filter(Boolean)
}

function getTeamSearchNames(teamName: string | null) {
  const normalizedTeam = normalizeText(teamName)
  if (!teamName || !normalizedTeam) return []

  return uniqueTextValues([
    ...getTranslatedCountryAliases(teamName, normalizedTeam),
    ...(COUNTRY_TEAM_SEARCH_ALIASES[normalizedTeam] ?? []),
    ...(TEAM_SEARCH_ALIASES[normalizedTeam] ?? []),
    teamName,
    ...getTeamAliasNames(teamName),
  ])
    .slice(0, MAX_TEAM_SEARCH_NAMES)
}

function getLeagueSearchNames(match: HighlightMatch) {
  const leagueExternalId = match.leagueExternalId ? String(match.leagueExternalId) : null
  const normalizedLeague = normalizeText(match.leagueName)
  const priorityLeague = PRIORITY_HIGHLIGHT_LEAGUES.find((league) => {
    if (leagueExternalId === league.externalId) return true

    return league.aliases.some((alias) => normalizedLeague.includes(alias))
  })

  return uniqueTextValues([
    priorityLeague?.name,
    ...(priorityLeague?.aliases ?? []),
    match.leagueName,
  ]).slice(0, 2)
}

function getQueryYearText(leagueName: string | null | undefined, yearText: string | null) {
  if (!yearText) return null

  return normalizeText(leagueName).includes(yearText) ? null : yearText
}

function getTeamSearchPairVariants(match: HighlightMatch) {
  const homeNames = getTeamSearchNames(match.homeName)
  const awayNames = getTeamSearchNames(match.awayName)
  if (!homeNames.length || !awayNames.length) return []

  const pairs: Array<[string, string]> = [
    [homeNames[0], awayNames[0]],
  ]
  if (homeNames[1] && awayNames[1]) pairs.push([homeNames[1], awayNames[1]])
  if (homeNames[1]) pairs.push([homeNames[1], awayNames[0]])
  if (awayNames[1]) pairs.push([homeNames[0], awayNames[1]])
  pairs.push([awayNames[0], homeNames[0]])
  if (homeNames[1] && awayNames[1]) pairs.push([awayNames[1], homeNames[1]])

  const seen = new Set<string>()

  return pairs
    .map(([home, away]) => [compactSpaces(home), compactSpaces(away)] as [string, string])
    .filter(([home, away]) => home && away)
    .filter(([home, away]) => {
      const key = `${normalizeText(home)}:${normalizeText(away)}`
      if (seen.has(key)) return false

      seen.add(key)
      return true
    })
}

function getTeamTitleScore(title: string, teamName: string | null) {
  const normalizedTitle = normalizeText(title)
  const candidates = getTeamTitleCandidates(teamName)
  if (!candidates.length || !normalizedTitle) return 0
  if (candidates.some((candidate) => normalizedTitle.includes(candidate))) return 3

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

function getTrustedChannelReason(channelTitle: string | null | undefined) {
  const normalizedChannel = normalizeText(channelTitle)
  if (!normalizedChannel) return null

  if (KNOWN_CHANNELS.some((channel) => normalizedChannel.includes(channel))) {
    return 'known-channel'
  }

  if (OFFICIAL_CHANNEL_HINTS.some((hint) => normalizedChannel.includes(hint))) {
    return 'official-channel'
  }

  return null
}

function isFifaGameText(normalizedTextValue: string) {
  return (
    /\bfifa\s?\d{2}\b/.test(normalizedTextValue) ||
    /\bea\s*sports\s*fc\b/.test(normalizedTextValue) ||
    /\bea\s*fc\s?\d{2}\b/.test(normalizedTextValue) ||
    /\bpes\s?\d{2,4}\b/.test(normalizedTextValue) ||
    (
      /\bfc\s?(24|25|26|27)\b/.test(normalizedTextValue) &&
      containsAny(normalizedTextValue, ['gameplay', 'simulation', 'simulacion', 'ps5', 'xbox'])
    ) ||
    normalizedTextValue.includes('fifa gameplay')
  )
}

function getExistingHighlightRejectReason(match: HighlightMatch) {
  const text = normalizeText(`${match.highlights_title ?? ''} ${match.highlights_url ?? ''}`)
  if (!text) return null

  if (containsAny(text, NEGATIVE_PATTERNS) || isFifaGameText(text)) return 'stored_suspicious_highlight'

  return null
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

export function buildYouTubeHighlightQueries(match: HighlightMatch) {
  if (!match.homeName || !match.awayName) return []

  const year = match.match_date ? new Date(match.match_date).getFullYear() : null
  const yearText = year && Number.isFinite(year) ? String(year) : null
  const pairs = getTeamSearchPairVariants(match)
  const primaryPair = pairs[0] ?? [match.homeName, match.awayName]
  const leagueNames = getLeagueSearchNames(match)
  const primaryLeague = leagueNames[0] ?? match.leagueName
  const secondaryLeague = leagueNames[1] ?? null
  const primaryYearText = getQueryYearText(primaryLeague, yearText)
  const secondaryYearText = getQueryYearText(secondaryLeague ?? primaryLeague, yearText)
  const primaryQueries = [
    compactSpaces(
      [
        primaryPair[0],
        primaryPair[1],
        'resumen',
        'goles',
        primaryLeague,
        primaryYearText,
      ].filter(Boolean).join(' ')
    ),
    compactSpaces(
      [
        primaryPair[0],
        'vs',
        primaryPair[1],
        'highlights',
        secondaryLeague ?? primaryLeague,
        secondaryYearText,
      ].filter(Boolean).join(' ')
    ),
    compactSpaces(
      [primaryPair[0], primaryPair[1], 'resumen completo', yearText].filter(Boolean).join(' ')
    ),
  ]
  const variantQueries = pairs.slice(1).map(([home, away]) =>
    compactSpaces([home, away, 'resumen goles', primaryLeague, primaryYearText].filter(Boolean).join(' '))
  )

  return [...new Set([...primaryQueries, ...variantQueries])]
    .filter((query) => query.length >= 12)
    .slice(0, MAX_PRIMARY_HIGHLIGHT_QUERIES)
}

function buildYouTubeTrustedSourceQueries(match: HighlightMatch) {
  if (!match.homeName || !match.awayName) return []

  const year = match.match_date ? new Date(match.match_date).getFullYear() : null
  const yearText = year && Number.isFinite(year) ? String(year) : null
  const pairs = getTeamSearchPairVariants(match).slice(0, 3)
  const primaryPair = pairs[0]
  if (!primaryPair) return []
  const leagueNames = getLeagueSearchNames(match)
  const primaryLeague = leagueNames[0] ?? match.leagueName
  const primaryYearText = getQueryYearText(primaryLeague, yearText)

  const queries = [
    ...TRUSTED_SOURCE_SEARCH_TERMS.map((source) =>
      compactSpaces(
        [
          primaryPair[0],
          'vs',
          primaryPair[1],
          source,
          'resumen highlights',
          primaryLeague,
          primaryYearText,
        ].filter(Boolean).join(' ')
      )
    ),
    ...TRUSTED_SOURCE_SEARCH_TERMS.flatMap((source) =>
      pairs.slice(1).map(([home, away]) =>
        compactSpaces([home, 'vs', away, source, 'resumen highlights', yearText].filter(Boolean).join(' '))
      )
    ),
  ]

  return [...new Set(queries)]
    .filter((query) => query.length >= 12)
    .slice(0, MAX_TRUSTED_SOURCE_FALLBACK_QUERIES)
}

export function buildYouTubeHighlightQuery(match: HighlightMatch) {
  return buildYouTubeHighlightQueries(match)[0] ?? ''
}

export function scoreYouTubeHighlightResult(match: HighlightMatch, result: YouTubeSearchItem) {
  const title = result.snippet?.title ?? ''
  const description = result.snippet?.description ?? ''
  const channelTitle = result.snippet?.channelTitle ?? ''
  const publishedAt = result.snippet?.publishedAt ?? null
  const text = normalizeText(`${title} ${description} ${channelTitle}`)
  const normalizedTitle = normalizeText(title)
  const reasons: string[] = []
  let score = 0
  let publishedBeforeMatch = false
  const trustedChannelReason = getTrustedChannelReason(channelTitle)
  const hasTrustedChannel = Boolean(trustedChannelReason)

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

  if (trustedChannelReason) {
    score += 3
    reasons.push(trustedChannelReason)
    if (containsAny(normalizeText(channelTitle), ['tyc sports', 'telefe'])) {
      score += 2
      reasons.push('preferred-argentina-channel')
    }
  } else {
    reasons.push('untrusted-channel')
  }

  const distanceDays = getPublishedDistanceDays(match.match_date, publishedAt)
  if (distanceDays !== null) {
    if (isPublishedBeforeMatch(match.match_date, publishedAt)) {
      publishedBeforeMatch = true
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
  const hasNegativeKeyword = reasons.includes('negative-keyword') || reasons.includes('live-not-summary')
  const hasTrustedOfficialClip =
    hasTrustedChannel &&
    hasBothTeams &&
    (reasons.includes('published-close') || reasons.includes('published-near'))

  return {
    score,
    reasons,
    accepted:
      score >= 10 &&
      hasBothTeams &&
      hasTrustedChannel &&
      (hasSummaryIntent || hasTrustedOfficialClip) &&
      !publishedBeforeMatch &&
      !hasNegativeKeyword,
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

export async function getHighlightsColumnStatus(supabase: DbClient) {
  const { error } = await supabase
    .from('matches')
    .select('highlights_url, highlights_title')
    .limit(1)

  if (!error) {
    return {
      hasHighlightsUrlColumn: true,
      hasHighlightsTitleColumn: true,
      missingColumns: [] as string[],
    }
  }

  if (!isMissingColumnError(error)) throw error

  const missing = getMissingHighlightColumnsFromError(error)
  const missingColumns = missing.length ? missing : ['highlights_url', 'highlights_title']

  return {
    hasHighlightsUrlColumn: !missingColumns.includes('highlights_url'),
    hasHighlightsTitleColumn: !missingColumns.includes('highlights_title'),
    missingColumns,
  }
}

async function assertHighlightColumns(supabase: DbClient) {
  const status = await getHighlightsColumnStatus(supabase)
  if (!status.missingColumns.length) return status

  throw new SerializableError(
    'Faltan columnas de highlights en public.matches.',
    'missing_database_columns',
    'Aplicar la migracion que agrega matches.highlights_url y matches.highlights_title.',
    'supabase',
    { missingColumns: status.missingColumns }
  )
}

async function fetchMatches(supabase: DbClient, options: HighlightSyncOptions) {
  const limit = clampLimit(options.limit, DEFAULT_SYNC_LIMIT, MAX_SYNC_LIMIT)
  const isSingleMatch = Boolean(options.matchId || options.fixture)
  const rowsLimit = isSingleMatch ? 1 : Math.min(limit * 10, 500)
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

  if (options.fixture) query = query.eq('external_id', options.fixture.trim())
  if (!isSingleMatch) query = query.in('status', FINISHED_QUERY_STATUSES)

  const leagueId = await getLeagueIdByExternalId(supabase, options.leagueExternalId)
  if (options.leagueExternalId && !leagueId) return []
  if (leagueId) query = query.eq('league_id', leagueId)

  const range = resolveDateRange(options)
  if (range.dateFrom) query = query.gte('match_date', range.dateFrom)
  if (range.dateTo) query = query.lte('match_date', range.dateTo)
  if (!options.force) query = query.is('highlights_url', null)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as MatchRow[]

  if (!options.recentFinishedOnly) return rows

  const since = Date.now() - 3 * 60 * 60 * 1000
  return rows.filter((match) => {
    const timestamp = match.match_date ? new Date(match.match_date).getTime() : NaN

    return isFinishedStatus(match.status) && Number.isFinite(timestamp) && timestamp >= since
  })
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

function getHighlightCompetitionPriority(match: HighlightMatch) {
  const leagueExternalId = match.leagueExternalId ? String(match.leagueExternalId) : null
  const normalizedLeague = normalizeText(match.leagueName)
  const priorityIndex = PRIORITY_HIGHLIGHT_LEAGUES.findIndex((league) => {
    if (leagueExternalId === league.externalId) return true

    return league.aliases.some((alias) => normalizedLeague.includes(alias))
  })

  return priorityIndex === -1 ? PRIORITY_HIGHLIGHT_LEAGUES.length : priorityIndex
}

function getMatchTimestamp(match: HighlightMatch) {
  if (!match.match_date) return 0

  const timestamp = new Date(match.match_date).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function sortMatchesForHighlightSync(matches: HighlightMatch[], options: HighlightSyncOptions) {
  if (options.matchId || options.fixture || options.leagueExternalId) return matches

  return [...matches].sort((a, b) => {
    const priorityDelta = getHighlightCompetitionPriority(a) - getHighlightCompetitionPriority(b)
    if (priorityDelta !== 0) return priorityDelta

    return getMatchTimestamp(b) - getMatchTimestamp(a)
  })
}

function getYouTubePublishedWindow(match: HighlightMatch) {
  if (!match.match_date) return null

  const matchTimestamp = new Date(match.match_date).getTime()
  if (!Number.isFinite(matchTimestamp)) return null

  const publishedAfter = new Date(matchTimestamp - 12 * 60 * 60 * 1000)
  const maxPublishedBefore = matchTimestamp + 14 * 24 * 60 * 60 * 1000
  const publishedBeforeTimestamp = Math.min(Date.now(), maxPublishedBefore)
  if (publishedBeforeTimestamp <= publishedAfter.getTime()) return null

  return {
    publishedAfter: publishedAfter.toISOString(),
    publishedBefore: new Date(publishedBeforeTimestamp).toISOString(),
  }
}

async function searchYouTubeHighlights(query: string, apiKey: string, match: HighlightMatch) {
  const url = new URL(YOUTUBE_SEARCH_URL)
  const publishedWindow = getYouTubePublishedWindow(match)

  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', String(YOUTUBE_RESULTS_PER_QUERY))
  url.searchParams.set('q', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('order', 'relevance')
  url.searchParams.set('relevanceLanguage', 'es')
  url.searchParams.set('regionCode', 'AR')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('safeSearch', 'moderate')
  if (publishedWindow) {
    url.searchParams.set('publishedAfter', publishedWindow.publishedAfter)
    url.searchParams.set('publishedBefore', publishedWindow.publishedBefore)
  }

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

  if (process.env.NODE_ENV !== 'production') {
    console.info('[sync-match-highlights] youtube-response', {
      query,
      status: response.status,
      ok: response.ok,
      results: payload.items?.length ?? 0,
    })
  }

  if (!response.ok) {
    const firstError = payload.error?.errors?.[0]
    throw new SerializableError(
      payload.error?.message || `YouTube devolvio ${response.status}`,
      firstError?.reason || `YOUTUBE_${response.status}`,
      firstError?.message || payload.error?.message || null,
      'youtube',
      { status: response.status }
    )
  }

  return payload.items ?? []
}

async function fetchYouTubeVideoDetails(videoIds: string[], apiKey: string) {
  const uniqueIds = [...new Set(videoIds.filter(Boolean))]
  const details = new Map<string, YouTubeVideoDetailsItem>()

  for (let index = 0; index < uniqueIds.length; index += YOUTUBE_VIDEO_DETAILS_BATCH_SIZE) {
    const chunk = uniqueIds.slice(index, index + YOUTUBE_VIDEO_DETAILS_BATCH_SIZE)
    const url = new URL(YOUTUBE_VIDEOS_URL)
    url.searchParams.set('part', 'snippet,status,contentDetails')
    url.searchParams.set('id', chunk.join(','))
    url.searchParams.set('key', apiKey)

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
            : 'Fallo el fetch de detalle de videos de YouTube',
        aborted ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_VIDEO_DETAILS_FETCH_FAILED',
        aborted ? `Timeout ${YOUTUBE_FETCH_TIMEOUT_MS}ms` : null,
        'youtube'
      )
    } finally {
      clearTimeout(timeout)
    }

    const payload = (await response.json().catch(() => ({}))) as YouTubeVideoDetailsResponse

    if (!response.ok) {
      const firstError = payload.error?.errors?.[0]
      throw new SerializableError(
        payload.error?.message || `YouTube devolvio ${response.status}`,
        firstError?.reason || `YOUTUBE_${response.status}`,
        firstError?.message || payload.error?.message || null,
        'youtube',
        { status: response.status }
      )
    }

    for (const item of payload.items ?? []) {
      if (item.id) details.set(item.id, item)
    }
  }

  return details
}

function toSearchItemFromVideoDetails(
  videoId: string,
  item: YouTubeVideoDetailsItem
): YouTubeSearchItem {
  return {
    id: {
      videoId,
    },
    snippet: {
      title: item.snippet?.title,
      description: item.snippet?.description,
      channelTitle: item.snippet?.channelTitle,
      publishedAt: item.snippet?.publishedAt,
    },
  }
}

function getYouTubeVideoDetailsRejectReason(
  videoId: string,
  details: Map<string, YouTubeVideoDetailsItem>,
  match: HighlightMatch
) {
  const item = details.get(videoId)
  if (!item) return 'stored_video_not_found'

  const uploadStatus = item.status?.uploadStatus
  if (uploadStatus && uploadStatus !== 'processed') return `stored_video_${uploadStatus}`

  const privacyStatus = item.status?.privacyStatus
  if (privacyStatus && privacyStatus !== 'public' && privacyStatus !== 'unlisted') {
    return `stored_video_${privacyStatus}`
  }

  if (item.status?.embeddable === false) return 'stored_video_not_embeddable'

  const regionRestriction = item.contentDetails?.regionRestriction
  const blockedCountries = regionRestriction?.blocked?.map((country) => country.toUpperCase()) ?? []
  if (blockedCountries.includes('AR')) return 'stored_video_region_blocked_ar'

  const allowedCountries = regionRestriction?.allowed?.map((country) => country.toUpperCase()) ?? []
  if (allowedCountries.length && !allowedCountries.includes('AR')) {
    return 'stored_video_region_not_allowed_ar'
  }

  const scored = scoreYouTubeHighlightResult(match, toSearchItemFromVideoDetails(videoId, item))

  if (!scored.accepted) {
    const reason = scored.reasons.slice(0, 4).join(',')

    return reason ? `stored_video_low_relevance:${reason}` : 'stored_video_low_relevance'
  }

  return null
}

function toResultBase(match: HighlightMatch) {
  return {
    matchId: match.id,
    fixtureExternalId: match.external_id,
    externalId: match.external_id,
    home: match.homeName,
    away: match.awayName,
    league: match.leagueName,
    matchDate: match.match_date,
  }
}

function toCandidate(item: YouTubeSearchItem, match: HighlightMatch, query: string) {
  const videoId = item.id?.videoId ? getYouTubeVideoId(getYouTubeWatchUrl(item.id.videoId)) : null

  return {
    item,
    videoId,
    title: item.snippet?.title ?? '',
    channelTitle: item.snippet?.channelTitle ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    query,
    ...scoreYouTubeHighlightResult(match, item),
  }
}

async function clearSuspiciousStoredHighlights(
  supabase: DbClient,
  matches: HighlightMatch[],
  apiKey: string
) {
  const cleared = new Map<string, string>()
  const rejectReasons = new Map<string, string>()
  const storedVideoIds = new Map<string, string>()

  for (const match of matches) {
    if (!match.highlights_url) continue

    const rejectReason = getExistingHighlightRejectReason(match)
    if (rejectReason) {
      rejectReasons.set(match.id, rejectReason)
      continue
    }

    const videoId = getYouTubeVideoId(match.highlights_url)
    if (videoId) storedVideoIds.set(match.id, videoId)
  }

  if (storedVideoIds.size) {
    try {
      const details = await fetchYouTubeVideoDetails([...storedVideoIds.values()], apiKey)

      for (const [matchId, videoId] of storedVideoIds.entries()) {
        const match = matches.find((candidate) => candidate.id === matchId)
        if (!match) continue

        const rejectReason = getYouTubeVideoDetailsRejectReason(videoId, details, match)
        if (rejectReason) rejectReasons.set(matchId, rejectReason)
      }
    } catch (error) {
      console.warn(
        '[sync-match-highlights] stored-video-validation-failed',
        serializeHighlightError(error, 'youtube')
      )
    }
  }

  for (const match of matches) {
    const rejectReason = rejectReasons.get(match.id)
    if (!rejectReason) continue

    const { error } = await supabase
      .from('matches')
      .update({
        highlights_url: null,
        highlights_title: null,
      })
      .eq('id', match.id)

    if (error) throw error

    cleared.set(match.id, rejectReason)
  }

  return cleared
}

export async function syncMatchHighlights(supabase: DbClient, options: HighlightSyncOptions) {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    throw new SerializableError(
      'Falta YOUTUBE_API_KEY',
      'missing_youtube_api_key',
      'Configura YOUTUBE_API_KEY en variables de entorno server-side.',
      'config'
    )
  }

  await assertHighlightColumns(supabase)

  const limit = clampLimit(options.limit, DEFAULT_SYNC_LIMIT, MAX_SYNC_LIMIT)
  const preClearedHighlights = options.force
    ? new Map<string, string>()
    : await clearSuspiciousStoredHighlights(
        supabase,
        await enrichMatches(
          supabase,
          await fetchMatches(supabase, { ...options, force: true, limit: MAX_SYNC_LIMIT })
        ),
        apiKey
      )
  const rows = await fetchMatches(supabase, { ...options, limit })
  const matches = sortMatchesForHighlightSync(await enrichMatches(supabase, rows), options)
  const results: HighlightResult[] = []
  let searched = 0
  let updated = 0
  let stoppedReason: string | null = null

  for (const match of matches.slice(0, limit)) {
    let clearedExistingReason: string | null = preClearedHighlights.get(match.id) ?? null
    let clearedExisting = Boolean(clearedExistingReason)

    if (!options.force && match.highlights_url) {
      const rejectReason = getExistingHighlightRejectReason(match)

      if (rejectReason) {
        const { error } = await supabase
          .from('matches')
          .update({
            highlights_url: null,
            highlights_title: null,
          })
          .eq('id', match.id)

        if (error) {
          const serialized = serializeHighlightError(error, 'supabase')

          results.push({
            ...toResultBase(match),
            status: 'failed',
            skipReason: serialized.message,
            reason: serialized.message,
            clearedExisting: false,
            clearedExistingReason: rejectReason,
            errors: [serialized],
            error: serialized,
          })
          continue
        }

        match.highlights_url = null
        match.highlights_title = null
        clearedExisting = true
        clearedExistingReason = rejectReason
      }
    }

    const skipReason = getPreSearchSkipReason(match, options.force)
    if (skipReason) {
      const status =
        skipReason === 'already_has_highlights'
          ? 'already_exists'
          : skipReason === 'not_finished' || skipReason === 'future_match'
            ? 'skipped_not_finished'
            : 'failed'
      results.push({
        ...toResultBase(match),
        status,
        skipReason,
        reason: skipReason,
        clearedExisting,
        clearedExistingReason,
      })
      continue
    }

    const queries = buildYouTubeHighlightQueries(match)
    if (!queries.length) {
      results.push({
        ...toResultBase(match),
        status: 'failed',
        skipReason: 'missing_search_query',
        reason: 'missing_search_query',
        clearedExisting,
        clearedExistingReason,
      })
      continue
    }

    const allCandidates: ReturnType<typeof toCandidate>[] = []
    const attemptedQueries = [...queries]

    try {
      const runSearches = async (searchQueries: string[]) => {
        for (const query of searchQueries) {
          searched += 1
          const items = await searchYouTubeHighlights(query, apiKey, match)
          const scored = items
            .map((item) => toCandidate(item, match, query))
            .filter((item) => item.videoId)
            .sort((a, b) => b.score - a.score)

          allCandidates.push(...scored)
          if (scored.some((item) => item.accepted)) return true
        }

        return false
      }

      const foundPrimaryCandidate = await runSearches(queries)

      if (!foundPrimaryCandidate) {
        const trustedSourceQueries = buildYouTubeTrustedSourceQueries(match).filter(
          (query) => !attemptedQueries.includes(query)
        )

        attemptedQueries.push(...trustedSourceQueries)
        await runSearches(trustedSourceQueries)
      }

      const acceptedCandidates = allCandidates
        .filter((item): item is ReturnType<typeof toCandidate> & { videoId: string } =>
          Boolean(item.videoId) && item.accepted
        )
        .sort((a, b) => b.score - a.score)
      const rejectedAcceptedCandidates: Array<{
        videoId: string
        reason: string
      }> = []
      let selected: (ReturnType<typeof toCandidate> & { videoId: string }) | null = null

      if (acceptedCandidates.length) {
        const details = await fetchYouTubeVideoDetails(
          acceptedCandidates.map((item) => item.videoId),
          apiKey
        )

        for (const candidate of acceptedCandidates) {
          const rejectReason = getYouTubeVideoDetailsRejectReason(candidate.videoId, details, match)

          if (!rejectReason) {
            selected = candidate
            break
          }

          rejectedAcceptedCandidates.push({
            videoId: candidate.videoId,
            reason: rejectReason,
          })
        }
      }

      if (!selected) {
        results.push({
          ...toResultBase(match),
          query: attemptedQueries[0],
          queries: attemptedQueries,
          status: 'no_reliable_video',
          skipReason: 'no_reliable_video',
          reason: 'no_reliable_video',
          clearedExisting,
          clearedExistingReason,
          candidatesFound: allCandidates.length,
          candidates: allCandidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map((item) => ({
              title: item.title,
              channelTitle: item.channelTitle,
              publishedAt: item.publishedAt,
              score: item.score,
              reasons: [
                ...item.reasons,
                ...rejectedAcceptedCandidates
                  .filter((rejected) => rejected.videoId === item.videoId)
                  .map((rejected) => `video-details:${rejected.reason}`),
              ],
              query: item.query,
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
      const selectedVideo = {
        title: selected.title,
        url: highlightsUrl,
        channelTitle: selected.channelTitle,
        publishedAt: selected.publishedAt,
        score: selected.score,
      }

      results.push({
        ...toResultBase(match),
        query: selected.query,
        queries: attemptedQueries,
        status: 'updated',
        selectedVideo,
        selectedScore: selected.score,
        selected: selectedVideo,
        highlightsUrl,
        highlightsTitle: selected.title,
        candidatesFound: allCandidates.length,
        clearedExisting,
        clearedExistingReason,
      })
    } catch (error) {
      const serialized = serializeHighlightError(
        error,
        isSupabaseErrorLike(error) ? 'supabase' : 'youtube'
      )

      results.push({
        ...toResultBase(match),
        query: attemptedQueries[0],
        queries: attemptedQueries,
        status: 'failed',
        skipReason: serialized.message,
        reason: serialized.message,
        clearedExisting,
        clearedExistingReason,
        candidatesFound: allCandidates.length,
        errors: [serialized],
        error: serialized,
      })

      if (isYouTubeQuotaError(serialized)) {
        stoppedReason = serialized.code
        break
      }
    }
  }

  const failed = results.filter((result) => result.status === 'failed').length
  const skipped = results.filter((result) =>
    result.status === 'already_exists' ||
    result.status === 'skipped_not_finished' ||
    result.status === 'no_reliable_video'
  ).length

  return {
    ok: failed === 0,
    checked: matches.length,
    searched,
    updated,
    clearedExisting: preClearedHighlights.size,
    stoppedReason,
    skipped,
    failed,
    errors: failed,
    items: results,
    results,
  }
}

async function countFinishedMatches(
  supabase: DbClient,
  options: HighlightAuditOptions & { withoutHighlights?: boolean; withHighlights?: boolean; recentOnly?: boolean }
) {
  let query = supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .in('status', FINISHED_QUERY_STATUSES)

  const leagueId = await getLeagueIdByExternalId(supabase, options.leagueExternalId)
  if (options.leagueExternalId && !leagueId) return 0
  if (leagueId) query = query.eq('league_id', leagueId)

  const range = options.recentOnly
    ? { dateFrom: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), dateTo: new Date().toISOString() }
    : resolveDateRange(options)
  if (range.dateFrom) query = query.gte('match_date', range.dateFrom)
  if (range.dateTo) query = query.lte('match_date', range.dateTo)
  if (options.withHighlights) query = query.not('highlights_url', 'is', null)
  if (options.withoutHighlights) query = query.is('highlights_url', null)

  const { count, error } = await query
  if (error) throw error

  return count ?? 0
}

function serializeSample(match: HighlightMatch) {
  const videoId = getYouTubeVideoId(match.highlights_url)
  const thumbnailUrl = getYouTubeThumbnailUrl(match.highlights_url)
  const embedUrl = getYouTubeEmbedUrl(match.highlights_url)
  const validUrl = Boolean(match.highlights_url && videoId)

  return {
    id: match.id,
    externalId: match.external_id,
    league: match.leagueName,
    home: match.homeName,
    away: match.awayName,
    matchDate: match.match_date,
    status: match.status,
    title: match.highlights_title,
    url: match.highlights_url,
    videoId,
    thumbnailUrl,
    embedUrl,
    isValidYouTubeUrl: validUrl,
    renderReady: validUrl && Boolean(thumbnailUrl && embedUrl),
  }
}

function serializeAuditItem(match: HighlightMatch) {
  const videoId = getYouTubeVideoId(match.highlights_url)
  const thumbnailUrl = getYouTubeThumbnailUrl(match.highlights_url)
  const validUrl = Boolean(match.highlights_url && videoId)
  const renderReady = validUrl && Boolean(thumbnailUrl)
  let reasonIfMissing: string | null = null

  if (!match.highlights_url) reasonIfMissing = 'missing_highlights_url'
  else if (!validUrl) reasonIfMissing = 'invalid_youtube_url'
  else if (!renderReady) reasonIfMissing = 'missing_thumbnail_url'

  return {
    matchId: match.id,
    fixtureExternalId: match.external_id,
    league: match.leagueName,
    home: match.homeName,
    away: match.awayName,
    status: match.status,
    matchDate: match.match_date,
    highlightsUrl: match.highlights_url,
    highlightsTitle: match.highlights_title,
    videoId,
    thumbnailUrl,
    renderReady,
    reasonIfMissing,
  }
}

export async function getHighlightsAudit(supabase: DbClient, options: HighlightAuditOptions) {
  const limit = clampLimit(options.limit, DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT)
  const warnings: string[] = []
  const columnStatus = await getHighlightsColumnStatus(supabase)
  const render = {
    thumbnailDomainsConfigured:
      ALLOWED_REMOTE_ASSET_HOSTS.includes(YOUTUBE_IMAGE_HOST) &&
      ALLOWED_REMOTE_ASSET_HOSTS.includes(YOUTUBE_IMAGE_ALT_HOST),
    allowedImageDomains: ALLOWED_REMOTE_ASSET_HOSTS,
  }

  if (!process.env.YOUTUBE_API_KEY) warnings.push('missing_youtube_api_key')
  if (!(process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET)) warnings.push('missing_cron_secret')
  if (columnStatus.missingColumns.length) {
    warnings.push(`missing_database_columns:${columnStatus.missingColumns.join(',')}`)

    return {
      ok: false,
      error: 'missing_database_columns',
      message: 'Faltan columnas de highlights en public.matches.',
      env: {
        hasYoutubeApiKey: Boolean(process.env.YOUTUBE_API_KEY),
        hasCronSecret: Boolean(process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET),
      },
      db: columnStatus,
      matches: {
        checked: 0,
        finishedMatches: 0,
        withHighlights: 0,
        withoutHighlights: 0,
        invalidYoutubeUrls: 0,
        renderReady: 0,
        missingThumbnails: 0,
      },
      totals: {
        checked: 0,
        finishedMatches: 0,
        withHighlights: 0,
        withoutHighlights: 0,
        invalidYoutubeUrls: 0,
        renderReady: 0,
        noReliableVideo: 0,
        matchesWithHighlights: 0,
        matchesWithoutHighlights: 0,
        recentFinishedWithoutHighlights: 0,
      },
      items: [],
      samples: {
        withHighlights: [],
        withoutHighlights: [],
        invalidUrls: [],
      },
      nextConfig: {
        allowsImgYoutube: ALLOWED_REMOTE_ASSET_HOSTS.includes(YOUTUBE_IMAGE_HOST),
        allowsIYtimg: ALLOWED_REMOTE_ASSET_HOSTS.includes(YOUTUBE_IMAGE_ALT_HOST),
      },
      render,
      warnings,
      errors: ['missing_database_columns'],
    }
  }

  const [finishedMatches, matchesWithHighlights, matchesWithoutHighlights, recentFinishedWithoutHighlights] =
    await Promise.all([
      countFinishedMatches(supabase, options),
      countFinishedMatches(supabase, { ...options, withHighlights: true }),
      countFinishedMatches(supabase, { ...options, withoutHighlights: true }),
      countFinishedMatches(supabase, { ...options, withoutHighlights: true, recentOnly: true }),
    ])
  const rows = await fetchMatches(supabase, {
    ...options,
    force: true,
    limit,
  })
  const matches = await enrichMatches(supabase, rows)
  const finished = matches.filter((match) => isFinishedStatus(match.status))
  const withHighlights = finished.filter((match) => Boolean(match.highlights_url))
  const withoutHighlights = finished.filter((match) => !match.highlights_url)
  const invalidUrls = withHighlights.filter((match) => !isValidYouTubeUrl(match.highlights_url))
  const renderReady = withHighlights.filter((match) => {
    const videoId = getYouTubeVideoId(match.highlights_url)
    const thumbnailUrl = getYouTubeThumbnailUrl(match.highlights_url)
    const embedUrl = getYouTubeEmbedUrl(match.highlights_url)

    return Boolean(videoId && thumbnailUrl && embedUrl)
  })
  const missingThumbnails = withHighlights.length - renderReady.length
  if (!render.thumbnailDomainsConfigured) warnings.push('youtube_thumbnail_domains_not_configured')
  if (!process.env.YOUTUBE_API_KEY) warnings.push('Falta YOUTUBE_API_KEY')

  const auditItems = finished.map(serializeAuditItem)
  const items = options.onlyProblems
    ? auditItems.filter((item) => !item.renderReady || Boolean(item.reasonIfMissing))
    : auditItems

  return {
    ok: Boolean(process.env.YOUTUBE_API_KEY),
    error: process.env.YOUTUBE_API_KEY ? null : 'missing_youtube_api_key',
    message: process.env.YOUTUBE_API_KEY ? null : 'Falta YOUTUBE_API_KEY',
    env: {
      hasYoutubeApiKey: Boolean(process.env.YOUTUBE_API_KEY),
      hasCronSecret: Boolean(process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET),
    },
    db: columnStatus,
    matches: {
      checked: matches.length,
      finishedMatches,
      withHighlights: matchesWithHighlights,
      withoutHighlights: matchesWithoutHighlights,
      invalidYoutubeUrls: invalidUrls.length,
      renderReady: renderReady.length,
      missingThumbnails,
    },
    totals: {
      checked: matches.length,
      finishedMatches,
      withHighlights: matchesWithHighlights,
      withoutHighlights: matchesWithoutHighlights,
      invalidYoutubeUrls: invalidUrls.length,
      renderReady: renderReady.length,
      noReliableVideo: matchesWithoutHighlights,
      matchesWithHighlights,
      matchesWithoutHighlights,
      recentFinishedWithoutHighlights,
    },
    items,
    samples: {
      withHighlights: withHighlights.slice(0, limit).map(serializeSample),
      withoutHighlights: withoutHighlights.slice(0, limit).map(serializeSample),
      invalidUrls: invalidUrls.slice(0, limit).map(serializeSample),
    },
    nextConfig: {
      allowsImgYoutube: ALLOWED_REMOTE_ASSET_HOSTS.includes(YOUTUBE_IMAGE_HOST),
      allowsIYtimg: ALLOWED_REMOTE_ASSET_HOSTS.includes(YOUTUBE_IMAGE_ALT_HOST),
    },
    render,
    warnings,
    errors: [],
    checked: matches.length,
    finishedMatches,
    withHighlights: matchesWithHighlights,
    withoutHighlights: matchesWithoutHighlights,
    latestHighlights: withHighlights.slice(0, limit).map(serializeSample),
    finishedWithoutHighlights: withoutHighlights.slice(0, limit).map(serializeSample),
    recentErrors: [],
  }
}

export async function getHighlightRenderAudit(
  supabase: DbClient,
  options: Pick<HighlightAuditOptions, 'matchId' | 'fixture'>
) {
  const warnings: string[] = []
  const errors: string[] = []
  const columnStatus = await getHighlightsColumnStatus(supabase)

  if (columnStatus.missingColumns.length) {
    errors.push('missing_database_columns')

    return {
      ok: false,
      match: null,
      db: {
        highlightsUrl: null,
        highlightsTitle: null,
        ...columnStatus,
      },
      parsed: {
        videoId: null,
        thumbnailUrl: null,
        embedUrl: null,
        validUrl: false,
      },
      renderReadiness: {
        canRenderSummary: false,
        reasonIfNot: `missing_database_columns:${columnStatus.missingColumns.join(',')}`,
      },
      warnings,
      errors,
    }
  }

  const rows = await fetchMatches(supabase, {
    matchId: options.matchId,
    fixture: options.fixture,
    force: true,
    limit: 1,
  })
  const [match] = await enrichMatches(supabase, rows)

  if (!match) {
    errors.push('match_not_found')

    return {
      ok: false,
      match: null,
      db: {
        highlightsUrl: null,
        highlightsTitle: null,
        ...columnStatus,
      },
      parsed: {
        videoId: null,
        thumbnailUrl: null,
        embedUrl: null,
        validUrl: false,
      },
      renderReadiness: {
        canRenderSummary: false,
        reasonIfNot: 'match_not_found',
      },
      warnings,
      errors,
    }
  }

  const videoId = getYouTubeVideoId(match.highlights_url)
  const thumbnailUrl = getYouTubeThumbnailUrl(match.highlights_url)
  const embedUrl = getYouTubeEmbedUrl(match.highlights_url)
  const validUrl = Boolean(match.highlights_url && videoId)
  const reasonIfNot = !match.highlights_url
    ? 'missing_highlights_url'
    : !validUrl
      ? 'invalid_youtube_url'
      : !thumbnailUrl
        ? 'missing_thumbnail_url'
        : !embedUrl
          ? 'missing_embed_url'
        : null

  if (reasonIfNot) warnings.push(reasonIfNot)

  return {
    ok: true,
    match: {
      id: match.id,
      externalId: match.external_id,
      home: match.homeName,
      away: match.awayName,
      league: match.leagueName,
      matchDate: match.match_date,
      status: match.status,
    },
    db: {
      highlightsUrl: match.highlights_url,
      highlightsTitle: match.highlights_title,
      ...columnStatus,
    },
    parsed: {
      videoId,
      thumbnailUrl,
      embedUrl,
      validUrl,
    },
    renderReadiness: {
      canRenderSummary: Boolean(validUrl && thumbnailUrl && embedUrl),
      reasonIfNot,
    },
    warnings,
    errors,
  }
}
