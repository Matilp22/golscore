import {
  getAuthenticatedProdeUser,
  jsonNoStore,
} from '@/app/api/prode/private-tournaments/_shared'
import {
  deletePrivateTournamentChatMessage,
  PrivateTournamentChatError,
} from '@/server/prode/private-tournament-chat'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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

  console.error('[prode/private-tournaments/chat/messages/delete] Error completo', error)

  return jsonNoStore(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 }
  )
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { user, error } = await getAuthenticatedProdeUser(
    request,
    'Iniciá sesión para participar del chat.'
  )

  if (error || !user) return error

  const { id, messageId } = await params

  try {
    const result = await deletePrivateTournamentChatMessage({
      tournamentId: id,
      messageId,
      userId: user.id,
    })

    return jsonNoStore(result)
  } catch (caughtError) {
    return chatErrorResponse(caughtError, 'No se pudo borrar el mensaje.')
  }
}
