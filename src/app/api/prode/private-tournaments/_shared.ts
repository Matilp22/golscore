import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { PrivateTournamentError } from '@/server/prode/private-tournaments'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function getAuthenticatedProdeUser(
  request: Request,
  message = 'Necesitás iniciar sesión para usar torneos privados.'
) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      user: null,
      error: jsonNoStore(
        { ok: false, error: 'Supabase no está configurado.' },
        { status: 500 }
      ),
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return { user, error: null }

  const authorization = request.headers.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim()

    if (token) {
      const {
        data: { user: tokenUser },
      } = await supabase.auth.getUser(token)

      if (tokenUser) return { user: tokenUser, error: null }
    }
  }

  return {
    user: null,
    error: jsonNoStore({ ok: false, error: message }, { status: 401 }),
  }
}

export function privateTournamentErrorResponse(error: unknown, fallback: string) {
  if (error instanceof PrivateTournamentError) {
    return jsonNoStore(
      {
        ok: false,
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    )
  }

  console.error('[prode/private-tournaments] Error completo', error)

  return jsonNoStore(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 }
  )
}
