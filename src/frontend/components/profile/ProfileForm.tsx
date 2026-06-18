'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/frontend/hooks/useAuth'
import { writeAppAudioEnabled } from '@/frontend/hooks/useAppAudioPreference'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'
import { APP_AUDIO_PREFERENCE } from '@/lib/audio-config'
import { normalizeUsername } from '@/shared/utils/usernames'

type ProfileError = {
  message: string
  code?: string
  details?: string | null
}

type ProfileRow = {
  username?: string | null
  show_home_predictions?: boolean | null
  audio_enabled?: boolean | null
}

type ProfileUpsert = {
  id: string
  username: string
  show_home_predictions?: boolean
  audio_enabled?: boolean
}

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: ProfileRow | null
        error: ProfileError | null
      }>
    }
  }
  upsert: (
    value: ProfileUpsert,
    options: { onConflict: string }
  ) => Promise<{ error: ProfileError | null }>
}

type ProfileTab = 'account' | 'settings'

function profilesQuery() {
  return getSupabaseBrowserClient().from('profiles' as 'leagues') as unknown as ProfileQuery
}

function isMissingOptionalProfilePreference(error: ProfileError | null) {
  const message = error?.message.toLowerCase() ?? ''

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('show_home_predictions') ||
    message.includes('audio_enabled') ||
    message.includes('schema cache')
  )
}

async function loadProfile(userId: string) {
  const full = await profilesQuery()
    .select('username, show_home_predictions, audio_enabled')
    .eq('id', userId)
    .maybeSingle()

  if (!full.error || !isMissingOptionalProfilePreference(full.error)) return full

  const withoutAudio = await profilesQuery()
    .select('username, show_home_predictions')
    .eq('id', userId)
    .maybeSingle()

  if (!withoutAudio.error || !isMissingOptionalProfilePreference(withoutAudio.error)) {
    return {
      data: withoutAudio.data ? { ...withoutAudio.data, audio_enabled: null } : null,
      error: withoutAudio.error,
    }
  }

  const base = await profilesQuery()
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  return {
    data: base.data
      ? {
          ...base.data,
          show_home_predictions: null,
          audio_enabled: null,
        }
      : null,
    error: base.error,
  }
}

async function saveProfile(value: ProfileUpsert) {
  const full = await profilesQuery().upsert(value, { onConflict: 'id' })

  if (!full.error || !isMissingOptionalProfilePreference(full.error)) {
    return {
      error: full.error,
      missingAudioPreference: false,
      missingHomePredictionPreference: false,
    }
  }

  const withoutAudio = await profilesQuery().upsert(
    {
      id: value.id,
      username: value.username,
      show_home_predictions: value.show_home_predictions,
    },
    { onConflict: 'id' }
  )

  if (!withoutAudio.error || !isMissingOptionalProfilePreference(withoutAudio.error)) {
    return {
      error: withoutAudio.error,
      missingAudioPreference: !withoutAudio.error,
      missingHomePredictionPreference: false,
    }
  }

  const base = await profilesQuery().upsert(
    {
      id: value.id,
      username: value.username,
    },
    { onConflict: 'id' }
  )

  return {
    error: base.error,
    missingAudioPreference: !base.error,
    missingHomePredictionPreference: !base.error,
  }
}

function SettingToggle({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string
  description: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-black/20 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#8d98a7]">
            {description}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => onChange(!enabled)}
          className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
            enabled
              ? 'border-[#70ff9d]/35 bg-[#70ff9d]/15 text-[#7ff0b2]'
              : 'border-white/10 bg-black/30 text-[#c8d0da] hover:border-[#70ff9d]/25 hover:text-white'
          }`}
        >
          {enabled ? 'Activado' : 'Desactivado'}
        </button>
      </div>
    </section>
  )
}

function SignedOutProfileState() {
  return (
    <section className="rounded-3xl border border-white/8 bg-[#111418] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-6">
      <div className="rounded-2xl border border-[#70ff9d]/15 bg-[#0b1412]/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#70ff9d]">
          Mi cuenta
        </p>
        <h2 className="mt-2 text-xl font-black text-white">
          Iniciá sesión para ver tu perfil
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#9aa7b5]">
          Desde acá podés editar tu usuario, email, contraseña y preferencias de la app.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href="/login?next=%2Fperfil"
            className="hf-button inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register?next=%2Fperfil"
            className="hf-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-[#c8d0da]"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function ProfileForm() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>('account')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showHomePredictions, setShowHomePredictions] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState<boolean>(
    APP_AUDIO_PREFERENCE.enabledByDefault
  )
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      return
    }

    loadProfile(user.id)
      .then(({ data, error }) => {
        if (error) {
          console.warn('[profile] No se pudo cargar profiles', {
            message: error.message,
            code: error.code ?? null,
            details: error.details ?? null,
          })
          return
        }

        const nextAudioEnabled =
          data?.audio_enabled ?? APP_AUDIO_PREFERENCE.enabledByDefault

        setEmail(user.email ?? '')
        setUsername(
          data?.username ||
            (typeof user.user_metadata?.username === 'string'
              ? user.user_metadata.username
              : '')
        )
        setShowHomePredictions(Boolean(data?.show_home_predictions))
        setAudioEnabled(nextAudioEnabled)
        writeAppAudioEnabled(nextAudioEnabled)
      })
      .catch((error: unknown) => {
        console.warn('[profile] Error cargando perfil', {
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
      })
  }, [isLoading, router, user])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!user) {
      setError('Necesitás iniciar sesión para editar tu perfil.')
      return
    }

    const cleanUsername = normalizeUsername(username)
    const cleanEmail = email.trim()

    if (cleanUsername.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.')
      return
    }

    if (!cleanEmail.includes('@')) {
      setError('Ingresá un email válido.')
      return
    }

    if (password || repeatPassword) {
      if (password.length < 6) {
        setError('La nueva contraseña debe tener al menos 6 caracteres.')
        return
      }

      if (password !== repeatPassword) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient()
      const notices: string[] = []

      const profileResult = await saveProfile({
        id: user.id,
        username: cleanUsername,
        show_home_predictions: showHomePredictions,
        audio_enabled: audioEnabled,
      })

      if (profileResult.error) {
        setError(profileResult.error.message)
        return
      }

      if (profileResult.missingHomePredictionPreference) {
        notices.push('Falta aplicar la migración del Prode para guardar esa preferencia.')
      }

      if (profileResult.missingAudioPreference) {
        notices.push('Falta aplicar la migración de audio para guardar esa preferencia.')
      } else {
        writeAppAudioEnabled(audioEnabled)
      }

      const metadataResult = await supabase.auth.updateUser({
        data: {
          username: cleanUsername,
        },
      })

      if (metadataResult.error) {
        console.warn('[profile] No se pudo actualizar metadata de username', {
          message: metadataResult.error.message,
          code: metadataResult.error.code ?? null,
        })
      }

      if (cleanEmail && cleanEmail !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: cleanEmail })

        if (emailError) {
          setError(emailError.message)
          return
        }

        notices.push('Revisá tu correo para confirmar el cambio de email si Supabase lo solicita.')
      }

      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password })

        if (passwordError) {
          setError(passwordError.message)
          return
        }
      }

      setPassword('')
      setRepeatPassword('')
      setMessage(
        notices.length
          ? `Perfil actualizado. ${notices.join(' ')}`
          : 'Perfil actualizado correctamente.'
      )
      router.refresh()
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/8 bg-[#111418] p-5 text-sm text-[#8d98a7]">
        Cargando perfil...
      </div>
    )
  }

  if (!user) {
    return <SignedOutProfileState />
  }

  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: 'account', label: 'Mi cuenta' },
    { id: 'settings', label: 'Configuración' },
  ]

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-white/8 bg-[#111418] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-6"
    >
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-black/20 p-1"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 rounded-xl px-3 text-sm font-black transition ${
                selected
                  ? 'bg-[#70ff9d] text-[#07100d] shadow-[0_0_24px_rgba(112,255,157,0.18)]'
                  : 'text-[#c8d0da] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'account' ? (
        <div role="tabpanel" className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-[#c8d0da]">Nombre de usuario</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-[#7ff0b2]"
              autoComplete="username"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-[#c8d0da]">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-[#7ff0b2]"
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-[#c8d0da]">Nueva contraseña</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-[#7ff0b2]"
              type="password"
              autoComplete="new-password"
              placeholder="Opcional"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-[#c8d0da]">Repetir nueva contraseña</span>
            <input
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-[#7ff0b2]"
              type="password"
              autoComplete="new-password"
              placeholder="Opcional"
            />
          </label>
        </div>
      ) : (
        <div role="tabpanel" className="space-y-3">
          <SettingToggle
            title="Pronóstico en resultados"
            description="Mostrá en el inicio el marcador que guardaste en tu Prode. Solo vos lo ves cuando iniciás sesión."
            enabled={showHomePredictions}
            onChange={setShowHomePredictions}
          />

          <SettingToggle
            title="Sonidos de la app"
            description="Activá o desactivá todos los audios de Hay Fulbo, incluido el fondo de la Copa del Mundo."
            enabled={audioEnabled}
            onChange={setAudioEnabled}
          />
        </div>
      )}

      {error ? (
        <p className="rounded-xl border border-[#653131] bg-[#35141a] px-3 py-2 text-sm text-[#ffd5d5]">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-[#25553d] bg-[#13251d] px-3 py-2 text-sm text-[#7ff0b2]">
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-11 rounded-xl border border-[#25553d] bg-[#163828] px-5 text-sm font-bold text-[#7ff0b2] transition hover:bg-[#1b4330] disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
