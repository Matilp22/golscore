import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { WORLD_CUP_FINALS_SEED, type WorldCupFinalSeed } from '@/server/world-cup-champions'

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

function toRow(final: WorldCupFinalSeed) {
  return {
    year: final.year,
    champion_name: final.championName,
    champion_canonical_name: final.championCanonicalName,
    champion_team_external_id: final.championTeamExternalId,
    runner_up_name: final.runnerUpName,
    runner_up_canonical_name: final.runnerUpCanonicalName,
    runner_up_team_external_id: final.runnerUpTeamExternalId,
    score: final.score,
    penalties: final.penalties,
    after_extra_time: final.afterExtraTime,
    decisive_match: final.decisiveMatch,
    venue: final.venue,
    city: final.city,
    country: final.country,
    notes: final.notes,
    source: final.source,
    verified: final.verified,
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonNoStore({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const payload = await request.json().catch(() => ({}))
    const finals = Array.isArray(payload?.finals) && payload.finals.length
      ? (payload.finals as WorldCupFinalSeed[])
      : WORLD_CUP_FINALS_SEED

    const rows = finals.map(toRow)
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('world_cup_finals')
      .upsert(rows, { onConflict: 'year' })
      .select('year')

    if (error) {
      const message = error.message?.toLowerCase() ?? ''
      if (error.code === '42P01' || error.code === 'PGRST205' || message.includes('schema cache')) {
        return jsonNoStore(
          {
            ok: false,
            migrationNeeded: true,
            error: 'La tabla world_cup_finals no existe todavia. Aplicar la migracion antes del seed remoto.',
          },
          { status: 409 }
        )
      }

      throw error
    }

    return jsonNoStore({
      ok: true,
      endpoint: 'upsert-world-cup-finals',
      upserted: data?.length ?? rows.length,
      years: rows.map((row) => row.year).sort((a, b) => a - b),
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron guardar finales del Mundial.',
      },
      { status: 500 }
    )
  }
}
