'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  getSupabaseBrowserClient,
  signInWithEmail,
  signUpWithEmail,
} from '@/lib/supabase/supabaseClient'

type AuthFormProps = {
  mode: 'login' | 'register'
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/prode'

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

      if (isLogin) {
        const { error } = await signInWithEmail(email, password)

        if (error) {
          setMessage(error.message || 'No se pudo iniciar sesion.')
          return
        }

        await supabase.auth.getSession()
        router.replace(nextPath)
        router.refresh()
        return
      }

      const { data, error } = await signUpWithEmail(email, password)

      if (error) {
        setMessage(error.message || 'No se pudo registrar la cuenta.')
        return
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

  return (
    <div className="rounded-2xl border border-white/8 bg-[#111418] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <h1 className="text-2xl font-black text-white">
        {isLogin ? 'Iniciar sesion' : 'Registrarse'}
      </h1>
      <p className="mt-2 text-sm text-[#8d98a7]">
        {isLogin
          ? 'Entra con tu email y contrasena para usar el prode.'
          : 'Crea tu cuenta para guardar predicciones y sumar puntos.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#c8d0da]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-11 w-full rounded-xl border border-white/8 bg-[#0f1317] px-3 text-sm text-white outline-none transition focus:border-[#25553d]"
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
            className="h-11 w-full rounded-xl border border-white/8 bg-[#0f1317] px-3 text-sm text-white outline-none transition focus:border-[#25553d]"
            placeholder="********"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#25553d] bg-[#163828] px-4 text-sm font-semibold text-[#7ff0b2] transition hover:bg-[#1b4330] disabled:cursor-wait disabled:opacity-70"
        >
          {isPending
            ? isLogin
              ? 'Ingresando...'
              : 'Creando cuenta...'
            : isLogin
              ? 'Iniciar sesion'
              : 'Crear cuenta'}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-xl border border-white/8 bg-[#0f1317] px-3 py-2 text-sm text-[#dce7f2]">
          {message}
        </p>
      ) : null}

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
          {isLogin ? 'Registrate' : 'Inicia sesion'}
        </Link>
      </div>
    </div>
  )
}
