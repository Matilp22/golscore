import {
  getAuthenticatedProdeUser,
  jsonNoStore,
} from '@/app/api/prode/private-tournaments/_shared'
import {
  getPrivateTournamentChat,
  PrivateTournamentChatError,
} from '@/server/prode/private-tournament-chat'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function parseLimit(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function chatErrorResponse(error: unknown, fallback: string) {
  if (error instanceof PrivateTournamentChatError) {
    return jsonNoStore(
      {
        ok: false,
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    )
  }

  console.error('[prode/private-tournaments/chat] Error completo', error)

  return jsonNoStore(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 }
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedProdeUser(
    request,
    'Iniciá sesión para participar del chat.'
  )

  if (error || !user) return error

  const { id } = await params
  const { searchParams } = new URL(request.url)

  try {
    const result = await getPrivateTournamentChat({
      tournamentId: id,
      userId: user.id,
      limit: parseLimit(searchParams.get('limit')) ?? 50,
      before: searchParams.get('before'),
    })

    return jsonNoStore({ ok: true, ...result })
  } catch (caughtError) {
    return chatErrorResponse(caughtError, 'No se pudo cargar el chat.')
  }
}
