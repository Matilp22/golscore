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
    <Link href="/login" className="hf-account-submit">
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
  const [showPasswords, setShowPasswords] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true

    try {
      const supabase = getSupabaseBrowserClient()

      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (active) setSessionStatus(data.session ? 'ready' : 'invalid')
        })
        .catch(() => {
          if (active) setSessionStatus('invalid')
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      try {
        const supabase = getSupabaseBrowserClient()
        const { error } = await supabase.auth.updateUser({ password })

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
      } catch {
        setError('No pudimos actualizar la contraseña. Intentá nuevamente.')
      }
    })
  }

  if (sessionStatus === 'checking') {
    return (
      <section className="hf-account-card" aria-live="polite" aria-busy="true">
        <div className="hf-account-card-heading">
          <span className="hf-type-overline">Verificando acceso</span>
          <h1>Un momento</h1>
          <p>Estamos comprobando que el enlace siga vigente.</p>
        </div>
        <div className="hf-account-card-skeleton" aria-hidden="true" />
      </section>
    )
  }

  if (sessionStatus === 'invalid') {
    return (
      <section className="hf-account-card">
        <div className="hf-account-card-heading">
          <span className="hf-type-overline">Enlace vencido</span>
          <h1>Necesitás un enlace nuevo</h1>
          <p>
            Por seguridad, los enlaces de recuperación son temporales. Solicitá otro para
            continuar.
          </p>
        </div>
        <p className="hf-account-notice is-error" role="alert">
          El enlace es inválido o expiró.
        </p>
        <RequestNewLinkButton />
        <p className="hf-account-help">
          Si necesitás ayuda, escribinos a{' '}
          <a href={ACCOUNT_HELP_MAILTO}>{ACCOUNT_EMAIL}</a>.
        </p>
      </section>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hf-account-card hf-account-form-card"
      aria-busy={isPending}
    >
      <div className="hf-account-card-heading">
        <span className="hf-type-overline">Último paso</span>
        <h1>Elegí una contraseña nueva</h1>
        <p>Usá una clave que no repitas en otros servicios.</p>
      </div>

      <div className="hf-account-form">
        <label className="hf-account-field">
          <span>Nueva contraseña</span>
          <input
            type={showPasswords ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={AUTH_PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            required
          />
          <small>Mínimo {AUTH_PASSWORD_MIN_LENGTH} caracteres.</small>
        </label>

        <label className="hf-account-field">
          <span>Repetir contraseña</span>
          <input
            type={showPasswords ? 'text' : 'password'}
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            minLength={AUTH_PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            required
          />
        </label>

        <button
          type="button"
          className="hf-account-show-password"
          aria-pressed={showPasswords}
          onClick={() => setShowPasswords((current) => !current)}
        >
          {showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        </button>
      </div>

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

      <button type="submit" disabled={isPending} className="hf-account-submit">
        {isPending ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>

      <div className="hf-account-help">
        <Link href="/login">Solicitar un nuevo enlace</Link>
        <span aria-hidden="true">·</span>
        <a href={ACCOUNT_HELP_MAILTO}>Pedir ayuda</a>
      </div>
    </form>
  )
}
