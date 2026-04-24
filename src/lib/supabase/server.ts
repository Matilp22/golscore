import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SetAllCookies } from '@supabase/ssr'
import { getSupabasePublicConfig } from '@/lib/supabase/config'

export async function getSupabaseServerClient() {
  const config = getSupabasePublicConfig()
  if (!config) return null

  const cookieStore = await cookies()

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // El layout server no siempre puede mutar cookies.
          }
        },
      },
    }
  )
}
