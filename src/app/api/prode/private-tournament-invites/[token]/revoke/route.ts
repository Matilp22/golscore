import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'
import { revokePrivateTournamentInvite } from '@/server/prode/private-tournaments'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { user, error } = await getAuthenticatedProdeUser(request)
  if (error || !user) return error

  const { token } = await context.params

  try {
    const result = await revokePrivateTournamentInvite({ ownerId: user.id, token })

    return jsonNoStore(result)
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo revocar la invitación.')
  }
}

