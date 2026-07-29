'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import AppIcon from '@/frontend/components/navigation/AppIcon'
import { useAuth } from '@/frontend/hooks/useAuth'
import {
  getSupabaseBrowserClient,
  signOut,
} from '@/lib/supabase/supabaseClient'

type ProfileQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{
        data: { username?: string | null } | null
        error: {
          message: string
          code?: string
          details?: string | null
        } | null
      }>
    }
  }
}

function profilesQuery() {
  return getSupabaseBrowserClient().from(
    'profiles' as 'leagues'
  ) as unknown as ProfileQuery
}

function AuthPlaceholder() {
  return (
    <div className="hf-auth-placeholder" aria-label="Cargando sesión">
      <span />
      <span />
    </div>
  )
}

export default function AuthStatus() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [profile, setProfile] = useState<{
    userId: string
    username: string | null
  } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true

    if (!user) {
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
          message:
            error instanceof Error ? error.message : 'Error desconocido',
        })
      })

    return () => {
      active = false
    }
  }, [user])

  const currentUserLabel =
    (profile && profile.userId === user?.id ? profile.username : null) ||
    (typeof user?.user_metadata?.username === 'string'
      ? user.user_metadata.username
      : null) ||
    user?.email ||
    'Mi cuenta'

  function handleLogout() {
    setError('')

    startTransition(async () => {
      try {
        getSupabaseBrowserClient()
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Supabase no está configurado.'
        )
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

  if (isLoading) return <AuthPlaceholder />

  if (!user) {
    return (
      <div className="hf-auth-guest">
        <Link href="/register">Crear cuenta</Link>
        <Link href="/login">Iniciar sesión</Link>
      </div>
    )
  }

  return (
    <div className="hf-auth-user">
      <Link href="/perfil" title={currentUserLabel}>
        <AppIcon name="profile" />
        <span>{currentUserLabel}</span>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        {isPending ? (
          <span className="hf-ui-spinner" aria-hidden="true" />
        ) : (
          <AppIcon name="logout" />
        )}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
