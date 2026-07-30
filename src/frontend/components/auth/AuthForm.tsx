'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'

import {
  getSupabaseBrowserClient,
  sendPasswordRecoveryEmail,
  signInWithEmail,
  signUpWithEmail,
  upsertUserProfile,
} from '@/lib/supabase/supabaseClient'
import {
  getAuthCallbackBaseUrl,
  getAuthCallbackUrl,
  getSafeAuthNextPath,
} from '@/shared/utils/auth-redirects'
import { translateAuthError } from '@/shared/utils/auth-errors'
import {
  AUTH_PASSWORD_MIN_LENGTH,
  validateAuthPassword,
} from '@/shared/utils/password-policy'
import { validateUsername } from '@/shared/utils/usernames'

type AuthFormProps = {
  mode: 'login' | 'register'
  defaultNext?: string
  loginDescription?: string
  showModeSwitch?: boolean
}

type NoticeTone = 'info' | 'error' | 'success'

function getLoginStatusMessage(searchParams: { get: (name: string) => string | null }) {
  if (searchParams.get('passwordUpdated') === '1') {
    return 'Tu contraseña fue actualizada. Ya podés iniciar sesión.'
  }

  if (searchParams.get('authError') === 'recovery_link_invalid') {
    return 'El enlace es inválido o expiró. Solicitá uno nuevo para restablecer tu contraseña.'
  }

  return ''
}

function getServiceErrorMessage(error: unknown) {
  console.warn('[auth] El servicio de acceso no está disponible.', {
    message: error instanceof Error ? error.message : 'Configuración ausente',
  })

  return 'El acceso no está disponible en este momento. Intentá nuevamente más tarde.'
}

export default function AuthForm({
  mode,
  defaultNext = '/prode',
  loginDescription = 'Entrá con tu email y contraseña para usar el Prode.',
  showModeSwitch = true,
}: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = getSafeAuthNextPath(searchParams.get('next'), defaultNext)
  const isLogin = mode === 'login'
  const initialMessage = isLogin ? getLoginStatusMessage(searchParams) : ''

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(initialMessage)
  const [noticeTone, setNoticeTone] = useState<NoticeTone>(
    searchParams.get('authError') ? 'error' : 'info'
  )
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  function showNotice(text: string, tone: NoticeTone = 'error') {
    setNoticeTone(tone)
    setMessage(text)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const cleanEmail = email.trim()
    let cleanUsername = ''

    if (!isLogin) {
      const validation = validateUsername(username)

      if (validation.error) {
        showNotice(validation.error)
        return
      }

      const passwordError = validateAuthPassword(password)

      if (passwordError) {
        showNotice(passwordError)
        return
      }

      cleanUsername = validation.username
    }

    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient()

        if (isLogin) {
          const { error } = await signInWithEmail(cleanEmail, password)

          if (error) {
            showNotice(translateAuthError(error, 'login'))
            return
          }

          await supabase.auth.getSession()
          router.replace(nextPath)
          router.refresh()
          return
        }

        const { data, error } = await signUpWithEmail(cleanEmail, password, {
          username: cleanUsername,
          displayName: cleanUsername,
          emailRedirectTo: getAuthCallbackUrl(nextPath),
        })

        if (error) {
          showNotice(translateAuthError(error, 'register'))
          return
        }

        if (data.session && data.user) {
          const { error: profileError } = await upsertUserProfile({
            id: data.user.id,
            email: data.user.email ?? cleanEmail,
            username: cleanUsername,
            displayName: cleanUsername,
          })

          if (profileError) {
            console.warn('[auth/register] No se pudo asegurar el perfil inicial', {
              message: profileError.message,
              code: profileError.code ?? null,
              details: profileError.details ?? null,
            })
          }
        }

        if (!data.session) {
          showNotice(
            'Cuenta creada. Revisá tu correo para confirmar el acceso.',
            'success'
          )
          return
        }

        await supabase.auth.getSession()
        router.replace(nextPath)
        router.refresh()
      } catch (error) {
        showNotice(getServiceErrorMessage(error))
      }
    })
  }

  function handlePasswordRecovery() {
    setMessage('')

    const cleanEmail = email.trim()

    if (!cleanEmail || !cleanEmail.includes('@')) {
      showNotice('Ingresá tu email para enviarte el enlace de recuperación.')
      return
    }

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
        const { error } = await sendPasswordRecoveryEmail(
          cleanEmail,
          getAuthCallbackBaseUrl()
        )

        if (error) {
          showNotice(translateAuthError(error, 'passwordRecovery'))
          return
        }

        showNotice(
          'Si existe una cuenta asociada a ese email, vas a recibir un enlace para restablecer la contraseña.',
          'success'
        )
      } catch (error) {
        showNotice(getServiceErrorMessage(error))
      }
    })
  }

  return (
    <section className="hf-account-card">
      <div className="hf-account-card-heading">
        <span className="hf-type-overline">
          {isLogin ? 'Bienvenido de vuelta' : 'Tu ficha de hincha'}
        </span>
        <h1>{isLogin ? 'Iniciar sesión' : 'Crear una cuenta'}</h1>
        <p>
          {isLogin
            ? loginDescription
            : 'Elegí cómo querés aparecer en el Prode. Podés cambiar tus datos más adelante.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="hf-account-form" aria-busy={isPending}>
        {!isLogin ? (
          <label className="hf-account-field">
            <span>Nombre de usuario</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              maxLength={40}
              autoComplete="username"
              placeholder="Tu nombre en el Prode"
            />
            <small>Entre 3 y 40 caracteres.</small>
          </label>
        ) : null}

        <label className="hf-account-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            placeholder="vos@correo.com"
          />
        </label>

        <label className="hf-account-field">
          <span>Contraseña</span>
          <span className="hf-account-password">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={isLogin ? undefined : AUTH_PASSWORD_MIN_LENGTH}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="Tu contraseña"
            />
            <button
              type="button"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
          {!isLogin ? (
            <small>Mínimo {AUTH_PASSWORD_MIN_LENGTH} caracteres.</small>
          ) : null}
        </label>

        <button type="submit" disabled={isPending} className="hf-account-submit">
          {isPending
            ? isLogin
              ? 'Ingresando…'
              : 'Creando cuenta…'
            : isLogin
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
        </button>
      </form>

      {isLogin ? (
        <button
          type="button"
          onClick={handlePasswordRecovery}
          disabled={isPending}
          className="hf-account-recovery"
        >
          ¿Olvidaste tu contraseña?
        </button>
      ) : null}

      {message ? (
        <p
          className={`hf-account-notice is-${noticeTone}`}
          role={noticeTone === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}

      {showModeSwitch ? (
        <div className="hf-account-switch">
          {isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
          <Link
            href={
              isLogin
                ? `/register?next=${encodeURIComponent(nextPath)}`
                : `/login?next=${encodeURIComponent(nextPath)}`
            }
          >
            {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
          </Link>
        </div>
      ) : null}
    </section>
  )
}
