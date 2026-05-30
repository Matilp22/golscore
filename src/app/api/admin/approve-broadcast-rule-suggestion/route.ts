import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { approveBroadcastRuleSuggestion } from '@/server/broadcasts/admin'
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

function readBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined) return fallback

  return ['1', 'true', 'yes', 'si'].includes(String(value).trim().toLowerCase())
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const supabase = getSupabaseAdminClient()
    const result = await approveBroadcastRuleSuggestion(supabase, {
      suggestionId: typeof body.suggestionId === 'string' ? body.suggestionId : null,
      approved: readBoolean(body.approved, true),
    })

    return jsonNoStore({
      endpoint: 'approve-broadcast-rule-suggestion',
      ...result,
    }, { status: result.ok ? 200 : 400 })
  } catch (error) {
    const serialized = serializeError(error, 'unknown')
    console.error('[approve-broadcast-rule-suggestion] Error completo', serialized)

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
