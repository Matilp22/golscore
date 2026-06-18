import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSafeAuthNextPath } from '@/shared/utils/auth-redirects'

const INVALID_LINK_PATH = '/login?authError=recovery_link_invalid'

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const code = request.nextUrl.searchParams.get('code')
  const rawNextPath = request.nextUrl.searchParams.get('next')

  if (!tokenHash && !code) {
    return redirectTo(request, INVALID_LINK_PATH)
  }

  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return redirectTo(request, INVALID_LINK_PATH)
  }

  if (tokenHash) {
    const nextPath = getSafeAuthNextPath(rawNextPath, '/restablecer-contrasena')

    if (type !== 'recovery') {
      return redirectTo(request, INVALID_LINK_PATH)
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    if (error) {
      console.warn('[auth/callback] No se pudo verificar el token de recuperación', {
        code: error.code ?? null,
        status: error.status ?? null,
      })

      return redirectTo(request, INVALID_LINK_PATH)
    }

    return redirectTo(request, nextPath)
  }

  const nextPath = getSafeAuthNextPath(rawNextPath, '/prode')

  if (!code) {
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
