'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import {
  getSupabaseBrowserClient,
  signOut,
} from '@/lib/supabase/supabaseClient'
import { useAuth } from '@/frontend/hooks/useAuth'

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { username?: string | null } | null
        error: { message: string; code?: string; details?: string | null } | null
      }>
    }
  }
}

function profilesQuery() {
  return getSupabaseBrowserClient().from('profiles' as 'leagues') as unknown as ProfileQuery
}

function AuthPlaceholder() {
  return (
    <div
      className="hf-skeleton h-10 w-[172px] rounded-xl border border-white/8"
      aria-hidden="true"
    />
  )
}

export default function AuthStatus() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<{ userId: string; username: string | null } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    let active = true

    if (!mounted || !user) {
      return () => {
        active = false
      }
    }

    profilesQuery()
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          console.warn('[auth-status] No se pudo cargar profiles', {
            message: error.message,
            code: error.code ?? null,
            details: error.details ?? null,
          })
          return
        }

        setProfile({
          userId: user.id,
          username: data?.username ?? null,
        })
      })
      .catch((error: unknown) => {
        if (!active) return

        console.warn('[auth-status] Error cargando perfil', {
          message: error instanceof Error ? error.message : 'Error desconocido',
        })
      })

    return () => {
      active = false
    }
  }, [mounted, user])

  const currentUserLabel =
    (profile && profile.userId === user?.id ? profile.username : null) ||
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username) ||
    user?.email ||
    'Mi cuenta'

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

      setProfile(null)
      router.replace('/')
      router.refresh()
    })
  }

  if (!mounted || isLoading) {
    return <AuthPlaceholder />
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs font-semibold text-[#9aa7b5] sm:inline">
          No iniciaste sesión
        </span>
        <Link
          href="/register"
          className="hf-button-secondary rounded-xl px-3 py-2 text-sm font-semibold"
        >
          Crear cuenta
        </Link>
        <Link
          href="/login"
          className="hf-button rounded-xl px-3 py-2 text-sm font-black"
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
          className="hf-button-secondary max-w-[180px] truncate rounded-xl px-3 py-2 text-sm font-semibold"
        >
          {currentUserLabel}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          className="hf-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#c8d0da] disabled:cursor-wait disabled:opacity-70"
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
