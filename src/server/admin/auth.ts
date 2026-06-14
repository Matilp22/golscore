import 'server-only'

import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type AdminAuthStatus =
  | {
      status: 'authenticated_admin'
      user: User
      email: string
    }
  | {
      status: 'access_denied'
      user: User
      email: string
    }
  | {
      status: 'not_authenticated'
      user: null
      email: null
    }
  | {
      status: 'supabase_not_configured'
      user: null
      email: null
    }
  | {
      status: 'admin_not_configured'
      user: null
      email: null
    }

export class AdminAuthError extends Error {
  code: 'not_authenticated' | 'access_denied' | 'supabase_not_configured' | 'admin_not_configured'

  constructor(code: AdminAuthError['code'], message: string) {
    super(message)
    this.name = 'AdminAuthError'
    this.code = code
  }
}

function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false

  return getConfiguredAdminEmails().includes(email.trim().toLowerCase())
}

export async function getCurrentAdminUser(): Promise<AdminAuthStatus> {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      status: 'supabase_not_configured',
      user: null,
      email: null,
    }
  }

  if (!getConfiguredAdminEmails().length) {
    return {
      status: 'admin_not_configured',
      user: null,
      email: null,
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      status: 'not_authenticated',
      user: null,
      email: null,
    }
  }

  const email = user.email?.trim().toLowerCase() ?? ''

  if (!isAdminEmail(email)) {
    return {
      status: 'access_denied',
      user,
      email,
    }
  }

  return {
    status: 'authenticated_admin',
    user,
    email,
  }
}

export async function requireAdmin() {
  const current = await getCurrentAdminUser()

  if (current.status === 'authenticated_admin') return current.user

  if (current.status === 'access_denied') {
    throw new AdminAuthError(
      'access_denied',
      'Acceso denegado. Tu email no esta habilitado como administrador.'
    )
  }

  if (current.status === 'supabase_not_configured') {
    throw new AdminAuthError(
      'supabase_not_configured',
      'Supabase no esta configurado.'
    )
  }

  if (current.status === 'admin_not_configured') {
    throw new AdminAuthError(
      'admin_not_configured',
      'ADMIN_EMAILS no esta configurado.'
    )
  }

  throw new AdminAuthError(
    'not_authenticated',
    'Necesitas iniciar sesion para acceder al admin.'
  )
}
