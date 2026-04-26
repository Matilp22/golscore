'use client'

import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/frontend/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'

function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { username?: string | null } | null
        error: { message: string; code?: string; details?: string | null } | null
      }>
    }
  }
  upsert: (
    value: { id: string; username: string },
    options: { onConflict: string }
  ) => Promise<{ error: { message: string; code?: string; details?: string | null } | null }>
}

function profilesQuery() {
  return getSupabaseBrowserClient().from('profiles' as 'leagues') as unknown as ProfileQuery
}

export default function ProfileForm() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
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
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
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
        },
        { onConflict: 'id' }
      )

      if (profileError) {
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
