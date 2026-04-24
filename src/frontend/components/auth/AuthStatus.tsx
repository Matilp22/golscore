'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  getSupabaseBrowserClient,
  signOut,
} from '@/lib/supabase/supabaseClient'
import { useAuth } from '@/frontend/hooks/useAuth'

type AuthStatusProps = {
  isAuthenticated: boolean
  userLabel?: string | null
}

export default function AuthStatus({
  isAuthenticated,
  userLabel,
}: AuthStatusProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const currentUserLabel =
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username) ||
    user?.email ||
    userLabel ||
    'Mi cuenta'
  const loggedIn = Boolean(user) || isAuthenticated

  const handleLogout = () => {
    setError('')

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Supabase no esta configurado.')
        return
      }
      const { error: signOutError } = await signOut()

      if (signOutError) {
        setError('No se pudo cerrar sesión.')
        return
      }

      router.replace('/')
      router.refresh()
    })
  }

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/register"
          className="rounded-xl border border-white/8 bg-[#111418] px-3 py-2 text-sm font-semibold text-[#c8d0da] transition hover:bg-white/5 hover:text-white"
        >
          Registrarse
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[#25553d] bg-[#163828] px-3 py-2 text-sm font-semibold text-[#7ff0b2] transition hover:bg-[#1b4330]"
        >
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="rounded-xl border border-white/8 bg-[#111418] px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
          {currentUserLabel}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          className="rounded-xl border border-white/8 bg-[#111418] px-3 py-2 text-sm font-semibold text-[#c8d0da] transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </div>
      {error ? <p className="text-xs text-[#ffd5d5]">{error}</p> : null}
    </div>
  )
}
