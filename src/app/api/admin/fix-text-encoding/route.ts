import { NextResponse } from 'next/server'

import { fixTextEncoding } from '@/server/text-encoding'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
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

function readDryRun(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
  }

  return true
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const payload = await request.json().catch(() => ({}))
    const result = await fixTextEncoding({
      dryRun: readDryRun(payload?.dryRun),
    })

    return jsonNoStore({
      endpoint: 'fix-text-encoding',
      ...result,
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo corregir encoding de textos.',
      },
      { status: 500 }
    )
  }
}
