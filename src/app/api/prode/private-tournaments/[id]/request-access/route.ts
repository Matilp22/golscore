import { requestPrivateTournamentAccess } from '@/server/prode/private-tournaments'
import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedProdeUser(request)

  if (error || !user) return error

  const { id } = await params

  try {
    const accessRequest = await requestPrivateTournamentAccess(user.id, id)

    return jsonNoStore({ ok: true, request: accessRequest }, { status: 201 })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo solicitar acceso.')
  }
}
