import {
  getAuthenticatedProdeUser,
  jsonNoStore,
  privateTournamentErrorResponse,
} from '@/app/api/prode/private-tournaments/_shared'
import { createPrivateTournamentInvite } from '@/server/prode/private-tournaments'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type RouteContext = {
  params: Promise<{ id: string }>
}

function getOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`

  return new URL(request.url).origin
}

export async function POST(request: Request, context: RouteContext) {
  const { user, error } = await getAuthenticatedProdeUser(request)
  if (error || !user) return error

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : null
  const expiresInDays =
    typeof body?.expiresInDays === 'number'
      ? body.expiresInDays
      : typeof body?.expiresInDays === 'string'
        ? Number(body.expiresInDays)
        : null

  try {
    const invite = await createPrivateTournamentInvite({
      ownerId: user.id,
      tournamentId: id,
      email,
      expiresInDays,
      origin: getOrigin(request),
    })

    return jsonNoStore({ ok: true, invite }, { status: 201 })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo crear la invitación.')
  }
}

