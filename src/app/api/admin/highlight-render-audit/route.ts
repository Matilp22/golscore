import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getHighlightRenderAudit, serializeHighlightError } from '@/server/match-highlights'

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

  const { searchParams } = new URL(request.url)

  try {
    const supabase = getSupabaseAdminClient()
    const audit = await getHighlightRenderAudit(supabase, {
      matchId: searchParams.get('matchId') ?? searchParams.get('match_id'),
      fixture:
        searchParams.get('fixture') ??
        searchParams.get('fixtureExternalId') ??
        searchParams.get('fixture_external_id'),
    })

    return NextResponse.json(audit, {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    const serialized = serializeHighlightError(error, 'supabase')
    console.error('[highlight-render-audit] Error completo', serialized)

    return NextResponse.json(
      {
        ok: false,
        error: serialized.code,
        message: serialized.message,
        detail: serialized.detail,
        source: serialized.source,
        missingColumns: serialized.missingColumns,
      },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
