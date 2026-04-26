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
        setError(error instanceof Error ? error.message : 'Supabase no está configurado.')
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
        <Link
          href="/perfil"
          className="rounded-xl border border-white/8 bg-[#111418] px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:border-[#7ff0b2]/40 hover:bg-white/[0.04]"
        >
          {currentUserLabel}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-[#111418] text-[#c8d0da] transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-70"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          {isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7ff0b2]/30 border-t-[#7ff0b2]" />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          )}
        </button>
      </div>
      {error ? <p className="text-xs text-[#ffd5d5]">{error}</p> : null}
    </div>
  )
}
