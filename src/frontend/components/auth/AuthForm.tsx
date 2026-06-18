'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  getSupabaseBrowserClient,
  sendPasswordRecoveryEmail,
  signInWithEmail,
  signUpWithEmail,
  upsertUserProfile,
} from '@/lib/supabase/supabaseClient'
import BrandMark from '@/frontend/components/BrandMark'
import { translateAuthError } from '@/shared/utils/auth-errors'
import { validateUsername } from '@/shared/utils/usernames'

type AuthFormProps = {
  mode: 'login' | 'register'
  defaultNext?: string
  loginDescription?: string
  showModeSwitch?: boolean
}

function getSafeNextPath(value: string | null, fallback: string) {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback

  return value
}

function getRedirectUrl(path: string) {
  if (typeof window === 'undefined') return undefined

  return new URL(path, window.location.origin).toString()
}

export default function AuthForm({
  mode,
  defaultNext = '/prode',
  loginDescription = 'Entra con tu email y contrasena para usar el prode.',
  showModeSwitch = true,
}: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'), defaultNext)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const isLogin = mode === 'login'

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `${error.message} Pega tus claves publicas en .env.local y reinicia npm run dev.`
            : 'Supabase no esta configurado. Pega tus claves publicas en .env.local y reinicia npm run dev.'
        )
        return
      }

      const supabase = getSupabaseBrowserClient()
      const cleanEmail = email.trim()

      if (isLogin) {
        const { error } = await signInWithEmail(cleanEmail, password)

        if (error) {
          setMessage(translateAuthError(error, 'login'))
          return
        }

        await supabase.auth.getSession()
        router.replace(nextPath)
        router.refresh()
        return
      }

      const { username: cleanUsername, error: usernameError } = validateUsername(username)

      if (usernameError) {
        setMessage(usernameError)
        return
      }

      const { data, error } = await signUpWithEmail(cleanEmail, password, {
        username: cleanUsername,
        displayName: cleanUsername,
        emailRedirectTo: getRedirectUrl(nextPath),
      })

      if (error) {
        setMessage(translateAuthError(error, 'register'))
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
        setMessage('Cuenta creada. Revisa tu correo para confirmar el acceso.')
        return
      }

      await supabase.auth.getSession()
      router.replace(nextPath)
      router.refresh()
    })
  }

  const handlePasswordRecovery = () => {
    setMessage('')

    const cleanEmail = email.trim()

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMessage('Ingresá tu email para enviarte el enlace de recuperación.')
      return
    }

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `${error.message} Pegá tus claves públicas en .env.local y reiniciá npm run dev.`
            : 'Supabase no está configurado. Pegá tus claves públicas en .env.local y reiniciá npm run dev.'
        )
        return
      }

      const { error } = await sendPasswordRecoveryEmail(
        cleanEmail,
        getRedirectUrl('/perfil?recovery=1')
      )

      if (error) {
        setMessage(translateAuthError(error, 'passwordRecovery'))
        return
      }

      setMessage('Te enviamos un email para recuperar tu contraseña. Revisá tu casilla y seguí el enlace.')
    })
  }

  return (
    <div className="hf-card rounded-3xl p-5">
      <div className="mb-4">
        <BrandMark />
      </div>
      <h1 className="text-2xl font-black text-white">
        {isLogin ? 'Iniciar sesión' : 'Registrarse'}
      </h1>
      <p className="mt-2 text-sm text-[#8d98a7]">
        {isLogin
          ? loginDescription
          : 'Crea tu cuenta para guardar predicciones y sumar puntos.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {!isLogin ? (
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#c8d0da]">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              maxLength={40}
              autoComplete="username"
              className="hf-input h-11 w-full rounded-xl px-3 text-sm outline-none transition"
              placeholder="Tu nombre en el Prode"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#c8d0da]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="hf-input h-11 w-full rounded-xl px-3 text-sm outline-none transition"
            placeholder="vos@correo.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#c8d0da]">
            Contrasena
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="hf-input h-11 w-full rounded-xl px-3 text-sm outline-none transition"
            placeholder="********"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="hf-button inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-70"
        >
          {isPending
            ? isLogin
              ? 'Ingresando...'
              : 'Creando cuenta...'
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
          className="mt-3 w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm font-bold text-[#7ff0b2] transition hover:border-[#70ff9d]/25 hover:bg-[#70ff9d]/10 hover:text-white disabled:cursor-wait disabled:opacity-70"
        >
          ¿Olvidaste tu contraseña?
        </button>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-xl border border-white/8 bg-[#0f1317] px-3 py-2 text-sm text-[#dce7f2]">
          {message}
        </p>
      ) : null}

      {showModeSwitch ? (
      <div className="mt-4 text-sm text-[#8d98a7]">
        {isLogin ? 'No tenes cuenta?' : 'Ya tenes cuenta?'}{' '}
        <Link
          href={
            isLogin
              ? `/register?next=${encodeURIComponent(nextPath)}`
              : `/login?next=${encodeURIComponent(nextPath)}`
          }
          className="font-semibold text-[#7ff0b2] hover:text-white"
        >
          {isLogin ? 'Registrate' : 'Iniciá sesión'}
        </Link>
      </div>
      ) : null}
    </div>
  )
}
