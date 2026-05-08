import { searchPrivateTournament } from '@/server/prode/private-tournaments'
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

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name') ?? ''

  try {
    const tournament = await searchPrivateTournament(user.id, name)

    return jsonNoStore({
      ok: true,
      found: Boolean(tournament),
      tournament,
    })
  } catch (caughtError) {
    return privateTournamentErrorResponse(caughtError, 'No se pudo buscar el torneo.')
  }
}
