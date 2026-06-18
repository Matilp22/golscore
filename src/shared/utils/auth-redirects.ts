const DEFAULT_AUTH_NEXT_PATH = '/'
const AUTH_REDIRECT_BASE = 'https://hayfulbo.local'

function getOrigin() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_SITE_URL || 'https://hayfulbo.com'
}

export function getSafeAuthNextPath(
  nextPath: string | null | undefined,
  fallback = DEFAULT_AUTH_NEXT_PATH
) {
  const cleanFallback = fallback.startsWith('/') && !fallback.startsWith('//')
    ? fallback
    : DEFAULT_AUTH_NEXT_PATH
  const cleanNextPath = nextPath?.trim()

  if (!cleanNextPath) return cleanFallback
  if (!cleanNextPath.startsWith('/') || cleanNextPath.startsWith('//')) {
    return cleanFallback
  }

  try {
    const parsed = new URL(cleanNextPath, AUTH_REDIRECT_BASE)

    if (parsed.origin !== AUTH_REDIRECT_BASE) return cleanFallback

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return cleanFallback
  }
}

export function getAuthCallbackUrl(nextPath: string | null | undefined) {
  const callbackUrl = new URL('/auth/callback', getOrigin())
  callbackUrl.searchParams.set('next', getSafeAuthNextPath(nextPath))

  return callbackUrl.toString()
}
