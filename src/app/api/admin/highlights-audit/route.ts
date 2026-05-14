import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getHighlightsAudit } from '@/server/match-highlights'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  return Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
}

function parseLimit(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  try {
    const supabase = getSupabaseAdminClient()
    const audit = await getHighlightsAudit(supabase, {
      leagueExternalId: searchParams.get('leagueExternalId') ?? searchParams.get('league_external_id'),
      limit: parseLimit(searchParams.get('limit')),
    })

    return NextResponse.json(audit, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[highlights-audit] Error completo', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo auditar resúmenes.',
      },
      { status: 500 }
    )
  }
}
