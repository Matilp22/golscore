import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'
import { acceptPrivateTournamentInvite } from '@/server/prode/private-tournaments'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { user, error } = await getAuthenticatedProdeUser(
    request,
    'Iniciá sesión para aceptar esta invitación.'
  )

  if (error || !user) {
    return jsonNoStore(
      {
        ok: false,
        requiresAuth: true,
        error: 'Iniciá sesión para aceptar esta invitación.',
      },
      { status: 401 }
    )
  }

  const { token } = await context.params

  try {
    const invite = await acceptPrivateTournamentInvite(token, user.id)

    return jsonNoStore({ ok: true, ...invite })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo aceptar la invitación.')
  }
}

