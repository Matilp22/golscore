import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const CANONICAL_HOST = 'hayfulbo.com'

const REDIRECT_HOSTS = new Set([
  'www.hayfulbo.com',
  'hayfulbo.com.ar',
  'www.hayfulbo.com.ar',
  'golscore.vercel.app',
  'golscore-matilp22s-projects.vercel.app',
  'golscore-matilp22-matilp22s-projects.vercel.app',
])

const PUBLIC_FILE_PATTERN = /\/[^/]+\.[^/]+$/

function shouldRedirectToCanonicalHost(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()

  if (!host || !REDIRECT_HOSTS.has(host)) return false

  const { pathname } = request.nextUrl

  return (
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/') &&
    !PUBLIC_FILE_PATTERN.test(pathname)
  )
}

export function proxy(request: NextRequest) {
  if (shouldRedirectToCanonicalHost(request)) {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    url.host = CANONICAL_HOST

    return NextResponse.redirect(url, 308)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
