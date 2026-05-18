import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  syncHomeFixtureCacheOnly,
  syncHomeScoreboardMatches,
} from '@/server/prode/sync-matches'
import { getArgentinaTodayISO } from '@/shared/utils/argentina-time'

const MIN_SYNC_INTERVAL_MS = 45_000
const lastSyncByDate = new Map<string, number>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || getArgentinaTodayISO()
  const catchup =
    searchParams.get('catchup') === '1' ||
    searchParams.get('catchup') === 'true'
  const limitValue = Number(searchParams.get('limit') ?? 20)
  const limit = catchup
    ? null
    : Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(Math.floor(limitValue), 20)
      : 20
  const syncKey = `${date}:${catchup ? 'catchup' : 'live'}`
  const now = Date.now()
  const lastSyncAt = lastSyncByDate.get(syncKey) ?? 0

  if (now - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return NextResponse.json(
      {
        ok: true,
        throttled: true,
        reason: 'live sync throttled',
        date,
        catchup,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  lastSyncByDate.set(syncKey, now)

  try {
    const syncOptions = {
      date,
      limit,
      liveOnly: true,
    }
    const result = catchup
      ? await syncHomeFixtureCacheOnly(getSupabaseAdminClient(), syncOptions)
      : await syncHomeScoreboardMatches(getSupabaseAdminClient(), syncOptions)

    return NextResponse.json(
      {
        ok: true,
        throttled: false,
        catchup,
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.warn('[home-live-sync] No se pudo sincronizar live.', {
      date,
      catchup,
      message: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudieron sincronizar los partidos en vivo.',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}
