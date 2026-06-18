'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'
import { translateAuthError } from '@/shared/utils/auth-errors'
import {
  AUTH_PASSWORD_MIN_LENGTH,
  validateAuthPassword,
} from '@/shared/utils/password-policy'

const ACCOUNT_EMAIL = 'cuentas@hayfulbo.com'
const ACCOUNT_HELP_MAILTO =
  'mailto:cuentas@hayfulbo.com?subject=Ayuda%20con%20mi%20cuenta%20de%20Hay%20Fulbo'

type SessionStatus = 'checking' | 'ready' | 'invalid'

function RequestNewLinkButton() {
  return (
    <Link
      href="/login"
      className="hf-button inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black"
    >
      Solicitar un nuevo enlace
    </Link>
  )
}

export default function ResetPasswordForm() {
  const router = useRouter()
  const redirectTimer = useRef<number | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true

    try {
      const supabase = getSupabaseBrowserClient()

      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return
          setSessionStatus(data.session ? 'ready' : 'invalid')
        })
        .catch(() => {
          if (!active) return
          setSessionStatus('invalid')
        })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return

        if (event === 'PASSWORD_RECOVERY' || session) {
          setSessionStatus(session ? 'ready' : 'invalid')
        }
      })

      return () => {
        active = false
        subscription.unsubscribe()
        if (redirectTimer.current) window.clearTimeout(redirectTimer.current)
      }
    } catch {
      queueMicrotask(() => {
        if (active) setSessionStatus('invalid')
      })

      return () => {
        active = false
        if (redirectTimer.current) window.clearTimeout(redirectTimer.current)
      }
    }
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (sessionStatus !== 'ready') {
      setError('El enlace es inválido o expiró.')
      return
    }

    const passwordError = validateAuthPassword(password, repeatPassword)

    if (passwordError) {
      setError(passwordError)
      return
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        setError(translateAuthError(error, 'passwordRecovery'))
        return
      }

      setPassword('')
      setRepeatPassword('')
      setMessage('Contraseña actualizada correctamente.')

      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        console.warn('[auth/reset-password] No se pudo cerrar la sesión de recuperación', {
          code: signOutError.code ?? null,
          status: signOutError.status ?? null,
        })
      }

      redirectTimer.current = window.setTimeout(() => {
        router.replace('/login?passwordUpdated=1')
        router.refresh()
      }, 700)
    })
  }

  if (sessionStatus === 'checking') {
    return (
      <div className="hf-card rounded-3xl p-5 text-sm text-[#8d98a7]">
        Verificando enlace...
      </div>
    )
  }

  if (sessionStatus === 'invalid') {
    return (
      <section className="hf-card rounded-3xl p-5">
        <h1 className="text-2xl font-black text-white">Restablecer contraseña</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#c8d0da]">
          El enlace es inválido o expiró.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#8d98a7]">
          Solicitá un nuevo enlace. Si necesitás ayuda, escribinos a{' '}
          <a className="font-bold text-[#7ff0b2]" href={ACCOUNT_HELP_MAILTO}>
            {ACCOUNT_EMAIL}
          </a>
          .
        </p>
        <div className="mt-5">
          <RequestNewLinkButton />
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="hf-card rounded-3xl p-5">
      <h1 className="text-2xl font-black text-white">Restablecer contraseña</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#8d98a7]">
        Ingresá una nueva contraseña para tu cuenta de Hay Fulbo.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[#c8d0da]">Nueva contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={AUTH_PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="hf-input h-11 w-full rounded-xl px-3 text-sm outline-none transition"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[#c8d0da]">Repetir contraseña</span>
          <input
            type="password"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            minLength={AUTH_PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="hf-input h-11 w-full rounded-xl px-3 text-sm outline-none transition"
            required
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-[#653131] bg-[#35141a] px-3 py-2 text-sm text-[#ffd5d5]">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-xl border border-[#25553d] bg-[#13251d] px-3 py-2 text-sm text-[#7ff0b2]">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="hf-button mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? 'Guardando...' : 'Guardar nueva contraseña'}
      </button>

      <div className="mt-4 flex flex-col gap-2 text-sm text-[#8d98a7]">
        <Link className="font-bold text-[#7ff0b2] hover:text-white" href="/login">
          Solicitar un nuevo enlace
        </Link>
        <p>
          ¿Necesitás ayuda?{' '}
          <a className="font-bold text-[#7ff0b2] hover:text-white" href={ACCOUNT_HELP_MAILTO}>
            {ACCOUNT_EMAIL}
          </a>
        </p>
      </div>
    </form>
  )
}
