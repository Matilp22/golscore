'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/server/admin/auth'
import { requireMiTorneitoTournamentAdmin } from '@/server/mi-torneito/auth'
import {
  assignMiTorneitoTournamentAdmin,
  createMiTorneitoMatch,
  createMiTorneitoRound,
  createMiTorneitoTeam,
  createMiTorneitoTournament,
  createMiTorneitoTournamentRequest,
  getMiTorneitoErrorMessage,
  updateMiTorneitoMatchResult,
  updateMiTorneitoRequestStatus,
} from '@/server/mi-torneito/repository'
import type {
  MiTorneitoMatchStatus,
  MiTorneitoRequestStatus,
  MiTorneitoRoundPhase,
  MiTorneitoTournamentStatus,
  MiTorneitoVisibility,
} from '@/shared/mi-torneito/types'

function readString(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalString(formData: FormData, key: string) {
  return readString(formData, key) || null
}

function readNullableInteger(formData: FormData, key: string) {
  const value = readString(formData, key)
  if (!value) return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Valor invalido para ${key}.`)

  return Math.trunc(parsed)
}

function readDateInput(formData: FormData, key: string) {
  const value = readString(formData, key)
  if (!value) return null

  return value
}

function readDateTimeInput(formData: FormData, key: string) {
  const value = readString(formData, key)
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toISOString()
}

function getSafeReturnPath(value: string) {
  if (value.startsWith('/admin/mi-torneito')) return value
  if (value.startsWith('/mi-torneito/admin')) return value
  if (value.startsWith('/mi-torneito/t/')) return value

  return '/mi-torneito'
}

function withStatus(path: string, status: { saved?: string; error?: string }) {
  const [pathname, rawQuery = ''] = path.split('?')
  const params = new URLSearchParams(rawQuery)

  params.delete('saved')
  params.delete('error')

  if (status.saved) params.set('saved', status.saved)
  if (status.error) params.set('error', status.error)

  const query = params.toString()

  return `${pathname}${query ? `?${query}` : ''}`
}

const REQUEST_STATUSES: MiTorneitoRequestStatus[] = [
  'pending',
  'contacted',
  'approved',
  'rejected',
  'archived',
]

const TOURNAMENT_STATUSES: MiTorneitoTournamentStatus[] = [
  'draft',
  'scheduled',
  'active',
  'finished',
  'archived',
]

const VISIBILITIES: MiTorneitoVisibility[] = ['public', 'unlisted', 'private']
const ROUND_PHASES: MiTorneitoRoundPhase[] = ['group', 'knockout', 'final']
const MATCH_STATUSES: MiTorneitoMatchStatus[] = [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
]

function ensureValue<T extends string>(value: string, values: T[], fallback: T) {
  return values.includes(value as T) ? (value as T) : fallback
}

async function authorizeTournamentMutation(tournamentId: string) {
  try {
    const user = await requireAdmin()

    return {
      userId: user.id,
      email: user.email ?? null,
      source: 'super_admin' as const,
    }
  } catch {
    const current = await requireMiTorneitoTournamentAdmin(tournamentId)

    return {
      userId: current.user.id,
      email: current.email,
      source: 'tournament_admin' as const,
    }
  }
}

export async function submitMiTorneitoRequestAction(formData: FormData) {
  let target = '/mi-torneito?solicitud=ok#solicitar'

  try {
    const organizerName = readString(formData, 'organizerName')
    const organizerEmail = readString(formData, 'organizerEmail')
    const tournamentName = readString(formData, 'tournamentName')

    if (!organizerName || !organizerEmail || !tournamentName) {
      throw new Error('Completa nombre, email y nombre del torneo.')
    }

    await createMiTorneitoTournamentRequest({
      organizerName,
      organizerEmail,
      organizerPhone: readOptionalString(formData, 'organizerPhone'),
      tournamentName,
      city: readOptionalString(formData, 'city'),
      expectedTeams: readNullableInteger(formData, 'expectedTeams'),
      notes: readOptionalString(formData, 'notes'),
    })

    revalidatePath('/mi-torneito')
  } catch (error) {
    target = `/mi-torneito?solicitud=error&mensaje=${encodeURIComponent(
      getMiTorneitoErrorMessage(error)
    )}#solicitar`
  }

  redirect(target)
}

export async function updateMiTorneitoRequestStatusAction(formData: FormData) {
  const returnPath = getSafeReturnPath(readString(formData, 'returnPath') || '/admin/mi-torneito/solicitudes')
  let target = withStatus(returnPath, { saved: 'solicitud' })

  try {
    const user = await requireAdmin()

    await updateMiTorneitoRequestStatus({
      requestId: readString(formData, 'requestId'),
      status: ensureValue(readString(formData, 'status'), REQUEST_STATUSES, 'pending'),
      adminNotes: readOptionalString(formData, 'adminNotes'),
      reviewedBy: user.id,
    })

    revalidatePath('/admin/mi-torneito')
    revalidatePath('/admin/mi-torneito/solicitudes')
  } catch (error) {
    target = withStatus(returnPath, { error: getMiTorneitoErrorMessage(error) })
  }

  redirect(target)
}

export async function createMiTorneitoTournamentAction(formData: FormData) {
  let target = '/admin/mi-torneito/torneos'

  try {
    const user = await requireAdmin()
    const tournament = await createMiTorneitoTournament({
      requestId: readOptionalString(formData, 'requestId'),
      organizationName: readString(formData, 'organizationName'),
      organizationCity: readOptionalString(formData, 'organizationCity'),
      contactEmail: readOptionalString(formData, 'contactEmail'),
      contactPhone: readOptionalString(formData, 'contactPhone'),
      tournamentName: readString(formData, 'tournamentName'),
      shortDescription: readOptionalString(formData, 'shortDescription'),
      city: readOptionalString(formData, 'city'),
      venue: readOptionalString(formData, 'venue'),
      season: readOptionalString(formData, 'season'),
      format: readOptionalString(formData, 'format'),
      status: ensureValue(readString(formData, 'status'), TOURNAMENT_STATUSES, 'draft'),
      visibility: ensureValue(readString(formData, 'visibility'), VISIBILITIES, 'public'),
      startsOn: readDateInput(formData, 'startsOn'),
      endsOn: readDateInput(formData, 'endsOn'),
      adminEmail: readOptionalString(formData, 'adminEmail'),
      actorUserId: user.id,
      actorEmail: user.email ?? null,
    })

    revalidatePath('/mi-torneito')
    revalidatePath('/mi-torneito/torneos')
    revalidatePath('/admin/mi-torneito')
    revalidatePath('/admin/mi-torneito/torneos')
    target = `/admin/mi-torneito/torneos/${tournament.id}?saved=torneo`
  } catch (error) {
    target = `/admin/mi-torneito/torneos?error=${encodeURIComponent(
      getMiTorneitoErrorMessage(error)
    )}`
  }

  redirect(target)
}

export async function createMiTorneitoTeamAction(formData: FormData) {
  const tournamentId = readString(formData, 'tournamentId')
  const returnPath = getSafeReturnPath(readString(formData, 'returnPath'))
  let target = withStatus(returnPath, { saved: 'equipo' })

  try {
    await authorizeTournamentMutation(tournamentId)
    await createMiTorneitoTeam({
      tournamentId,
      name: readString(formData, 'name'),
      logoUrl: readOptionalString(formData, 'logoUrl'),
      primaryColor: readOptionalString(formData, 'primaryColor'),
      coachName: readOptionalString(formData, 'coachName'),
      homeVenue: readOptionalString(formData, 'homeVenue'),
    })

    revalidatePath(returnPath)
    revalidatePath('/mi-torneito')
  } catch (error) {
    target = withStatus(returnPath, { error: getMiTorneitoErrorMessage(error) })
  }

  redirect(target)
}

export async function createMiTorneitoRoundAction(formData: FormData) {
  const tournamentId = readString(formData, 'tournamentId')
  const returnPath = getSafeReturnPath(readString(formData, 'returnPath'))
  let target = withStatus(returnPath, { saved: 'ronda' })

  try {
    await authorizeTournamentMutation(tournamentId)
    await createMiTorneitoRound({
      tournamentId,
      name: readString(formData, 'name'),
      phase: ensureValue(readString(formData, 'phase'), ROUND_PHASES, 'group'),
      sortOrder: readNullableInteger(formData, 'sortOrder') ?? 0,
    })

    revalidatePath(returnPath)
  } catch (error) {
    target = withStatus(returnPath, { error: getMiTorneitoErrorMessage(error) })
  }

  redirect(target)
}

export async function createMiTorneitoMatchAction(formData: FormData) {
  const tournamentId = readString(formData, 'tournamentId')
  const returnPath = getSafeReturnPath(readString(formData, 'returnPath'))
  let target = withStatus(returnPath, { saved: 'partido' })

  try {
    await authorizeTournamentMutation(tournamentId)
    await createMiTorneitoMatch({
      tournamentId,
      roundId: readOptionalString(formData, 'roundId'),
      homeTeamId: readOptionalString(formData, 'homeTeamId'),
      awayTeamId: readOptionalString(formData, 'awayTeamId'),
      scheduledAt: readDateTimeInput(formData, 'scheduledAt'),
      venue: readOptionalString(formData, 'venue'),
      status: ensureValue(readString(formData, 'status'), MATCH_STATUSES, 'scheduled'),
      broadcastLabel: readOptionalString(formData, 'broadcastLabel'),
      notes: readOptionalString(formData, 'notes'),
    })

    revalidatePath(returnPath)
    revalidatePath('/mi-torneito')
  } catch (error) {
    target = withStatus(returnPath, { error: getMiTorneitoErrorMessage(error) })
  }

  redirect(target)
}

export async function saveMiTorneitoMatchResultAction(formData: FormData) {
  const tournamentId = readString(formData, 'tournamentId')
  const returnPath = getSafeReturnPath(readString(formData, 'returnPath'))
  let target = withStatus(returnPath, { saved: 'resultado' })

  try {
    await authorizeTournamentMutation(tournamentId)
    await updateMiTorneitoMatchResult({
      matchId: readString(formData, 'matchId'),
      status: ensureValue(readString(formData, 'status'), MATCH_STATUSES, 'finished'),
      homeScore: readNullableInteger(formData, 'homeScore'),
      awayScore: readNullableInteger(formData, 'awayScore'),
      homePenaltyScore: readNullableInteger(formData, 'homePenaltyScore'),
      awayPenaltyScore: readNullableInteger(formData, 'awayPenaltyScore'),
      minute: readNullableInteger(formData, 'minute'),
    })

    revalidatePath(returnPath)
    revalidatePath('/mi-torneito')
  } catch (error) {
    target = withStatus(returnPath, { error: getMiTorneitoErrorMessage(error) })
  }

  redirect(target)
}

export async function assignMiTorneitoAdminAction(formData: FormData) {
  const returnPath = getSafeReturnPath(readString(formData, 'returnPath'))
  let target = withStatus(returnPath, { saved: 'admin' })

  try {
    const user = await requireAdmin()

    await assignMiTorneitoTournamentAdmin({
      tournamentId: readString(formData, 'tournamentId'),
      email: readString(formData, 'email'),
      role: readString(formData, 'role') === 'owner' ? 'owner' : 'editor',
      actorUserId: user.id,
    })

    revalidatePath(returnPath)
    revalidatePath('/mi-torneito/admin')
  } catch (error) {
    target = withStatus(returnPath, { error: getMiTorneitoErrorMessage(error) })
  }

  redirect(target)
}
