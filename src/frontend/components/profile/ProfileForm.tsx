'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent } from 'react'

import { useAuth } from '@/frontend/hooks/useAuth'
import { writeAppAudioEnabled } from '@/frontend/hooks/useAppAudioPreference'
import { APP_AUDIO_PREFERENCE } from '@/lib/audio-config'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'
import { validateAuthPassword } from '@/shared/utils/password-policy'
import { validateUsername } from '@/shared/utils/usernames'

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

  const base = await profilesQuery().select('username').eq('id', userId).maybeSingle()

  return {
    data: base.data
      ? { ...base.data, show_home_predictions: null, audio_enabled: null }
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
    { id: value.id, username: value.username },
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
    <section className="hf-profile-setting">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={enabled ? 'is-enabled' : ''}
      >
        <span aria-hidden="true" />
        {enabled ? 'Activado' : 'Desactivado'}
      </button>
    </section>
  )
}

function SignedOutProfileState({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <section className="hf-profile-signed-out">
      <div className="hf-profile-signed-out-mark" aria-hidden="true">
        HF
      </div>
      <div>
        <span className="hf-type-overline">
          {unavailable ? 'Sesión no disponible' : 'Tu cuenta'}
        </span>
        <h2>
          {unavailable
            ? 'No pudimos comprobar tu sesión'
            : 'Iniciá sesión para ver tu perfil'}
        </h2>
        <p>
          {unavailable
            ? 'Podés volver a intentar desde el acceso. Tus favoritos locales siguen guardados en este dispositivo.'
            : 'Editá tus datos y preferencias. Los favoritos locales funcionan incluso sin una cuenta.'}
        </p>
      </div>
      <div className="hf-profile-signed-out-actions">
        <Link href="/login?next=%2Fperfil">Iniciar sesión</Link>
        <Link href="/register?next=%2Fperfil">Crear cuenta</Link>
      </div>
    </section>
  )
}

export default function ProfileForm() {
  const router = useRouter()
  const { user, isLoading, error: authError } = useAuth()
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
  const [loadError, setLoadError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isLoading || !user) return

    let active = true

    queueMicrotask(() => {
      if (!active) return

      setEmail(user.email ?? '')
      setUsername(
        typeof user.user_metadata?.username === 'string'
          ? user.user_metadata.username
          : ''
      )
      setLoadError('')

      loadProfile(user.id)
        .then(({ data, error }) => {
          if (!active) return

          if (error) {
            console.warn('[profile] No se pudo cargar profiles', {
              message: error.message,
              code: error.code ?? null,
              details: error.details ?? null,
            })
            setLoadError('No pudimos cargar todas tus preferencias. Podés editar los datos disponibles.')
            return
          }

          const nextAudioEnabled =
            data?.audio_enabled ?? APP_AUDIO_PREFERENCE.enabledByDefault

          if (data?.username) setUsername(data.username)
          setShowHomePredictions(Boolean(data?.show_home_predictions))
          setAudioEnabled(nextAudioEnabled)
          writeAppAudioEnabled(nextAudioEnabled)
        })
        .catch((caught: unknown) => {
          if (!active) return
          console.warn('[profile] Error cargando perfil', {
            message: caught instanceof Error ? caught.message : 'Error desconocido',
          })
          setLoadError('No pudimos cargar todas tus preferencias. Podés volver a intentarlo.')
        })
    })

    return () => {
      active = false
    }
  }, [isLoading, user])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!user) {
      setError('Necesitás iniciar sesión para editar tu perfil.')
      return
    }

    const usernameValidation = validateUsername(username)
    const cleanEmail = email.trim()

    if (usernameValidation.error) {
      setError(usernameValidation.error)
      return
    }

    if (!cleanEmail.includes('@')) {
      setError('Ingresá un email válido.')
      return
    }

    if (password || repeatPassword) {
      const passwordError = validateAuthPassword(password, repeatPassword)

      if (passwordError) {
        setError(passwordError)
        return
      }
    }

    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const notices: string[] = []
        const cleanUsername = usernameValidation.username
        const profileResult = await saveProfile({
          id: user.id,
          username: cleanUsername,
          show_home_predictions: showHomePredictions,
          audio_enabled: audioEnabled,
        })

        if (profileResult.error) {
          setError('No pudimos guardar el perfil. Intentá nuevamente.')
          return
        }

        if (profileResult.missingHomePredictionPreference) {
          notices.push('La preferencia del Prode todavía no está disponible en esta cuenta.')
        }

        if (profileResult.missingAudioPreference) {
          notices.push('La preferencia de audio queda guardada solo en este dispositivo.')
        } else {
          writeAppAudioEnabled(audioEnabled)
        }

        const metadataResult = await supabase.auth.updateUser({
          data: { username: cleanUsername },
        })

        if (metadataResult.error) {
          console.warn('[profile] No se pudo actualizar metadata de username', {
            message: metadataResult.error.message,
            code: metadataResult.error.code ?? null,
          })
        }

        if (cleanEmail && cleanEmail !== user.email) {
          const { error: emailError } = await supabase.auth.updateUser({
            email: cleanEmail,
          })

          if (emailError) {
            setError('No pudimos actualizar el email.')
            return
          }

          notices.push('Revisá tu correo para confirmar el cambio de email.')
        }

        if (password) {
          const { error: passwordError } = await supabase.auth.updateUser({ password })

          if (passwordError) {
            setError('No pudimos actualizar la contraseña.')
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
      } catch {
        setError('No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.')
      }
    })
  }

  if (isLoading) {
    return (
      <div className="hf-profile-loading" aria-live="polite" aria-busy="true">
        <span />
        <span />
        <span />
        <p>Cargando tu perfil…</p>
      </div>
    )
  }

  if (!user) return <SignedOutProfileState unavailable={Boolean(authError)} />

  const tabs: Array<{ id: ProfileTab; label: string; description: string }> = [
    { id: 'account', label: 'Mi cuenta', description: 'Usuario y acceso' },
    { id: 'settings', label: 'Preferencias', description: 'Cómo se siente la app' },
  ]

  return (
    <form onSubmit={handleSubmit} className="hf-profile-card" aria-busy={isPending}>
      <div className="hf-profile-tabs" role="tablist" aria-label="Secciones del perfil">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id

          return (
            <button
              key={tab.id}
              id={`profile-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`profile-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const nextTab = tab.id === 'account' ? 'settings' : 'account'
                setActiveTab(nextTab)
                window.requestAnimationFrame(() => {
                  document.getElementById(`profile-tab-${nextTab}`)?.focus()
                })
              }}
              className={selected ? 'is-active' : ''}
            >
              <strong>{tab.label}</strong>
              <small>{tab.description}</small>
            </button>
          )
        })}
      </div>

      {loadError ? (
        <p className="hf-account-notice" role="status">
          {loadError}
        </p>
      ) : null}

      {activeTab === 'account' ? (
        <section
          id="profile-panel-account"
          role="tabpanel"
          aria-labelledby="profile-tab-account"
          className="hf-profile-panel"
        >
          <div className="hf-profile-section-heading">
            <span className="hf-type-overline">Identidad</span>
            <h2>Cómo aparecés en Hay Fulbo</h2>
            <p>El cambio de email puede requerir una confirmación por correo.</p>
          </div>
          <div className="hf-profile-fields">
            <label className="hf-account-field">
              <span>Nombre de usuario</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={40}
              />
            </label>

            <label className="hf-account-field">
              <span>Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="hf-account-field">
              <span>Nueva contraseña</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Dejala vacía para no cambiarla"
              />
            </label>

            <label className="hf-account-field">
              <span>Repetir nueva contraseña</span>
              <input
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Repetí la nueva contraseña"
              />
            </label>
          </div>
        </section>
      ) : (
        <section
          id="profile-panel-settings"
          role="tabpanel"
          aria-labelledby="profile-tab-settings"
          className="hf-profile-panel"
        >
          <div className="hf-profile-section-heading">
            <span className="hf-type-overline">Preferencias</span>
            <h2>Tu manera de vivir los partidos</h2>
            <p>Los cambios se aplican al guardar. Las opciones disponibles dependen del perfil actual.</p>
          </div>
          <div className="hf-profile-settings">
            <SettingToggle
              title="Pronóstico en resultados"
              description="Mostrá en el inicio el marcador que guardaste en tu Prode. Solo vos lo ves con la sesión iniciada."
              enabled={showHomePredictions}
              onChange={setShowHomePredictions}
            />
            <SettingToggle
              title="Sonidos de la app"
              description="Activá o desactivá los audios de Hay Fulbo, incluido el ambiente de la Copa del Mundo."
              enabled={audioEnabled}
              onChange={setAudioEnabled}
            />
          </div>
        </section>
      )}

      {error ? (
        <p className="hf-account-notice is-error" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="hf-account-notice is-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="hf-profile-actions">
        <small>Tu sesión sigue activa después de guardar.</small>
        <button type="submit" disabled={isPending} className="hf-account-submit">
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
