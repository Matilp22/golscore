import { getYouTubeVideoId } from '@/shared/utils/youtube'

export const SUMMARY_SOURCE_PRIORITY = [
  'espn',
  'fox_sports',
  'dsports',
  'directv_sports',
  'tnt_sports',
  'afaplay',
  'official_media',
  'dazn',
  'fifa',
] as const

export type KnownSummaryProvider = (typeof SUMMARY_SOURCE_PRIORITY)[number]
export type SummaryProvider = KnownSummaryProvider | 'unknown'
export type MatchSummarySourceType = 'iframe' | 'video'

export type MatchSummarySource = {
  provider: SummaryProvider
  title: string
  type: MatchSummarySourceType
  src: string
}

export type MatchSummaryCandidate = {
  provider?: string | null
  sourceName?: string | null
  title?: string | null
  url?: string | null
  embedUrl?: string | null
  type?: string | null
  metadata?: Record<string, unknown> | null
}

export type MatchSummaryCandidateSource = MatchSummaryCandidate & {
  highlightsUrl?: string | null
  highlightsTitle?: string | null
}

export type NormalizedMatchSummary =
  | {
      available: true
      provider: SummaryProvider
      title: string
      type: MatchSummarySourceType
      src: string
      source: MatchSummarySource
    }
  | {
      available: false
      provider: null
      title: null
      type: null
      src: null
      source: null
    }

type SummaryProviderDetectionInput =
  | string
  | {
      provider?: string | null
      sourceName?: string | null
      title?: string | null
      url?: string | null
      embedUrl?: string | null
      metadata?: Record<string, unknown> | null
    }
  | null
  | undefined

type NormalizedVideoUrl = {
  type: MatchSummarySourceType
  src: string
}

type NormalizeVideoUrlInput = {
  url?: string | null
  embedUrl?: string | null
  type?: string | null
  metadata?: Record<string, unknown> | null
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeProviderText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9+./:\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectProviderFields(input: SummaryProviderDetectionInput) {
  if (!input) return []
  if (typeof input === 'string') return [input]

  const metadataValues = input.metadata
    ? Object.values(input.metadata).filter((value): value is string => typeof value === 'string')
    : []

  return [
    input.provider,
    input.sourceName,
    input.title,
    input.url,
    input.embedUrl,
    ...metadataValues,
  ].flatMap((value) => {
    const cleaned = cleanString(value)
    return cleaned ? [cleaned] : []
  })
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle))
}

export function normalizeSummaryProvider(input: SummaryProviderDetectionInput): SummaryProvider {
  const fields = collectProviderFields(input)
  if (!fields.length) return 'unknown'

  const haystack = normalizeProviderText(fields.join(' '))

  if (includesAny(haystack, ['espn', 'espn.com', 'espn com', 'espn.com.ar', 'espn com ar', 'espndeportes'])) {
    return 'espn'
  }
  if (includesAny(haystack, ['fox sports', 'foxsports', 'foxsports.com', 'foxsports com'])) {
    return 'fox_sports'
  }
  if (includesAny(haystack, ['dsports', 'd sports'])) {
    return 'dsports'
  }
  if (includesAny(haystack, ['directv sports', 'directvsports', 'directv'])) {
    return 'directv_sports'
  }
  if (includesAny(haystack, ['tnt sports', 'tntsports'])) {
    return 'tnt_sports'
  }
  if (includesAny(haystack, ['afa play', 'afaplay'])) {
    return 'afaplay'
  }
  if (includesAny(haystack, ['dazn', 'dazn tv'])) {
    return 'dazn'
  }
  if (includesAny(haystack, ['fifa.com', 'fifa com', 'fifa+'])) {
    return 'fifa'
  }
  if (/\bfifa\b/.test(haystack)) {
    return 'fifa'
  }
  if (includesAny(haystack, [
    'official',
    'oficial',
    'club official',
    'federation',
    'federacion',
    'asociacion',
    'association',
    'canal oficial',
    'sitio oficial',
  ])) {
    return 'official_media'
  }

  return 'unknown'
}

export function getSummaryProviderPriority(provider: SummaryProvider) {
  const index = SUMMARY_SOURCE_PRIORITY.indexOf(provider as KnownSummaryProvider)

  return index === -1 ? SUMMARY_SOURCE_PRIORITY.length : index
}

function parseHttpUrl(value?: string | null) {
  const cleaned = cleanString(value)
  if (!cleaned) return null

  try {
    const url = new URL(cleaned)

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function buildYouTubeEmbedUrl(value: string) {
  const videoId = getYouTubeVideoId(value)

  return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null
}

function getVimeoVideoId(url: URL) {
  const hostname = url.hostname.replace(/^www\./, '')
  const pathSegments = url.pathname.split('/').filter(Boolean)

  if (hostname === 'player.vimeo.com' && pathSegments[0] === 'video') {
    return pathSegments[1] ?? null
  }

  if (hostname === 'vimeo.com' && /^\d+$/.test(pathSegments[0] ?? '')) {
    return pathSegments[0]
  }

  return null
}

function normalizeVimeoUrl(url: URL) {
  const videoId = getVimeoVideoId(url)

  return videoId ? `https://player.vimeo.com/video/${encodeURIComponent(videoId)}` : null
}

function isDirectVideoUrl(url: URL) {
  const pathname = url.pathname.toLowerCase()

  return pathname.endsWith('.mp4') || pathname.endsWith('.webm')
}

function isUnsupportedHlsUrl(url: URL) {
  return url.pathname.toLowerCase().endsWith('.m3u8')
}

function isExplicitEmbedUrl(url: URL) {
  const hostname = url.hostname.toLowerCase()
  const pathname = url.pathname.toLowerCase()
  const pathSegments = pathname.split('/').filter(Boolean)

  return (
    hostname.startsWith('player.') ||
    hostname.startsWith('embed.') ||
    pathSegments.includes('embed') ||
    pathSegments.includes('iframe') ||
    pathSegments.includes('player') ||
    pathname.includes('/core/video/iframe') ||
    url.searchParams.get('output') === 'embed' ||
    url.searchParams.get('embed') === 'true'
  )
}

function normalizeDeclaredType(type?: string | null) {
  const normalized = cleanString(type)?.toLowerCase()

  if (normalized === 'iframe' || normalized === 'embed') return 'iframe'
  if (normalized === 'video' || normalized === 'file') return 'video'

  return null
}

function normalizeUrlCandidate(value: string | null, options: { declaredType: MatchSummarySourceType | null; isEmbedField: boolean }) {
  const parsed = parseHttpUrl(value)
  if (!parsed) return null

  const youtubeEmbedUrl = buildYouTubeEmbedUrl(parsed.toString())
  if (youtubeEmbedUrl) {
    return {
      type: 'iframe',
      src: youtubeEmbedUrl,
    } satisfies NormalizedVideoUrl
  }

  const vimeoEmbedUrl = normalizeVimeoUrl(parsed)
  if (vimeoEmbedUrl) {
    return {
      type: 'iframe',
      src: vimeoEmbedUrl,
    } satisfies NormalizedVideoUrl
  }

  if (isDirectVideoUrl(parsed)) {
    return {
      type: 'video',
      src: parsed.toString(),
    } satisfies NormalizedVideoUrl
  }

  // HLS needs a dedicated player for broad browser support; the app does not ship one yet.
  if (isUnsupportedHlsUrl(parsed)) {
    return null
  }

  if (options.isEmbedField || isExplicitEmbedUrl(parsed)) {
    return {
      type: 'iframe',
      src: parsed.toString(),
    } satisfies NormalizedVideoUrl
  }

  return null
}

export function normalizeVideoUrl(input: NormalizeVideoUrlInput): NormalizedVideoUrl | null {
  const declaredType = normalizeDeclaredType(input.type)
  const embedCandidate = normalizeUrlCandidate(cleanString(input.embedUrl), {
    declaredType,
    isEmbedField: true,
  })

  if (embedCandidate) return embedCandidate

  return normalizeUrlCandidate(cleanString(input.url), {
    declaredType,
    isEmbedField: false,
  })
}

export function isReproducibleSummarySource(source: MatchSummarySource | null | undefined) {
  return Boolean(source?.src && (source.type === 'iframe' || source.type === 'video'))
}

export function normalizeSummaryCandidate(candidate: MatchSummaryCandidate): MatchSummarySource | null {
  const normalizedUrl = normalizeVideoUrl(candidate)

  if (!normalizedUrl) return null

  return {
    provider: normalizeSummaryProvider(candidate),
    title: cleanString(candidate.title) ?? 'Resumen del partido',
    type: normalizedUrl.type,
    src: normalizedUrl.src,
  }
}

export function dedupeSummarySources(sources: MatchSummarySource[]) {
  const seen = new Set<string>()
  const deduped: MatchSummarySource[] = []

  for (const source of sources) {
    const key = `${source.type}:${source.src}`
    if (seen.has(key)) continue

    seen.add(key)
    deduped.push(source)
  }

  return deduped
}

export function sortSummarySourcesByPriority(sources: MatchSummarySource[]) {
  return [...sources].sort((a, b) => {
    const priorityDifference =
      getSummaryProviderPriority(a.provider) - getSummaryProviderPriority(b.provider)

    if (priorityDifference !== 0) return priorityDifference

    return 0
  })
}

export function pickBestMatchSummary(candidates: MatchSummaryCandidate[]) {
  const sources = candidates
    .map(normalizeSummaryCandidate)
    .filter((source): source is MatchSummarySource => isReproducibleSummarySource(source))

  return dedupeSummarySources(sortSummarySourcesByPriority(sources))[0] ?? null
}

export function getSummaryCandidates(match: MatchSummaryCandidateSource | null | undefined): MatchSummaryCandidate[] {
  if (!match) return []

  const url = cleanString(match.url) ?? cleanString(match.highlightsUrl)
  const title = cleanString(match.title) ?? cleanString(match.highlightsTitle)
  const embedUrl = cleanString(match.embedUrl)

  if (!url && !embedUrl) return []

  return [
    {
      provider: match.provider,
      sourceName: match.sourceName,
      title,
      url,
      embedUrl,
      type: match.type,
      metadata: match.metadata,
    },
  ]
}

export function buildMatchSummary(candidates: MatchSummaryCandidate[]): NormalizedMatchSummary {
  const source = pickBestMatchSummary(candidates)

  if (!source) {
    return {
      available: false,
      provider: null,
      title: null,
      type: null,
      src: null,
      source: null,
    }
  }

  return {
    available: true,
    provider: source.provider,
    title: source.title,
    type: source.type,
    src: source.src,
    source,
  }
}
