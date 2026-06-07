import { NextResponse } from 'next/server'

import {
  getPrivateTournamentInvitesAudit,
  PrivateTournamentError,
} from '@/server/prode/private-tournaments'

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
    const audit = await getPrivateTournamentInvitesAudit()

    return NextResponse.json(audit, { headers: JSON_HEADERS })
  } catch (error) {
    if (error instanceof PrivateTournamentError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status, headers: JSON_HEADERS }
      )
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

