import { NextResponse } from 'next/server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncMatchDetail } from '@/server/match-detail-cache'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const MIN_FAST_SYNC_INTERVAL_MS = 15_000
const MIN_FULL_SYNC_INTERVAL_MS = 60_000
const lastFastSyncByFixture = new Map<string, number>()
const lastFullSyncByFixture = new Map<string, number>()

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
  const lastFastSyncAt = lastFastSyncByFixture.get(syncKey) ?? 0

  if (now - lastFastSyncAt < MIN_FAST_SYNC_INTERVAL_MS) {
    return jsonNoStore({
      ok: true,
      throttled: true,
      reason: 'match detail sync throttled',
      fixtureExternalId,
      nextAllowedInMs: MIN_FAST_SYNC_INTERVAL_MS - (now - lastFastSyncAt),
    })
  }

  lastFastSyncByFixture.set(syncKey, now)

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

    const lastFullSyncAt = lastFullSyncByFixture.get(syncKey) ?? 0
    const shouldRunFullSync = now - lastFullSyncAt >= MIN_FULL_SYNC_INTERVAL_MS
    const sections = {
      fixture: true,
      events: true,
      lineups: shouldRunFullSync,
      statistics: shouldRunFullSync,
    }

    if (shouldRunFullSync) {
      lastFullSyncByFixture.set(syncKey, now)
    }

    const result = await syncMatchDetail(supabase, {
      fixtureExternalId,
      sections,
    })

    return jsonNoStore({
      ok: result.errors.length === 0,
      throttled: false,
      mode: 'match-detail-live-sync',
      fastSyncIntervalMs: MIN_FAST_SYNC_INTERVAL_MS,
      fullSyncIntervalMs: MIN_FULL_SYNC_INTERVAL_MS,
      fullSync: shouldRunFullSync,
      sections,
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
