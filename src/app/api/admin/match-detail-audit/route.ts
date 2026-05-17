import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { auditMatchDetailCache } from '@/server/match-detail-cache'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function readNumber(value: string | null) {
  if (value === null || value.trim() === '') return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = getSupabaseAdminClient()
    const audit = await auditMatchDetailCache(supabase, {
      fixtureExternalId: readNumber(searchParams.get('fixture')),
      matchId: searchParams.get('matchId'),
    })

    return jsonNoStore({
      ok: true,
      endpoint: 'match-detail-audit',
      ...audit,
    })
  } catch (error) {
    console.error('[match-detail-audit] Error completo', error)

    return jsonNoStore(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo auditar el detalle del partido.',
      },
      { status: 500 }
    )
  }
}
