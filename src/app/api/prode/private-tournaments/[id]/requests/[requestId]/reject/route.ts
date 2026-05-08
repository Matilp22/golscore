import { reviewPrivateTournamentRequest } from '@/server/prode/private-tournaments'
import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const { user, error } = await getAuthenticatedProdeUser(request)

  if (error || !user) return error

  const { id, requestId } = await params

  try {
    const tournament = await reviewPrivateTournamentRequest({
      ownerId: user.id,
      tournamentId: id,
      requestId,
      action: 'reject',
    })

    return jsonNoStore({ ok: true, tournament })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo rechazar la solicitud.')
  }
}
