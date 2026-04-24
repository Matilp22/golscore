import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { SetAllCookies } from '@supabase/ssr'
import { getSupabasePublicConfig } from '@/lib/supabase/config'

export function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })
  const config = getSupabasePublicConfig()

  if (!config) return response

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  void supabase.auth.getUser()

  return response
}
