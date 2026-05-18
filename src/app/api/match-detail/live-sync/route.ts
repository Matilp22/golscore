import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncMatchDetail } from '@/server/match-detail-cache'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const MIN_SYNC_INTERVAL_MS = 60_000
const lastSyncByFixture = new Map<string, number>()

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

function readFixtureId(value: string | null) {
  if (!value?.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
}

async function fixtureExistsInSupabase(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  fixtureExternalId: number
) {
  const candidates = [fixtureExternalId, String(fixtureExternalId)]

  for (const candidate of candidates) {
    const response = await supabase
      .from('matches')
      .select('id')
      .eq('external_id', candidate)
      .maybeSingle()

    if (response.error) throw response.error
    if (response.data) return true
  }

  return false
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fixtureExternalId = readFixtureId(searchParams.get('fixture'))

  if (!fixtureExternalId) {
    return jsonNoStore(
      { ok: false, error: 'fixture invalido.' },
      { status: 400 }
    )
  }

  const syncKey = String(fixtureExternalId)
  const now = Date.now()
  const lastSyncAt = lastSyncByFixture.get(syncKey) ?? 0

  if (now - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return jsonNoStore({
      ok: true,
      throttled: true,
      reason: 'match detail sync throttled',
      fixtureExternalId,
    })
  }

  lastSyncByFixture.set(syncKey, now)

  try {
    const supabase = getSupabaseAdminClient()
    const knownFixture = await fixtureExistsInSupabase(supabase, fixtureExternalId)

    if (!knownFixture) {
      return jsonNoStore(
        {
          ok: false,
          error: 'Fixture no sincronizado en Supabase.',
          fixtureExternalId,
        },
        { status: 404 }
      )
    }

    const result = await syncMatchDetail(supabase, {
      fixtureExternalId,
    })

    return jsonNoStore({
      ok: result.errors.length === 0,
      throttled: false,
      mode: 'match-detail-live-sync',
      result,
    })
  } catch (error) {
    console.warn('[match-detail-live-sync] No se pudo sincronizar detalle.', {
      fixtureExternalId,
      message: error instanceof Error ? error.message : String(error),
    })

    return jsonNoStore({
      ok: false,
      error: 'No se pudo sincronizar el detalle del partido.',
    })
  }
}
