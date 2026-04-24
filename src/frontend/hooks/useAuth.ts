'use client'

import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/supabaseClient'

type AuthState = {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | null = null

    Promise.resolve()
      .then(() => {
        const supabase = getSupabaseBrowserClient()

        supabase.auth
          .getSession()
          .then(({ data, error }) => {
            if (!active) return

            setState({
              session: data.session,
              user: data.session?.user ?? null,
              isLoading: false,
              error: error?.message ?? null,
            })
          })
          .catch((error: unknown) => {
            if (!active) return

            setState({
              session: null,
              user: null,
              isLoading: false,
              error: error instanceof Error ? error.message : 'No se pudo recuperar la sesion.',
            })
          })

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setState({
            session,
            user: session?.user ?? null,
            isLoading: false,
            error: null,
          })
        })

        unsubscribe = () => subscription.unsubscribe()
      })
      .catch((error: unknown) => {
        if (!active) return

        setState({
          session: null,
          user: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Supabase no esta configurado.',
        })
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  return state
}
