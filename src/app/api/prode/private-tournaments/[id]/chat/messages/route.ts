import {
  getAuthenticatedProdeUser,
  jsonNoStore,
} from '@/app/api/prode/private-tournaments/_shared'
import {
  createPrivateTournamentChatMessage,
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

  console.error('[prode/private-tournaments/chat/messages] Error completo', error)

  return jsonNoStore(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 }
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedProdeUser(
    request,
    'Iniciá sesión para participar del chat.'
  )

  if (error || !user) return error

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    messageType?: string
    message?: string
    stickerId?: string
  }

  try {
    const message = await createPrivateTournamentChatMessage({
      tournamentId: id,
      user,
      messageType: body.messageType === 'sticker' ? 'sticker' : 'text',
      message: body.message,
      stickerId: body.stickerId,
    })

    return jsonNoStore({ ok: true, message })
  } catch (caughtError) {
    return chatErrorResponse(caughtError, 'No se pudo enviar el mensaje.')
  }
}
