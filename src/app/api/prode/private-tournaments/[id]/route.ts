import { getPrivateTournamentDetail } from '@/server/prode/private-tournaments'
import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedProdeUser(request)

  if (error || !user) return error

  const { id } = await params

  try {
    const tournament = await getPrivateTournamentDetail(user.id, id)

    return jsonNoStore({ ok: true, tournament })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo cargar el torneo.')
  }
}
