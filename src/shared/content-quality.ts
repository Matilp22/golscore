export type PublicPageKind =
  | 'home'
  | 'section'
  | 'competition'
  | 'news'
  | 'transfers'
  | 'article'
  | 'trust'
  | 'legal'
  | 'auth'
  | 'admin'
  | 'profile'
  | 'chat'
  | 'match'
  | 'team'
  | 'player'
  | 'prode'
  | 'unknown'

export type PublicPageContentSignals = {
  editorialWordCount?: number
  sportsDataItems?: number
  hasMetadata?: boolean
  hasPrimaryData?: boolean
  placeholderOnly?: boolean
}

export type PublicPageIndexabilityInput = {
  path: string
  kind?: PublicPageKind
  content?: PublicPageContentSignals
}

export type PublicPageIndexability = {
  index: boolean
  follow: true
  reason: string
  contentScore: number
  isThin: boolean
}

export const TRUST_PAGE_PATHS = [
  '/quienes-somos',
  '/politica-editorial',
  '/fuentes-y-metodologia',
  '/contacto',
  '/privacidad',
  '/terminos',
  '/cookies',
] as const

export const LEGACY_TRUST_ROUTE_REDIRECTS = [
  { from: '/contact', to: '/contacto' },
  { from: '/privacy-policy', to: '/privacidad' },
  { from: '/terms', to: '/terminos' },
] as const

const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/perfil',
  '/restablecer-contrasena',
] as const

const HARD_NOINDEX_PREFIXES = [
  '/admin',
  '/api',
  '/sentry-example-page',
  '/sentry-test',
] as const

const MANUAL_AD_BLOCKED_PREFIXES = [
  '/admin',
  '/login',
  '/register',
  '/perfil',
  '/restablecer-contrasena',
  '/mercado-de-pases',
] as const

const DEFAULT_AD_ALLOWED_COMPETITION_PATHS = new Set([
  '/liga/selecciones-mundial',
  '/liga/internacional-libertadores',
  '/liga/internacional-champions',
  '/liga/argentina-liga-profesional',
])

const ARTICLE_MIN_WORDS = 180
const EDITORIAL_INDEX_MIN_WORDS = 180
const TRUST_PAGE_MIN_WORDS = 120
const COMPETITION_EDITORIAL_MIN_WORDS = 120
const MATCH_COMPLETE_SCORE = 60
const TEAM_COMPLETE_SCORE = 45

export function normalizePublicPath(path: string) {
  const withoutOrigin = path.replace(/^https?:\/\/[^/]+/i, '')
  const withoutHash = withoutOrigin.split('#')[0] ?? '/'
  const withoutQuery = withoutHash.split('?')[0] ?? '/'
  const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`

  return normalized.replace(/\/+$/, '') || '/'
}

function startsWithRoute(path: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function getRouteKind(path: string): PublicPageKind {
  const route = normalizePublicPath(path)

  if (startsWithRoute(route, ['/admin'])) return 'admin'
  if (startsWithRoute(route, AUTH_ROUTE_PREFIXES)) {
    return route === '/perfil' || route.startsWith('/perfil/') ? 'profile' : 'auth'
  }
  if (route.includes('/chat')) return 'chat'
  if (route === '/') return 'home'
  if (route === '/noticias' || route.startsWith('/noticias/')) return 'news'
  if (route === '/mercado-de-pases' || route.startsWith('/mercado-de-pases/')) {
    return 'transfers'
  }
  if (route === '/analisis' || route.startsWith('/analisis/')) return 'article'
  if (TRUST_PAGE_PATHS.includes(route as (typeof TRUST_PAGE_PATHS)[number])) return 'trust'
  if (route.startsWith('/seccion/')) return 'section'
  if (route.startsWith('/liga/')) return 'competition'
  if (route.startsWith('/partido/')) return 'match'
  if (route.startsWith('/equipo/')) return 'team'
  if (route.startsWith('/jugador/')) return 'player'
  if (route.startsWith('/prode')) return 'prode'

  return 'unknown'
}

function scoreContent(kind: PublicPageKind, content: PublicPageContentSignals) {
  const editorialWords = content.editorialWordCount ?? 0
  const sportsItems = content.sportsDataItems ?? 0
  let score = 0

  if (content.hasMetadata) score += 10
  if (content.hasPrimaryData) score += 20
  score += Math.min(editorialWords, 260) / 4
  score += Math.min(sportsItems, 80)

  if (kind === 'trust') score += 35
  if (kind === 'home') score += 45
  if (kind === 'prode') score += 30

  return Math.round(score)
}

export function getPublicPageIndexability({
  path,
  kind: explicitKind,
  content = {},
}: PublicPageIndexabilityInput): PublicPageIndexability {
  const route = normalizePublicPath(path)
  const kind = explicitKind ?? getRouteKind(route)
  const contentScore = scoreContent(kind, content)

  if (startsWithRoute(route, HARD_NOINDEX_PREFIXES)) {
    return {
      index: false,
      follow: true,
      reason: 'administrative-or-technical-route',
      contentScore,
      isThin: true,
    }
  }

  if (kind === 'auth' || kind === 'profile' || kind === 'chat') {
    return {
      index: false,
      follow: true,
      reason: 'account-or-private-workflow',
      contentScore,
      isThin: true,
    }
  }

  if (content.placeholderOnly) {
    return {
      index: false,
      follow: true,
      reason: 'placeholder-only-content',
      contentScore,
      isThin: true,
    }
  }

  if (kind === 'section') {
    return {
      index: false,
      follow: true,
      reason: 'navigation-only-section',
      contentScore,
      isThin: true,
    }
  }

  if (kind === 'article') {
    const index = (content.editorialWordCount ?? 0) >= ARTICLE_MIN_WORDS && content.hasMetadata !== false

    return {
      index,
      follow: true,
      reason: index ? 'article-has-editorial-body' : 'article-missing-editorial-depth',
      contentScore,
      isThin: !index,
    }
  }

  if (kind === 'news' || kind === 'transfers') {
    if (kind === 'transfers' && route === '/mercado-de-pases') {
      const hasTransferMovements = (content.sportsDataItems ?? 0) > 0
      const hasEditorialDepth = (content.editorialWordCount ?? 0) >= EDITORIAL_INDEX_MIN_WORDS
      const index = hasTransferMovements && hasEditorialDepth && content.hasMetadata !== false

      return {
        index,
        follow: true,
        reason: index ? 'transfer-market-has-real-movements' : 'transfer-market-without-real-movements',
        contentScore,
        isThin: !index,
      }
    }

    const index =
      (content.editorialWordCount ?? 0) >= EDITORIAL_INDEX_MIN_WORDS &&
      content.hasMetadata !== false

    return {
      index,
      follow: true,
      reason: index ? 'editorial-section-has-content' : 'editorial-section-without-content',
      contentScore,
      isThin: !index,
    }
  }

  if (kind === 'trust' || kind === 'legal') {
    const index = (content.editorialWordCount ?? TRUST_PAGE_MIN_WORDS) >= TRUST_PAGE_MIN_WORDS

    return {
      index,
      follow: true,
      reason: index ? 'trust-page' : 'trust-page-too-short',
      contentScore,
      isThin: !index,
    }
  }

  if (kind === 'competition') {
    const hasSportsData = (content.sportsDataItems ?? 0) > 0
    const hasEditorialIntro = (content.editorialWordCount ?? 0) >= COMPETITION_EDITORIAL_MIN_WORDS
    const index = hasSportsData || hasEditorialIntro

    return {
      index,
      follow: true,
      reason: index ? 'competition-has-data-or-editorial-context' : 'competition-without-data-or-editorial-context',
      contentScore,
      isThin: !index,
    }
  }

  if (kind === 'match') {
    const index = contentScore >= MATCH_COMPLETE_SCORE

    return {
      index,
      follow: true,
      reason: index ? 'match-has-enough-detail' : 'match-without-enough-detail',
      contentScore,
      isThin: !index,
    }
  }

  if (kind === 'team' || kind === 'player') {
    const index = contentScore >= TEAM_COMPLETE_SCORE

    return {
      index,
      follow: true,
      reason: index ? 'profile-has-enough-detail' : 'profile-without-enough-detail',
      contentScore,
      isThin: !index,
    }
  }

  return {
    index: true,
    follow: true,
    reason: 'default-indexable-route',
    contentScore,
    isThin: false,
  }
}

export function shouldAllowAdsOnRoute(
  path: string,
  options: {
    indexable?: boolean
    hasSufficientContent?: boolean
  } = {}
) {
  const route = normalizePublicPath(path)
  const kind = getRouteKind(route)

  if (startsWithRoute(route, MANUAL_AD_BLOCKED_PREFIXES)) {
    return false
  }

  if (
    kind === 'admin' ||
    kind === 'auth' ||
    kind === 'profile' ||
    kind === 'chat' ||
    kind === 'section'
  ) {
    return false
  }

  if (
    kind === 'competition' &&
    !DEFAULT_AD_ALLOWED_COMPETITION_PATHS.has(route) &&
    options.hasSufficientContent !== true
  ) {
    return false
  }

  if (kind === 'transfers' && options.hasSufficientContent !== true) {
    return false
  }

  if (
    (kind === 'match' || kind === 'team' || kind === 'player') &&
    options.hasSufficientContent !== true
  ) {
    return false
  }

  if (options.indexable === false || options.hasSufficientContent === false) {
    return false
  }

  return true
}

export function hasPlaceholderLanguage(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const normalizedWords = countWords(normalized)

  if (/\b(lorem ipsum|placeholder)\b/.test(normalized)) return true
  if (normalizedWords > 80) return false

  return /\b(pendiente|no disponible|sin datos disponibles|tabla vacia|fixture vacio)\b/.test(
    normalized
  )
}

export function countWords(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.trim().length > 1).length
}
