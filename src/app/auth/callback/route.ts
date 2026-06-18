import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSafeAuthNextPath } from '@/shared/utils/auth-redirects'

const INVALID_LINK_PATH = '/login?authError=recovery_link_invalid'

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const nextPath = getSafeAuthNextPath(
    request.nextUrl.searchParams.get('next'),
    '/prode'
  )

  if (!code) {
    return redirectTo(request, INVALID_LINK_PATH)
  }

  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return redirectTo(request, INVALID_LINK_PATH)
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.warn('[auth/callback] No se pudo intercambiar el code de Supabase', {
      code: error.code ?? null,
      status: error.status ?? null,
    })

    return redirectTo(request, INVALID_LINK_PATH)
  }

  return redirectTo(request, nextPath)
}
