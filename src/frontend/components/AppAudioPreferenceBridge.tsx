'use client'

import { useEffect } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import { writeAppAudioEnabled } from '@/frontend/hooks/useAppAudioPreference'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'
import { APP_AUDIO_PREFERENCE } from '@/lib/audio-config'

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { audio_enabled?: boolean | null } | null
        error: { message: string; code?: string; details?: string | null } | null
      }>
    }
  }
}

function profilesQuery() {
  return getSupabaseBrowserClient().from('profiles' as 'leagues') as unknown as ProfileQuery
}

function isMissingAudioPreference(error: { message: string; code?: string } | null) {
  const message = error?.message.toLowerCase() ?? ''

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('audio_enabled') ||
    message.includes('schema cache')
  )
}

export default function AppAudioPreferenceBridge() {
  const { user, isLoading } = useAuth()

  useEffect(() => {
    let active = true

    if (isLoading) {
      return () => {
        active = false
      }
    }

    if (!user) {
      writeAppAudioEnabled(false)
      return () => {
        active = false
      }
    }

    profilesQuery()
      .select('audio_enabled')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          if (!isMissingAudioPreference(error)) {
            console.warn('[audio-preference] No se pudo cargar profiles.audio_enabled', {
              message: error.message,
              code: error.code ?? null,
              details: error.details ?? null,
            })
          }

          writeAppAudioEnabled(false)
          return
        }

        writeAppAudioEnabled(
          data?.audio_enabled ?? APP_AUDIO_PREFERENCE.enabledByDefault
        )
      })
      .catch((error: unknown) => {
        if (!active) return

        console.warn('[audio-preference] Error cargando preferencia de audio', {
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
        writeAppAudioEnabled(false)
      })

    return () => {
      active = false
    }
  }, [isLoading, user])

  return null
}
