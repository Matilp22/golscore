import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { APP_AUDIO_PREFERENCE } from '@/lib/audio-config'

type ProfileAudioPreferenceRow = {
  audio_enabled?: boolean | null
}

type SupabaseError = {
  code?: string
  message?: string
}

function isMissingAudioPreference(error: SupabaseError | null | undefined) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('audio_enabled') ||
    message.includes('schema cache')
  )
}

export async function getCurrentUserAudioEnabled() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return false

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  try {
    const { data, error } = await getSupabaseAdminClient()
      .from('profiles')
      .select('audio_enabled')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      if (isMissingAudioPreference(error)) return false
      throw error
    }

    return (data as ProfileAudioPreferenceRow | null)?.audio_enabled ??
      APP_AUDIO_PREFERENCE.enabledByDefault
  } catch (error) {
    console.error('[profile-audio] No se pudo cargar la preferencia de audio', {
      error: error instanceof Error ? error.message : String(error),
    })

    return false
  }
}
