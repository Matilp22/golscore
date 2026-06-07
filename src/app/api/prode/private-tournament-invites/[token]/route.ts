import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'
import { getPrivateTournamentInviteInfo } from '@/server/prode/private-tournaments'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params
  const { user } = await getAuthenticatedProdeUser(
    request,
    'Iniciá sesión para aceptar esta invitación.'
  )

  try {
    const invite = await getPrivateTournamentInviteInfo(token, user?.id ?? null)

    return jsonNoStore({ ok: true, ...invite })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo leer la invitación.')
  }
}

