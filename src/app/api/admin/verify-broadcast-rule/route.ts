import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { verifyBroadcastRule } from '@/server/broadcasts/admin'
import { serializeError } from '@/server/match-detail-cache'

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

async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await readBody(request)
    const result = await verifyBroadcastRule(getSupabaseAdminClient(), {
      ruleId: typeof body.ruleId === 'string' ? body.ruleId : '',
      verified: typeof body.verified === 'boolean' ? body.verified : true,
      source: typeof body.source === 'string' ? body.source : 'manual',
      confidence: typeof body.confidence === 'string' ? body.confidence : 'high',
    })

    return jsonNoStore({
      endpoint: 'verify-broadcast-rule',
      ...result,
    }, { status: result.ok ? 200 : 400 })
  } catch (error) {
    const serialized = serializeError(error, 'supabase')
    console.error('[verify-broadcast-rule] Error completo', serialized)

    return jsonNoStore(
      {
        ok: false,
        error: serialized.message,
        code: serialized.code,
        detail: serialized.detail,
        hint: serialized.hint,
        source: serialized.source,
      },
      { status: 500 }
    )
  }
}
