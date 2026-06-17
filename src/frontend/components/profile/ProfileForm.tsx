'use client'

import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/frontend/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'
import { normalizeUsername } from '@/shared/utils/usernames'

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { username?: string | null; show_home_predictions?: boolean | null } | null
        error: { message: string; code?: string; details?: string | null } | null
      }>
    }
  }
  upsert: (
    value: { id: string; username: string; show_home_predictions?: boolean },
    options: { onConflict: string }
  ) => Promise<{ error: { message: string; code?: string; details?: string | null } | null }>
}

function profilesQuery() {
  return getSupabaseBrowserClient().from('profiles' as 'leagues') as unknown as ProfileQuery
}

function isMissingHomePredictionPreference(error: { message: string; code?: string } | null) {
  const message = error?.message.toLowerCase() ?? ''

  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    message.includes('show_home_predictions') ||
    message.includes('schema cache')
  )
}

export default function ProfileForm() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showHomePredictions, setShowHomePredictions] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    profilesQuery()
      .select('username, show_home_predictions')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error && isMissingHomePredictionPreference(error)) {
          return profilesQuery()
            .select('username')
            .eq('id', user.id)
            .maybeSingle()
        }

        return { data, error }
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[profile] No se pudo cargar profiles', {
            message: error.message,
            code: error.code ?? null,
            details: error.details ?? null,
          })
          return
        }

        setEmail(user.email ?? '')
        setUsername(
          data?.username ||
            (typeof user.user_metadata?.username === 'string'
              ? user.user_metadata.username
            : '')
        )
        setShowHomePredictions(Boolean(data?.show_home_predictions))
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

      const { error: profileError } = await profilesQuery().upsert(
        {
          id: user.id,
          username: cleanUsername,
          show_home_predictions: showHomePredictions,
        },
        { onConflict: 'id' }
      )

      if (profileError) {
        if (isMissingHomePredictionPreference(profileError)) {
          const retry = await profilesQuery().upsert(
            {
              id: user.id,
              username: cleanUsername,
            },
            { onConflict: 'id' }
          )

          if (!retry.error) {
            setError('Falta aplicar la migraciÃ³n de perfil para guardar esta preferencia.')
            return
          }
        }

        setError(profileError.message)
        return
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

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-white/8 bg-[#111418] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
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

      <section className="rounded-2xl border border-white/8 bg-black/20 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">PronÃ³stico en resultados</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#8d98a7]">
              MostrÃ¡ en el inicio el marcador que guardaste en tu Prode. Solo vos lo ves cuando iniciÃ¡s sesiÃ³n.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={showHomePredictions}
            onClick={() => setShowHomePredictions((current) => !current)}
            className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
              showHomePredictions
                ? 'border-[#70ff9d]/35 bg-[#70ff9d]/15 text-[#7ff0b2]'
                : 'border-white/10 bg-black/30 text-[#c8d0da] hover:border-[#70ff9d]/25 hover:text-white'
            }`}
          >
            {showHomePredictions ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </section>

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
