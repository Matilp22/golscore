import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { syncHomeScoreboardMatches } from '@/server/prode/sync-matches'
import { getArgentinaTodayISO } from '@/shared/utils/argentina-time'

const MIN_SYNC_INTERVAL_MS = 45_000
const lastSyncByDate = new Map<string, number>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || getArgentinaTodayISO()
  const limitValue = Number(searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(limitValue) && limitValue > 0
    ? Math.min(Math.floor(limitValue), 20)
    : 20
  const now = Date.now()
  const lastSyncAt = lastSyncByDate.get(date) ?? 0

  if (now - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
    return NextResponse.json(
      {
        ok: true,
        throttled: true,
        reason: 'live sync throttled',
        date,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  lastSyncByDate.set(date, now)

  try {
    const result = await syncHomeScoreboardMatches(getSupabaseAdminClient(), {
      date,
      limit,
      liveOnly: true,
    })

    return NextResponse.json(
      {
        ok: true,
        throttled: false,
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
