import 'server-only'

import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isMiTorneitoAdminForTournament, listTournamentsForAdminEmail } from '@/server/mi-torneito/repository'

export type MiTorneitoAdminUserStatus =
  | {
      status: 'authenticated_tournament_admin'
      user: User
      email: string
      tournamentCount: number
    }
  | {
      status: 'not_authenticated'
      user: null
      email: null
      tournamentCount: 0
    }
  | {
      status: 'supabase_not_configured'
      user: null
      email: null
      tournamentCount: 0
    }
  | {
      status: 'access_denied'
      user: User
      email: string
      tournamentCount: 0
    }

export class MiTorneitoAuthError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'MiTorneitoAuthError'
    this.status = status
  }
}

export async function getCurrentMiTorneitoAdminUser(): Promise<MiTorneitoAdminUserStatus> {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return {
      status: 'supabase_not_configured',
      user: null,
      email: null,
      tournamentCount: 0,
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 'not_authenticated',
      user: null,
      email: null,
      tournamentCount: 0,
    }
  }

  const email = user.email?.trim().toLowerCase() ?? ''
  const tournaments = await listTournamentsForAdminEmail(email)

  if (tournaments.error || !tournaments.data.length) {
    return {
      status: 'access_denied',
      user,
      email,
      tournamentCount: 0,
    }
  }

  return {
    status: 'authenticated_tournament_admin',
    user,
    email,
    tournamentCount: tournaments.data.length,
  }
}

export async function requireMiTorneitoTournamentAdmin(tournamentId: string) {
  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    throw new MiTorneitoAuthError('Supabase no esta configurado.', 500)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new MiTorneitoAuthError('Necesitas iniciar sesion para administrar este torneo.', 401)
  }

  const email = user.email?.trim().toLowerCase()
  if (!email) {
    throw new MiTorneitoAuthError('Tu cuenta no tiene email confirmado.', 403)
  }

  const allowed = await isMiTorneitoAdminForTournament({
    tournamentId,
    email,
    userId: user.id,
  })

  if (!allowed) {
    throw new MiTorneitoAuthError('No tenes permiso para administrar este torneo.', 403)
  }

  return {
    user,
    email,
  }
}
