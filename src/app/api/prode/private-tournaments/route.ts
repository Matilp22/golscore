import {
  createPrivateTournament,
  listPrivateTournaments,
} from '@/server/prode/private-tournaments'
import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedProdeUser(request)

  if (error || !user) return error

  try {
    const tournaments = await listPrivateTournaments(user.id)

    return jsonNoStore({ ok: true, tournaments })
  } catch (caughtError) {
    return privateTournamentErrorResponse(
      caughtError,
      'No se pudieron cargar tus torneos privados.'
    )
  }
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedProdeUser(request)

  if (error || !user) return error

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''

  try {
    const tournament = await createPrivateTournament(user.id, name)

    return jsonNoStore({ ok: true, tournament }, { status: 201 })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo crear el torneo.')
  }
}
