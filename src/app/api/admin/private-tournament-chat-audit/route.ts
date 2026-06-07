import { NextResponse } from 'next/server'

import { auditPrivateTournamentChats } from '@/server/prode/private-tournament-chat'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
}

function getAuthorizationToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i)

  return bearerMatch?.[1] ?? request.headers.get('x-cron-secret')
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret) return !isProduction

  return getAuthorizationToken(request) === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401, headers: JSON_HEADERS })
  }

  try {
    const audit = await auditPrivateTournamentChats()

    return NextResponse.json(audit, { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[private-tournament-chat-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar el chat privado.',
        tournamentsChecked: 0,
        chatsFound: 0,
        messagesCount: 0,
        messagesMissingUsername: 0,
        orphanChats: 0,
        groupChatsStillRendered: false,
        warnings: ['private_tournament_chat_audit_failed'],
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
